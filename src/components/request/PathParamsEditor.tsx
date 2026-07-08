import { EmptyState } from "../common/EmptyState";
import { extractVariableNames } from "../../services/variableResolver";
import { isMapPlaceholder } from "../../services/requestBody";
import styles from "./TableEditor.module.css";

interface PathParamsEditorProps {
  url: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function PathParamsEditor({ url, values, onChange }: PathParamsEditorProps) {
  const keys = extractVariableNames(url);

  if (keys.length === 0) {
    return (
      <EmptyState
        title="No path variables found"
        description="Add placeholders like {{id}} in the request URL to wire path values."
      />
    );
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <strong>Path Params</strong>
        <span>These values resolve into URL placeholders inside the request path.</span>
      </div>
      <div className="kv-editor">
        {keys.map((key) => (
          <div className={`kv-row ${isMapPlaceholder(values[key] ?? "") ? styles.mappedRow : ""}`} key={key}>
            <input value={key} readOnly />
            <div className={styles.valueCell}>
              <input
                value={values[key] ?? ""}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="value"
                onChange={(event) => onChange({ ...values, [key]: event.currentTarget.value })}
              />
              {isMapPlaceholder(values[key] ?? "") ? <span className={styles.mappedBadge}>-&gt;map ✓</span> : null}
            </div>
            <button
              type="button"
              title="Clear"
              onClick={() => {
                const next = { ...values };
                delete next[key];
                onChange(next);
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
