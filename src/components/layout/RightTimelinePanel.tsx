import { Clock3, History, RotateCcw, Split, X } from "lucide-react";
import { EmptyState } from "../common/EmptyState";
import { EndpointIndex, DiffRow } from "../../types/bik";
import styles from "./RightTimelinePanel.module.css";

interface RightTimelinePanelProps {
  endpoint: EndpointIndex | null;
  diffRows: DiffRow[];
  selectedHistoryPath: string | null;
  onClose: () => void;
  onSelectHistory: (path: string) => void;
  onCompare: (path: string) => void;
  onRestore: (path: string) => void;
}

export function RightTimelinePanel({
  endpoint,
  diffRows,
  selectedHistoryPath,
  onClose,
  onSelectHistory,
  onCompare,
  onRestore,
}: RightTimelinePanelProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div>
          <strong>API Timeline</strong>
          <span>Version history and payload changes</span>
        </div>
        <button type="button" onClick={onClose} className={styles.closeButton}>
          <X size={14} />
        </button>
      </div>

      {!endpoint ? (
        <div className={styles.empty}>
          <EmptyState
            title="No request selected"
            description="Choose a request to inspect its saved snapshots and examples."
            icon={Clock3}
          />
        </div>
      ) : (
        <div className={styles.body}>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <History size={14} />
              <span>Current version</span>
            </div>
            <div className={styles.current}>
              <strong>{endpoint.name}</strong>
              <span>{endpoint.request.method}</span>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <Clock3 size={14} />
              <span>Older request versions</span>
            </div>
            {endpoint.history.length === 0 ? (
              <div className={styles.emptyBox}>Save edits to create timeline entries.</div>
            ) : (
              <div className={styles.historyList}>
                {endpoint.history.map((entry) => {
                  const active = selectedHistoryPath === entry.path;
                  return (
                    <div key={entry.path} className={`${styles.historyCard} ${active ? styles.historyCardActive : ""}`}>
                      <button type="button" className={styles.historyMain} onClick={() => onSelectHistory(entry.path)}>
                        <strong>{entry.name}</strong>
                        <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      </button>
                      <div className={styles.historyActions}>
                        <button type="button" onClick={() => onCompare(entry.path)}>
                          <Split size={13} />
                          Compare
                        </button>
                        <button type="button" onClick={() => onRestore(entry.path)}>
                          <RotateCcw size={13} />
                          Restore
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <Split size={14} />
              <span>Payload changes</span>
            </div>
            {!selectedHistoryPath ? (
              <div className={styles.emptyBox}>Select a version to compare with current.</div>
            ) : diffRows.length === 0 ? (
              <div className={styles.emptyBox}>No changes from the selected version.</div>
            ) : (
              <div className={styles.diffList}>
                {diffRows.map((row) => (
                  <div key={`${row.path}-${row.change}`} className={styles.diffRow}>
                    <strong>{row.path}</strong>
                    <span>{row.change}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
