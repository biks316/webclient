import {
  BikRequest,
  FileRef,
  JsonValue,
  RequestBody,
  RequestBodyType,
  RequestFormField,
  RequestGraphqlBody,
  RequestMultipartField,
  WorkspaceIndex,
} from "../types/bik";

export const BODY_TYPE_OPTIONS: Array<{ group: string; value: RequestBodyType; label: string }> = [
  { group: "FORM", value: "multipart", label: "Multipart Form" },
  { group: "FORM", value: "form-urlencoded", label: "Form URL Encoded" },
  { group: "RAW", value: "json", label: "JSON" },
  { group: "RAW", value: "xml", label: "XML" },
  { group: "RAW", value: "text", label: "Text" },
  { group: "RAW", value: "graphql", label: "GraphQL" },
  { group: "OTHER", value: "binary", label: "File / Binary" },
  { group: "OTHER", value: "none", label: "No Body" },
];

const BODY_TYPES = new Set<RequestBodyType>(BODY_TYPE_OPTIONS.map((option) => option.value));
const MAP_PLACEHOLDER = "->map";

export interface BodyPlaceholderField {
  path: string;
  label: string;
  value: string;
}

export function createRequestBody(type: RequestBodyType = "json"): RequestBody {
  switch (type) {
    case "none":
      return { type: "none" };
    case "json":
      return { type: "json", raw: "" };
    case "xml":
      return { type: "xml", raw: "" };
    case "text":
      return { type: "text", raw: "" };
    case "form-urlencoded":
      return { type: "form-urlencoded", form: [] };
    case "multipart":
      return { type: "multipart", multipart: [] };
    case "binary":
      return { type: "binary", binary: null };
    case "graphql":
      return { type: "graphql", graphql: { query: "", variables: "{\n  \n}" } };
    default:
      return { type: "json", raw: "" };
  }
}

export function normalizeRequestBody(input: unknown): RequestBody {
  if (isRequestBody(input)) {
    return normalizeStructuredBody(input);
  }
  return legacyJsonBody(input as JsonValue);
}

export function normalizeRequest(request: BikRequest): BikRequest {
  return { ...request, body: normalizeRequestBody((request as unknown as { body: unknown }).body) };
}

export function normalizeWorkspaceRequests(workspace: WorkspaceIndex): WorkspaceIndex {
  return {
    ...workspace,
    collections: workspace.collections.map((collection) => ({
      ...collection,
      endpoints: collection.endpoints.map((endpoint) => ({
        ...endpoint,
        request: normalizeRequest(endpoint.request),
      })),
    })),
  };
}

