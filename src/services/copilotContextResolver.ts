import { CollectionIndex, RunResponse, VariableFile, WorkspaceIndex } from "../types/bik";
import {
  CopilotContextReference,
  CopilotResolvedCollectionContext,
  CopilotResolvedContext,
  CopilotResolvedEnvironmentContext,
  CopilotResolvedFileContext,
  CopilotResolvedFlowContext,
  CopilotResolvedRequestContext,
  CopilotResolvedResponseContext,
  CopilotResolvedSchemaContext,
} from "../types/copilot";
import { CopilotTextFileEntry } from "./copilotContextIndex";
import { buildCurlBody } from "./requestBody";

interface ResolveCopilotContextArgs {
  prompt: string;
  references: CopilotContextReference[];
  workspace: WorkspaceIndex | null;
  selectedCollection: CollectionIndex | null;
  selectedEnvironment: VariableFile | null;
  response: RunResponse | null;
  responseError: string | null;
  textFiles: CopilotTextFileEntry[];
}

const SECRET_KEY_PATTERN = /(secret|token|password|passwd|api[_-]?key|client[_-]?secret|auth|bearer|cookie|session|jwt|private)/i;
const MAX_TEXT_LENGTH = 3_500;
const MAX_BODY_LENGTH = 2_000;

function truncate(value: string | null | undefined, limit = MAX_TEXT_LENGTH) {
  if (!value) {
    return "";
  }
  return value.length <= limit ? value : `${value.slice(0, limit)}\n...[truncated]`;
}

function sanitizeHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !SECRET_KEY_PATTERN.test(key)),
  );
}

function sanitizeVariables(values: Record<string, string>) {
  return Object.keys(values).filter((key) => !SECRET_KEY_PATTERN.test(key));
}

function sanitizeBody(value: string | undefined | null) {
  return truncate(value, MAX_BODY_LENGTH);
}

function promptKeywords(prompt: string) {
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 3);
}

