import { VariableEntry, maskVariableValue } from "../../services/variableResolver";
import styles from "./Variables.module.css";

interface VariableAutocompleteProps {
  entries: VariableEntry[];
  filter: string;
  activeIndex: number;
  onSelect: (entry: VariableEntry) => void;
}

export function VariableAutocomplete({ entries, filter, activeIndex, onSelect }: VariableAutocompleteProps) {
  const normalized = filter.toLowerCase();
  const visible = entries
    .filter((entry) => entry.name.toLowerCase().includes(normalized))
    .slice(0, 8);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className={styles.autocomplete}>
      {visible.map((entry, index) => (
        <button
          type="button"
          key={`${entry.scope}:${entry.name}`}
          className={index === activeIndex ? styles.autocompleteActive : ""}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(entry);
          }}
        >
          <strong>{entry.name}</strong>
          <span>{entry.scope}</span>
          <em>{maskVariableValue(entry.value, entry.isSecret)}</em>
        </button>
      ))}
    </div>
  );
}
