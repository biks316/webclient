import { WorkspaceIndex } from "../types/bik";
import {
  CopilotBuildOperation,
  CopilotBuildPlan,
  CopilotCreateEndpointOperation,
} from "../types/copilot";

const MAX_OPERATIONS = 20;
const MAX_NAME_LENGTH = 160;
const MAX_URL_LENGTH = 4_096;
const MAX_BODY_LENGTH = 100_000;
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export const BUILD_MODE_SYSTEM_INSTRUCTIONS = `
You are in BikAPI Build mode. Extract a small, safe creation plan from only the user's latest request.
Return only one valid JSON object with two root properties: message (a concise string) and operations (an array). Never use markdown.
A collection operation has type create_collection and name.
Every endpoint operation has type create_endpoint, collectionName, name, method, url, headers, queryParams, and an optional body.

Rules:
- The only allowed operations are create_collection and create_endpoint.
- Never plan deletion, renaming, modification, request execution, shell commands, or file edits.
- Copy or derive real values from the user's request. Never emit literal schema placeholders such as "name", "path", "URL", or "Collection name".
- Use the exact collection name from workspace context when the user says "current", "selected", or "this collection".
- When creating a collection and requests inside it, put create_collection first, then its create_endpoint operations.
- Every endpoint needs collectionName, name, method, and url. Ask a concise question and return an empty operations array if required details cannot be safely inferred.
- Allowed methods are GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS.
- Repeat all required properties on every endpoint. Use empty objects for omitted headers and queryParams.
- A body belongs only to the endpoint for which the user specified it. GET and HEAD requests have no body.
- If the user is asking a question rather than asking to create something, answer briefly in message and return an empty operations array.
- Do not say that you executed the plan. BikAPI will show the plan and require confirmation.
`.trim();

export interface CopilotBuildParseResult {
  message: string;
  plan: CopilotBuildPlan | null;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function nonEmptyString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
  return normalized;
}

function optionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length > maxLength) {
      throw new Error("Request body is too long.");
    }
    return normalized || undefined;
  }
  if (isRecord(value) || Array.isArray(value)) {
    const normalized = JSON.stringify(value, null, 2);
    if (normalized.length > maxLength) {
      throw new Error("Request body is too long.");
    }
    return normalized;
  }
  throw new Error("Request body must be text or JSON.");
}

function stringMap(value: unknown, label: string) {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const entries = Object.entries(value);
  if (entries.length > 100) {
    throw new Error(`${label} contains too many entries.`);
  }

  const result: Record<string, string> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    if (!key || key.length > 256) {
      throw new Error(`${label} contains an invalid key.`);
    }
    if (!["string", "number", "boolean"].includes(typeof rawValue)) {
      throw new Error(`${label}.${key} must be a string, number, or boolean.`);
    }
    const normalizedValue = String(rawValue);
    if (normalizedValue.length > 10_000) {
      throw new Error(`${label}.${key} is too long.`);
    }
    result[key] = normalizedValue;
  }
  return result;
}

function operationType(value: unknown, operation?: Record<string, unknown>) {
  if (value === "create_collection" || value === "createCollection") {
    return "create_collection" as const;
  }
  if (value === "create_endpoint" || value === "createEndpoint" || value === "create_request") {
    return "create_endpoint" as const;
  }
  if (value !== undefined && value !== null && value !== "") {
    throw new Error(`Unsupported Build operation: ${String(value)}.`);
  }
  if (operation) {
    const hasEndpointField = [
      "collectionName",
      "collection_name",
      "collection",
      "endpointName",
      "requestName",
      "method",
      "url",
      "headers",
      "queryParams",
      "query_params",
      "body",
    ].some((key) => operation[key] !== undefined);
    if (hasEndpointField) {
      return "create_endpoint" as const;
    }
    if (operation.name !== undefined) {
      return "create_collection" as const;
    }
  }
  throw new Error("Build operation type is required.");
}

function operationTypeOrNull(value: unknown, operation?: Record<string, unknown>) {
  try {
    return operationType(value, operation);
  } catch {
    return null;
  }
}

