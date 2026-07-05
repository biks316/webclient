import { Eye, EyeOff } from "lucide-react";
import { MouseEvent } from "react";
import { ManagedVariable } from "./VariableManagerTypes";
import { VariableActions } from "./VariableActions";
import { VariableBadge } from "./VariableBadge";
import styles from "./Variables.module.css";

interface VariableRowProps {
  variable: ManagedVariable;
  masked: boolean;
  onToggleMask: (id: string) => void;
  onToggleEnabled: (variable: ManagedVariable) => void;
  onEdit: (variable: ManagedVariable) => void;
  onCopy: (variable: ManagedVariable) => void;
  onDuplicate: (variable: ManagedVariable) => void;
  onDelete: (variable: ManagedVariable) => void;
  onUsage: (variable: ManagedVariable) => void;
  onContextMenu: (event: MouseEvent, variable: ManagedVariable) => void;
}

function displayValue(variable: ManagedVariable, value: string, masked: boolean) {
  if (variable.type !== "secret" || !masked) {
    return value || "-";
  }
  return "**************";
}

export function VariableRow({
  variable,
  masked,
  onToggleMask,
  onToggleEnabled,
  onEdit,
  onCopy,
  onDuplicate,
  onDelete,
  onUsage,
  onContextMenu,
}: VariableRowProps) {
  return (
    <div
      className={styles.managerRow}
      onDoubleClick={() => onEdit(variable)}
      onContextMenu={(event) => onContextMenu(event, variable)}
    >
      <label className={styles.managerCheck}>
        <input
          type="checkbox"
          checked={variable.enabled}
          onChange={() => onToggleEnabled(variable)}
          aria-label={`Enable ${variable.name}`}
        />
      </label>
      <strong title={variable.name}>{variable.name}</strong>
      <span title={variable.initialValue}>{displayValue(variable, variable.initialValue, masked)}</span>
      <span className={styles.managerValueCell} title={variable.currentValue}>
        {displayValue(variable, variable.currentValue, masked)}
        {variable.type === "secret" && (
          <button type="button" title={masked ? "Reveal secret" : "Mask secret"} onClick={() => onToggleMask(variable.id)}>
            {masked ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        )}
      </span>
      <span title={variable.description}>{variable.description || "-"}</span>
      <VariableBadge type={variable.type} />
      <button type="button" className={styles.managerUsageButton} onClick={() => onUsage(variable)}>
        {variable.usedCount === 1 ? "Used once" : `Used in ${variable.usedCount} requests`}
      </button>
      <VariableActions
        variable={variable}
        onEdit={onEdit}
        onCopy={onCopy}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </div>
  );
}
