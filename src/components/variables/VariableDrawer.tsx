import { X } from "lucide-react";
import {
  VARIABLE_SCOPE_LABEL,
  VARIABLE_SCOPE_ORDER,
  VariableDraft,
  VariableScopeKey,
  VariableType,
} from "./VariableManagerTypes";
import styles from "./Variables.module.css";

interface VariableDrawerProps {
  draft: VariableDraft | null;
  onChange: (draft: VariableDraft) => void;
  onClose: () => void;
  onSave: () => void;
}

const VARIABLE_TYPES: VariableType[] = ["default", "secret", "computed", "readonly"];

export function VariableDrawer({ draft, onChange, onClose, onSave }: VariableDrawerProps) {
  if (!draft) {
    return null;
  }

  function update(patch: Partial<VariableDraft>) {
    if (!draft) {
      return;
    }
    onChange({ ...draft, ...patch });
  }

  return (
    <div className={styles.managerDrawerScrim} role="presentation">
      <aside className={styles.managerDrawer} aria-label="Variable editor">
        <header>
          <div>
            <strong>{draft.id ? "Edit Variable" : "New Variable"}</strong>
            <span>Changes apply to the selected variable scope.</span>
          </div>
          <button type="button" onClick={onClose} title="Close editor">
            <X size={16} />
          </button>
        </header>

        <div className={styles.managerDrawerFields}>
          <label>
            <span>Variable Name</span>
            <input value={draft.name} onChange={(event) => update({ name: event.currentTarget.value })} />
          </label>
          <label>
            <span>Initial Value</span>
            <textarea value={draft.initialValue} onChange={(event) => update({ initialValue: event.currentTarget.value })} />
          </label>
          <label>
            <span>Current Value</span>
            <textarea value={draft.currentValue} onChange={(event) => update({ currentValue: event.currentTarget.value })} />
          </label>
          <label>
            <span>Description</span>
            <textarea value={draft.description} onChange={(event) => update({ description: event.currentTarget.value })} />
          </label>
          <label>
            <span>Scope</span>
            <select value={draft.scope} onChange={(event) => update({ scope: event.currentTarget.value as VariableScopeKey })}>
              {VARIABLE_SCOPE_ORDER.map((scope) => (
                <option key={scope} value={scope}>
                  {VARIABLE_SCOPE_LABEL[scope]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select value={draft.type} onChange={(event) => update({ type: event.currentTarget.value as VariableType })}>
              {VARIABLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Group</span>
            <input value={draft.group} onChange={(event) => update({ group: event.currentTarget.value })} />
          </label>
        </div>

        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className={styles.managerPrimaryButton} onClick={onSave} disabled={!draft.name.trim()}>
            Save
          </button>
        </footer>
      </aside>
    </div>
  );
}
