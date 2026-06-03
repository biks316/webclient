import { Copy, Download, Save } from "lucide-react";
import { ActionMenu } from "./ActionMenu";
import { RunResponse } from "../types/bik";

interface ResponseViewerProps {
  response: RunResponse | null;
  error: string | null;
  isBusy: boolean;
  onSaveExample: () => void;
  onCopyResponse: () => void;
  onExportResponse: () => void;
}

export function ResponseViewer({
  response,
  error,
  isBusy,
  onSaveExample,
  onCopyResponse,
  onExportResponse,
}: ResponseViewerProps) {
  return (
    <section className="response-viewer">
      <div className="response-bar">
        <div>
          <strong>Response</strong>
          {isBusy && <span>Sending...</span>}
          {response && (
            <span>
              {response.status} {response.statusText} · {response.responseTimeMs} ms
            </span>
          )}
        </div>
        <ActionMenu
          label="Response actions"
          items={[
            {
              label: "Save example",
              icon: <Save size={14} />,
              disabled: !response,
              onSelect: onSaveExample,
            },
            {
              label: "Copy response",
              icon: <Copy size={14} />,
              disabled: !response,
              onSelect: onCopyResponse,
            },
            {
              label: "Export response",
              icon: <Download size={14} />,
              disabled: !response,
              onSelect: onExportResponse,
            },
          ]}
        />
      </div>
      {response ? (
        <div className="response-content">
          <div>
            <h2>Headers</h2>
            <pre>{JSON.stringify(response.headers, null, 2)}</pre>
          </div>
          <div>
            <div className="response-meta">
              <h2>Body</h2>
              <span>{response.resolvedUrl}</span>
            </div>
            <pre>{formatBody(response.body)}</pre>
          </div>
        </div>
      ) : error ? (
        <div className="response-error">
          <h2>Request failed</h2>
          <pre>{error}</pre>
        </div>
      ) : (
        <div className="empty-panel">Responses appear here after a request is sent.</div>
      )}
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