function selectRelevantMarkdownSections(prompt: string, content: string) {
  const normalized = content.replace(/\r\n/g, "\n");
  const sections = normalized.split(/\n(?=#{1,6}\s)/g);
  if (sections.length <= 1) {
    return truncate(normalized);
  }
  const keywords = promptKeywords(prompt);
  const scored = sections.map((section) => {
    const lower = section.toLowerCase();
    const score = keywords.reduce((total, keyword) => total + (lower.includes(keyword) ? 1 : 0), 0);
    return { section, score };
  });
  const selected = scored
    .sort((left, right) => right.score - left.score || left.section.length - right.section.length)
    .filter((entry, index) => entry.score > 0 || index === 0)
    .slice(0, 3)
    .map((entry) => entry.section.trim())
    .filter(Boolean)
    .join("\n\n");
  return truncate(selected || normalized);
}

function fileHeadings(content: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => /^#{1,6}\s/.test(line))
    .slice(0, 12)
    .map((line) => line.replace(/^#{1,6}\s*/, "").trim());
}

export function resolveCopilotContext({
  prompt,
  references,
  workspace,
  selectedCollection,
  selectedEnvironment,
  response,
  responseError,
  textFiles,
}: ResolveCopilotContextArgs): CopilotResolvedContext {
  const requests: CopilotResolvedRequestContext[] = [];
  const collections: CopilotResolvedCollectionContext[] = [];
  const flows: CopilotResolvedFlowContext[] = [];
  const files: CopilotResolvedFileContext[] = [];
  const schemas: CopilotResolvedSchemaContext[] = [];
  const responses: CopilotResolvedResponseContext[] = [];
  const environments: CopilotResolvedEnvironmentContext[] = [];

  const textFileMap = new Map(textFiles.map((entry) => [entry.path, entry]));

  references.forEach((reference) => {
    switch (reference.type) {
      case "request": {
        const collection = workspace?.collections.find((item) => item.id === reference.collectionId) ?? null;
        const endpoint = collection?.endpoints.find((item) => item.id === reference.id) ?? null;
        if (!collection || !endpoint) {
          return;
        }
        requests.push({
          id: endpoint.id,
          collectionId: collection.id,
          collectionName: collection.name,
          label: reference.label,
          method: endpoint.request.method.toUpperCase(),
          url: endpoint.request.url,
          headers: sanitizeHeaders(endpoint.request.headers),
          queryParams: sanitizeHeaders(endpoint.request.queryParams),
          body: sanitizeBody(buildCurlBody(endpoint.request.body)),
        });
        return;
      }
      case "collection": {
        const collection = workspace?.collections.find((item) => item.id === reference.id) ?? null;
        if (!collection) {
          return;
        }
        collections.push({
          id: collection.id,
          label: collection.name,
          path: collection.path,
          variables: sanitizeVariables(collection.variables),
          requestIds: collection.endpoints.map((item) => item.id),
          flowIds: collection.flows.map((item) => item.id),
          requests: collection.endpoints.map((item) => ({
            id: item.id,
            name: item.name,
            method: item.request.method.toUpperCase(),
            url: item.request.url,
          })),
          flows: collection.flows.map((item) => ({
            id: item.id,
            name: item.name,
            nodeCount: item.flow.nodes.length,
          })),
        });
        return;
      }
      case "flow": {
        const collection = workspace?.collections.find((item) => item.id === reference.collectionId) ?? null;
        const flow = collection?.flows.find((item) => item.id === reference.id) ?? null;
        if (!collection || !flow) {
          return;
        }
        flows.push({
          id: flow.id,
          collectionId: collection.id,
          collectionName: collection.name,
          label: flow.name,
          path: flow.path,
          nodes: flow.flow.nodes.map((node) => ({
            id: node.id,
            name: node.name,
            requestId: node.requestId,
            status: node.lastRun?.status === "success" ? "success" : node.lastRun?.status === "failed" ? "failed" : "idle",
          })),
          edges: flow.flow.edges.map((edge) => ({
            id: edge.id,
            from: edge.from,
            to: edge.to,
            mappingCount: edge.mappings.length,
          })),
        });
        return;
      }
      case "flow-node": {
        const collection = workspace?.collections.find((item) => item.id === reference.collectionId) ?? null;
        const flow = collection?.flows.find((item) => item.id === reference.flowId) ?? null;
        const node = flow?.flow.nodes.find((item) => item.id === reference.id) ?? null;
        if (!collection || !flow || !node) {
          return;
        }
        flows.push({
          id: `${flow.id}:${node.id}`,
          collectionId: collection.id,
          collectionName: collection.name,
          label: `${flow.name} / ${node.name}`,
          path: flow.path,
          nodes: [{
            id: node.id,
            name: node.name,
            requestId: node.requestId,
            status: node.lastRun?.status === "success" ? "success" : node.lastRun?.status === "failed" ? "failed" : "idle",
          }],
          edges: flow.flow.edges
            .filter((edge) => edge.from === node.id || edge.to === node.id)
            .map((edge) => ({
              id: edge.id,
              from: edge.from,
              to: edge.to,
              mappingCount: edge.mappings.length,
            })),
        });
        return;
      }
      case "file": {
        const file = textFileMap.get(reference.path);
        if (!file) {
          return;
        }
        files.push({
          path: reference.path,
          label: reference.label,
          content: selectRelevantMarkdownSections(prompt, file.content),
          headings: fileHeadings(file.content),
        });
        return;
      }
      case "schema": {
        const file = textFileMap.get(reference.path);
        if (!file) {
          return;
        }
        schemas.push({
          path: reference.path,
          label: reference.label,
          content: truncate(file.content),
        });
        return;
      }
      case "environment": {
        const environment = workspace?.environments.find((item) => item.id === reference.id)
          ?? (selectedEnvironment?.id === reference.id ? selectedEnvironment : null);
        if (!environment) {
          return;
        }
        environments.push({
          id: environment.id,
          label: environment.name,
          variableKeys: sanitizeVariables(environment.variables),
        });
        return;
      }
      case "response": {
        if (!response) {
          return;
        }
        responses.push({
          id: reference.id,
          label: reference.label,
          status: response.status,
          statusText: response.statusText,
          sentAt: response.sentAt,
          headers: sanitizeHeaders(response.headers),
          body: truncate(response.body, MAX_BODY_LENGTH),
        });
      }
    }
  });

  if (responseError && response) {
    responses.push({
      id: `response-error:${response.sentAt}`,
      label: "Latest response error",
      status: response.status,
      statusText: response.statusText,
      sentAt: response.sentAt,
      headers: sanitizeHeaders(response.headers),
      body: truncate(`${response.body}\n\nError: ${responseError}`, MAX_BODY_LENGTH),
    });
  }

  return {
    requests,
    collections,
    flows,
    files,
    schemas,
    responses,
    environments,
  };
}
