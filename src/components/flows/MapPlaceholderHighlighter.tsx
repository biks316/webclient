import { Check } from "lucide-react";
import styles from "./MappingBuilderModal.module.css";

interface MapPlaceholderHighlighterProps {
  expectsMapping: boolean;
  mapped: boolean;
  active: boolean;
  value: string;
}

export function MapPlaceholderHighlighter({
  expectsMapping,
  mapped,
  active,
  value,
}: MapPlaceholderHighlighterProps) {
  if (!expectsMapping) {
    return <span className={styles.jsonStringToken}>"{value}"</span>;
  }

  return (
    <span
      className={[
        styles.placeholderToken,
        mapped ? styles.placeholderTokenMapped : "",
        active ? styles.placeholderTokenActive : "",
      ].filter(Boolean).join(" ")}
    >
      <span>"{value}"</span>
      {mapped ? <Check size={12} /> : null}
    </span>
  );
}
