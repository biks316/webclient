export interface ScriptConsoleEntry {
  id: string;
  message: string;
  tone: "info" | "success" | "warning" | "error";
}

interface ScriptConsoleProps {
  entries: ScriptConsoleEntry[];
  variables: Record<string, string>;
  activePanel: "console" | "logs" | "variables";
  onPanelChange: (panel: ScriptConsoleProps["activePanel"]) => void;
  onClear: () => void;
}

export function ScriptConsole({
  entries,
  variables,
  activePanel,
  onPanelChange,
  onClear,
}: ScriptConsoleProps) {
  return (
    <section className="script-console">
      <div className="script-console-tabs">
        <button
          type="button"
          className={activePanel === "console" ? "active" : ""}
          onClick={() => onPanelChange("console")}
        >
          Script Console
        </button>
        <button
          type="button"
          className={activePanel === "logs" ? "active" : ""}
          onClick={() => onPanelChange("logs")}
        >
          Execution Logs
        </button>
        <button
          type="button"
          className={activePanel === "variables" ? "active" : ""}
          onClick={() => onPanelChange("variables")}
        >
          Script Variables
        </button>
        <button type="button" className="script-console-clear" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="script-console-body">
        {activePanel === "variables" ? (
          Object.keys(variables).length === 0 ? (
            <span className="script-console-empty">No variables available.</span>
          ) : (
            <div className="script-variable-list">
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} className="script-variable-row">
                  <strong>{key}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          )
        ) : entries.length === 0 ? (
          <span className="script-console-empty">No script output yet.</span>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className={`script-console-entry ${entry.tone}`}>
              <span>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