export function bodyTypeLabel(type: RequestBodyType) {
  return BODY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function bodySupportsEditor(type: RequestBodyType) {
  return type !== "none";
}

export function getBodyType(body: RequestBody | null | undefined): RequestBodyType {
  return body?.type ?? "none";
}

export function bodyHasContent(body: RequestBody): boolean {
  switch (body.type) {
    case "none":
      return false;
    case "json":
    case "xml":
    case "text":
      return Boolean(body.raw?.trim());
    case "graphql":
      return Boolean(body.graphql?.query.trim() || body.graphql?.variables.trim());
    case "form-urlencoded":
      return (body.form ?? []).some((field) => field.enabled && field.key.trim());
    case "multipart":
      return (body.multipart ?? []).some((field) => field.enabled && field.key.trim());
    case "binary":
      return Boolean(body.binary?.path);
    default:
      return false;
  }
}

export function validateRequestBody(body: RequestBody): string | null {
  switch (body.type) {
    case "json":
      if (!body.raw?.trim()) {
        return null;
      }
      try {
        JSON.parse(body.raw);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Invalid JSON";
      }
    case "graphql":
      if (!body.graphql?.variables.trim()) {
        return null;
      }
      try {
        JSON.parse(body.graphql.variables);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Invalid GraphQL variables JSON";
      }
    default:
      return null;
  }
}

export function parseJsonBody(body: RequestBody): JsonValue {
  if (body.type !== "json") {
    return null;
  }
  if (!body.raw?.trim()) {
    return null;
  }
  try {
    return JSON.parse(body.raw) as JsonValue;
  } catch {
    return null;
  }
}

export function parseGraphqlVariables(body: RequestBody): JsonValue {
  if (body.type !== "graphql") {
    return null;
  }
  if (!body.graphql?.variables.trim()) {
    return null;
  }
  try {
    return JSON.parse(body.graphql.variables) as JsonValue;
  } catch {
    return null;
  }
}

export function formatJsonBody(raw: string) {
  if (!raw.trim()) {
    return "";
  }
  return JSON.stringify(JSON.parse(raw), null, 2);
}

export function formatXmlBody(raw: string) {
  const compact = raw.trim();
  if (!compact) {
    return "";
  }
  const tokens = compact.replace(/>\s+</g, "><").split(/(?=<)|(?<=>)/).filter(Boolean);
  let indent = 0;
  const lines = tokens.map((token) => {
    const trimmed = token.trim();
    if (/^<\//.test(trimmed)) {
      indent = Math.max(indent - 1, 0);
    }
    const line = `${"  ".repeat(indent)}${trimmed}`;
    if (/^<[^!?/][^>]*[^/]?>$/.test(trimmed) && !trimmed.includes(`</`)) {
      indent += 1;
    }
    return line;
  });
  return lines.join("\n");
}

export function getBodySearchText(body: RequestBody): string {
  switch (body.type) {
    case "json":
    case "xml":
    case "text":
      return body.raw ?? "";
    case "form-urlencoded":
      return JSON.stringify(body.form ?? []);
    case "multipart":
      return JSON.stringify(body.multipart ?? []);
    case "binary":
      return JSON.stringify(body.binary ?? null);
    case "graphql":
      return `${body.graphql?.query ?? ""}\n${body.graphql?.variables ?? ""}`;
    case "none":
    default:
      return "";
  }
}

export function findRequestBodyPlaceholders(body: RequestBody): BodyPlaceholderField[] {
  switch (body.type) {
    case "json":
      return walkJsonPlaceholders(safeParseJson(body.raw ?? ""), "body");
    case "xml":
    case "text":
      return findRawPlaceholders(body.raw ?? "");
    case "form-urlencoded":
      return (body.form ?? [])
        .flatMap((field, index) => isMapPlaceholder(field.value)
          ? [{ path: `body.form.${index}.value`, label: field.key || `field ${index + 1}`, value: field.value }]
          : []);
    case "multipart":
      return (body.multipart ?? [])
        .flatMap((field, index) => field.kind === "text" && isMapPlaceholder(field.value)
          ? [{ path: `body.multipart.${index}.value`, label: field.key || `field ${index + 1}`, value: field.value ?? "" }]
          : []);
    case "graphql":
      return walkJsonPlaceholders(safeParseJson(body.graphql?.variables ?? ""), "body.graphql.variables");
    case "binary":
    case "none":
    default:
      return [];
  }
}

export function isMapPlaceholder(value: unknown) {
  return typeof value === "string" && value.trim() === MAP_PLACEHOLDER;
}

export function replaceRequestBodyPlaceholder(body: RequestBody, path: string, value: string): RequestBody {
  const normalized = normalizeRequestBody(body);
  if (path.startsWith("body.raw.")) {
    const index = Number(path.slice("body.raw.".length));
    if (normalized.type === "xml" || normalized.type === "text") {
      return { ...normalized, raw: replacePlaceholderOccurrence(normalized.raw ?? "", index, value) };
    }
    return normalized;
  }
  if (path.startsWith("body.form.")) {
    const [, , indexRaw] = path.split(".");
    const index = Number(indexRaw);
    if (normalized.type !== "form-urlencoded") {
      return normalized;
    }
    return {
      ...normalized,
      form: (normalized.form ?? []).map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, value } : field,
      ),
    };
  }
  if (path.startsWith("body.multipart.")) {
    const [, , indexRaw] = path.split(".");
    const index = Number(indexRaw);
    if (normalized.type !== "multipart") {
      return normalized;
    }
    return {
      ...normalized,
      multipart: (normalized.multipart ?? []).map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, value } : field,
      ),
    };
  }
  if (path.startsWith("body.graphql.variables.")) {
    if (normalized.type !== "graphql") {
      return normalized;
    }
    const variables = safeParseJson(normalized.graphql?.variables ?? "");
    const next = ensureObject(variables);
    setJsonByPath(next, path.slice("body.graphql.variables.".length).split("."), value);
    return {
      ...normalized,
      graphql: {
        query: normalized.graphql?.query ?? "",
        variables: JSON.stringify(next, null, 2),
      },
    };
  }
  if (path.startsWith("body.")) {
    const next = ensureObject(safeParseJson(normalized.type === "json" ? normalized.raw ?? "" : ""));
    setJsonByPath(next, path.slice("body.".length).split("."), value);
    return {
      type: "json",
      raw: JSON.stringify(next, null, 2),
    };
  }
  return normalized;
}

