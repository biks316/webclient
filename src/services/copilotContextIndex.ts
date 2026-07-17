import { CollectionIndex, FlowNode, RunResponse, VariableFile, WorkspaceIndex } from "../types/bik";
import {
  CollectionContextReference,
  CopilotContextReference,
  CopilotContextSearchItem,
  EnvironmentContextReference,
  FileContextReference,
  FlowContextReference,
  FlowNodeContextReference,
  RequestContextReference,
  ResponseContextReference,
  SchemaContextReference,
} from "../types/copilot";

export interface CopilotTextFileEntry {
  path: string;
  content: string;
}

interface BuildCopilotContextIndexArgs {
  workspace: WorkspaceIndex | null;
  selectedCollection: CollectionIndex | null;
  selectedEnvironment: VariableFile | null;
  selectedResponse: RunResponse | null;
  selectedRequestId: string | null;
  textFiles: CopilotTextFileEntry[];
}

function words(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9/._-]+/i)
    .filter(Boolean);
}

function itemKey(reference: CopilotContextReference) {
  return contextReferenceKey(reference);
}

function fileExtension(path: string) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index + 1).toLowerCase();
}

function fileName(path: string) {
  const normalized = path.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function contextReferenceKey(reference: CopilotContextReference) {
  switch (reference.type) {
    case "request":
    case "collection":
    case "flow":
    case "flow-node":
    case "environment":
    case "response":
      return `${reference.type}:${reference.id}`;
    case "file":
    case "schema":
      return `${reference.type}:${reference.path}`;
  }
}

export function cloneContextReference<T extends CopilotContextReference>(reference: T, pinned = reference.pinned): T {
  return { ...reference, pinned } as T;
}

export function toPinnedReference<T extends CopilotContextReference>(reference: T, pinned: boolean, source = reference.source): T {
  return { ...reference, pinned, source } as T;
}

export function dedupeContextReferences(references: CopilotContextReference[]) {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = contextReferenceKey(reference);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function createRequestReference(collection: CollectionIndex, endpoint: CollectionIndex["endpoints"][number], source: RequestContextReference["source"]): RequestContextReference {
  return {
    type: "request",
    id: endpoint.id,
    collectionId: collection.id,
    label: `${endpoint.request.method.toUpperCase()} ${endpoint.request.url || endpoint.name}`,
    method: endpoint.request.method.toUpperCase(),
    url: endpoint.request.url,
    path: endpoint.path,
    pinned: false,
    source,
    metadata: {
      endpointName: endpoint.name,
      collectionName: collection.name,
    },
  };
}

export function createCollectionReference(collection: CollectionIndex, source: CollectionContextReference["source"]): CollectionContextReference {
  return {
    type: "collection",
    id: collection.id,
    label: collection.name,
    path: collection.path,
    pinned: false,
    source,
    metadata: {
      requestCount: collection.endpoints.length,
      flowCount: collection.flows.length,
    },
  };
}

export function createFlowReference(collection: CollectionIndex, flow: CollectionIndex["flows"][number], source: FlowContextReference["source"]): FlowContextReference {
  return {
    type: "flow",
    id: flow.id,
    collectionId: collection.id,
    label: flow.name,
    path: flow.path,
    pinned: false,
    source,
    metadata: {
      collectionName: collection.name,
      nodeCount: flow.flow.nodes.length,
    },
  };
}

export function createFlowNodeReference(collection: CollectionIndex, flowId: string, node: FlowNode, source: FlowNodeContextReference["source"]): FlowNodeContextReference {
  return {
    type: "flow-node",
    id: node.id,
    flowId,
    collectionId: collection.id,
    requestId: node.requestId,
    label: node.name,
    pinned: false,
    source,
    metadata: {
      collectionName: collection.name,
      requestPath: node.requestPath,
    },
  };
}

export function createEnvironmentReference(environment: VariableFile, source: EnvironmentContextReference["source"]): EnvironmentContextReference {
  return {
    type: "environment",
    id: environment.id,
    label: environment.name,
    pinned: false,
    source,
    metadata: {
      variableCount: Object.keys(environment.variables).length,
    },
  };
}

export function createResponseReference(response: RunResponse, requestId: string | null, source: ResponseContextReference["source"]): ResponseContextReference {
  return {
    type: "response",
    id: `${requestId ?? "response"}:${response.sentAt}`,
    requestId,
    label: `Response ${response.status}`,
    status: response.status,
    sentAt: response.sentAt,
    pinned: false,
    source,
    metadata: {
      resolvedUrl: response.resolvedUrl,
      responseTimeMs: response.responseTimeMs,
    },
  };
}

export function createFileReference(path: string, source: FileContextReference["source"]): FileContextReference {
  return {
    type: "file",
    path,
    label: fileName(path),
    extension: fileExtension(path),
    pinned: false,
    source,
  };
}

export function createSchemaReference(path: string, source: SchemaContextReference["source"]): SchemaContextReference {
  const extension = fileExtension(path);
  return {
    type: "schema",
    path,
    label: fileName(path),
    format: extension === "json" ? "json" : extension === "yml" ? "yml" : "yaml",
    pinned: false,
    source,
  };
}

export function buildCopilotContextIndex({
  workspace,
  selectedCollection,
  selectedEnvironment,
  selectedResponse,
  selectedRequestId,
  textFiles,
}: BuildCopilotContextIndexArgs) {
  const items: CopilotContextSearchItem[] = [];

  if (workspace) {
    workspace.collections.forEach((collection) => {
      const collectionReference = createCollectionReference(collection, "picker");
      items.push({
        key: itemKey(collectionReference),
        title: collection.name,
        subtitle: `${collection.endpoints.length} requests · ${collection.flows.length} flows`,
        keywords: words(`${collection.name} collection ${collection.path}`),
        reference: collectionReference,
      });

      collection.endpoints.forEach((endpoint) => {
        const reference = createRequestReference(collection, endpoint, "picker");
        items.push({
          key: itemKey(reference),
          title: endpoint.name,
          subtitle: `${reference.method} ${endpoint.request.url}`,
          keywords: words(`${endpoint.name} ${reference.method} ${endpoint.request.url} ${collection.name}`),
          reference,
        });
      });

      collection.flows.forEach((flow) => {
        const reference = createFlowReference(collection, flow, "picker");
        items.push({
          key: itemKey(reference),
          title: flow.name,
          subtitle: `${collection.name} · ${flow.flow.nodes.length} nodes`,
          keywords: words(`${flow.name} flow ${collection.name}`),
          reference,
        });

        flow.flow.nodes.forEach((node) => {
          const nodeReference = createFlowNodeReference(collection, flow.id, node, "picker");
          items.push({
            key: itemKey(nodeReference),
            title: node.name,
            subtitle: `${flow.name} · node`,
            keywords: words(`${node.name} ${flow.name} flow node ${collection.name}`),
            reference: nodeReference,
          });
        });
      });
    });

    workspace.environments.forEach((environment) => {
      const reference = createEnvironmentReference(environment, "picker");
      items.push({
        key: itemKey(reference),
        title: environment.name,
        subtitle: `${Object.keys(environment.variables).length} variables`,
        keywords: words(`${environment.name} environment`),
        reference,
      });
    });
  }

  textFiles.forEach((entry) => {
    const extension = fileExtension(entry.path);
    if (extension === "md" || extension === "mdx") {
      const reference = createFileReference(entry.path, "picker");
      items.push({
        key: itemKey(reference),
        title: fileName(entry.path),
        subtitle: entry.path,
        keywords: words(`${entry.path} ${entry.content.slice(0, 200)}`),
        reference,
      });
      return;
    }

    const looksLikeSchema = ["json", "yaml", "yml"].includes(extension)
      && (/schema|openapi|swagger/i.test(entry.path) || /"\$schema"|openapi\s*:/i.test(entry.content));
    if (looksLikeSchema) {
      const reference = createSchemaReference(entry.path, "picker");
      items.push({
        key: itemKey(reference),
        title: fileName(entry.path),
        subtitle: entry.path,
        keywords: words(`${entry.path} schema openapi swagger`),
        reference,
      });
    }
  });

  if (selectedEnvironment && workspace?.environments.every((environment) => environment.id !== selectedEnvironment.id)) {
    const reference = createEnvironmentReference(selectedEnvironment, "picker");
    items.push({
      key: itemKey(reference),
      title: selectedEnvironment.name,
      subtitle: `${Object.keys(selectedEnvironment.variables).length} variables`,
      keywords: words(`${selectedEnvironment.name} environment`),
      reference,
    });
  }

  if (selectedCollection) {
    const hasCurrentCollection = items.some((item) => item.reference.type === "collection" && item.reference.id === selectedCollection.id);
    if (!hasCurrentCollection) {
      const reference = createCollectionReference(selectedCollection, "picker");
      items.push({
        key: itemKey(reference),
        title: selectedCollection.name,
        subtitle: `${selectedCollection.endpoints.length} requests · ${selectedCollection.flows.length} flows`,
        keywords: words(`${selectedCollection.name} collection`),
        reference,
      });
    }
  }

  if (selectedResponse) {
    const responseReference = createResponseReference(selectedResponse, selectedRequestId, "response");
    items.push({
      key: itemKey(responseReference),
      title: responseReference.label,
      subtitle: `${selectedResponse.responseTimeMs} ms · ${selectedResponse.resolvedUrl}`,
      keywords: words(`response ${selectedResponse.status} ${selectedResponse.resolvedUrl}`),
      reference: responseReference,
    });
  }

  return items;
}

export function filterCopilotContextItems(items: CopilotContextSearchItem[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return items.slice(0, 24);
  }
  return items
    .map((item) => {
      let score = 0;
      if (item.title.toLowerCase().includes(trimmed)) {
        score += 5;
      }
      if (item.subtitle?.toLowerCase().includes(trimmed)) {
        score += 2;
      }
      item.keywords.forEach((keyword) => {
        if (keyword.includes(trimmed)) {
          score += 1;
        }
      });
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title))
    .slice(0, 24)
    .map((entry) => entry.item);
}

export function resolveDroppedCopilotReference(dataTransfer: DataTransfer, items: CopilotContextSearchItem[]) {
  const customPayload = dataTransfer.getData("application/bikapi-copilot-context");
  if (customPayload) {
    try {
      const parsed = JSON.parse(customPayload) as Partial<CopilotContextReference>;
      const matched = items.find((item) => contextReferenceKey(item.reference) === contextReferenceKey(parsed as CopilotContextReference));
      if (matched) {
        return matched.reference;
      }
    } catch {
      // Ignore malformed drag payloads.
    }
  }

  const requestPayload = dataTransfer.getData("application/bikapi-request") || dataTransfer.getData("application/bikapi-endpoint");
  if (requestPayload) {
    try {
      const parsed = JSON.parse(requestPayload) as { collectionId?: string; requestId?: string };
      return items.find((item) => item.reference.type === "request"
        && item.reference.id === parsed.requestId
        && item.reference.collectionId === parsed.collectionId)?.reference ?? null;
    } catch {
      return null;
    }
  }

  return null;
}
