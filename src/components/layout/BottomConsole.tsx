import { ChevronDown, ChevronUp, Trash2, X } from "lucide-react";
import styles from "./BottomConsole.module.css";

export interface ConsoleEntry {
  id: string;
  message: string;
  timestamp: string;
  tone: "info" | "success" | "warning" | "error";
}

interface BottomConsoleProps {
  collapsed: boolean;
  entries: ConsoleEntry[];
  status: string;
  onToggleCollapsed: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function BottomConsole({
  collapsed,
  entries,
  status,
  onToggleCollapsed,
  onClear,
  onClose,
}: BottomConsoleProps) {
  return (
    <section className={styles.console}>
      <div className={styles.header}>
        <div>
          <strong>Console</strong>
          <span>{status}</span>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={onClear} disabled={entries.length === 0}>
            <Trash2 size={14} />
            Clear
          </button>
          <button type="button" onClick={onToggleCollapsed}>
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button type="button" onClick={onClose} title="Hide console panel">
            <X size={14} />
            Hide
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className={styles.body}>
          {entries.length === 0 ? (
            <div className={styles.empty}>No logs to display</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className={`${styles.entry} ${styles[entry.tone]}`}>
                <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
                <span>{entry.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
