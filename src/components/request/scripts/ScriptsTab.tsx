import { useMemo, useRef, useState } from "react";
import { BikRequest, RunResponse, Scripts } from "../../../types/bik";
import { cloneJson } from "../../../services/workspaceService";
import { runRequestScript } from "../../../services/scriptRunner";
import { ScriptConsole, ScriptConsoleEntry } from "./ScriptConsole";
import { ScriptDocsPanel } from "./ScriptDocsPanel";
import { ScriptEditor, ScriptEditorHandle } from "./ScriptEditor";
import { ScriptTemplatesMenu } from "./ScriptTemplatesMenu";
import "./ScriptsTab.css";

type ScriptTabId = keyof Scripts;
type ScriptStatus = "valid" | "warning" | "error";
type ConsolePanel = "console" | "logs" | "variables";

interface ScriptsTabProps {
  scripts: Scripts;
  request: BikRequest;
  response: RunResponse | null;
  variables: Record<string, string>;
  onChange: (next: Scripts) => void;
  onSave: () => void;
}

const TAB_META: Record<ScriptTabId, { label: string; title: string; file: string }> = {
  pre: { label: "Pre-request", title: "Pre-request script", file: "pre.js" },
  post: { label: "Post-response", title: "Post-response script", file: "post.js" },
  helpers: { label: "Shared Helpers", title: "Shared helper functions", file: "helpers.js" },
};

function validateScript(tab: ScriptTabId, scripts: Scripts): { state: ScriptStatus; label: string } {
  const script = scripts[tab];
  if (!script.trim()) {
    return { state: "warning", label: "Warning" };
  }

  const source = tab === "helpers" ? script : [scripts.helpers, script].filter(Boolean).join("\n\n");
  try {
    new Function("bik", "request", "response", "variables", "console", "ctx", source);
    return { state: "valid", label: "Valid" };
  } catch {
    return { state: "error", label: "Error" };
  }
}

export function ScriptsTab({ scripts, request, response, variables, onChange, onSave }: ScriptsTabProps) {
  const [activeTab, setActiveTab] = useState<ScriptTabId>("pre");
  const [consoleEntries, setConsoleEntries] = useState<ScriptConsoleEntry[]>([]);
  const [consolePanel, setConsolePanel] = useState<ConsolePanel>("console");
  const [docsCollapsed, setDocsCollapsed] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [runtimeVariables, setRuntimeVariables] = useState<Record<string, string> | null>(null);
  const editorRef = useRef<ScriptEditorHandle | null>(null);
  const status = useMemo(() => validateScript(activeTab, scripts), [activeTab, scripts]);
  const activeMeta = TAB_META[activeTab];
  const visibleVariables = runtimeVariables ?? variables;

  function appendConsole(message: string, tone: ScriptConsoleEntry["tone"] = "info") {
    setConsoleEntries((entries) => [
      {
        id: `${Date.now()}-${entries.length}`,
        message,
        tone,
      },
      ...entries,
    ]);
  }

  async function runActiveScript() {
    const requestClone = cloneJson(request);
    const variableClone = { ...variables, ...requestClone.variables };
    const script = scripts[activeTab];
    const helpers = activeTab === "helpers" ? "" : scripts.helpers;

    appendConsole(`[script] Running ${activeMeta.file}...`);
    setConsolePanel("console");

    try {
      await runRequestScript({
        name: activeMeta.label,
        phase: activeTab === "post" ? "post" : "pre",
        script,
        helpers,
        request: requestClone,
        response: activeTab === "post" ? response ?? undefined : undefined,
        variables: variableClone,
        onLog: (message, level) => {
          appendConsole(
            `[script] ${message}`,
            level === "error" ? "error" : level === "warn" ? "warning" : "info",
          );
        },
      });
      setRuntimeVariables(variableClone);
      appendConsole(`[script] ${activeMeta.file} completed`, "success");
    } catch (error) {
      setRuntimeVariables(variableClone);
      appendConsole(error instanceof Error ? error.message : String(error), "error");
    }
  }

  return (
    <section className={`scripts-tab ${fullscreen ? "fullscreen" : ""}`}>
      <header className="scripts-header">
        <strong>Scripts</strong>
        <span className={`script-status ${status.state}`}>
          {status.state === "valid" ? "✓" : status.state === "warning" ? "⚠" : "✕"} {status.label}
        </span>
      </header>

      <nav className="script-tabs" aria-label="Script files">
        {(Object.keys(TAB_META) as ScriptTabId[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_META[tab].label}
          </button>
        ))}
      </nav>

      <div className="script-workbench">
        <div className="script-main">
          <div className="script-toolbar">
            <div className="script-toolbar-title">
              <strong>{activeMeta.title}</strong>
              <span>{activeMeta.file}</span>
            </div>
            <div className="script-toolbar-actions">
              <button type="button" onClick={() => void runActiveScript()}>Run Script</button>
              <button type="button" onClick={() => editorRef.current?.format()}>Format</button>
              <ScriptTemplatesMenu
                phase={activeTab === "post" ? "post" : activeTab === "pre" ? "pre" : "helpers"}
                onInsert={(snippet) => editorRef.current?.insertText(snippet)}
              />
              <button type="button" onClick={() => setDocsCollapsed((current) => !current)}>Docs</button>
              <button type="button" onClick={() => setMinimap((current) => !current)}>
                Minimap {minimap ? "On" : "Off"}
              </button>
              <button type="button" onClick={() => setWordWrap((current) => !current)}>
                Wrap {wordWrap ? "On" : "Off"}
              </button>
              <button type="button" onClick={onSave}>Save</button>
              <button type="button" onClick={() => setFullscreen((current) => !current)}>
                {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
            </div>
          </div>
          <ScriptEditor
            ref={editorRef}
            value={scripts[activeTab]}
            minimap={minimap}
            wordWrap={wordWrap}
            onChange={(value) => onChange({ ...scripts, [activeTab]: value })}
          />
        </div>
        <ScriptDocsPanel collapsed={docsCollapsed} onToggle={() => setDocsCollapsed((current) => !current)} />
      </div>

      <ScriptConsole
        entries={consoleEntries}
        variables={visibleVariables}
        activePanel={consolePanel}
        onPanelChange={setConsolePanel}
        onClear={() => setConsoleEntries([])}
      />
    </section>
  );
}
