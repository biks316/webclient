import { FunctionSquare, Trash2 } from "lucide-react";
import { FlowMapping } from "../../types/bik";
import styles from "./MappingBuilderModal.module.css";

interface MappingRowProps {
  mapping: FlowMapping;
  sourceLabel: string;
  targetLabel: string;
  active: boolean;
  onHover: (hovered: boolean) => void;
  onOpenTransform: (target: HTMLButtonElement) => void;
  onDelete: () => void;
}

export function MappingRow({
  mapping,
  sourceLabel,
  targetLabel,
  active,
  onHover,
  onOpenTransform,
  onDelete,
}: MappingRowProps) {
  return (
    <div
      className={`${styles.mappingRow} ${active ? styles.mappingRowActive : ""}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className={styles.mappingRowSummary}>
        <span>{sourceLabel}</span>
        <strong>&rarr;</strong>
        <span>{targetLabel}</span>
      </div>
      <div className={styles.mappingRowActions}>
        <button type="button" className={styles.mappingFxButton} onClick={(event) => onOpenTransform(event.currentTarget)}>
          <FunctionSquare size={14} />
          fx
        </button>
        <button type="button" className={styles.mappingDeleteButton} onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
      {mapping.transformType !== "raw" && (
        <small className={styles.mappingTransformPill}>{mapping.transformType}</small>
      )}
    </div>
  );
}
