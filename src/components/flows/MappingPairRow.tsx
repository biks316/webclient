import { FunctionSquare, Trash2 } from "lucide-react";
import { FlowMapping } from "../../types/bik";
import styles from "./MappingBuilderModal.module.css";

interface MappingPairRowProps {
  mapping: FlowMapping;
  sourceLabel: string;
  sourceValue: string;
  targetLabel: string;
  active: boolean;
  onHover: (hovered: boolean) => void;
  onOpenTransform: (target: HTMLButtonElement) => void;
  onDelete: () => void;
}

export function MappingPairRow({
  mapping,
  sourceLabel,
  sourceValue,
  targetLabel,
  active,
  onHover,
  onOpenTransform,
  onDelete,
}: MappingPairRowProps) {
  return (
    <div
      className={`${styles.mappingPairRow} ${active ? styles.mappingPairRowActive : ""}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className={styles.mappingPairCard}>
        <strong>{sourceLabel}</strong>
        <span title={sourceValue}>{sourceValue}</span>
      </div>
      <div className={styles.mappingPairArrow}>&rarr;</div>
      <div className={styles.mappingPairCard}>
        <strong>{targetLabel}</strong>
        <span>-&gt;map</span>
      </div>
      <div className={styles.mappingPairActions}>
        <button type="button" className={styles.mappingMiniButton} onClick={(event) => onOpenTransform(event.currentTarget)}>
          <FunctionSquare size={14} />
          fx
        </button>
        <button type="button" className={styles.mappingMiniButton} onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
      {mapping.transformType !== "raw" ? <small className={styles.mappingChipTransform}>{mapping.transformType}</small> : null}
    </div>
  );
}