function methodFromName(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim().match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i)?.[1];
}

function endpointNameFromUrl(method: string, value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  try {
    const url = new URL(value, "http://bikapi.local");
    return `${method} ${url.pathname || "/"}`;
  } catch {
    return `${method} request`;
  }
}

function normalizeOperation(
  value: unknown,
  index: number,
  fallbackCollectionName?: string,
): CopilotBuildOperation {
  if (!isRecord(value)) {
    throw new Error(`Operation ${index + 1} must be an object.`);
  }

  const type = operationType(value.type, value);
  const id = `build-operation-${crypto.randomUUID()}`;
  if (type === "create_collection") {
    return {
      id,
      type,
      name: nonEmptyString(value.name ?? value.collectionName, "Collection name", MAX_NAME_LENGTH),
    };
  }

  const method = nonEmptyString(
    value.method ?? methodFromName(value.name),
    "Endpoint method",
    16,
  ).toUpperCase();
  if (!HTTP_METHODS.has(method)) {
    throw new Error(`Unsupported HTTP method: ${method}.`);
  }

  return {
    id,
    type,
    collectionName: nonEmptyString(
      value.collectionName ?? value.collection_name ?? value.collection ?? fallbackCollectionName,
      "Endpoint collection name",
      MAX_NAME_LENGTH,
    ),
    name: nonEmptyString(
      value.name ?? value.endpointName ?? value.requestName ?? endpointNameFromUrl(method, value.url),
      "Endpoint name",
      MAX_NAME_LENGTH,
    ),
    method,
    url: nonEmptyString(value.url, "Endpoint URL", MAX_URL_LENGTH),
    headers: stringMap(value.headers, "Endpoint headers"),
    queryParams: stringMap(value.queryParams ?? value.query_params, "Endpoint query parameters"),
    body: method === "GET" || method === "HEAD" ? undefined : optionalString(value.body, MAX_BODY_LENGTH),
  };
}

function jsonCandidates(content: string) {
  const trimmed = content.trim();
  const candidates = [trimmed];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of trimmed.matchAll(fenced)) {
    if (match[1]?.trim()) {
      candidates.push(match[1].trim());
    }
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  return [...new Set(candidates)];
}

function parseResponseObject(content: string) {
  for (const candidate of jsonCandidates(content)) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isRecord(parsed)) {
        return parsed;
      }
    } catch {
      // Try the next candidate. Models sometimes wrap JSON in a short explanation.
    }
  }
  return null;
}

