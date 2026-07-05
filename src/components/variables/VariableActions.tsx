import { Copy, Edit3, MoreHorizontal, Trash2, Files } from "lucide-react";
import { ManagedVariable } from "./VariableManagerTypes";
import styles from "./Variables.module.css";

interface VariableActionsProps {
  variable: ManagedVariable;
  onEdit: (variable: ManagedVariable) => void;
  onCopy: (variable: ManagedVariable) => void;
  onDuplicate: (variable: ManagedVariable) => void;
  onDelete: (variable: ManagedVariable) => void;
}

export function VariableActions({ variable, onEdit, onCopy, onDuplicate, onDelete }: VariableActionsProps) {
  return (
    <div className={styles.managerActions}>
      <button type="button" title="Edit" onClick={() => onEdit(variable)}>
        <Edit3 size={13} />
      </button>
      <button type="button" title="Copy value" onClick={() => onCopy(variable)}>
        <Copy size={13} />
      </button>
      <button type="button" title="Duplicate" onClick={() => onDuplicate(variable)}>
        <Files size={13} />
      </button>
      <button type="button" title="Delete" onClick={() => onDelete(variable)}>
        <Trash2 size={13} />
      </button>
      <button type="button" title="More actions">
        <MoreHorizontal size={13} />
      </button>
    </div>
  );
}
