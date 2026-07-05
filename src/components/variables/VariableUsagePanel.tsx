import { X } from "lucide-react";
import { ManagedVariable } from "./VariableManagerTypes";
import styles from "./Variables.module.css";

interface VariableUsagePanelProps {
  variable: ManagedVariable | null;
  onClose: () => void;
}

export function VariableUsagePanel({ variable, onClose }: VariableUsagePanelProps) {
  if (!variable) {
    return null;
  }

  return (
    <aside className={styles.managerUsagePanel}>
      <header>
        <div>
          <strong>{variable.name}</strong>
          <span>{variable.usedCount === 1 ? "Used once" : `Used in ${variable.usedCount} requests`}</span>
        </div>
        <button type="button" onClick={onClose} title="Close usage panel">
          <X size={14} />
        </button>
      </header>
      <div className={styles.managerUsageList}>
        {variable.usages.length === 0 ? (
          <p>No request references found in the current editor context.</p>
        ) : (
          variable.usages.map((usage) => (
            <button type="button" key={usage.id}>
              <strong>{usage.requestName}</strong>
              <span>{usage.location}</span>
              <code>{usage.excerpt}</code>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
