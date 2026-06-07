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
  collection: CollectionIndex;
  flow: FlowDefinition;
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
  lastResponses: Record<string, RunResponse | null>;
  runningNodeIds: Set<string>;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectCanvas: () => void;
  onDropEndpoint: (payload: DragEndpointPayload, position: { x: number; y: number }) => void;
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
  onConnectNodes: (from: string, to: string) => void;
}

export type DragEndpointPayload = RequestDragPayload;

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
  collection,
  flow,
  selectedEdgeId,
  selectedNodeId,
  lastResponses,
  runningNodeIds,
  onSelectEdge,
  onSelectNode,
  onSelectCanvas,
  onDropEndpoint,
  onMoveNode,
  onConnectNodes,
}: FlowCanvasProps) {
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectionPoint, setConnectionPoint] = useState<{ x: number; y: number } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [dragging, setDragging] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const handledDropRef = useRef(false);

  function canvasPointFromClient(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left + canvas.scrollLeft,
      y: clientY - rect.top + canvas.scrollTop,
    };
  }

  function canvasPoint(event: { clientX: number; clientY: number }) {
    return canvasPointFromClient(event.clientX, event.clientY);
  }

  const connectingNode = connectingFrom ? flow.nodes.find((node) => node.id === connectingFrom) ?? null : null;
  const connectionStart = connectingNode
    ? { x: connectingNode.position.x + 190, y: connectingNode.position.y + 36 }
    : null;

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
  }, [onDropEndpoint]);

  return (
    <div
      ref={canvasRef}
      className={`${styles.canvas} ${dropActive ? `${styles.canvasDropActive} is-drag-over` : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onSelectCanvas();
        }
      }}
      onMouseMove={(event) => {
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
      }}
      onMouseLeave={() => setDragging(null)}
    >
      <svg className={styles.edges} width="100%" height="100%">
        <defs>
          <marker id="flow-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#60a5fa" />
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
              className={`${styles.edgePath} ${selectedEdgeId === edge.id ? styles.edgePathActive : ""}`}
              markerEnd="url(#flow-arrow)"
              onClick={() => onSelectEdge(edge.id)}
            />
          );
        })}
        {connectionStart && connectionPoint && (
          <path
            d={connectionPath(connectionStart, connectionPoint)}
            className={styles.connectionPreview}
            markerEnd="url(#flow-arrow)"
          />
        )}
      </svg>
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
            onClick={() => onSelectEdge(edge.id)}
          />
        );
      })}
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
          onStartDrag={(event) => {
            const target = event.currentTarget.getBoundingClientRect();
            setDragging({
              nodeId: node.id,
              offsetX: event.clientX - target.left,
              offsetY: event.clientY - target.top,
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
  );
}
