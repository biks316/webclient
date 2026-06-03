import { DiffRow } from "../types/bik";

interface DiffViewerProps {
  rows: DiffRow[];
  selectedHistoryPath: string | null;
}

export function DiffViewer({ rows, selectedHistoryPath }: DiffViewerProps) {
  if (!selectedHistoryPath) {
    return null;
  }

  return (
    <section className="diff-viewer">
      <div className="panel-heading">
        <strong>Diff vs selected history</strong>
        <span>{rows.length} changes</span>
      </div>
      {rows.length === 0 ? (
        <div className="empty-panel">No changes from the selected version.</div>
      ) : (
        <div className="diff-table">
          {rows.map((row) => (
            <div className={`diff-row ${row.change}`} key={`${row.path}-${row.change}`}>
              <strong>{row.path}</strong>
              <span>{row.change}</span>
              <code>{format(row.before)}</code>
              <code>{format(row.after)}</code>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function format(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}
