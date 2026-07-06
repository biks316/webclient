import { PencilLine, Trash2 } from "lucide-react";
import { FlowEdge } from "../../types/bik";
import { forwardRuleLabel, forwardRuleSummary, mappingToForwardRule } from "./forwarding";
import styles from "./FlowBuilder.module.css";

interface ForwardRuleListProps {
  edge: FlowEdge;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

export function ForwardRuleList({ edge, onEdit, onDelete }: ForwardRuleListProps) {
  if (edge.mappings.length === 0) {
    return (
      <div className={styles.forwardRuleEmpty}>
        <strong>{forwardRuleSummary(edge)}</strong>
        <span>No values forwarded yet.</span>
      </div>
    );
  }

  return (
    <div className={styles.forwardRuleList}>
      <div className={styles.forwardRuleSummary}>
        <strong>{forwardRuleSummary(edge)}</strong>
        <span>Click a row to edit or remove it.</span>
      </div>
      {edge.mappings.map((mapping, index) => {
        const rule = mappingToForwardRule(edge, mapping);
        return (
          <div key={`${mapping.sourcePath}-${mapping.targetPath}-${index}`} className={styles.forwardRuleRow}>
            <span>{forwardRuleLabel(rule)}</span>
            <div className={styles.forwardRuleActions}>
              <button type="button" title="Edit" onClick={() => onEdit(index)}>
                <PencilLine size={12} />
              </button>
              <button type="button" title="Delete" onClick={() => onDelete(index)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
