import { CollectionIndex, FlowIndex, RunResponse, VariableFile, WorkspaceIndex } from "../types/bik";
import { CopilotCollectionSummary, CopilotContextSnapshot, CopilotExecutionEntry, CopilotVariable } from "../types/copilot";

interface BuildCopilotContextArgs {
  workspace: WorkspaceIndex | null;
  selectedCollection: CollectionIndex | null;
  selectedEnvironment: VariableFile | null;
  selectedFlow: FlowIndex | null;
  selectedRequestName: string | null;
  requestVariables?: Record<string, string>;
  response: RunResponse | null;
  responseError: string | null;
}

const SECRET_KEY_PATTERN = /(secret|token|password|passwd|api[_-]?key|client[_-]?secret|auth|bearer|cookie|session|jwt|private)/i;

function variableList(scope: CopilotVariable["scope"], values: Record<string, string>) {
  return Object.entries(values).map(([key, value]) => ({
    scope,
    key,
    value: SECRET_KEY_PATTERN.test(key) ? undefined : value,
    secret: SECRET_KEY_PATTERN.test(key),
  }));
}

function summarizeCollections(collections: WorkspaceIndex["collections"]): CopilotCollectionSummary[] {
  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    requestCount: collection.endpoints.length,
    flowCount: collection.flows.length,
    requests: collection.endpoints.map((endpoint) => ({
      id: endpoint.id,
      name: endpoint.name,
      method: endpoint.request.method,
      url: endpoint.request.url,
    })),
  }));
}

function recentExecutions(flow: FlowIndex | null, requestName: string | null, response: RunResponse | null, responseError: string | null) {
  const items: CopilotExecutionEntry[] = [];
  if (response && requestName) {
    items.push({
      id: `request:${requestName}:${response.sentAt}`,
      kind: "request",
      name: requestName,
      status: response.status >= 400 ? "failed" : "success",
      statusCode: response.status,
      timestamp: response.sentAt,
      durationMs: response.responseTimeMs,
      error: responseError,
    });
  }
  if (flow) {
    flow.flow.nodes.forEach((node) => {
      if (!node.lastRun) {
        return;
      }
      items.push({
        id: `flow-node:${node.id}:${node.lastRun.ranAt}`,
        kind: "flow-node",
        name: node.name,
        status: node.lastRun.status === "success" ? "success" : "failed",
        statusCode: node.lastRun.statusCode,
        timestamp: node.lastRun.ranAt,
        durationMs: node.lastRun.durationMs,
        error: node.lastRun.error,
      });
    });
  }
  return items
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 12);
}

export function buildCopilotContext({
  workspace,
  selectedCollection,
  selectedEnvironment,
  selectedFlow,
  selectedRequestName,
  requestVariables,
  response,
  responseError,
}: BuildCopilotContextArgs): CopilotContextSnapshot {
  return {
    workspaceName: workspace?.name ?? null,
    workspacePath: workspace?.path ?? null,
    currentCollectionName: selectedCollection?.name ?? null,
    currentRequestName: selectedRequestName,
    currentEnvironmentName: selectedEnvironment?.name ?? null,
    currentFlowName: selectedFlow?.name ?? null,
    collections: summarizeCollections(workspace?.collections ?? []),
    variables: [
      ...variableList("global", workspace?.globals ?? {}),
      ...variableList("collection", selectedCollection?.variables ?? {}),
      ...variableList("environment", selectedEnvironment?.variables ?? {}),
      ...variableList("request", requestVariables ?? {}),
    ],
    flowGraph: selectedFlow
      ? {
          nodes: selectedFlow.flow.nodes.map((node) => ({
            id: node.id,
            name: node.name,
            requestId: node.requestId,
            status: node.lastRun?.status === "success" ? "success" : node.lastRun?.status === "failed" ? "failed" : "idle",
            statusCode: node.lastRun?.statusCode ?? null,
            durationMs: node.lastRun?.durationMs ?? null,
            ranAt: node.lastRun?.ranAt ?? null,
          })),
          edges: selectedFlow.flow.edges.map((edge) => ({
            id: edge.id,
            from: edge.source || edge.from,
            to: edge.target || edge.to,
            mappingCount: edge.mappings.length,
            mappings: edge.mappings.map((mapping) => ({
              sourcePath: mapping.sourcePath,
              targetPath: mapping.targetPath,
              transformType: mapping.transformType,
            })),
          })),
        }
      : null,
    recentExecutionHistory: recentExecutions(selectedFlow, selectedRequestName, response, responseError),
  };
}
