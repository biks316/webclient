import { createPortal } from "react-dom";
import { FileText, Hash, Route, Unplug, Workflow, Wrench } from "lucide-react";
import { CopilotContextSearchItem } from "../../types/copilot";
import styles from "./CopilotComposer.module.css";

interface CopilotMentionMenuProps {
  open: boolean;
  items: CopilotContextSearchItem[];
  activeIndex: number;
  anchor: { top: number; left: number } | null;
  onSelect: (item: CopilotContextSearchItem) => void;
}

function iconFor(item: CopilotContextSearchItem) {
  switch (item.reference.type) {
    case "request":
      return <Wrench size={12} />;
    case "collection":
      return <Route size={12} />;
    case "flow":
    case "flow-node":
      return <Workflow size={12} />;
    case "environment":
      return <Unplug size={12} />;
    case "schema":
      return <Hash size={12} />;
    case "file":
      return <FileText size={12} />;
    case "response":
      return <Route size={12} />;
  }
}

export function CopilotMentionMenu({ open, items, activeIndex, anchor, onSelect }: CopilotMentionMenuProps) {
  if (!open || !anchor) {
    return null;
  }

  return createPortal(
    <div className={styles.mentionMenu} style={{ top: anchor.top, left: anchor.left }} role="listbox" aria-label="Copilot context suggestions">
      {items.length === 0 ? (
        <div className={styles.mentionEmpty}>No matching context</div>
      ) : (
        items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={`${styles.mentionItem} ${index === activeIndex ? styles.mentionItemActive : ""}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(item)}
          >
            <span className={styles.mentionItemIcon}>{iconFor(item)}</span>
            <span className={styles.mentionItemBody}>
              <strong>{item.title}</strong>
              {item.subtitle ? <small>{item.subtitle}</small> : null}
            </span>
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}
