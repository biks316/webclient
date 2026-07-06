import { MapPlaceholderField } from "../../services/mapPlaceholderService";
import styles from "./FlowBuilder.module.css";

interface MapPlaceholderDetectorProps {
  placeholders: MapPlaceholderField[];
  onSelect: (placeholder: MapPlaceholderField) => void;
}

export function MapPlaceholderDetector({ placeholders, onSelect }: MapPlaceholderDetectorProps) {
  if (placeholders.length === 0) {
    return <pre>{"No ->map placeholders found."}</pre>;
  }

  return (
    <div className={styles.placeholderList}>
      {placeholders.map((placeholder) => (
        <button
          key={placeholder.path}
          type="button"
          className={styles.placeholderButton}
          onClick={() => onSelect(placeholder)}
        >
          <span>{placeholder.path}</span>
          <em>-&gt;map</em>
        </button>
      ))}
    </div>
  );
}
