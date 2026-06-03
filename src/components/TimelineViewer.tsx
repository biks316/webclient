import { Clock, FileJson } from "lucide-react";
import { EndpointIndex } from "../types/bik";

interface TimelineViewerProps {
  endpoint: EndpointIndex | null;
  selectedHistoryPath: string | null;
  onSelectHistory: (path: string) => void;
}

export function TimelineViewer({
  endpoint,
  selectedHistoryPath,
  onSelectHistory,
}: TimelineViewerProps) {
  return (
    <aside className="timeline-panel">
      <div className="panel-heading">
        <Clock size={17} />
        <strong>API Timeline</strong>
      </div>
      {endpoint ? (
        <>
          <div className="timeline-section">
            <span>History</span>
            {endpoint.history.length === 0 && (
              <div className="empty-state">Save edits to create history snapshots.</div>
            )}
            {endpoint.history.map((entry) => (
              <button
                type="button"
                key={entry.path}
                className={selectedHistoryPath === entry.path ? "active" : ""}
                onClick={() => onSelectHistory(entry.path)}
              >
                <FileJson size={14} />
                <div>
                  <strong>{entry.name}</strong>
                  <small>{new Date(entry.createdAt).toLocaleString()}</small>
                </div>
              </button>
            ))}
          </div>
          <div className="timeline-section">
            <span>Examples</span>
            {endpoint.examples.length === 0 && (
              <div className="empty-state">Saved responses appear here.</div>
            )}
            {endpoint.examples.map((entry) => (
              <div className="example-row" key={entry.path}>
                <FileJson size={14} />
                <div>
                  <strong>{entry.name}</strong>
                  <small>{new Date(entry.createdAt).toLocaleString()}</small>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">Select an endpoint to inspect history.</div>
      )}
    </aside>
  );
}
