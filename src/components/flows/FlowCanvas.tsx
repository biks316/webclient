import { CollectionIndex, FlowDefinition, FlowEdge, RunResponse } from "../../types/bik";
import { useEffect, useRef, useState } from "react";
import { EdgeLabel } from "./EdgeLabel";
import { RequestFlowNode } from "./RequestFlowNode";
import { edgeSource, edgeTarget } from "../../services/flowLayoutService";
import {
  RequestDragPayload,
  clearCurrentRequestDrag,
  getCurrentRequestDrag,
} from "../../services/requestDragStore";
import styles from "./FlowBuilder.module.css";

interface FlowCanvasProps {
  workspacePath: string;
  collection: CollectionIndex;
  flow: FlowDefinition;
  environmentId: string | null;
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
  lastResponses: Record<string, RunResponse | null>;
  runningNodeIds: Set<string>;
  fitVersion: number;
  warning?: string | null;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectCanvas: () => void;
  onDropEndpoint: (payload: DragEndpointPayload, position: { x: number; y: number }) => void;
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
  onConnectNodes: (from: string, to: string) => void;
  onUpdateEdge: (edge: FlowEdge) => void;
  onOpenMappingBuilder: (edgeId: string) => void;
  onDiscoveredResponse: (nodeId: string, response: RunResponse) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export type DragEndpointPayload = RequestDragPayload;

const NODE_WIDTH = 190;
const NODE_HEIGHT = 72;
const START_NODE_SIZE = 62;
const START_NODE_GAP = 96;
const GRAPH_MIN = -5000;
const GRAPH_MAX = 5000;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.2;

function edgePath(edge: FlowEdge, flow: FlowDefinition) {
  const from = flow.nodes.find((node) => node.id === edgeSource(edge));
  const to = flow.nodes.find((node) => node.id === edgeTarget(edge));
  if (!from || !to) {
    return null;
  }

  const startX = from.position.x + 190;
  const startY = from.position.y + 36;
  const endX = to.position.x;
  const endY = to.position.y + 36;
  const midX = startX + Math.max((endX - startX) / 2, 48);
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

function connectionPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = from.x + Math.max((to.x - from.x) / 2, 48);
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}

function rootNodes(flow: FlowDefinition) {
  const targeted = new Set(flow.edges.map((edge) => edgeTarget(edge)));
  return flow.nodes.filter((node) => !targeted.has(node.id));
}

function readEndpointPayload(dataTransfer: DataTransfer) {
  const raw =
    dataTransfer.getData("application/bikapi-request") ||
    dataTransfer.getData("application/bikapi-endpoint") ||
    dataTransfer.getData("text/plain");
  if (!raw) {
    console.warn("[DND] no payload found");
    return null;
  }

  console.log("[DND] payload", raw);

  if (!raw.trim().startsWith("{")) {
    return { requestId: raw.trim(), method: "GET" };
  }

  try {
    const payload = JSON.parse(raw) as Partial<DragEndpointPayload>;
    if (payload.requestId) {
      return payload as DragEndpointPayload;
    }
  } catch {
    return null;
  }
  return null;
}

export function FlowCanvas({
  workspacePath,
  collection,
  flow,
  environmentId,
  selectedEdgeId,
  selectedNodeId,
  lastResponses,
  runningNodeIds,
  fitVersion,
  warning,
  onSelectEdge,
  onSelectNode,
  onSelectCanvas,
  onDropEndpoint,
  onMoveNode,
  onConnectNodes,
  onUpdateEdge,
  onOpenMappingBuilder,
  onDiscoveredResponse,
  onDeleteNode,
  onDeleteEdge,
}: FlowCanvasProps) {
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectionPoint, setConnectionPoint] = useState<{ x: number; y: number } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [dragging, setDragging] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [panning, setPanning] = useState<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ x: 40, y: 40, scale: 1 });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const handledDropRef = useRef(false);
  const selectedEdge = selectedEdgeId ? flow.edges.find((edge) => edge.id === selectedEdgeId) ?? null : null;
  const selectedFromNode = selectedEdge ? flow.nodes.find((node) => node.id === edgeSource(selectedEdge)) ?? null : null;
  const selectedToNode = selectedEdge ? flow.nodes.find((node) => node.id === edgeTarget(selectedEdge)) ?? null : null;
  const startNodes = rootNodes(flow);
  const startAnchor = startNodes.length > 0
    ? {
        x: Math.min(...startNodes.map((node) => node.position.x)) - START_NODE_GAP,
        y: startNodes.reduce((sum, node) => sum + node.position.y + NODE_HEIGHT / 2, 0) / startNodes.length,
      }
    : null;

  const graphBounds = flow.nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.position.x, startAnchor ? startAnchor.x - START_NODE_SIZE / 2 : node.position.x),
      minY: Math.min(bounds.minY, node.position.y, startAnchor ? startAnchor.y - START_NODE_SIZE / 2 : node.position.y),
      maxX: Math.max(bounds.maxX, node.position.x + NODE_WIDTH),
      maxY: Math.max(bounds.maxY, node.position.y + NODE_HEIGHT, startAnchor ? startAnchor.y + START_NODE_SIZE / 2 : node.position.y + NODE_HEIGHT),
    }),
    { minX: 0, minY: 0, maxX: 1200, maxY: 700 },
  );

  function canvasPointFromClient(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
    };
  }

  function canvasPoint(event: { clientX: number; clientY: number }) {
    return canvasPointFromClient(event.clientX, event.clientY);
  }

  const connectingNode = connectingFrom ? flow.nodes.find((node) => node.id === connectingFrom) ?? null : null;
  const connectionStart = connectingNode
    ? { x: connectingNode.position.x + NODE_WIDTH, y: connectingNode.position.y + 36 }
    : null;

  function fitView() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const padding = 0.2;
    const width = Math.max(graphBounds.maxX - graphBounds.minX, NODE_WIDTH);
    const height = Math.max(graphBounds.maxY - graphBounds.minY, NODE_HEIGHT);
    const scale = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(rect.width / (width * (1 + padding)), rect.height / (height * (1 + padding)))),
    );
    setViewport({
      scale,
      x: rect.width / 2 - (graphBounds.minX + width / 2) * scale,
      y: rect.height / 2 - (graphBounds.minY + height / 2) * scale,
    });
  }

  function zoomBy(multiplier: number, clientX?: number, clientY?: number) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const anchorX = clientX ?? rect.left + rect.width / 2;
    const anchorY = clientY ?? rect.top + rect.height / 2;
    const graphPoint = canvasPointFromClient(anchorX, anchorY);
    const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.scale * multiplier));
    setViewport({
      scale: nextScale,
      x: anchorX - rect.left - graphPoint.x * nextScale,
      y: anchorY - rect.top - graphPoint.y * nextScale,
    });
  }

  useEffect(() => {
    if (fitVersion > 0 || flow.nodes.length > 0) {
      fitView();
    }
  }, [fitVersion]);

  useEffect(() => {
    function handleZoomIn() {
      zoomBy(1.18);
    }
    function handleZoomOut() {
      zoomBy(0.84);
    }
    window.addEventListener("bikapi:flow-zoom-in", handleZoomIn);
    window.addEventListener("bikapi:flow-zoom-out", handleZoomOut);
    return () => {
      window.removeEventListener("bikapi:flow-zoom-in", handleZoomIn);
      window.removeEventListener("bikapi:flow-zoom-out", handleZoomOut);
    };
  }, [viewport]);

  useEffect(() => {
    function isInsideCanvas(clientX: number, clientY: number) {
      const canvas = canvasRef.current;
      if (!canvas) {
        return false;
      }
      const rect = canvas.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }

    function finishRequestDrag(clientX: number, clientY: number) {
      const payload = getCurrentRequestDrag();
      if (!payload) {
        return;
      }

      if (isInsideCanvas(clientX, clientY)) {
        console.log("[DND] document fallback drop canvas", clientX, clientY);
        handledDropRef.current = true;
        setDropActive(false);
        onDropEndpoint(payload, canvasPointFromClient(clientX, clientY));
      }
      clearCurrentRequestDrag();
      window.setTimeout(() => {
        handledDropRef.current = false;
      }, 0);
    }

    function handlePointerMove(event: PointerEvent) {
      if (getCurrentRequestDrag()) {
        setDropActive(isInsideCanvas(event.clientX, event.clientY));
      }
    }

    function handlePointerUp(event: PointerEvent) {
      finishRequestDrag(event.clientX, event.clientY);
    }

    function handleDragOver(event: DragEvent) {
      if (!getCurrentRequestDrag()) {
        return;
      }
      if (isInsideCanvas(event.clientX, event.clientY)) {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "copy";
        }
        setDropActive(true);
      } else {
        setDropActive(false);
      }
    }

    function handleDrop(event: DragEvent) {
      finishRequestDrag(event.clientX, event.clientY);
    }

    function handleDragEnd(event: DragEvent) {
      finishRequestDrag(event.clientX, event.clientY);
    }

    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("dragover", handleDragOver, true);
    document.addEventListener("drop", handleDrop, true);
    document.addEventListener("dragend", handleDragEnd, true);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("dragover", handleDragOver, true);
      document.removeEventListener("drop", handleDrop, true);
      document.removeEventListener("dragend", handleDragEnd, true);
    };
  }, [onDropEndpoint, viewport]);

  return (
    <div
      ref={canvasRef}
      className={`${styles.canvas} ${dropActive ? `${styles.canvasDropActive} is-drag-over` : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onSelectCanvas();
        }
      }}
      onWheel={(event) => {
        event.preventDefault();
        zoomBy(event.deltaY < 0 ? 1.08 : 0.92, event.clientX, event.clientY);
      }}
      onMouseDown={(event) => {
        const target = event.target as HTMLElement | SVGElement;
        if (
          event.button !== 0 ||
          target.tagName.toLowerCase() === "path" ||
          target.closest?.(`.${styles.requestNode}, .${styles.edgeLabel}, .${styles.mappingOverlay}, .${styles.mappingPopover}, button`)
        ) {
          return;
        }
        setPanning({
          startX: event.clientX,
          startY: event.clientY,
          originX: viewport.x,
          originY: viewport.y,
        });
      }}
      onMouseMove={(event) => {
        if (panning) {
          setViewport((current) => ({
            ...current,
            x: panning.originX + event.clientX - panning.startX,
            y: panning.originY + event.clientY - panning.startY,
          }));
          return;
        }
        if (getCurrentRequestDrag()) {
          setDropActive(true);
        }
        if (connectingFrom) {
          setConnectionPoint(canvasPoint(event));
        }
        if (dragging) {
          const point = canvasPoint(event);
          onMoveNode(dragging.nodeId, {
            x: point.x - dragging.offsetX,
            y: point.y - dragging.offsetY,
          });
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        console.log("[DND] dragOver canvas");
        setDropActive(true);
      }}
      onDragEnter={(event) => {
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropActive(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        console.log("[DND] drop canvas", event.clientX, event.clientY);
        if (handledDropRef.current) {
          return;
        }
        const payload = readEndpointPayload(event.dataTransfer);
        if (!payload) {
          return;
        }
        setDropActive(false);
        clearCurrentRequestDrag();
        onDropEndpoint(payload, canvasPoint(event));
      }}
      onMouseUp={(event) => {
        const requestDrag = getCurrentRequestDrag();
        if (requestDrag && !dragging && !connectingFrom) {
          console.log("[DND] fallback mouseUp canvas", event.clientX, event.clientY);
          setDropActive(false);
          clearCurrentRequestDrag();
          onDropEndpoint(requestDrag, canvasPoint(event));
          return;
        }
        setConnectingFrom(null);
        setConnectionPoint(null);
        setDragging(null);
        setPanning(null);
      }}
      onMouseLeave={() => {
        setDragging(null);
        setPanning(null);
      }}
    >
      <div
        className={styles.graphContent}
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
      >
      <svg
        className={styles.edges}
        viewBox={`${GRAPH_MIN} ${GRAPH_MIN} ${GRAPH_MAX - GRAPH_MIN} ${GRAPH_MAX - GRAPH_MIN}`}
      >
        <defs>
          <marker id="flow-arrow" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto">
            <path d="M0,0 L0,8 L11,4 z" fill="#93c5fd" />
          </marker>
        </defs>
        {flow.edges.map((edge) => {
          const path = edgePath(edge, flow);
          if (!path) {
            return null;
          }
          return (
            <path
              key={edge.id}
              d={path}
              className={`${styles.edgePath} ${selectedEdgeId === edge.id ? styles.edgePathActive : ""} ${
                runningNodeIds.has(edgeSource(edge)) ? styles.edgePathRunning : ""
              }`}
              markerEnd="url(#flow-arrow)"
              onClick={() => onSelectEdge(edge.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                onDeleteEdge(edge.id);
              }}
            />
          );
        })}
        {startAnchor && startNodes.map((node) => (
          <path
            key={`start-to-${node.id}`}
            d={connectionPath(
              { x: startAnchor.x + START_NODE_SIZE / 2, y: startAnchor.y },
              { x: node.position.x, y: node.position.y + NODE_HEIGHT / 2 },
            )}
            className={styles.startEdgePath}
            markerEnd="url(#flow-arrow)"
          />
        ))}
        {connectionStart && connectionPoint && (
          <path
            d={connectionPath(connectionStart, connectionPoint)}
            className={styles.connectionPreview}
            markerEnd="url(#flow-arrow)"
          />
        )}
      </svg>
      {startAnchor && (
        <div
          className={styles.startNode}
          style={{
            left: startAnchor.x - START_NODE_SIZE / 2,
            top: startAnchor.y - START_NODE_SIZE / 2,
          }}
        >
          <span>Start</span>
        </div>
      )}
      {flow.edges.map((edge) => {
        const from = flow.nodes.find((node) => node.id === edgeSource(edge));
        const to = flow.nodes.find((node) => node.id === edgeTarget(edge));
        if (!from || !to) {
          return null;
        }
        return (
          <EdgeLabel
            key={`${edge.id}-label`}
            edge={edge}
            from={from}
            to={to}
            active={selectedEdgeId === edge.id}
            onClick={() => {
              onSelectEdge(edge.id);
            }}
          />
        );
      })}
      {selectedEdge && selectedFromNode && selectedToNode && (
        <div
          className={styles.edgeActions}
          style={{
            left: (selectedFromNode.position.x + selectedToNode.position.x) / 2 + 90,
            top: (selectedFromNode.position.y + selectedToNode.position.y) / 2 + 54,
          }}
        >
          <span>{selectedEdge.mappings.length === 0 ? "No mappings yet" : `${selectedEdge.mappings.length} mapping${selectedEdge.mappings.length === 1 ? "" : "s"}`}</span>
          <button type="button" onClick={() => onOpenMappingBuilder(selectedEdge.id)}>Add Mapping</button>
        </div>
      )}
      {flow.nodes.map((node) => (
        <RequestFlowNode
          key={node.id}
          node={node}
          method={collection.endpoints.find((endpoint) => endpoint.id === node.requestId)?.request.method ?? "GET"}
          active={selectedNodeId === node.id}
          lastResponse={lastResponses[node.id] ?? (node.lastRun ? {
            status: node.lastRun.statusCode ?? 0,
            statusText: node.lastRun.status,
            headers: node.lastRun.responseHeaders,
            body: node.lastRun.responseBody,
            responseTimeMs: node.lastRun.durationMs ?? 0,
            sentAt: node.lastRun.ranAt,
            resolvedUrl: "",
          } : null)}
          running={runningNodeIds.has(node.id)}
          onClick={() => onSelectNode(node.id)}
          onContextMenu={() => onDeleteNode(node.id)}
          onStartDrag={(event) => {
            const target = event.currentTarget.getBoundingClientRect();
            setDragging({
              nodeId: node.id,
              offsetX: (event.clientX - target.left) / viewport.scale,
              offsetY: (event.clientY - target.top) / viewport.scale,
            });
            onSelectNode(node.id);
          }}
          onStartConnect={setConnectingFrom}
          onUpdateConnectionPoint={(event) => setConnectionPoint(canvasPoint(event))}
          onCompleteConnect={(toNodeId) => {
            if (connectingFrom && connectingFrom !== toNodeId) {
              onConnectNodes(connectingFrom, toNodeId);
            }
            setConnectingFrom(null);
            setConnectionPoint(null);
          }}
        />
      ))}
      {flow.nodes.length === 0 && (
        <div className={styles.canvasEmpty}>
          <strong>Drop requests here</strong>
          <span>Drag from the Requests list to create nodes, then connect handles.</span>
        </div>
      )}
      </div>
      {flow.nodes.length > 0 && (
        <div className={styles.minimap}>
          {flow.nodes.map((node) => {
            const width = Math.max(graphBounds.maxX - graphBounds.minX, 1);
            const height = Math.max(graphBounds.maxY - graphBounds.minY, 1);
            return (
              <span
                key={node.id}
                className={selectedNodeId === node.id ? styles.minimapNodeActive : ""}
                style={{
                  left: `${((node.position.x - graphBounds.minX) / width) * 100}%`,
                  top: `${((node.position.y - graphBounds.minY) / height) * 100}%`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
