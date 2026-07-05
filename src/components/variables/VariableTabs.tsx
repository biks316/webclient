import { ManagedVariable, VARIABLE_SCOPE_LABEL, VARIABLE_SCOPE_ORDER, VariableScopeKey } from "./VariableManagerTypes";
import styles from "./Variables.module.css";

interface VariableTabsProps {
  activeScope: VariableScopeKey;
  variables: ManagedVariable[];
  onChange: (scope: VariableScopeKey) => void;
}

export function VariableTabs({ activeScope, variables, onChange }: VariableTabsProps) {
  return (
    <nav className={styles.managerTabs} aria-label="Variable scopes">
      {VARIABLE_SCOPE_ORDER.map((scope) => {
        const count = variables.filter((variable) => variable.scope === scope).length;
        return (
          <button
            key={scope}
            type="button"
            className={activeScope === scope ? styles.managerTabActive : ""}
            onClick={() => onChange(scope)}
          >
            {activeScope === scope && <span className={styles.managerTabPill} />}
            <span>{VARIABLE_SCOPE_LABEL[scope]}</span>
            <em>{count}</em>
          </button>
        );
      })}
    </nav>
  );
}
