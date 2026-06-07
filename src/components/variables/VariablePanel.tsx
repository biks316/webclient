import {
  buildVariableEntries,
  extractVariableNames,
  maskVariableValue,
  VariableContext,
  VariableScope,
} from "../../services/variableResolver";
import styles from "./Variables.module.css";

interface VariablePanelProps {
  context: VariableContext;
  usedText?: string;
}

const GROUPS: Array<{ scope: VariableScope; label: string }> = [
  { scope: "environment", label: "Environment variables" },
  { scope: "collection", label: "Collection variables" },
  { scope: "flow", label: "Flow variables" },
  { scope: "runtime", label: "Runtime variables" },
  { scope: "global", label: "Global variables" },
];

export function VariablePanel({ context, usedText = "" }: VariablePanelProps) {
  const entries = buildVariableEntries(context);
  const used = extractVariableNames(usedText);

  return (
    <div className={styles.panel}>
      {GROUPS.map((group) => {
        const scoped = entries.filter((entry) => entry.scope === group.scope);
        return (
          <section key={group.scope}>
            <h4>{group.label}</h4>
            {scoped.length === 0 ? (
              <p>No variables</p>
            ) : (
              scoped.map((entry) => (
                <div key={`${entry.scope}:${entry.name}`} className={styles.variableRow}>
                  <strong>{entry.name}</strong>
                  <span className={`${styles.badge} ${styles[`scope_${entry.scope}`]}`}>{entry.scope}</span>
                  <em>{maskVariableValue(entry.value, entry.isSecret)}</em>
                  {entry.isSecret && <span title="Sensitive variable">lock</span>}
                  <small>{used.filter((name) => name === entry.name).length} used</small>
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
