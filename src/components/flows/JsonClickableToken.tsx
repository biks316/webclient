import { forwardRef, ReactNode } from "react";
import styles from "./MappingBuilderModal.module.css";

interface JsonClickableTokenProps {
  lineNumber: number;
  depth: number;
  interactive?: boolean;
  selected?: boolean;
  active?: boolean;
  mapped?: boolean;
  glow?: boolean;
  dimmed?: boolean;
  invalid?: boolean;
  match?: boolean;
  anchor?: "source" | "target" | null;
  children: ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  ariaLabel?: string;
}

export const JsonClickableToken = forwardRef<HTMLButtonElement, JsonClickableTokenProps>(function JsonClickableToken({
  lineNumber,
  depth,
  interactive = false,
  selected = false,
  active = false,
  mapped = false,
  glow = false,
  dimmed = false,
  invalid = false,
  match = false,
  anchor = null,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  ariaLabel,
}, ref) {
  const className = [
    styles.jsonCodeLine,
    interactive ? styles.jsonCodeLineInteractive : "",
    selected ? styles.jsonCodeLineSelected : "",
    active ? styles.jsonCodeLineActive : "",
    mapped ? styles.jsonCodeLineMapped : "",
    glow ? styles.jsonCodeLineGlow : "",
    dimmed ? styles.jsonCodeLineDimmed : "",
    invalid ? styles.jsonCodeLineInvalid : "",
    match ? styles.jsonCodeLineMatch : "",
  ].filter(Boolean).join(" ");

  const content = (
    <>
      <span className={styles.jsonLineNumber}>{lineNumber}</span>
      <span className={styles.jsonLineIndent} style={{ width: depth * 18 }} aria-hidden="true" />
      <span className={styles.jsonLineContent}>
        {anchor ? <span className={`${styles.jsonAnchor} ${anchor === "source" ? styles.jsonAnchorSource : styles.jsonAnchorTarget}`} /> : null}
        {children}
      </span>
    </>
  );

  if (!interactive) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );
});
