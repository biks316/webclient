import { FlowNode, RunResponse } from "../../types/bik";
import { MethodBadge } from "../common/MethodBadge";
import type { MouseEvent } from "react";
import styles from "./FlowBuilder.module.css";

interface RequestFlowNodeProps {
  node: FlowNode;
  method: string;
  active: boolean;
  lastResponse: RunResponse | null;
  running: boolean;
  onClick: () => void;
  onContextMenu: () => void;
  onStartDrag: (event: MouseEvent<HTMLDivElement>) => void;
  onStartConnect: (nodeId: string) => void;
  onUpdateConnectionPoint: (event: MouseEvent<HTMLElement>) => void;
  onCompleteConnect: (nodeId: string) => void;
}

export function RequestFlowNode({
  node,
  method,
  active,
  lastResponse,
  running,
  onClick,
  onContextMenu,
  onStartDrag,
  onStartConnect,
  onUpdateConnectionPoint,
  onCompleteConnect,
}: RequestFlowNodeProps) {
  const status = running ? "running" : node.lastRun?.status === "failed" ? "failed" : node.lastRun?.status === "success" ? "success" : "idle";
  return (
    <div
      className={`${styles.requestNode} ${active ? styles.requestNodeActive : ""}`}
      style={{ left: node.position.x, top: node.position.y }}
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu();
      }}
      onMouseDown={onStartDrag}
    >
      <button
        type="button"
        className={`${styles.connector} ${styles.connectorIn}`}
        title="Drop connection here"
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => {
          event.stopPropagation();
          onCompleteConnect(node.id);
        }}
      />
      <div className={styles.nodeTitle}>
        <MethodBadge method={method} compact />
        <strong>{node.name}</strong>
      </div>
      <small>{lastResponse ? `${lastResponse.status} ${lastResponse.statusText || ""}`.trim() : "No run yet"}</small>
      <span className={`${styles.nodeStatus} ${styles[`nodeStatus_${status}`]}`}>
        {status === "idle" ? "Not run" : status}
      </span>
      <button
        type="button"
        className={`${styles.connector} ${styles.connectorOut}`}
        title="Drag to connect"
        onMouseDown={(event) => {
          event.stopPropagation();
          onStartConnect(node.id);
          onUpdateConnectionPoint(event);
        }}
      />
    </div>
  );
}
