import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../common/EmptyState";
import { BodyEditor } from "./BodyEditor";
import { HeadersEditor } from "./HeadersEditor";
import { ParamsEditor } from "./ParamsEditor";
import { RequestBar } from "./RequestBar";
import { RequestTabs } from "./RequestTabs";
import { AuthEditor } from "./AuthEditor";
import { ScriptsEditor } from "./ScriptsEditor";
import { TestsEditor } from "./TestsEditor";
import { BikRequest, CollectionAutomation, DiffRow, RunResponse, Scripts, VariableFile } from "../../types/bik";
import styles from "./RequestEditor.module.css";

interface RequestEditorProps {
  request: BikRequest | null;
  activeTab: "params" | "auth" | "headers" | "body" | "scripts" | "docs" | "tests";
  activeResponseTab: "response" | "headers" | "timeline" | "tests";
  response: RunResponse | null;
  responseError: string | null;
  diffRows: DiffRow[];
  selectedHistoryPath: string | null;
  scripts: Scripts;
  collectionAutomation: CollectionAutomation;
  environments: VariableFile[];
  selectedEnvironmentId: string | null;
  selectedEnvironment: VariableFile | null;
  globalVariables: Record<string, string>;
  collectionVariables: Record<string, string>;
  isBusy: boolean;
  onActiveTabChange: (tab: RequestEditorProps["activeTab"]) => void;
  onActiveResponseTabChange: (tab: RequestEditorProps["activeResponseTab"]) => void;
  onEnvironmentChange: (environmentId: string | null) => void;
  onCreateEnvironment: () => void;
  onGlobalVariablesChange: (variables: Record<string, string>) => void;
  onCollectionVariablesChange: (variables: Record<string, string>) => void;
  onEnvironmentVariablesChange: (variables: Record<string, string>) => void;
  onRequestChange: (request: BikRequest) => void;
  onScriptsChange: (scripts: Scripts) => void;
  onCollectionAutomationChange: (automation: CollectionAutomation) => void;
  onSave: () => void;
  onSaveGlobals: () => void;
  onSaveCollectionVariables: () => void;
  onSaveEnvironmentVariables: () => void;
  onSaveScripts: () => void;
  onSaveTests: () => void;
  onSend: () => void;
  onCopyRequest: () => void;
  onExportRequest: () => void;
  onSaveExample: () => void;
  onCopyResponse: () => void;
  onExportResponse: () => void;
}

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

