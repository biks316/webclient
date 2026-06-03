import { Copy, Download, Play, Plus, Save, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ActionMenu } from "./ActionMenu";
import { KeyValueEditor } from "./KeyValueEditor";
import { BikRequest, VariableFile } from "../types/bik";

interface RequestEditorProps {
  request: BikRequest | null;
  environments: VariableFile[];
  selectedEnvironmentId: string | null;
  globalVariables: Record<string, string>;
  collectionVariables: Record<string, string>;
  selectedEnvironment: VariableFile | null;
  isBusy: boolean;
  onEnvironmentChange: (environmentId: string | null) => void;
  onCreateEnvironment: () => void;
  onGlobalVariablesChange: (variables: Record<string, string>) => void;
  onCollectionVariablesChange: (variables: Record<string, string>) => void;
  onEnvironmentVariablesChange: (variables: Record<string, string>) => void;
  onRequestChange: (request: BikRequest) => void;
  onSave: () => void;
  onSaveGlobals: () => void;
  onSaveCollectionVariables: () => void;
  onSaveEnvironmentVariables: () => void;
  onSend: () => void;
  onCopyRequest: () => void;
  onExportRequest: () => void;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);
type VariableDialogMode = "globals" | "collection" | "environment" | "request" | "environment-select";

export function RequestEditor({
  request,
  environments,
  selectedEnvironmentId,
  globalVariables,
  collectionVariables,
  selectedEnvironment,
  isBusy,
  onEnvironmentChange,
  onCreateEnvironment,
  onGlobalVariablesChange,
  onCollectionVariablesChange,
  onEnvironmentVariablesChange,
  onRequestChange,
  onSave,
  onSaveGlobals,
  onSaveCollectionVariables,
  onSaveEnvironmentVariables,
  onSend,
  onCopyRequest,
  onExportRequest,
}: RequestEditorProps) {
  const [bodyText, setBodyText] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [variableDialog, setVariableDialog] = useState<VariableDialogMode | null>(null);

  useEffect(() => {
    if (!request || BODYLESS_METHODS.has(request.method.toUpperCase())) {
      setBodyText("");
      setBodyError(null);
      return;
    }

    setBodyText(request.body === null ? "" : JSON.stringify(request.body, null, 2));
    setBodyError(null);
  }, [request?.id, request?.method]);

  const hasRequestBody = request ? !BODYLESS_METHODS.has(request.method.toUpperCase()) : false;
  const hasBlockingBodyError = hasRequestBody && Boolean(bodyError);
  const canRun = useMemo(
    () => Boolean(request && !hasBlockingBodyError && !isBusy),
    [request, hasBlockingBodyError, isBusy],
  );

  if (!request) {
    return <main className="request-editor empty-panel">Select or create an endpoint.</main>;
  }

  function update(patch: Partial<BikRequest>) {
    if (request) {
      onRequestChange({ ...request, ...patch });
    }
  }

  function parseBody(nextText: string) {
    setBodyText(nextText);
    if (!nextText.trim()) {
      update({ body: null });
      setBodyError(null);
      return;
    }
    try {
      update({ body: JSON.parse(nextText) });
      setBodyError(null);
    } catch (error) {
      setBodyError(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  function changeMethod(method: string) {
    if (BODYLESS_METHODS.has(method.toUpperCase())) {
      setBodyText("");
      setBodyError(null);
      update({ method, body: null });
      return;
    }

    update({ method });
  }

  return (
    <main className="request-editor">
      <div className="editor-toolbar">
        <input
          className="request-name"
          value={request.name}
          onChange={(event) => update({ name: event.target.value })}
        />
        <button type="button" onClick={onSave} disabled={!request || hasBlockingBodyError || isBusy}>
          <Save size={16} />
          Save
        </button>
        <button type="button" className="primary" onClick={onSend} disabled={!canRun}>
          <Send size={16} />
          Send
        </button>
        <ActionMenu
          label="Request actions"
          items={[
            {
              label: "Run test",
              icon: <Play size={14} />,
              disabled: !canRun,
              onSelect: onSend,
            },
            {
              label: "Environment",
              icon: <Plus size={14} />,
              onSelect: () => setVariableDialog("environment-select"),
            },
            {
              label: "Request variables",
              icon: <Plus size={14} />,
              onSelect: () => setVariableDialog("request"),
            },
            {
              label: "Collection variables",
              icon: <Plus size={14} />,
              onSelect: () => setVariableDialog("collection"),
            },
            {
              label: "Globals",
              icon: <Plus size={14} />,
              onSelect: () => setVariableDialog("globals"),
            },
            {
              label: selectedEnvironment ? `${selectedEnvironment.name} variables` : "Environment variables",
              icon: <Plus size={14} />,
              onSelect: () => setVariableDialog("environment"),
            },
            {
              label: "Copy request",
              icon: <Copy size={14} />,
              onSelect: onCopyRequest,
            },
            {
              label: "Export request",
              icon: <Download size={14} />,
              onSelect: onExportRequest,
            },
            {
              label: "Save request",
              icon: <Save size={14} />,
              disabled: hasBlockingBodyError || isBusy,
              onSelect: onSave,
            },
          ]}
        />
      </div>

      <div className="url-row">
        <select
          className={`method-select method-${request.method.toLowerCase()}`}
          value={request.method}
          onChange={(event) => changeMethod(event.target.value)}
        >
          {METHODS.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
        <input
          value={request.url}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => update({ url: event.target.value })}
        />
      </div>

      <div className="editor-grid">
        <section>
          <h2>Headers</h2>
          <KeyValueEditor
            values={request.headers}
            keyPlaceholder="Content-Type"
            valuePlaceholder="application/json"
            onChange={(headers) => update({ headers })}
          />
        </section>
        <section>
          <h2>Query</h2>
          <KeyValueEditor
            values={request.queryParams}
            keyPlaceholder="page"
            valuePlaceholder="1"
            onChange={(queryParams) => update({ queryParams })}
          />
        </section>
      </div>

      {hasRequestBody && (
        <section className="body-section">
          <div className="section-heading">
            <h2>Body JSON</h2>
            {bodyError && <span className="error-text">{bodyError}</span>}
          </div>
          <textarea
            spellCheck={false}
            className={bodyError ? "invalid" : ""}
            value={bodyText}
            onChange={(event) => parseBody(event.target.value)}
          />
        </section>
      )}

      {variableDialog && (
        <div className="prompt-backdrop" role="presentation">
          <div className="prompt-dialog variable-dialog">
            {variableDialog === "environment-select" ? (
              <>
                <h2>Environment</h2>
                <label>
                  <span>Active environment</span>
                  <select
                    value={selectedEnvironmentId ?? ""}
                    onChange={(event) => onEnvironmentChange(event.target.value || null)}
                  >
                    <option value="">No environment</option>
                    {environments.map((environment) => (
                      <option key={environment.id} value={environment.id}>
                        {environment.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="prompt-actions split-actions">
                  <button type="button" onClick={onCreateEnvironment} disabled={isBusy}>
                    <Plus size={14} />
                    New environment
                  </button>
                  <div className="prompt-actions">
                    <button type="button" onClick={() => setVariableDialog(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <VariableScopeEditor
                title={
                  variableDialog === "globals"
                    ? "Globals"
                    : variableDialog === "collection"
                      ? "Collection Variables"
                      : variableDialog === "environment"
                        ? selectedEnvironment?.name ?? "Environment Variables"
                        : "Request Variables"
                }
                values={
                  variableDialog === "globals"
                    ? globalVariables
                    : variableDialog === "collection"
                      ? collectionVariables
                      : variableDialog === "environment"
                        ? selectedEnvironment?.variables ?? {}
                        : request.variables
                }
                keyPlaceholder={
                  variableDialog === "globals"
                    ? "baseUrl"
                    : variableDialog === "collection"
                      ? "tenantId"
                      : variableDialog === "environment"
                        ? "token"
                        : "customerId"
                }
                valuePlaceholder={
                  variableDialog === "globals"
                    ? "https://api.example.com"
                    : variableDialog === "collection"
                      ? "acme"
                      : variableDialog === "environment"
                        ? "secret"
                        : "123"
                }
                saveLabel={
                  variableDialog === "globals"
                    ? "Save globals"
                    : variableDialog === "collection"
                      ? "Save collection"
                      : variableDialog === "environment"
                        ? "Save environment"
                        : "Save request"
                }
                disabled={isBusy || (variableDialog === "environment" && !selectedEnvironment)}
                emptyAction={variableDialog === "environment" && !selectedEnvironment ? onCreateEnvironment : undefined}
                emptyActionLabel="Create environment"
                onChange={(values) => {
                  if (variableDialog === "globals") {
                    onGlobalVariablesChange(values);
                  } else if (variableDialog === "collection") {
                    onCollectionVariablesChange(values);
                  } else if (variableDialog === "environment") {
                    onEnvironmentVariablesChange(values);
                  } else {
                    update({ variables: values });
                  }
                }}
                onSave={() => {
                  if (variableDialog === "globals") {
                    onSaveGlobals();
                  } else if (variableDialog === "collection") {
                    onSaveCollectionVariables();
                  } else if (variableDialog === "environment") {
                    onSaveEnvironmentVariables();
                  } else {
                    onSave();
                  }
                  setVariableDialog(null);
                }}
                onClose={() => setVariableDialog(null)}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

interface VariableScopeEditorProps {
  title: string;
  values: Record<string, string>;
  keyPlaceholder: string;
  valuePlaceholder: string;
  saveLabel: string;
  disabled: boolean;
  emptyAction?: () => void;
  emptyActionLabel?: string;
  onChange: (values: Record<string, string>) => void;
  onSave: () => void;
  onClose?: () => void;
}

function VariableScopeEditor({
  title,
  values,
  keyPlaceholder,
  valuePlaceholder,
  saveLabel,
  disabled,
  emptyAction,
  emptyActionLabel,
  onChange,
  onSave,
  onClose,
}: VariableScopeEditorProps) {
  return (
    <div className="variable-scope">
      <div className="section-heading">
        <h3>{title}</h3>
        <div className="inline-actions">
          {onClose && (
            <button type="button" onClick={onClose}>
              Close
            </button>
          )}
          <button type="button" onClick={onSave} disabled={disabled || Boolean(emptyAction)}>
            <Save size={14} />
            {saveLabel}
          </button>
        </div>
      </div>
      {emptyAction ? (
        <div className="empty-state-action">
          <span>No environment selected.</span>
          <button type="button" onClick={emptyAction} disabled={disabled}>
            <Plus size={14} />
            {emptyActionLabel ?? "Create"}
          </button>
        </div>
      ) : (
        <KeyValueEditor
          values={values}
          keyPlaceholder={keyPlaceholder}
          valuePlaceholder={valuePlaceholder}
          onChange={onChange}
        />
      )}
    </div>
  );
}
