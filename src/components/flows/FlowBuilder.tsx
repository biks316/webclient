import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { FlowNodeInspector } from "./FlowNodeInspector";
import { DragEndpointPayload } from "./FlowCanvas";
import { MappingBuilderModal } from "./MappingBuilderModal";
import styles from "./FlowBuilder.module.css";

interface FlowBuilderProps {
  workspacePath: string;
  collection: CollectionIndex;
  flow: FlowDefinition;
  environmentId: string | null;
  onChange: (flow: FlowDefinition) => void;
  onSave: () => void;
  onRenameFlow: () => void;
  onDuplicateFlow: () => void;
  onDeleteFlow: () => void;
}

export function FlowBuilder({
  workspacePath,
  collection,
  flow,
  environmentId,
  onChange,
  onSave,
  onRenameFlow,
  onDuplicateFlow,
  onDeleteFlow,
}: FlowBuilderProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(flow.nodes[0]?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(flow.edges[0]?.id ?? null);
  const [runSteps, setRunSteps] = useState<FlowRunStep[]>([]);
  const [lastResponses, setLastResponses] = useState<Record<string, RunResponse | null>>({});
  const [flowWarning, setFlowWarning] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<FlowDefinition[]>([]);
  const [redoStack, setRedoStack] = useState<FlowDefinition[]>([]);
  const [fitVersion, setFitVersion] = useState(0);
  const [running, setRunning] = useState(false);
  const [mappingBuilderState, setMappingBuilderState] = useState<{ edgeId: string; targetPath?: string | null } | null>(null);
  const lastFlowIdRef = useRef(flow.id);
  const flowMenuRef = useRef<HTMLDivElement | null>(null);
  const [flowMenuOpen, setFlowMenuOpen] = useState(false);
  const runningNodeIds = useMemo(
    () => new Set(runSteps.filter((step) => step.status === "running").map((step) => step.nodeId)),
    [runSteps],
  );

  useEffect(() => {
    if (lastFlowIdRef.current !== flow.id) {
      lastFlowIdRef.current = flow.id;
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [flow.id]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("bikapi:flow-history", {
      detail: { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 },
    }));
  }, [undoStack.length, redoStack.length]);

  useEffect(() => {
    if (!flowMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!flowMenuRef.current?.contains(event.target as Node)) {
        setFlowMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [flowMenuOpen]);

  useEffect(() => {
    function handleUndo() {
      undoFlowChange();
    }
    function handleRedo() {
      redoFlowChange();
    }
    window.addEventListener("bikapi:flow-undo", handleUndo);
    window.addEventListener("bikapi:flow-redo", handleRedo);
    return () => {
      window.removeEventListener("bikapi:flow-undo", handleUndo);
      window.removeEventListener("bikapi:flow-redo", handleRedo);
    };
  }, [flow, undoStack, redoStack]);

  function commitFlowChange(nextFlow: FlowDefinition) {
    setUndoStack((current) => [...current.slice(-49), flow]);
    setRedoStack([]);
    onChange(nextFlow);
  }

  function requestFitView() {
    window.setTimeout(() => setFitVersion((version) => version + 1), 0);
  }

  function undoFlowChange() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) {
      return;
    }
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [flow, ...current].slice(0, 50));
    onChange(previous);
  }

  function redoFlowChange() {
    const next = redoStack[0];
    if (!next) {
      return;
    }
    setRedoStack((current) => current.slice(1));
    setUndoStack((current) => [...current.slice(-49), flow]);
    onChange(next);
  }

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
    commitFlowChange({ ...flow, nodes: [...flow.nodes, node] });
    requestFitView();
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
    commitFlowChange(nextFlow);
    requestFitView();
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setFlowWarning(null);
  }

  function updateEdge(nextEdge: FlowEdge) {
    commitFlowChange({
      ...flow,
      edges: flow.edges.map((edge) => (edge.id === nextEdge.id ? nextEdge : edge)),
    });
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) {
      return;
    }
    commitFlowChange({
      ...flow,
      nodes: flow.nodes.filter((node) => node.id !== selectedNodeId),
      edges: flow.edges.filter((edge) => (edge.source || edge.from) !== selectedNodeId && (edge.target || edge.to) !== selectedNodeId),
    });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function deleteSelectedEdge() {
    if (!selectedEdgeId) {
      return;
    }
    commitFlowChange({
      ...flow,
      edges: flow.edges.filter((edge) => edge.id !== selectedEdgeId),
    });
    setSelectedEdgeId(null);
  }

  function moveNode(nodeId: string, position: { x: number; y: number }) {
    onChange({
      ...flow,
      nodes: flow.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
    });
  }

  function autoArrange() {
    commitFlowChange(layoutFlow(flow));
    requestFitView();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey;
      const isRedo =
        ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "z") ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y");
      if (isUndo) {
        event.preventDefault();
        undoFlowChange();
        return;
      }
      if (isRedo) {
        event.preventDefault();
        redoFlowChange();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const target = event.target as HTMLElement | null;
        if (target?.closest("input, textarea, select, [contenteditable='true']")) {
          return;
        }
        if (selectedNodeId || selectedEdgeId) {
          event.preventDefault();
          if (selectedNodeId) {
            deleteSelectedNode();
          } else {
            deleteSelectedEdge();
          }
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flow, selectedNodeId, selectedEdgeId, undoStack, redoStack]);

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
  const mappingBuilderEdge = mappingBuilderState ? flow.edges.find((edge) => edge.id === mappingBuilderState.edgeId) ?? null : null;
  const mappingBuilderFromNode = mappingBuilderEdge ? flow.nodes.find((node) => node.id === (mappingBuilderEdge.source || mappingBuilderEdge.from)) ?? null : null;
  const mappingBuilderToNode = mappingBuilderEdge ? flow.nodes.find((node) => node.id === (mappingBuilderEdge.target || mappingBuilderEdge.to)) ?? null : null;
  const selectedEndpoint = selectedNode
    ? collection.endpoints.find((endpoint) => endpoint.id === selectedNode.requestId) ?? null
    : null;
  const variableContext = {
    collection,
    flowVariables: Object.fromEntries(
      flow.edges.flatMap((edge) => edge.mappings)
        .filter((mapping) => (mapping.targetType === "variable" || mapping.targetType === "flowVariable") && mapping.targetKey)
        .map((mapping) => [mapping.targetKey, ""]),
    ),
  };

  return (
    <section className={styles.flowBuilder}>
      <header className={styles.header}>
        <div>
          <strong>{flow.name}</strong>
          <span>Drag requests into the canvas, then connect output handles to input handles.</span>
        </div>
        <div className={styles.toolbar}>
          <button type="button" disabled={undoStack.length === 0} onClick={undoFlowChange}>Undo</button>
          <button type="button" disabled={redoStack.length === 0} onClick={redoFlowChange}>Redo</button>
          <button type="button" onClick={() => window.dispatchEvent(new Event("bikapi:flow-zoom-out"))}>Zoom -</button>
          <button type="button" onClick={() => window.dispatchEvent(new Event("bikapi:flow-zoom-in"))}>Zoom +</button>
          <button type="button" onClick={() => setFitVersion((version) => version + 1)}>Fit view</button>
          <button type="button" onClick={autoArrange}>Auto arrange</button>
          <button type="button" onClick={onSave}>Save Flow</button>
          <div className={styles.flowMenuWrap} ref={flowMenuRef}>
            <button
              type="button"
              className={styles.iconAction}
              title="Flow actions"
              onClick={() => setFlowMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={14} />
            </button>
            {flowMenuOpen ? (
              <div className={styles.flowMenu} role="menu">
                <button type="button" role="menuitem" onClick={() => { setFlowMenuOpen(false); onRenameFlow(); }}>
                  Rename flow
                </button>
                <button type="button" role="menuitem" onClick={() => { setFlowMenuOpen(false); onDuplicateFlow(); }}>
                  Clone flow
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.flowMenuDanger}
                  onClick={() => { setFlowMenuOpen(false); onDeleteFlow(); }}
                >
                  Delete flow
                </button>
              </div>
            ) : null}
          </div>
          <button type="button" className={styles.primaryButton} disabled={running} onClick={() => void runCurrentFlow()}>
            {running ? "Running..." : "Run Flow"}
          </button>
        </div>
      </header>

      <div className={`${styles.body} ${selectedNode && selectedEndpoint ? styles.bodyWithInspector : ""}`}>
        <FlowCanvas
          workspacePath={workspacePath}
          collection={collection}
          flow={flow}
          environmentId={environmentId}
          selectedEdgeId={selectedEdgeId}
          selectedNodeId={selectedNodeId}
          lastResponses={lastResponses}
          runningNodeIds={runningNodeIds}
          fitVersion={fitVersion}
          warning={flowWarning}
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
          onUpdateEdge={updateEdge}
          onOpenMappingBuilder={(edgeId) => setMappingBuilderState({ edgeId })}
          onDiscoveredResponse={(nodeId, response) =>
            setLastResponses((current) => ({ ...current, [nodeId]: response }))
          }
          onDeleteNode={(nodeId) => {
            setSelectedNodeId(nodeId);
            setSelectedEdgeId(null);
            commitFlowChange({
              ...flow,
              nodes: flow.nodes.filter((node) => node.id !== nodeId),
              edges: flow.edges.filter((edge) => (edge.source || edge.from) !== nodeId && (edge.target || edge.to) !== nodeId),
            });
          }}
          onDeleteEdge={(edgeId) => {
            setSelectedEdgeId(null);
            setSelectedNodeId(null);
            commitFlowChange({ ...flow, edges: flow.edges.filter((edge) => edge.id !== edgeId) });
          }}
        />
        {selectedNode && selectedEndpoint ? (
          <FlowNodeInspector
            node={selectedNode}
            request={selectedEndpoint.request}
            flow={flow}
            variableContext={variableContext}
            onRunStep={() => void runCurrentFlow()}
            onDeleteNode={deleteSelectedNode}
            onOpenPlaceholderMapping={(targetPath) => {
              const incomingEdge = flow.edges.find((edge) => (edge.target || edge.to) === selectedNode.id);
              if (!incomingEdge) {
                setFlowWarning(`No incoming edge available for ${targetPath}. Connect a source node first.`);
                return;
              }
              setMappingBuilderState({ edgeId: incomingEdge.id, targetPath });
            }}
          />
        ) : null}
      </div>

      {mappingBuilderEdge && mappingBuilderFromNode && mappingBuilderToNode && (
        <MappingBuilderModal
          open
          workspacePath={workspacePath}
          collection={collection}
          edge={mappingBuilderEdge}
          fromNode={mappingBuilderFromNode}
          toNode={mappingBuilderToNode}
          environmentId={environmentId}
          initialResponse={lastResponses[mappingBuilderFromNode.id] ?? (mappingBuilderFromNode.lastRun ? {
            status: mappingBuilderFromNode.lastRun.statusCode ?? 0,
            statusText: mappingBuilderFromNode.lastRun.status,
            headers: mappingBuilderFromNode.lastRun.responseHeaders,
            body: mappingBuilderFromNode.lastRun.responseBody,
            responseTimeMs: mappingBuilderFromNode.lastRun.durationMs ?? 0,
            sentAt: mappingBuilderFromNode.lastRun.ranAt,
            resolvedUrl: "",
          } : null)}
          initialTargetPath={mappingBuilderState?.targetPath ?? null}
          onClose={() => setMappingBuilderState(null)}
          onSave={(nextEdge) => {
            updateEdge(nextEdge);
            setMappingBuilderState(null);
          }}
          onDiscoveredResponse={(nodeId, response) =>
            setLastResponses((current) => ({ ...current, [nodeId]: response }))
          }
        />
      )}

      <FlowRunPanel steps={runSteps} />
    </section>
  );
}