export function RequestEditor({
  request,
  activeTab,
  activeResponseTab,
  response,
  responseError,
  diffRows,
  selectedHistoryPath,
  scripts,
  collectionAutomation,
  environments,
  selectedEnvironmentId,
  selectedEnvironment,
  globalVariables,
  collectionVariables,
  isBusy,
  onActiveTabChange,
  onActiveResponseTabChange,
  onEnvironmentChange,
  onCreateEnvironment,
  onGlobalVariablesChange,
  onCollectionVariablesChange,
  onEnvironmentVariablesChange,
  onRequestChange,
  onScriptsChange,
  onCollectionAutomationChange,
  onSave,
  onSaveGlobals,
  onSaveCollectionVariables,
  onSaveEnvironmentVariables,
  onSaveScripts,
  onSaveTests,
  onSend,
  onCopyRequest,
  onExportRequest,
  onSaveExample,
  onCopyResponse,
  onExportResponse,
}: RequestEditorProps) {
  const [bodyText, setBodyText] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [variableMode, setVariableMode] = useState<"globals" | "collection" | "environment" | null>(null);

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
  const canSend = useMemo(() => Boolean(request && !bodyError && !isBusy), [bodyError, isBusy, request]);

  if (!request) {
    return (
      <div className={styles.empty}>
        <EmptyState
          title="Select a request"
          description="Request editing and response inspection will appear here."
        />
      </div>
    );
  }

  const currentRequest = request;

  function update(patch: Partial<BikRequest>) {
    onRequestChange({ ...currentRequest, ...patch });
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

  function formatBody() {
    if (!bodyText.trim()) {
      return;
    }
    try {
      const pretty = JSON.stringify(JSON.parse(bodyText), null, 2);
      setBodyText(pretty);
      update({ body: JSON.parse(pretty) });
      setBodyError(null);
    } catch (error) {
      setBodyError(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  function renderLeftPane() {
    switch (activeTab) {
      case "params":
        return <ParamsEditor values={currentRequest.queryParams} onChange={(queryParams) => update({ queryParams })} />;
      case "auth":
        return <AuthEditor />;
      case "headers":
        return <HeadersEditor values={currentRequest.headers} onChange={(headers) => update({ headers })} />;
      case "scripts":
        return (
          <ScriptsEditor
            scripts={scripts}
            request={currentRequest}
            response={response}
            variables={{
              ...globalVariables,
              ...collectionVariables,
              ...(selectedEnvironment?.variables ?? {}),
              ...currentRequest.variables,
            }}
            onChange={onScriptsChange}
            onSave={onSaveScripts}
          />
        );
      case "docs":
        return (
          <EmptyState
            title="Request docs are not persisted yet"
            description="The current .bik workflow stays unchanged. Use collection naming and examples for lightweight documentation."
          />
        );
      case "tests":
        return (
          <TestsEditor
            automation={collectionAutomation}
            onChange={onCollectionAutomationChange}
            onSave={onSaveTests}
          />
        );
      case "body":
      default:
        return hasRequestBody ? (
          <BodyEditor bodyText={bodyText} bodyError={bodyError} onChange={parseBody} onFormat={formatBody} />
        ) : (
          <div className={styles.bodyPlaceholder}>
            <span>No request body</span>
          </div>
        );
    }
  }

  const variableValues =
    variableMode === "globals"
      ? globalVariables
      : variableMode === "collection"
        ? collectionVariables
        : selectedEnvironment?.variables ?? {};

  const saveVariableScope =
    variableMode === "globals"
      ? onSaveGlobals
      : variableMode === "collection"
        ? onSaveCollectionVariables
        : onSaveEnvironmentVariables;

  return (
    <div className={styles.editor}>
      <RequestBar
        name={currentRequest.name}
        method={currentRequest.method}
        url={currentRequest.url}
        environments={environments}
        selectedEnvironmentId={selectedEnvironmentId}
        selectedEnvironmentName={selectedEnvironment?.name ?? null}
        isBusy={isBusy}
        sendDisabled={!canSend}
        onNameChange={(name) => update({ name })}
        onMethodChange={changeMethod}
        onUrlChange={(url) => update({ url })}
        onEnvironmentChange={onEnvironmentChange}
        onCreateEnvironment={onCreateEnvironment}
        onSave={onSave}
        onSend={onSend}
        onCopyRequest={onCopyRequest}
        onExportRequest={onExportRequest}
      />

      <div className={styles.quickBar}>
        <RequestTabs
          tabs={[
            { id: "params", label: "Params" },
            { id: "auth", label: "Auth" },
            { id: "headers", label: "Headers" },
            { id: "body", label: "Body" },
            { id: "scripts", label: "Scripts" },
            { id: "docs", label: "Docs" },
            { id: "tests", label: "Tests" },
          ]}
          activeTab={activeTab}
          onChange={(tab) => onActiveTabChange(tab as RequestEditorProps["activeTab"])}
        />
        <div className={styles.quickActions}>
          <button type="button" onClick={() => setVariableMode("globals")}>Globals</button>
          <button type="button" onClick={() => setVariableMode("collection")}>Collection vars</button>
          <button type="button" onClick={() => setVariableMode("environment")} disabled={!selectedEnvironment}>
            Env vars
          </button>
        </div>
      </div>

      <div className={styles.workSurface}>
        <div className={styles.leftPane}>{renderLeftPane()}</div>
      </div>

      {variableMode && (
        <div className="prompt-backdrop" role="presentation">
          <div className="prompt-dialog variable-dialog">
            <div className={styles.variableHeader}>
              <strong>
                {variableMode === "globals"
                  ? "Global variables"
                  : variableMode === "collection"
                    ? "Collection variables"
                    : "Environment variables"}
              </strong>
              <div className={styles.quickActions}>
                <button type="button" onClick={() => setVariableMode(null)}>Close</button>
                <button type="button" onClick={saveVariableScope}>Save</button>
              </div>
            </div>
            <div className={styles.variableGrid}>
              <ParamsEditor
                values={variableValues}
                onChange={(values) => {
                  if (variableMode === "globals") {
                    onGlobalVariablesChange(values);
                  } else if (variableMode === "collection") {
                    onCollectionVariablesChange(values);
                  } else {
                    onEnvironmentVariablesChange(values);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
