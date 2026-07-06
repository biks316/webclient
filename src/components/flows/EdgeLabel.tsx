import { FlowEdge, FlowNode } from "../../types/bik";
import { forwardRuleSummary } from "./forwarding";
import styles from "./FlowBuilder.module.css";

interface EdgeLabelProps {
  edge: FlowEdge;
  from: FlowNode;
  to: FlowNode;
  active: boolean;
  onClick: () => void;
}

export function mappingLabel(edge: FlowEdge) {
  return edge.label && edge.mappings.length === 0 ? edge.label : forwardRuleSummary(edge);
}

export function EdgeLabel({ edge, from, to, active, onClick }: EdgeLabelProps) {
  const left = (from.position.x + to.position.x) / 2 + 90;
  const top = (from.position.y + to.position.y) / 2 + 14;

  return (
    <button
      type="button"
      className={`${styles.edgeLabel} ${active ? styles.edgeLabelActive : ""}`}
      style={{ left, top }}
      onClick={onClick}
      title={mappingLabel(edge)}
    >
      {mappingLabel(edge)}
    </button>
  );
}
