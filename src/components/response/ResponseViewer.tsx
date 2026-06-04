import { Copy, Download, Save } from "lucide-react";
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
}: ResponseViewerProps) {
  const responseText = response ? formatBody(response.body) : "";
  const headersText = response ? JSON.stringify(response.headers, null, 2) : "";
  const size = response ? new Blob([response.body]).size : null;

  function renderContent() {
    if (error) {
      return <ErrorBox title="Request failed" message={error} />;
    }

    if (!response && !isBusy) {
      return (
        <div className={styles.empty}>
          <EmptyState
            title="Response viewer"
            description="Send the current request to inspect response data, headers, test output, and timing."
          />
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
        <div className={styles.actions}>
          <button type="button" onClick={onSaveExample} disabled={!response}>
            <Save size={14} />
            Save
          </button>
          <button type="button" onClick={onCopyResponse} disabled={!response}>
            <Copy size={14} />
            Copy
          </button>
          <button type="button" onClick={onExportResponse} disabled={!response}>
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <ResponseMetaBar
        status={response?.status ?? null}
        statusText={response?.statusText ?? ""}
        responseTimeMs={response?.responseTimeMs ?? null}
        size={size}
      />

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
