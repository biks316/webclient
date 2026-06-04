import { ChevronDown, ChevronUp, Gauge, Route, TerminalSquare, Trash2, Wifi, X } from "lucide-react";
import { ResponseViewer } from "../response/ResponseViewer";
import { DiffRow, RunResponse } from "../../types/bik";
import styles from "./BottomConsole.module.css";

export interface ConsoleEntry {
  id: string;
  message: string;
  timestamp: string;
  tone: "info" | "success" | "warning" | "error";
}

export type BottomDockTab = "response" | "console" | "timeline" | "network" | "performance";

interface FlowItem {
  id: string;
  method: string;
  name: string;
}

interface BottomConsoleProps {
  collapsed: boolean;
  entries: ConsoleEntry[];
  status: string;
  activeTab: BottomDockTab;
  response: RunResponse | null;
  responseError: string | null;
  responseBusy: boolean;
  responseTab: "response" | "headers" | "timeline" | "tests";
  diffRows: DiffRow[];
  selectedHistoryPath: string | null;
  flowItems: FlowItem[];
  onToggleCollapsed: () => void;
  onClear: () => void;
  onClose: () => void;
  onTabChange: (tab: BottomDockTab) => void;
  onResponseTabChange: (tab: "response" | "headers" | "timeline" | "tests") => void;
  onSaveExample: () => void;
  onCopyResponse: () => void;
  onExportResponse: () => void;
}

const TAB_META: Array<{ id: BottomDockTab; label: string; icon: typeof TerminalSquare }> = [
  { id: "response", label: "Response", icon: Wifi },
  { id: "console", label: "Console", icon: TerminalSquare },
  { id: "timeline", label: "Timeline", icon: Route },
  { id: "network", label: "Network", icon: Wifi },
  { id: "performance", label: "Performance", icon: Gauge },
];

export function BottomConsole({
  collapsed,
  entries,
  status,
  activeTab,
  response,
  responseError,
  responseBusy,
  responseTab,
  diffRows,
  selectedHistoryPath,
  flowItems,
  onToggleCollapsed,
  onClear,
  onClose,
  onTabChange,
  onResponseTabChange,
  onSaveExample,
  onCopyResponse,
  onExportResponse,
}: BottomConsoleProps) {
  const responseSize = response ? new Blob([response.body]).size : 0;

  function renderTabBody() {
    if (activeTab === "response") {
      return (
        <div className={styles.responseWrap}>
          <ResponseViewer
            response={response}
            error={responseError}
            isBusy={responseBusy}
            activeTab={responseTab}
            diffRows={diffRows}
            selectedHistoryPath={selectedHistoryPath}
            onActiveTabChange={onResponseTabChange}
            onSaveExample={onSaveExample}
            onCopyResponse={onCopyResponse}
            onExportResponse={onExportResponse}
          />
        </div>
      );
    }

    if (activeTab === "console") {
      return (
        <div className={styles.logBody}>
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
      );
    }

    if (activeTab === "timeline") {
      return (
        <div className={styles.flowBody}>
          {flowItems.length === 0 ? (
            <div className={styles.empty}>Open or select requests to build a request flow.</div>
          ) : (
            <div className={styles.flowRow}>
              {flowItems.map((item, index) => (
                <div key={item.id} className={styles.flowItem}>
                  <strong>{item.method}</strong>
                  <span>{item.name}</span>
                  {index < flowItems.length - 1 && <em className={styles.arrow}>-&gt;</em>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "network") {
      return (
        <div className={styles.metaGrid}>
          <div className={styles.metaRow}><strong>Status</strong><span>{response ? `${response.status} ${response.statusText}` : "--"}</span></div>
          <div className={styles.metaRow}><strong>Resolved URL</strong><span>{response?.resolvedUrl ?? "--"}</span></div>
          <div className={styles.metaRow}><strong>Headers</strong><span>{response ? `${Object.keys(response.headers).length} headers` : "--"}</span></div>
          <div className={styles.metaRow}><strong>Body size</strong><span>{response ? `${responseSize} bytes` : "--"}</span></div>
        </div>
      );
    }

    return (
      <div className={styles.metaGrid}>
        <div className={styles.metaRow}><strong>Response time</strong><span>{response ? `${response.responseTimeMs} ms` : "--"}</span></div>
        <div className={styles.metaRow}><strong>Timeline changes</strong><span>{selectedHistoryPath ? `${diffRows.length} change(s)` : "No comparison selected"}</span></div>
        <div className={styles.metaRow}><strong>Console entries</strong><span>{entries.length}</span></div>
        <div className={styles.metaRow}><strong>Status</strong><span>{status}</span></div>
      </div>
    );
  }

  return (
    <section className={styles.console}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          {TAB_META.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className={styles.actions}>
          {activeTab === "console" && (
            <button type="button" onClick={onClear} disabled={entries.length === 0}>
              <Trash2 size={12} />
              Clear
            </button>
          )}
          <button type="button" onClick={onToggleCollapsed}>
            {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button type="button" onClick={onClose} title="Hide bottom panel">
            <X size={12} />
            Hide
          </button>
        </div>
      </div>
      {!collapsed && <div className={styles.body}>{renderTabBody()}</div>}
    </section>
  );
}
