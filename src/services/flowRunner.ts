import { BikRequest, CollectionIndex, FlowDefinition, FlowNode, RunResponse } from "../types/bik";
import * as api from "./tauriApi";
import { cloneJson } from "./workspaceService";
import { AppliedMapping, applyEdgeMappings } from "./mappingEngine";
import { edgeSource, edgeTarget, orderedFlowNodes } from "./flowLayoutService";

export interface FlowRunStep {
  nodeId: string;
  name: string;
  request: BikRequest;
  response: RunResponse | null;
  status: "pending" | "running" | "success" | "error";
  error?: string;
  appliedMappings: AppliedMapping[];
}

function requestForNode(collection: CollectionIndex, node: FlowNode): BikRequest {
  const endpoint = collection.endpoints.find((item) => item.id === node.requestId);
  if (!endpoint) {
    throw new Error(`Request not found for node ${node.name}`);
  }
  return cloneJson(endpoint.request);
}

export async function runFlow(
  workspacePath: string,
  collection: CollectionIndex,
  flow: FlowDefinition,
  environmentId: string | null,
  onStep: (steps: FlowRunStep[]) => void,
): Promise<FlowRunStep[]> {
  const nextFlow: FlowDefinition = cloneJson(flow);
  const nodes = orderedFlowNodes(nextFlow);
  const contextVariables: Record<string, string> = {};
  const requestByNode = new Map<string, BikRequest>();
  const steps: FlowRunStep[] = nodes.map((node) => {
    const request = requestForNode(collection, node);
    requestByNode.set(node.id, request);
    return {
      nodeId: node.id,
      name: node.name,
      request,
      response: null,
      status: "pending",
      appliedMappings: [],
    };
  });

  onStep([...steps]);

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const step = steps[index];
    const request = requestByNode.get(node.id);
    if (!request) {
      continue;
    }

    step.status = "running";
    onStep([...steps]);

    try {
      request.variables = { ...request.variables, ...contextVariables };
      const response = await api.sendRequest(workspacePath, collection.id, node.requestId, environmentId, request);
      step.response = response;
      step.status = response.status >= 400 ? "error" : "success";
      const graphNode = nextFlow.nodes.find((item) => item.id === node.id);
      if (graphNode) {
        graphNode.lastRun = {
          nodeId: node.id,
          requestId: node.requestId,
          status: response.status >= 400 ? "failed" : "success",
          statusCode: response.status,
          durationMs: response.responseTimeMs,
          responseHeaders: response.headers,
          responseBody: response.body,
          error: null,
          ranAt: response.sentAt,
        };
      }

      const outgoingEdges = flow.edges.filter((edge) => edgeSource(edge) === node.id);
      outgoingEdges.forEach((edge) => {
        const nextRequest = requestByNode.get(edgeTarget(edge));
        if (edge && nextRequest) {
          step.appliedMappings = applyEdgeMappings(edge, request, response, nextRequest, contextVariables);
        }
      });
    } catch (error) {
      step.status = "error";
      step.error = error instanceof Error ? error.message : String(error);
      const graphNode = nextFlow.nodes.find((item) => item.id === node.id);
      if (graphNode) {
        graphNode.lastRun = {
          nodeId: node.id,
          requestId: node.requestId,
          status: "failed",
          statusCode: null,
          durationMs: null,
          responseHeaders: {},
          responseBody: "",
          error: step.error,
          ranAt: new Date().toISOString(),
        };
      }
      onStep([...steps]);
      break;
    }

    onStep([...steps]);
    if (step.status === "error") {
      break;
    }
  }

  flow.nodes = nextFlow.nodes;
  return steps;
}
