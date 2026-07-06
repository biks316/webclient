import { Plus } from "lucide-react";
import styles from "./FlowBuilder.module.css";

interface ForwardFieldRowProps {
  label: string;
  value?: string | number | null;
  depth?: number;
  onAdd: (anchor: DOMRect) => void;
}

export function ForwardFieldRow({ label, value, depth = 0, onAdd }: ForwardFieldRowProps) {
  return (
    <div className={styles.forwardFieldRow} style={{ paddingLeft: 8 + depth * 12 }}>
      <div className={styles.forwardFieldLabel}>
        <span>{label}</span>
        {value !== undefined && value !== null && value !== "" && <em>{String(value).slice(0, 40)}</em>}
      </div>
      <button
        type="button"
        className={styles.forwardAddButton}
        title={`Forward ${label}`}
        onClick={(event) => onAdd(event.currentTarget.getBoundingClientRect())}
      >
        <Plus size={11} />
      </button>
    </div>
  );
}
