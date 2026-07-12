import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { CopilotAction } from "../../types/copilot";
import styles from "./ActionToolbar.module.css";

interface ActionToolbarProps {
  actions: CopilotAction[];
  onAction: (action: CopilotAction) => void;
}

export function ActionToolbar({ actions, onAction }: ActionToolbarProps) {
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
  const confirmingAction = actions.find((action) => action.id === confirmingActionId) ?? null;

  return (
    <div className={styles.wrap}>
      <div className={styles.actions}>
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={action.destructive ? styles.destructive : styles.primary}
            disabled={action.disabled}
            onClick={() => {
              if (action.requiresConfirmation) {
                setConfirmingActionId(action.id);
                return;
              }
              onAction(action);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      {confirmingAction ? (
        <div className={styles.confirmation}>
          <div className={styles.confirmationBody}>
            <AlertTriangle size={14} />
            <span>Confirm {confirmingAction.label} before execution.</span>
          </div>
          <div className={styles.confirmationActions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                onAction(confirmingAction);
                setConfirmingActionId(null);
              }}
            >
              Confirm
            </button>
            <button type="button" className={styles.secondary} onClick={() => setConfirmingActionId(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
