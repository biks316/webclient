import { Copy, Download, ExternalLink, MoreHorizontal, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../common/EmptyState";
import { JsonEditor } from "../common/JsonEditor";
import { DiffRow, RunResponse } from "../../types/bik";
import { ErrorBox } from "./ErrorBox";
import { ResponseMetaBar } from "./ResponseMetaBar";
import { ResponseTabs } from "./ResponseTabs";
import styles from "./ResponseViewer.module.css";

interface ResponseViewerProps {
  response: RunResponse | null;
  error: string | null;
  isBusy: boolean;
  activeTab: "response" | "headers" | "timeline" | "tests";
  diffRows: DiffRow[];
  selectedHistoryPath: string | null;
  onActiveTabChange: (tab: "response" | "headers" | "timeline" | "tests") => void;
  onSaveExample: () => void;
  onCopyResponse: () => void;
  onExportResponse: () => void;
  onClearResponse?: () => void;
}

export function ResponseViewer({
  response,
  error,
  isBusy,
  activeTab,
  diffRows,
  selectedHistoryPath,
  onActiveTabChange,
  onSaveExample,
  onCopyResponse,
  onExportResponse,
  onClearResponse,
}: ResponseViewerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const responseText = response ? formatBody(response.body) : "";
  const headersText = response ? JSON.stringify(response.headers, null, 2) : "";
  const size = response ? new Blob([response.body]).size : null;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  function openResponseInNewTab() {
    if (!response) {
      return;
    }
    const blob = new Blob([responseText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function renderContent() {
    if (error) {
      return <ErrorBox title="Request failed" message={error} />;
    }

    if (!response && !isBusy) {
      return (
        <div className={styles.emptyQuiet}>
          <span>No response yet</span>
        </div>
      );
    }

    if (activeTab === "headers") {
      return (
        <div className={styles.editorWrap}>
          <JsonEditor value={headersText} readOnly />
        </div>
      );
    }

    if (activeTab === "timeline") {
      return (
        <div className={styles.timeline}>
          <div className={styles.timelineRow}>
            <strong>Resolved URL</strong>
            <span>{response?.resolvedUrl ?? "--"}</span>
          </div>
          <div className={styles.timelineRow}>
            <strong>Sent</strong>
            <span>{response ? new Date(response.sentAt).toLocaleString() : "--"}</span>
          </div>
          <div className={styles.timelineRow}>
            <strong>Version diff</strong>
            <span>{selectedHistoryPath ? `${diffRows.length} change(s)` : "No comparison selected"}</span>
          </div>
        </div>
      );
    }

    if (activeTab === "tests") {
      return error ? (
        <ErrorBox title="Test output unavailable" message={error} />
      ) : (
        <div className={styles.empty}>
          <EmptyState
            title="No failed tests"
            description="Collection assertions are configured in the request Tests tab. Failures will surface here when request execution returns them."
          />
        </div>
      );
    }

    return (
      <div className={styles.editorWrap}>
        <JsonEditor value={responseText} readOnly />
      </div>
    );
  }

  return (
    <section className={styles.viewer}>
      <div className={styles.header}>
        <div>
          <strong>Response</strong>
          <span>{isBusy ? "Running request..." : "Inspect response payload, headers, and timeline."}</span>
        </div>
      </div>

      <div className={styles.metaRow}>
        <ResponseMetaBar
          status={response?.status ?? null}
          statusText={response?.statusText ?? ""}
          responseTimeMs={response?.responseTimeMs ?? null}
          size={size}
          sentAt={response?.sentAt ?? null}
        />
        <div className={styles.responseMenuWrap} ref={menuRef}>
          <button type="button" className={styles.responseMenuButton} onClick={() => setMenuOpen((open) => !open)} title="Response actions">
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className={styles.responseMenu}>
              <button type="button" onClick={() => { setMenuOpen(false); onSaveExample(); }} disabled={!response}>
                <Save size={13} />
                Save Response
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onCopyResponse(); }} disabled={!response}>
                <Copy size={13} />
                Copy Response
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onExportResponse(); }} disabled={!response}>
                <Download size={13} />
                Export Response
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); openResponseInNewTab(); }} disabled={!response}>
                <ExternalLink size={13} />
                Open Response in New Tab
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onClearResponse?.(); }} disabled={!response || !onClearResponse}>
                <Trash2 size={13} />
                Clear Response
              </button>
            </div>
          )}
        </div>
      </div>

      <ResponseTabs activeTab={activeTab} onChange={(tab) => onActiveTabChange(tab as ResponseViewerProps["activeTab"])} />

      <div className={styles.content}>{renderContent()}</div>
    </section>
  );
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
