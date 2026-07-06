import { FunctionSquare, Trash2 } from "lucide-react";
import { FlowMapping } from "../../types/bik";
import styles from "./MappingBuilderModal.module.css";

interface MappingChipProps {
  mapping: FlowMapping;
  sourceLabel: string;
  targetLabel: string;
  active: boolean;
  onHover: (hovered: boolean) => void;
  onOpenTransform: (target: HTMLButtonElement) => void;
  onDelete: () => void;
}

export function MappingChip({
  mapping,
  sourceLabel,
  targetLabel,
  active,
  onHover,
  onOpenTransform,
  onDelete,
}: MappingChipProps) {
  return (
    <div
      className={`${styles.mappingChip} ${active ? styles.mappingChipActive : ""}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className={styles.mappingChipText}>
        <span>{sourceLabel}</span>
        <strong>&rarr;</strong>
        <span>{targetLabel}</span>
      </div>
      <div className={styles.mappingChipActions}>
        <button type="button" className={styles.mappingMiniButton} onClick={(event) => onOpenTransform(event.currentTarget)} aria-label={`Edit transform for ${targetLabel}`}>
          <FunctionSquare size={14} />
          fx
        </button>
        <button type="button" className={styles.mappingMiniButton} onClick={onDelete} aria-label={`Delete mapping ${targetLabel}`}>
          <Trash2 size={14} />
        </button>
      </div>
      {mapping.transformType !== "raw" ? <small className={styles.mappingChipTransform}>{mapping.transformType}</small> : null}
    </div>
  );
}
