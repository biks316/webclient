import { FileText, Pin, Route, Trash2, Unplug, Workflow, Wrench } from "lucide-react";
import { CopilotContextReference } from "../../types/copilot";
import { IconButton } from "../common/IconButton";
import styles from "./CopilotComposer.module.css";

interface CopilotContextChipsProps {
  context: CopilotContextReference[];
  onTogglePinned: (reference: CopilotContextReference) => void;
  onRemove: (reference: CopilotContextReference) => void;
}

function iconFor(reference: CopilotContextReference) {
  switch (reference.type) {
    case "request":
      return <Wrench size={12} />;
    case "collection":
      return <Route size={12} />;
    case "flow":
    case "flow-node":
      return <Workflow size={12} />;
    case "file":
    case "schema":
      return <FileText size={12} />;
    case "environment":
      return <Unplug size={12} />;
    case "response":
      return <Route size={12} />;
  }
}

export function CopilotContextChips({ context, onTogglePinned, onRemove }: CopilotContextChipsProps) {
  if (context.length === 0) {
    return null;
  }

  return (
    <div className={styles.chips} aria-label="Attached context">
      {context.map((reference) => (
        <div key={`${reference.type}:${"id" in reference ? reference.id : reference.path}`} className={`${styles.chip} ${reference.pinned ? styles.chipPinned : ""}`}>
          <span className={styles.chipIcon}>{iconFor(reference)}</span>
          <span className={styles.chipLabel}>{reference.label}</span>
          <IconButton
            title={reference.pinned ? "Unpin context" : "Pin to session"}
            aria-label={reference.pinned ? "Unpin context" : "Pin context"}
            onClick={() => onTogglePinned(reference)}
          >
            <Pin size={11} />
          </IconButton>
          <IconButton
            title="Remove context"
            aria-label="Remove context"
            onClick={() => onRemove(reference)}
          >
            <Trash2 size={11} />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
