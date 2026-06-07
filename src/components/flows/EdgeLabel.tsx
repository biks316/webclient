import { FlowEdge, FlowNode } from "../../types/bik";
import styles from "./FlowBuilder.module.css";

interface EdgeLabelProps {
  edge: FlowEdge;
  from: FlowNode;
  to: FlowNode;
  active: boolean;
  onClick: () => void;
}

export function mappingLabel(edge: FlowEdge) {
  if (edge.label) {
    return edge.label;
  }
  if (edge.mappings.length === 0) {
    return "Add mapping";
  }
  if (edge.mappings.length > 1) {
    return `${edge.mappings.length} mappings`;
  }
  const mapping = edge.mappings[0];
  const source = mapping.sourceLabel || mapping.sourcePath?.split(".").pop() || "value";
  const target = mapping.targetKey || mapping.targetPath?.split(".").pop() || "target";
  return `${source} → ${target}`;
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
      Add mapping
    </button>
  );
}
