import { Check } from "lucide-react";
import styles from "./MappingBuilderModal.module.css";

interface MapPlaceholderPillProps {
  mapped: boolean;
  active: boolean;
  value: string;
}

export function MapPlaceholderPill({ mapped, active, value }: MapPlaceholderPillProps) {
  return (
    <span
      className={[
        styles.placeholderToken,
        mapped ? styles.placeholderTokenMapped : "",
        active ? styles.placeholderTokenActive : "",
        !mapped ? styles.placeholderTokenUnmapped : "",
      ].filter(Boolean).join(" ")}
    >
      <span>{value}</span>
      {mapped ? <Check size={12} /> : null}
    </span>
  );
}
