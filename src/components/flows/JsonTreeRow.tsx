import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { forwardRef } from "react";
import styles from "./MappingBuilderModal.module.css";

interface JsonTreeRowProps {
  depth: number;
  label: string;
  value?: string;
  expandable?: boolean;
  expanded?: boolean;
  interactive?: boolean;
  selected?: boolean;
  active?: boolean;
  mapped?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const JsonTreeRow = forwardRef<HTMLButtonElement, JsonTreeRowProps>(function JsonTreeRow({
  depth,
  label,
  value,
  expandable = false,
  expanded = false,
  interactive = false,
  selected = false,
  active = false,
  mapped = false,
  onToggle,
  onClick,
  onMouseEnter,
  onMouseLeave,
}, ref) {
  const className = [
    styles.jsonTreeRow,
    interactive ? styles.jsonTreeRowInteractive : "",
    selected ? styles.jsonTreeRowSelected : "",
    active ? styles.jsonTreeRowActive : "",
    mapped ? styles.jsonTreeRowMapped : "",
  ].filter(Boolean).join(" ");

  if (interactive) {
    return (
      <button
        ref={ref}
        type="button"
        className={className}
        style={{ paddingLeft: `${depth * 18 + 10}px` }}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className={styles.jsonTreeRowLead}>
          <span className={styles.jsonTreeLeafDot} />
          <span className={styles.jsonTreeKey}>{label}</span>
        </div>
        <div className={styles.jsonTreeRowValue} title={value}>
          {value ? <span>{value}</span> : null}
          {mapped ? <Check size={12} className={styles.jsonTreeMappedIcon} /> : null}
        </div>
      </button>
    );
  }

  return (
    <div
      className={className}
      style={{ paddingLeft: `${depth * 18 + 10}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.jsonTreeRowLead}>
        {expandable ? (
          <button type="button" className={styles.jsonTreeToggleButton} onClick={onToggle} aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className={styles.jsonTreeLeafDot} />
        )}
        <span className={styles.jsonTreeKey}>{label}</span>
      </div>
      <div className={styles.jsonTreeRowValue} title={value}>
        {value ? <span>{value}</span> : null}
      </div>
    </div>
  );
});
