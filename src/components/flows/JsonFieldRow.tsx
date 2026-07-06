import { Check, ChevronDown, ChevronRight, Circle, Copy } from "lucide-react";
import styles from "./MappingBuilderModal.module.css";

interface JsonFieldRowProps {
  label: string;
  preview: string;
  path: string;
  mode: "source" | "target";
  mapped?: boolean;
  active?: boolean;
  selected?: boolean;
  expectsMapping?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  glow?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
  onCopy?: () => void;
  onHoverChange?: (hovered: boolean) => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
  ariaLabel: string;
}

export function JsonFieldRow({
  label,
  preview,
  path,
  mode,
  mapped = false,
  active = false,
  selected = false,
  expectsMapping = false,
  expandable = false,
  expanded = false,
  glow = false,
  onToggle,
  onClick,
  onCopy,
  onHoverChange,
  buttonRef,
  ariaLabel,
}: JsonFieldRowProps) {
  return (
    <div className={styles.jsonFieldRow}>
      {expandable ? (
        <button type="button" className={styles.jsonToggle} onClick={onToggle} aria-label={expanded ? "Collapse branch" : "Expand branch"}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span className={styles.jsonToggleSpacer} />
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        className={[
          styles.jsonFieldButton,
          styles[`jsonFieldButton_${mode}`],
          mapped ? styles.jsonFieldMapped : "",
          active ? styles.jsonFieldActive : "",
          selected ? styles.jsonFieldSelected : "",
          glow ? styles.jsonFieldGlow : "",
        ].join(" ")}
        onClick={onClick}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
      >
        <span className={styles.jsonFieldLead}>
          {mapped ? <Check size={14} /> : <Circle size={10} />}
          <span className={styles.jsonFieldText}>
            <span className={styles.jsonFieldTitleRow}>
              <strong>{label}</strong>
              {expectsMapping ? <small className={styles.placeholderBadge}>{mapped ? "->map ✓" : "->map"}</small> : null}
            </span>
            <span className={styles.jsonFieldMeta}>{path}</span>
          </span>
        </span>
        <span className={styles.jsonFieldActions}>
          <span className={styles.jsonFieldPreview}>{preview || "empty"}</span>
          {onCopy ? (
            <span
              className={styles.copyAction}
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onCopy();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onCopy();
                }
              }}
              aria-label={`Copy path ${path}`}
            >
              <Copy size={13} />
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
