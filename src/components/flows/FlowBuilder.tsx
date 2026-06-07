import { useMemo, useState } from "react";
import { CollectionIndex, FlowDefinition, FlowEdge, RunResponse } from "../../types/bik";
import { runFlow, FlowRunStep } from "../../services/flowRunner";
import {
  edgeExists,
  layoutAfterConnection,
  layoutFlow,
  replaceChainEdge,
  wouldCreateCycle,
} from "../../services/flowLayoutService";
import { FlowCanvas } from "./FlowCanvas";
import { FlowRunPanel } from "./FlowRunPanel";
import { MappingPanel } from "./MappingPanel";
import { FlowNodeInspector } from "./FlowNodeInspector";
import { DragEndpointPayload } from "./FlowCanvas";
import styles from "./FlowBuilder.module.css";

interface FlowBuilderProps {
  workspacePath: string;
  collection: CollectionIndex;
  flow: FlowDefinition;
  environmentId: string | null;
  onChange: (flow: FlowDefinition) => void;
  onSave: () => void;
}

export function FlowBuilder({
  workspacePath,
  collection,
  flow,
  environmentId,
  onChange,
  onSave,
}: FlowBuilderProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(flow.nodes[0]?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(flow.edges[0]?.id ?? null);
  const [runSteps, setRunSteps] = useState<FlowRunStep[]>([]);
  const [lastResponses, setLastResponses] = useState<Record<string, RunResponse | null>>({});
  const [flowWarning, setFlowWarning] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const selectedEdge = useMemo(
    () => flow.edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [flow.edges, selectedEdgeId],
  );
  const runningNodeIds = useMemo(
    () => new Set(runSteps.filter((step) => step.status === "running").map((step) => step.nodeId)),
    [runSteps],
  );

  function createNode(endpointId: string, position?: { x: number; y: number }) {
    const endpoint = collection.endpoints.find((item) => item.id === endpointId || item.request.id === endpointId);
    if (!endpoint) {
      console.warn("[DND] request not found in current collection", endpointId);
      setFlowWarning(`Request ${endpointId} was not found in this collection.`);
      return;
    }
    const nodeId = flow.nodes.some((node) => node.id === endpoint.id)
      ? `${endpoint.id}-${Date.now()}`
      : endpoint.id;
    const node = {
      id: nodeId,
      type: "request" as const,
      requestPath: `../endpoints/${endpoint.id}/request.bik`,
      requestId: endpoint.id,
      name: endpoint.name,
      position: position ?? {
        x: 100 + flow.nodes.length * 260,
        y: 110,
      },
      lastRun: null,
    };
    onChange({ ...flow, nodes: [...flow.nodes, node] });
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setFlowWarning(null);
  }

  function createEdge(fromId: string, toId: string) {
    if (!fromId || !toId || fromId === toId) {
      setFlowWarning("Self connections are not allowed.");
      return;
    }
    const existing = flow.edges.find((edge) => (edge.source || edge.from) === fromId && (edge.target || edge.to) === toId);
    if (edgeExists(flow.edges, fromId, toId)) {
      setSelectedEdgeId(existing?.id ?? `${fromId}-to-${toId}`);
      setSelectedNodeId(null);
      setFlowWarning("That connection already exists.");
      return;
    }

    const nextEdges = replaceChainEdge(flow.edges, {
      id: `${fromId}-to-${toId}`,
      source: fromId,
      target: toId,
      from: fromId,
      to: toId,
      label: "Add mapping",
      mappings: [],
    });
    if (wouldCreateCycle(nextEdges, fromId, toId)) {
      setFlowWarning("Cycles are blocked for now. Connect nodes in a forward execution order.");
      return;
    }

    const edge: FlowEdge = {
      id: `${fromId}-to-${toId}`,
      source: fromId,
      target: toId,
      from: fromId,
      to: toId,
      label: "Add mapping",
      mappings: [],
    };
    const nextFlow = layoutAfterConnection({ ...flow, edges: nextEdges }, edge);
    onChange(nextFlow);
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setFlowWarning(null);
  }

  function updateEdge(nextEdge: FlowEdge) {
    onChange({
      ...flow,
      edges: flow.edges.map((edge) => (edge.id === nextEdge.id ? nextEdge : edge)),
    });
  }

  function moveNode(nodeId: string, position: { x: number; y: number }) {
    onChange({
      ...flow,
      nodes: flow.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
    });
  }

  function autoArrange() {
    onChange(layoutFlow(flow));
  }

  async function runCurrentFlow() {
    setRunning(true);
    try {
      const nextFlow = { ...flow, nodes: flow.nodes.map((node) => ({ ...node })) };
      await runFlow(workspacePath, collection, nextFlow, environmentId, (steps) => {
        setRunSteps(steps);
        setLastResponses((current) => {
          const next = { ...current };
          steps.forEach((step) => {
            if (step.response) {
              next[step.nodeId] = step.response;
            }
          });
          return next;
        });
      });
      onChange(nextFlow);
    } finally {
      setRunning(false);
    }
  }

  const selectedNode = flow.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEndpoint = selectedNode
    ? collection.endpoints.find((endpoint) => endpoint.id === selectedNode.requestId) ?? null
    : null;

  return (
    <section className={styles.flowBuilder}>
      <header className={styles.header}>
        <div>
          <strong>{flow.name}</strong>
          <span>Drag requests into the canvas, then connect output handles to input handles.</span>
        </div>
        <div className={styles.toolbar}>
          <button type="button" onClick={autoArrange}>Auto arrange</button>
          <button type="button" onClick={onSave}>Save Flow</button>
          <button type="button" className={styles.primaryButton} disabled={running} onClick={() => void runCurrentFlow()}>
            {running ? "Running..." : "Run Flow"}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <FlowCanvas
          collection={collection}
          flow={flow}
          selectedEdgeId={selectedEdgeId}
          selectedNodeId={selectedNodeId}
          lastResponses={lastResponses}
          runningNodeIds={runningNodeIds}
          onSelectNode={(nodeId) => {
            setSelectedNodeId(nodeId);
            setSelectedEdgeId(null);
            setFlowWarning(null);
          }}
          onSelectEdge={(edgeId) => {
            setSelectedEdgeId(edgeId);
            setSelectedNodeId(null);
            setFlowWarning(null);
          }}
          onSelectCanvas={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setFlowWarning(null);
          }}
          onDropEndpoint={(payload: DragEndpointPayload, position) => {
            if (!payload.collectionId || payload.collectionId === collection.id) {
              createNode(payload.requestId, position);
            } else {
              console.warn("[DND] dropped request from another collection", payload.collectionId, collection.id);
              setFlowWarning("Drop a request from the same collection as this flow.");
            }
          }}
          onMoveNode={moveNode}
          onConnectNodes={createEdge}
        />
        {selectedNode && selectedEndpoint ? (
          <FlowNodeInspector
            node={selectedNode}
            request={selectedEndpoint.request}
            flow={flow}
            onRunStep={() => void runCurrentFlow()}
          />
        ) : (
          <MappingPanel
            workspacePath={workspacePath}
            collection={collection}
            environmentId={environmentId}
            flow={flow}
            edge={selectedEdge}
            onChange={updateEdge}
            onDiscoveredResponse={(nodeId, response) =>
              setLastResponses((current) => ({ ...current, [nodeId]: response }))
            }
            warning={flowWarning}
          />
        )}
      </div>

      <FlowRunPanel steps={runSteps} />
    </section>
  );
}