export function parseCopilotBuildResponse(
  content: string,
  currentCollectionName?: string | null,
): CopilotBuildParseResult {
  const parsed = parseResponseObject(content);
  if (!parsed) {
    return {
      message: "I could not prepare a safe Build plan. Include the collection name and each endpoint's name, method, and URL, then try again.",
      plan: null,
      error: "The model did not return a valid Build plan.",
    };
  }

  const planObject = isRecord(parsed.plan) ? parsed.plan : parsed;
  const messageValue = parsed.message ?? planObject.message ?? planObject.summary;
  const message =
    typeof messageValue === "string" && messageValue.trim()
      ? messageValue.trim()
      : "Review the proposed Build plan.";
  const rawOperations = Array.isArray(planObject.operations)
    ? planObject.operations
    : operationTypeOrNull(planObject.type, planObject)
      ? [planObject]
      : null;
  if (!rawOperations) {
    return {
      message: "I could not prepare a safe Build plan. Include the collection name and each endpoint's name, method, and URL, then try again.",
      plan: null,
      error: "The Build response did not include an operations array.",
    };
  }
  if (rawOperations.length === 0) {
    return { message, plan: null };
  }
  if (rawOperations.length > MAX_OPERATIONS) {
    return {
      message: `The proposed plan has more than ${MAX_OPERATIONS} operations. Ask for a smaller batch.`,
      plan: null,
      error: "The Build plan is too large.",
    };
  }

  try {
    const createdCollectionNames = rawOperations
      .filter(isRecord)
      .filter((operation) => operationTypeOrNull(operation.type, operation) === "create_collection")
      .map((operation) => operation.name ?? operation.collectionName)
      .filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
    const fallbackCollectionName = createdCollectionNames.length === 1
      ? createdCollectionNames[0].trim()
      : currentCollectionName?.trim() || undefined;
    const operations = rawOperations.map((operation, index) =>
      normalizeOperation(operation, index, fallbackCollectionName),
    );
    const planMessage = `I prepared ${operations.length === 1 ? "one change" : `${operations.length} changes`} for review. Confirm the Build plan to apply ${operations.length === 1 ? "it" : "them"}.`;
    return {
      message: planMessage,
      plan: {
        id: `build-plan-${crypto.randomUUID()}`,
        summary: planMessage,
        operations,
      },
    };
  } catch (error) {
    return {
      message: `I could not safely apply that plan: ${error instanceof Error ? error.message : String(error)}`,
      plan: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function cleanPromptName(value: string | undefined) {
  if (!value) {
    return null;
  }
  const name = value
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ");
  if (
    !name ||
    name.length > MAX_NAME_LENGTH ||
    /^(a|an|the|new)$/i.test(name) ||
    /^(with|containing|for|that)\b/i.test(name) ||
    /\b(endpoint|request)\b/i.test(name)
  ) {
    return null;
  }
  return name;
}

function explicitCollectionName(prompt: string) {
  const verb = "(?:create|add|make|build|generate|set\\s*up)";
  const afterCollection = new RegExp(
    `\\b${verb}\\s+(?:an?\\s+|the\\s+)?(?:new\\s+)?collection\\s+(?:called\\s+|named\\s+)?[\"'“]?([^\"'”',.;\\n]+?)[\"'”]?(?=\\s+(?:with|containing|that\\s+has)\\b|[,.;\\n]|$)`,
    "i",
  );
  const beforeCollection = new RegExp(
    `\\b${verb}\\s+(?:an?\\s+|the\\s+)?(?:new\\s+)?[\"'“]?([^\"'”',.;\\n]+?)[\"'”]?\\s+collection\\b`,
    "i",
  );
  return cleanPromptName(prompt.match(afterCollection)?.[1])
    ?? cleanPromptName(prompt.match(beforeCollection)?.[1]);
}

function explicitTargetCollectionName(prompt: string) {
  const collectionFirst = /\b(?:in|inside|into|to)\s+(?:the\s+)?collection\s+(?:called\s+|named\s+)?["'“]?([^"'”',.;\n]+?)["'”]?(?=\s+(?:with|and)\b|[,.;\n]|$)/i;
  const collectionLast = /\b(?:in|inside|into|to)\s+(?:the\s+)?["'“]?([^"'”',.;\n]+?)["'”]?\s+collection\b/i;
  const name = cleanPromptName(prompt.match(collectionFirst)?.[1])
    ?? cleanPromptName(prompt.match(collectionLast)?.[1]);
  return name && !/^(current|selected|this)$/i.test(name) ? name : null;
}

function trimPromptUrl(value: string) {
  return value.trim().replace(/[),.;]+$/g, "");
}

function urlFromSegment(segment: string, allUrls: string[], previousUrl: string | null) {
  const absoluteUrl = segment.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  if (absoluteUrl) {
    return trimPromptUrl(absoluteUrl);
  }
  if (/\bsame\s+(?:url|endpoint|address)\b/i.test(segment) && previousUrl) {
    return previousUrl;
  }
  const relativeUrl = segment.match(/(?:\b(?:at|to|url)\s+|^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+)(\/[A-Za-z0-9_~!$&'()*+,;=:@%./?{}-]+)/i)?.[1];
  if (relativeUrl) {
    return trimPromptUrl(relativeUrl);
  }
  return allUrls.length === 1 ? allUrls[0] : null;
}

function endpointNameFromSegment(segment: string, method: string, url: string) {
  let candidate = segment.slice(method.length);
  const absoluteUrlIndex = candidate.search(/https?:\/\//i);
  if (absoluteUrlIndex >= 0) {
    candidate = candidate.slice(0, absoluteUrlIndex);
  }
  const detailMarker = candidate.search(/\b(?:at|to|with|using|url)\b/i);
  if (detailMarker >= 0) {
    candidate = candidate.slice(0, detailMarker);
  }
  candidate = candidate
    .replace(/^[\s,:;-]*(?:an?\s+)?/, "")
    .replace(/^(?:endpoint|request)\s+(?:called|named)\s+/i, "")
    .replace(/^(?:called|named|for)\s+/i, "")
    .replace(/\s+(?:endpoint|request)\s*$/i, "")
    .replace(/[\s,:;-]+$/g, "")
    .trim();

  if (candidate && !candidate.startsWith("/") && candidate.length <= MAX_NAME_LENGTH) {
    return candidate;
  }
  return endpointNameFromUrl(method, url) ?? `${method} request`;
}

function bodyFromSegment(segment: string) {
  const marker = /\b(?:json\s+)?body\b\s*(?::|is\b|of\b)?\s*/i.exec(segment);
  if (!marker?.index && marker?.index !== 0) {
    return undefined;
  }
  const remainder = segment.slice(marker.index + marker[0].length).trim();
  if (!remainder) {
    return undefined;
  }
  if (remainder.startsWith("{")) {
    const end = remainder.lastIndexOf("}");
    return end >= 0 ? remainder.slice(0, end + 1) : undefined;
  }
  if (remainder.startsWith("[")) {
    const end = remainder.lastIndexOf("]");
    return end >= 0 ? remainder.slice(0, end + 1) : undefined;
  }
  return remainder.replace(/[.;]\s*$/g, "").trim() || undefined;
}

export function parseExplicitBuildPrompt(
  prompt: string,
  currentCollectionName?: string | null,
): CopilotBuildPlan | null {
  if (
    !/\b(create|add|make|build|generate|set\s*up)\b/i.test(prompt) ||
    /^\s*(?:how|can|could|should|would|what|why|is|are|do|does)\b[\s\S]*\?\s*$/i.test(prompt)
  ) {
    return null;
  }

  const collectionName = explicitCollectionName(prompt);
  const methodPattern = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gi;
  const methodMatches = [...prompt.matchAll(methodPattern)];
  if (methodMatches.length === 0) {
    if (!collectionName || /\b(?:endpoint|request)s?\b/i.test(prompt)) {
      return null;
    }
    const operation: CopilotBuildOperation = {
      id: `build-operation-${crypto.randomUUID()}`,
      type: "create_collection",
      name: collectionName,
    };
    const message = `I prepared a new collection named “${collectionName}”. Confirm the Build plan to create it.`;
    return {
      id: `build-plan-${crypto.randomUUID()}`,
      summary: message,
      operations: [operation],
    };
  }

  if (/\b(headers?|query\s+(?:params?|parameters?)|authentication|authorization|scripts?|variables?)\b/i.test(prompt)) {
    return null;
  }

  if (methodMatches.length + (collectionName ? 1 : 0) > MAX_OPERATIONS) {
    return null;
  }
  const targetCollectionName = collectionName
    ?? explicitTargetCollectionName(prompt)
    ?? currentCollectionName?.trim()
    ?? null;
  if (!targetCollectionName) {
    return null;
  }

  const allUrls = [...prompt.matchAll(/https?:\/\/[^\s"'<>]+/gi)]
    .map((match) => trimPromptUrl(match[0]));
  const endpointOperations: CopilotBuildOperation[] = [];
  let previousUrl: string | null = null;
  for (let index = 0; index < methodMatches.length; index += 1) {
    const match = methodMatches[index];
    const start = match.index ?? 0;
    const end = methodMatches[index + 1]?.index ?? prompt.length;
    const segment = prompt.slice(start, end);
    const method = match[1].toUpperCase();
    const url = urlFromSegment(segment, allUrls, previousUrl);
    if (!url) {
      return null;
    }
    previousUrl = url;
    const body = method === "GET" || method === "HEAD" ? undefined : bodyFromSegment(segment);
    endpointOperations.push({
      id: `build-operation-${crypto.randomUUID()}`,
      type: "create_endpoint",
      collectionName: targetCollectionName,
      name: endpointNameFromSegment(segment, method, url),
      method,
      url,
      headers: {},
      queryParams: {},
      body,
    });
  }

  const operations: CopilotBuildOperation[] = [
    ...(collectionName
      ? [{
          id: `build-operation-${crypto.randomUUID()}`,
          type: "create_collection" as const,
          name: collectionName,
        }]
      : []),
    ...endpointOperations,
  ];
  const message = `I prepared ${operations.length === 1 ? "one change" : `${operations.length} changes`} for “${targetCollectionName}”. Review and confirm the Build plan to apply ${operations.length === 1 ? "it" : "them"}.`;
  return {
    id: `build-plan-${crypto.randomUUID()}`,
    summary: message,
    operations,
  };
}

export function buildOperationLabel(operation: CopilotBuildOperation) {
  if (operation.type === "create_collection") {
    return `Create collection “${operation.name}”`;
  }
  return `Create ${operation.method} request “${operation.name}” in “${operation.collectionName}”`;
}

function normalizedName(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function validateBuildPlanAgainstWorkspace(plan: CopilotBuildPlan, workspace: WorkspaceIndex) {
  if (!Array.isArray(plan.operations) || plan.operations.length === 0) {
    return "The Build plan does not contain any operations.";
  }
  if (plan.operations.length > MAX_OPERATIONS) {
    return `The Build plan cannot contain more than ${MAX_OPERATIONS} operations.`;
  }

  const collections = new Map<string, Set<string>>();
  for (const collection of workspace.collections) {
    collections.set(
      normalizedName(collection.name),
      new Set(collection.endpoints.map((endpoint) => normalizedName(endpoint.name))),
    );
  }

  for (const operation of plan.operations) {
    if (!isRecord(operation)) {
      return "The Build plan contains an invalid operation.";
    }
    if (operation.type === "create_collection") {
      if (typeof operation.name !== "string" || !operation.name.trim()) {
        return "A collection operation is missing its name.";
      }
      const collectionKey = normalizedName(operation.name);
      if (collections.has(collectionKey)) {
        return `Collection “${operation.name}” already exists.`;
      }
      collections.set(collectionKey, new Set());
      continue;
    }

    if (operation.type !== "create_endpoint") {
      return `Unsupported Build operation: ${String(operation.type)}.`;
    }
    if (
      typeof operation.collectionName !== "string" ||
      !operation.collectionName.trim() ||
      typeof operation.name !== "string" ||
      !operation.name.trim() ||
      typeof operation.method !== "string" ||
      !HTTP_METHODS.has(operation.method.toUpperCase()) ||
      typeof operation.url !== "string" ||
      !operation.url.trim() ||
      !isStringRecord(operation.headers) ||
      !isStringRecord(operation.queryParams) ||
      (operation.body !== undefined && typeof operation.body !== "string")
    ) {
      return `Request “${typeof operation.name === "string" ? operation.name : "unknown"}” has invalid or missing fields.`;
    }

    const collectionKey = normalizedName(operation.collectionName);
    const endpointNames = collections.get(collectionKey);
    if (!endpointNames) {
      return `Collection “${operation.collectionName}” does not exist and is not created earlier in this plan.`;
    }
    const endpointKey = normalizedName(operation.name);
    if (endpointNames.has(endpointKey)) {
      return `Request “${operation.name}” already exists in collection “${operation.collectionName}”.`;
    }
    endpointNames.add(endpointKey);
  }

  return null;
}

export function isJsonBody(operation: CopilotCreateEndpointOperation) {
  if (!operation.body) {
    return false;
  }
  try {
    JSON.parse(operation.body);
    return true;
  } catch {
    return false;
  }
}