export function buildCurlBody(body: RequestBody): string | null {
  switch (body.type) {
    case "none":
      return null;
    case "json":
    case "xml":
    case "text":
      return body.raw?.trim() ? body.raw : null;
    case "graphql":
      return JSON.stringify({
        query: body.graphql?.query ?? "",
        variables: safeParseJson(body.graphql?.variables ?? ""),
      });
    case "form-urlencoded":
      return new URLSearchParams(
        (body.form ?? [])
          .filter((field) => field.enabled && field.key.trim())
          .map((field) => [field.key, field.value]),
      ).toString();
    case "multipart":
      return (body.multipart ?? [])
        .filter((field) => field.enabled && field.key.trim())
        .map((field) => `${field.key}=${field.kind === "file" ? field.file?.path ?? "" : field.value ?? ""}`)
        .join("&");
    case "binary":
      return body.binary?.path ?? null;
    default:
      return null;
  }
}

export function defaultContentType(body: RequestBody): string | null {
  switch (body.type) {
    case "json":
      return "application/json";
    case "xml":
      return "application/xml";
    case "text":
      return "text/plain";
    case "form-urlencoded":
      return "application/x-www-form-urlencoded";
    case "graphql":
      return "application/json";
    case "binary":
      return body.binary?.mimeType ?? "application/octet-stream";
    default:
      return null;
  }
}

export function bodyUsesTable(type: RequestBodyType) {
  return type === "form-urlencoded" || type === "multipart";
}

export function emptyFormField(): RequestFormField {
  return { enabled: true, key: "", value: "", description: "" };
}

export function emptyMultipartField(): RequestMultipartField {
  return { enabled: true, key: "", kind: "text", value: "", description: "" };
}

export function createFileRef(path: string): FileRef {
  const name = path.split(/[\\/]/).pop() ?? path;
  return { path, name, size: null, mimeType: null };
}

function normalizeStructuredBody(body: RequestBody): RequestBody {
  switch (body.type) {
    case "none":
      return { type: "none" };
    case "json":
    case "xml":
    case "text":
      return { type: body.type, raw: body.raw ?? "" };
    case "form-urlencoded":
      return { type: "form-urlencoded", form: body.form ?? [] };
    case "multipart":
      return { type: "multipart", multipart: body.multipart ?? [] };
    case "binary":
      return { type: "binary", binary: body.binary ?? null };
    case "graphql":
      return {
        type: "graphql",
        graphql: {
          query: body.graphql?.query ?? "",
          variables: body.graphql?.variables ?? "{\n  \n}",
        },
      };
    default:
      return { type: "json", raw: "" };
  }
}

function legacyJsonBody(value: JsonValue): RequestBody {
  if (value === null) {
    return { type: "none" };
  }
  return {
    type: "json",
    raw: JSON.stringify(value, null, 2),
  };
}

function isRequestBody(value: unknown): value is RequestBody {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in (value as Record<string, unknown>) &&
    BODY_TYPES.has((value as RequestBody).type),
  );
}

function safeParseJson(raw: string): JsonValue {
  if (!raw.trim()) {
    return null;
  }
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return null;
  }
}

function ensureObject(value: JsonValue): Record<string, JsonValue> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, JsonValue>) };
  }
  return {};
}

function setJsonByPath(target: Record<string, JsonValue>, parts: string[], value: string) {
  let current: Record<string, JsonValue> = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }
    const existing = current[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, JsonValue>;
  });
}

function walkJsonPlaceholders(value: JsonValue, basePath: string): BodyPlaceholderField[] {
  if (isMapPlaceholder(value)) {
    const label = basePath.split(".").pop() ?? basePath;
    return [{ path: basePath, label, value: MAP_PLACEHOLDER }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => walkJsonPlaceholders(item, `${basePath}.${index}`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => walkJsonPlaceholders(item, `${basePath}.${key}`));
  }
  return [];
}

function findRawPlaceholders(raw: string): BodyPlaceholderField[] {
  const matches = [...raw.matchAll(/->map/g)];
  return matches.map((match, index) => ({
    path: `body.raw.${index}`,
    label: `placeholder ${index + 1}`,
    value: match[0],
  }));
}

function replacePlaceholderOccurrence(raw: string, index: number, nextValue: string) {
  let seen = -1;
  return raw.replace(/->map/g, (match) => {
    seen += 1;
    return seen === index ? nextValue : match;
  });
}
