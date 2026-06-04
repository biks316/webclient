import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Braces, FlaskConical, Plus, SquareCode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CollectionPanel, CollectionPanelTab } from "./components/CollectionPanel";
import { EmptyState } from "./components/common/EmptyState";
import { AppShell } from "./components/layout/AppShell";
import { BottomConsole, ConsoleEntry } from "./components/layout/BottomConsole";
import { Sidebar } from "./components/layout/Sidebar";
import { TopTabs } from "./components/layout/TopTabs";
import { RequestEditor } from "./components/request/RequestEditor";
import { ResponseViewer } from "./components/response/ResponseViewer";
import { RightTimelinePanel } from "./components/layout/RightTimelinePanel";
import { loadWorkspaceSession, saveWorkspaceSession } from "./services/sessionStore";
import * as api from "./services/tauriApi";
import { cloneJson, findCollection, findEndpoint, firstCollection } from "./services/workspaceService";
import {
  BikRequest,
  CollectionAutomation,
  CollectionIndex,
  DiffRow,
  RunResponse,
  Scripts,
  WorkspaceIndex,
} from "./types/bik";

const EMPTY_COLLECTION_AUTOMATION: CollectionAutomation = { pre: "", post: "", test: "", assert: "" };
const EMPTY_SCRIPTS: Scripts = { pre: "", post: "" };
const REQUEST_VERSION = "1.0";
const DEFAULT_REQUEST_URL = "https://example.com/";
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const COLLECTION_TABS: Array<{ id: CollectionPanelTab; label: string; icon: typeof Braces }> = [
  { id: "variables", label: "Variables", icon: Braces },
  { id: "scripts", label: "Scripts", icon: SquareCode },
  { id: "tests", label: "Tests", icon: FlaskConical },
];

interface TextPromptState {
  title: string;
  label: string;
  value: string;
  confirmText: string;
  resolve: (value: string | null) => void;
}

type EndpointCreateMode = "name" | "curl";

interface EndpointPromptState {
  mode: EndpointCreateMode;
  name: string;
  method: string;
  curl: string;
  error: string | null;
  resolve: (value: EndpointPromptResult | null) => void;
}

interface EndpointPromptResult {
  mode: EndpointCreateMode;
  name: string;
  method: string;
  curl: string;
}

interface OpenEndpointTab {
  collectionId: string;
  endpointId: string;
}

type RequestEditorTab = "params" | "auth" | "headers" | "body" | "scripts" | "docs" | "tests";
type ResponseTab = "response" | "headers" | "timeline" | "tests";
type HiddenPanel = "sidebar" | "timeline" | "console";

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceIndex | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [activeCollectionTab, setActiveCollectionTab] = useState<CollectionPanelTab>("variables");
  const [draftRequest, setDraftRequest] = useState<BikRequest | null>(null);
  const [collectionAutomation, setCollectionAutomation] =
    useState<CollectionAutomation>(EMPTY_COLLECTION_AUTOMATION);
  const [endpointScripts, setEndpointScripts] = useState<Scripts>(EMPTY_SCRIPTS);
  const [response, setResponse] = useState<RunResponse | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [selectedHistoryPath, setSelectedHistoryPath] = useState<string | null>(null);
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [textPrompt, setTextPrompt] = useState<TextPromptState | null>(null);
  const [endpointPrompt, setEndpointPrompt] = useState<EndpointPromptState | null>(null);
  const [openTabs, setOpenTabs] = useState<OpenEndpointTab[]>([]);
  const [activeRequestTab, setActiveRequestTab] = useState<RequestEditorTab>("body");
  const [activeResponseTab, setActiveResponseTab] = useState<ResponseTab>("response");
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [timelineHidden, setTimelineHidden] = useState(true);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [consoleHidden, setConsoleHidden] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);

  const selectedCollection = useMemo(
    () => findCollection(workspace, selectedCollectionId),
    [workspace, selectedCollectionId],
  );
  const selectedEndpoint = useMemo(
    () => findEndpoint(workspace, selectedCollectionId, selectedEndpointId),
    [workspace, selectedCollectionId, selectedEndpointId],
  );
  const selectedEnvironment = useMemo(
    () =>
      selectedEnvironmentId
        ? workspace?.environments.find((environment) => environment.id === selectedEnvironmentId) ?? null
        : null,
    [workspace, selectedEnvironmentId],
  );
  const openEndpointTabs = useMemo(
    () =>
      openTabs
        .map((tab) => {
          const collection = findCollection(workspace, tab.collectionId);
          const endpoint = findEndpoint(workspace, tab.collectionId, tab.endpointId);
          return collection && endpoint ? { ...tab, collection, endpoint } : null;
        })
        .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab)),
    [workspace, openTabs],
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!draftRequest || !selectedEndpoint) {
      return false;
    }
    return JSON.stringify(draftRequest) !== JSON.stringify(selectedEndpoint.request);
  }, [draftRequest, selectedEndpoint]);
  const hiddenPanels = useMemo(
    () =>
      [
        sidebarHidden ? "sidebar" : null,
        consoleHidden ? "console" : null,
      ].filter((panel): panel is HiddenPanel => panel !== null),
    [consoleHidden, sidebarHidden],
  );

  useEffect(() => {
    const restoredSession = loadWorkspaceSession();
    if (!restoredSession) {
      return;
    }
    const session = restoredSession;

    let cancelled = false;

    async function restoreWorkspace() {
      setIsBusy(true);
      setStatus("Opening last workspace...");
      try {
        const next = await api.openWorkspace(session.workspacePath);
        if (!cancelled) {
          applyWorkspace(next, session.collectionId, session.endpointId);
          setStatus("Ready");
        }
      } catch (error) {
        if (!cancelled) {
          saveWorkspaceSession(null);
          setStatus(`Last workspace unavailable: ${String(error)}`);
        }
      } finally {
        if (!cancelled) {
          setIsBusy(false);
        }
      }
    }

    void restoreWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    saveWorkspaceSession({
      workspacePath: workspace.path,
      collectionId: selectedCollectionId,
      endpointId: selectedEndpointId,
    });
  }, [workspace, selectedCollectionId, selectedEndpointId]);

  useEffect(() => {
    setOpenTabs([]);
  }, [workspace?.path]);

  useEffect(() => {
    if (!selectedCollectionId || !selectedEndpointId || !selectedEndpoint) {
      return;
    }

    setOpenTabs((tabs) => {
      const exists = tabs.some(
        (tab) => tab.collectionId === selectedCollectionId && tab.endpointId === selectedEndpointId,
      );
      return exists ? tabs : [...tabs, { collectionId: selectedCollectionId, endpointId: selectedEndpointId }];
    });
  }, [selectedCollectionId, selectedEndpointId, selectedEndpoint?.path]);

  useEffect(() => {
    setDraftRequest(selectedEndpoint ? cloneJson(selectedEndpoint.request) : null);
    setResponse(null);
    setResponseError(null);
    setSelectedHistoryPath(null);
    setDiffRows([]);
    setEndpointScripts(EMPTY_SCRIPTS);
    setActiveRequestTab("body");
    setActiveResponseTab("response");
  }, [selectedEndpoint?.path]);

  useEffect(() => {
    if (!workspace || !selectedCollectionId) {
      setCollectionAutomation(EMPTY_COLLECTION_AUTOMATION);
      return;
    }

    api
      .readCollectionAutomation(workspace.path, selectedCollectionId)
      .then(setCollectionAutomation)
      .catch((error) => setStatus(String(error)));
  }, [workspace?.path, selectedCollectionId]);

  useEffect(() => {
    if (!workspace || !selectedCollectionId || !selectedEndpointId) {
      setEndpointScripts(EMPTY_SCRIPTS);
      return;
    }

    api
      .readScripts(workspace.path, selectedCollectionId, selectedEndpointId)
      .then(setEndpointScripts)
      .catch(() => setEndpointScripts(EMPTY_SCRIPTS));
  }, [workspace?.path, selectedCollectionId, selectedEndpointId]);

  useEffect(() => {
    if (!draftRequest || !selectedHistoryPath) {
      setDiffRows([]);
      return;
    }

    api
      .requestDiff(draftRequest, selectedHistoryPath)
      .then(setDiffRows)
      .catch((error) => setStatus(String(error)));
  }, [draftRequest, selectedHistoryPath]);

  function appendConsole(message: string, tone: ConsoleEntry["tone"] = "info") {
    setConsoleEntries((entries) => [
      {
        id: `${Date.now()}-${entries.length}`,
        message,
        tone,
        timestamp: new Date().toISOString(),
      },
      ...entries,
    ]);
  }

  function requestTextPrompt(options: {
    title: string;
    label: string;
    defaultValue?: string;
    confirmText?: string;
  }): Promise<string | null> {
    return new Promise((resolve) => {
      setTextPrompt({
        title: options.title,
        label: options.label,
        value: options.defaultValue ?? "",
        confirmText: options.confirmText ?? "Create",
        resolve,
      });
    });
  }

  function resolveTextPrompt(value: string | null) {
    if (!textPrompt) {
      return;
    }
    const { resolve } = textPrompt;
    setTextPrompt(null);
    resolve(value);
  }

  async function chooseFolder(): Promise<string | null> {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (typeof selected === "string") {
        return selected;
      }
    } catch {
      const fallback = await requestTextPrompt({
        title: "Open Workspace",
        label: "Workspace folder path",
        confirmText: "Open",
      });
      return fallback?.trim() || null;
    }
    return null;
  }

  function applyWorkspace(
    next: WorkspaceIndex,
    preferredCollectionId = selectedCollectionId,
    preferredEndpointId = selectedEndpointId,
  ) {
    setWorkspace(next);
    const nextCollection = findCollection(next, preferredCollectionId) ?? firstCollection(next);
    const nextEndpoint = findEndpoint(next, nextCollection?.id ?? null, preferredEndpointId);
    setSelectedCollectionId(nextCollection?.id ?? null);
    setSelectedEndpointId(nextEndpoint?.id ?? null);
    setActiveCollectionTab("variables");
    setSelectedEnvironmentId((currentEnvironmentId) =>
      currentEnvironmentId &&
      next.environments.some((environment) => environment.id === currentEnvironmentId)
        ? currentEnvironmentId
        : null,
    );
  }

  async function runAction<T>(message: string, action: () => Promise<T>): Promise<T | null> {
    setIsBusy(true);
    setStatus(message);
    appendConsole(message);
    try {
      const result = await action();
      setStatus("Ready");
      return result;
    } catch (error) {
      const failure = String(error);
      setStatus(failure);
      appendConsole(failure, "error");
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  function exportJson(filename: string, value: unknown) {
    const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${filename}.`);
    appendConsole(`Exported ${filename}.`, "success");
  }

  async function copyJson(label: string, value: unknown) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setStatus(`${label} copied.`);
      appendConsole(`${label} copied to clipboard.`, "success");
    } catch (error) {
      const failure = `Copy failed: ${String(error)}`;
      setStatus(failure);
      appendConsole(failure, "error");
    }
  }

  function fileSafeName(value: string) {
    const safe = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return safe || "export";
  }

  function requestEndpointPrompt(): Promise<EndpointPromptResult | null> {
    return new Promise((resolve) => {
      setEndpointPrompt({
        mode: "name",
        name: "New Request",
        method: "GET",
        curl: "",
        error: null,
        resolve,
      });
    });
  }

  function selectEndpointTab(collectionId: string, endpointId: string) {
    setSelectedCollectionId(collectionId);
    setSelectedEndpointId(endpointId);
  }

  function selectCollection(collectionId: string) {
    setSelectedCollectionId(collectionId);
    setSelectedEndpointId(null);
  }

  function selectCollectionTab(tab: CollectionPanelTab) {
    setSelectedEndpointId(null);
    setActiveCollectionTab(tab);
  }

  function closeEndpointTab(collectionId: string, endpointId: string) {
    const closingIndex = openTabs.findIndex(
      (tab) => tab.collectionId === collectionId && tab.endpointId === endpointId,
    );
    const nextTabs = openTabs.filter(
      (tab) => tab.collectionId !== collectionId || tab.endpointId !== endpointId,
    );

    setOpenTabs(nextTabs);
    if (selectedCollectionId !== collectionId || selectedEndpointId !== endpointId) {
      return;
    }

    const fallback = nextTabs[Math.min(Math.max(closingIndex, 0), nextTabs.length - 1)];
    if (fallback) {
      selectEndpointTab(fallback.collectionId, fallback.endpointId);
    } else {
      setSelectedEndpointId(null);
    }
  }

  function restorePanel(panel: HiddenPanel) {
    if (panel === "sidebar") {
      setSidebarHidden(false);
      return;
    }
    setConsoleHidden(false);
    setConsoleCollapsed(false);
  }

  function openEndpointHistory(collectionId: string, endpointId: string) {
    setSelectedCollectionId(collectionId);
    setSelectedEndpointId(endpointId);
    setTimelineHidden(false);
  }

  function resolveEndpointPrompt(value: EndpointPromptResult | null) {
    if (!endpointPrompt) {
      return;
    }

    if (value?.mode === "name" && !value.name.trim()) {
      setEndpointPrompt({ ...endpointPrompt, error: "Request name is required." });
      return;
    }

    if (value?.mode === "curl" && !value.curl.trim()) {
      setEndpointPrompt({ ...endpointPrompt, error: "Paste a cURL command." });
      return;
    }

    const { resolve } = endpointPrompt;
    setEndpointPrompt(null);
    resolve(value);
  }

  function createNamedRequest(name: string, method: string): BikRequest {
    return {
      bikVersion: REQUEST_VERSION,
      type: "request",
      id: fileSafeName(name),
      name,
      method,
      url: DEFAULT_REQUEST_URL,
      headers: {},
      queryParams: {},
      body: null,
      variables: {},
    };
  }

  function createRequestFromCurl(command: string, fallbackName: string): BikRequest {
    const tokens = tokenizeCurl(command);
    if (tokens[0]?.toLowerCase() === "curl") {
      tokens.shift();
    }

    let method = "";
    let url = "";
    const headers: Record<string, string> = {};
    const bodyParts: string[] = [];

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const next = tokens[index + 1];

      if ((token === "-X" || token === "--request") && next) {
        method = next.toUpperCase();
        index += 1;
        continue;
      }

      if ((token === "-H" || token === "--header") && next) {
        const separator = next.indexOf(":");
        if (separator > -1) {
          const key = next.slice(0, separator).trim();
          const value = next.slice(separator + 1).trim();
          if (key) {
            headers[key] = value;
          }
        }
        index += 1;
        continue;
      }

      if (["-d", "--data", "--data-raw", "--data-binary", "--data-ascii"].includes(token) && next) {
        bodyParts.push(next);
        index += 1;
      }

      if (!token.startsWith("-") && /^https?:\/\//i.test(token)) {
        url = token;
      }
    }

    if (!url) {
      throw new Error("cURL command needs an http:// or https:// URL.");
    }

    const bodyText = bodyParts.join("&");
    const inferredMethod = method || (bodyText ? "POST" : "GET");
    const name = fallbackName.trim() || requestNameFromUrl(url);

    return {
      bikVersion: REQUEST_VERSION,
      type: "request",
      id: fileSafeName(name),
      name,
      method: inferredMethod,
      url,
      headers,
      queryParams: {},
      body: bodyText ? parseCurlBody(bodyText) : null,
      variables: {},
    };
  }

  function tokenizeCurl(command: string) {
    const input = command.replace(/\\\r?\n/g, " ");
    const tokens: string[] = [];
    let current = "";
    let quote: string | null = null;

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (quote) {
        if (char === quote) {
          quote = null;
        } else {
          current += char;
        }
        continue;
      }

      if (char === "'" || char === "\"") {
        quote = char;
        continue;
      }

      if (/\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }

      current += char;
    }

    if (current) {
      tokens.push(current);
    }
    return tokens;
  }

  function parseCurlBody(bodyText: string) {
    try {
      return JSON.parse(bodyText);
    } catch {
      return bodyText;
    }
  }

  function requestNameFromUrl(value: string) {
    try {
      const url = new URL(value);
      const segments = url.pathname.split("/").filter(Boolean);
      const segment = segments[segments.length - 1];
      return segment ? segment.replace(/[-_]+/g, " ") : url.hostname;
    } catch {
      return "Imported Request";
    }
  }

  async function handleOpenWorkspace() {
    const path = await chooseFolder();
    if (!path) {
      return;
    }
    const next = await runAction("Opening workspace...", () => api.openWorkspace(path));
    if (next) {
      applyWorkspace(next, null, null);
    }
  }

  async function handleCreateWorkspace() {
    const path = await chooseFolder();
    if (!path) {
      return;
    }
    const name = await requestTextPrompt({
      title: "New Workspace",
      label: "Workspace name",
      defaultValue: "BikAPI Workspace",
    });
    if (name === null) {
      return;
    }
    const next = await runAction("Creating workspace...", () =>
      api.createWorkspace(path, name.trim() || undefined),
    );
    if (next) {
      applyWorkspace(next, null, null);
    }
  }

  async function handleCreateCollection() {
    if (!workspace) {
      return;
    }
    const name = (
      await requestTextPrompt({
        title: "New Collection",
        label: "Collection name",
        defaultValue: "Travel API",
      })
    )?.trim();
    if (!name) {
      setStatus("Collection name is required.");
      return;
    }
    const next = await runAction("Creating collection...", () => api.createCollection(workspace.path, name));
    if (next) {
      const created = next.collections.find((collection) => collection.name === name);
      applyWorkspace(next, created?.id ?? selectedCollectionId, null);
    }
  }

  async function handleCreateEnvironment() {
    if (!workspace) {
      return;
    }

    const name = (
      await requestTextPrompt({
        title: "New Environment",
        label: "Environment name",
        defaultValue: "Local",
      })
    )?.trim();
    if (!name) {
      setStatus("Environment name is required.");
      return;
    }

    const existingIds = new Set(workspace.environments.map((environment) => environment.id));
    const next = await runAction("Creating environment...", () => api.createEnvironment(workspace.path, name));
    if (next) {
      const created = next.environments.find((environment) => !existingIds.has(environment.id));
      applyWorkspace(next, selectedCollectionId, selectedEndpointId);
      setSelectedEnvironmentId(created?.id ?? null);
    }
  }

  async function handleCreateEndpoint(collectionId?: string) {
    if (!workspace) {
      return;
    }

    const targetCollectionId = collectionId ?? selectedCollectionId ?? workspace.collections[0]?.id;
    if (!targetCollectionId) {
      setStatus("Create a collection first.");
      return;
    }

    const endpointInput = await requestEndpointPrompt();
    if (!endpointInput) {
      return;
    }

    let request: BikRequest;
    try {
      request =
        endpointInput.mode === "curl"
          ? createRequestFromCurl(endpointInput.curl, endpointInput.name)
          : createNamedRequest(endpointInput.name.trim(), endpointInput.method);
    } catch (error) {
      setStatus(String(error));
      return;
    }

    const next = await runAction("Creating request...", () =>
      api.createEndpointWithRequest(workspace.path, targetCollectionId, request),
    );
    if (next) {
      const collection = next.collections.find((item) => item.id === targetCollectionId);
      const matchingEndpoints = collection?.endpoints.filter((item) => item.name === request.name);
      const endpoint = matchingEndpoints?.[matchingEndpoints.length - 1];
      applyWorkspace(next, targetCollectionId, endpoint?.id ?? null);
    }
  }

  async function handleRestoreHistory(path: string) {
    const historicalRequest = await runAction("Restoring historical version...", async () => {
      const entry = await api.readHistoryEntry(path);
      return entry as unknown as BikRequest;
    });

    if (historicalRequest) {
      setDraftRequest(historicalRequest);
      setSelectedHistoryPath(path);
      setActiveRequestTab("body");
      appendConsole(`Loaded historical request snapshot from ${path}.`, "warning");
    }
  }

  function handleCopyCollection(collection: CollectionIndex) {
    void copyJson("Collection", collection);
  }

  function handleExportCollection(collection: CollectionIndex) {
    exportJson(`${fileSafeName(collection.name)}-collection.json`, collection);
  }

  function handleCopyRequest() {
    if (draftRequest) {
      void copyJson("Request", draftRequest);
    }
  }

  function handleExportRequest() {
    if (draftRequest) {
      exportJson(`${fileSafeName(draftRequest.name)}-request.json`, draftRequest);
    }
  }

  function handleCopyResponse() {
    if (response) {
      void copyJson("Response", response);
    }
  }

  function handleExportResponse() {
    if (response) {
      exportJson(`${fileSafeName(draftRequest?.name ?? "response")}-response.json`, response);
    }
  }

  async function handleSaveRequest() {
    if (!workspace || !selectedCollectionId || !selectedEndpointId || !draftRequest) {
      return;
    }
    const next = await runAction("Saving request.bik...", () =>
      api.saveRequest(workspace.path, selectedCollectionId, selectedEndpointId, draftRequest),
    );
    if (next) {
      applyWorkspace(next, selectedCollectionId, selectedEndpointId);
      appendConsole(`Saved request ${draftRequest.name}.`, "success");
    }
  }

  async function handleSaveGlobals() {
    if (!workspace) {
      return;
    }
    const next = await runAction("Saving globals.bik...", () => api.saveGlobals(workspace.path, workspace.globals));
    if (next) {
      applyWorkspace(next, selectedCollectionId, selectedEndpointId);
    }
  }

  async function handleSaveCollectionVariables() {
    if (!workspace || !selectedCollection) {
      return;
    }
    const next = await runAction("Saving collection variables...", () =>
      api.saveCollectionVariables(workspace.path, selectedCollection.id, selectedCollection.variables),
    );
    if (next) {
      applyWorkspace(next, selectedCollection.id, selectedEndpointId);
    }
  }

  async function handleSaveEnvironmentVariables() {
    if (!workspace || !selectedEnvironment) {
      return;
    }
    const next = await runAction("Saving environment variables...", () =>
      api.saveEnvironmentVariables(workspace.path, selectedEnvironment.id, selectedEnvironment.variables),
    );
    if (next) {
      applyWorkspace(next, selectedCollectionId, selectedEndpointId);
    }
  }

  async function handleSaveEndpointScripts() {
    if (!workspace || !selectedCollectionId || !selectedEndpointId) {
      return;
    }

    await runAction("Saving endpoint scripts...", async () => {
      await api.saveScript(workspace.path, selectedCollectionId, selectedEndpointId, "pre", endpointScripts.pre);
      await api.saveScript(workspace.path, selectedCollectionId, selectedEndpointId, "post", endpointScripts.post);
    });
    appendConsole("Endpoint scripts saved.", "success");
  }

  function handleGlobalVariablesChange(variables: Record<string, string>) {
    setWorkspace((current) => (current ? { ...current, globals: variables } : current));
  }

  function handleCollectionVariablesChange(variables: Record<string, string>) {
    if (!selectedCollectionId) {
      return;
    }
    setWorkspace((current) =>
      current
        ? {
            ...current,
            collections: current.collections.map((collection) =>
              collection.id === selectedCollectionId ? { ...collection, variables } : collection,
            ),
          }
        : current,
    );
  }

  function handleEnvironmentVariablesChange(variables: Record<string, string>) {
    if (!selectedEnvironmentId) {
      return;
    }
    setWorkspace((current) =>
      current
        ? {
            ...current,
            environments: current.environments.map((environment) =>
              environment.id === selectedEnvironmentId ? { ...environment, variables } : environment,
            ),
          }
        : current,
    );
  }

  async function handleSendRequest() {
    if (!workspace || !selectedCollectionId || !selectedEndpointId || !draftRequest) {
      return;
    }

    setIsBusy(true);
    setResponse(null);
    setResponseError(null);
    setStatus(`Sending ${draftRequest.method} ${draftRequest.url}...`);
    appendConsole(`Sending ${draftRequest.method} ${draftRequest.url}...`);

    try {
      const result = await api.sendRequest(
        workspace.path,
        selectedCollectionId,
        selectedEndpointId,
        selectedEnvironmentId,
        draftRequest,
      );
      setResponse(result);
      setActiveResponseTab("response");
      setStatus(`Received ${result.status} ${result.statusText || ""} from ${result.resolvedUrl}`.trim());
      appendConsole(`Response ${result.status} in ${result.responseTimeMs} ms from ${result.resolvedUrl}.`, result.status >= 400 ? "error" : "success");
    } catch (error) {
      const message = String(error);
      setResponseError(message);
      setStatus(`Request failed: ${message}`);
      appendConsole(`Request failed: ${message}`, "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveExample() {
    if (!workspace || !selectedCollectionId || !selectedEndpointId || !draftRequest || !response) {
      return;
    }
    const label = await requestTextPrompt({
      title: "Save Example",
      label: "Example label",
      defaultValue: `status-${response.status}`,
      confirmText: "Save",
    });
    if (label === null) {
      return;
    }
    const savedPath = await runAction("Saving example...", () =>
      api.saveResponseExample(
        workspace.path,
        selectedCollectionId,
        selectedEndpointId,
        draftRequest,
        response,
        label.trim() || undefined,
      ),
    );
    if (savedPath) {
      const next = await api.openWorkspace(workspace.path);
      applyWorkspace(next, selectedCollectionId, selectedEndpointId);
      setStatus(`Saved example: ${savedPath}`);
      appendConsole(`Saved example to ${savedPath}.`, "success");
    }
  }

  async function handleSaveCollectionAutomation() {
    if (!workspace || !selectedCollectionId) {
      return;
    }
    await runAction("Saving collection automation...", async () => {
      await api.saveCollectionAutomationScript(workspace.path, selectedCollectionId, "pre", collectionAutomation.pre);
      await api.saveCollectionAutomationScript(workspace.path, selectedCollectionId, "post", collectionAutomation.post);
      await api.saveCollectionAutomationScript(workspace.path, selectedCollectionId, "test", collectionAutomation.test);
      await api.saveCollectionAutomationScript(workspace.path, selectedCollectionId, "assert", collectionAutomation.assert);
    });
    appendConsole("Collection automation updated.", "success");
  }

  function renderMainContent() {
    if (draftRequest) {
      return (
        <AppShell.CenterColumn
          top={<TopTabs
            tabs={openEndpointTabs.map((tab) => ({
              id: `${tab.collectionId}:${tab.endpointId}`,
              collectionId: tab.collectionId,
              endpointId: tab.endpointId,
              method: tab.endpoint.request.method,
              name: tab.endpoint.name,
              active: tab.collectionId === selectedCollectionId && tab.endpointId === selectedEndpointId,
              dirty:
                tab.collectionId === selectedCollectionId &&
                tab.endpointId === selectedEndpointId &&
                hasUnsavedChanges,
            }))}
            hiddenPanels={hiddenPanels}
            onSelect={selectEndpointTab}
            onClose={closeEndpointTab}
            onCreate={() => void handleCreateEndpoint()}
            onRestorePanel={restorePanel}
          />}
          content={
            <RequestEditor
              request={draftRequest}
              activeTab={activeRequestTab}
              activeResponseTab={activeResponseTab}
              response={response}
              responseError={responseError}
              diffRows={diffRows}
              selectedHistoryPath={selectedHistoryPath}
              scripts={endpointScripts}
              collectionAutomation={collectionAutomation}
              environments={workspace?.environments ?? []}
              selectedEnvironmentId={selectedEnvironmentId}
              selectedEnvironment={selectedEnvironment}
              globalVariables={workspace?.globals ?? {}}
              collectionVariables={selectedCollection?.variables ?? {}}
              isBusy={isBusy}
              onActiveTabChange={setActiveRequestTab}
              onActiveResponseTabChange={setActiveResponseTab}
              onEnvironmentChange={setSelectedEnvironmentId}
              onCreateEnvironment={handleCreateEnvironment}
              onGlobalVariablesChange={handleGlobalVariablesChange}
              onCollectionVariablesChange={handleCollectionVariablesChange}
              onEnvironmentVariablesChange={handleEnvironmentVariablesChange}
              onRequestChange={setDraftRequest}
              onScriptsChange={setEndpointScripts}
              onCollectionAutomationChange={setCollectionAutomation}
              onSave={handleSaveRequest}
              onSaveGlobals={handleSaveGlobals}
              onSaveCollectionVariables={handleSaveCollectionVariables}
              onSaveEnvironmentVariables={handleSaveEnvironmentVariables}
              onSaveScripts={handleSaveEndpointScripts}
              onSaveTests={handleSaveCollectionAutomation}
              onSend={handleSendRequest}
              onCopyRequest={handleCopyRequest}
              onExportRequest={handleExportRequest}
              onSaveExample={handleSaveExample}
              onCopyResponse={handleCopyResponse}
              onExportResponse={handleExportResponse}
            />
          }
          bottom={consoleHidden ? undefined : (
            <BottomConsole
              collapsed={consoleCollapsed}
              entries={consoleEntries}
              status={status}
              onToggleCollapsed={() => setConsoleCollapsed((value) => !value)}
              onClear={() => setConsoleEntries([])}
              onClose={() => setConsoleHidden(true)}
            />
          )}
          bottomCollapsed={!consoleHidden && consoleCollapsed}
        />
      );
    }

    if (selectedCollection) {
      return (
        <AppShell.CenterColumn
          top={
            <TopTabs
              tabs={openEndpointTabs.map((tab) => ({
                id: `${tab.collectionId}:${tab.endpointId}`,
                collectionId: tab.collectionId,
                endpointId: tab.endpointId,
                method: tab.endpoint.request.method,
                name: tab.endpoint.name,
                active: tab.collectionId === selectedCollectionId && tab.endpointId === selectedEndpointId,
                dirty: false,
              }))}
              hiddenPanels={hiddenPanels}
              onSelect={selectEndpointTab}
              onClose={closeEndpointTab}
              onCreate={() => void handleCreateEndpoint(selectedCollection.id)}
              onRestorePanel={restorePanel}
            />
          }
          content={
            <CollectionPanel
              collection={selectedCollection}
              activeTab={activeCollectionTab}
              automation={collectionAutomation}
              isBusy={isBusy}
              onTabChange={selectCollectionTab}
              onCreateEndpoint={handleCreateEndpoint}
              onVariablesChange={handleCollectionVariablesChange}
              onAutomationChange={setCollectionAutomation}
              onSaveVariables={handleSaveCollectionVariables}
              onSaveAutomation={handleSaveCollectionAutomation}
            />
          }
          bottom={consoleHidden ? undefined : (
            <BottomConsole
              collapsed={consoleCollapsed}
              entries={consoleEntries}
              status={status}
              onToggleCollapsed={() => setConsoleCollapsed((value) => !value)}
              onClear={() => setConsoleEntries([])}
              onClose={() => setConsoleHidden(true)}
            />
          )}
          bottomCollapsed={!consoleHidden && consoleCollapsed}
        />
      );
    }

    return (
      <AppShell.CenterColumn
        top={
          <TopTabs
            tabs={openEndpointTabs.map((tab) => ({
              id: `${tab.collectionId}:${tab.endpointId}`,
              collectionId: tab.collectionId,
              endpointId: tab.endpointId,
              method: tab.endpoint.request.method,
              name: tab.endpoint.name,
              active: false,
              dirty: false,
            }))}
            hiddenPanels={hiddenPanels}
            onSelect={selectEndpointTab}
            onClose={closeEndpointTab}
            onCreate={() => void handleCreateEndpoint()}
            onRestorePanel={restorePanel}
          />
        }
        content={
          <div className="workspace-empty">
            <EmptyState
              title={workspace ? "Select a request to start editing" : "Open a workspace"}
              description={
                workspace
                  ? "Choose an endpoint from the left sidebar, or create a new request tab."
                  : "Open or create a local workspace to edit and run .bik requests."
              }
              actionLabel={workspace ? "Create request" : "Open workspace"}
              onAction={workspace ? () => void handleCreateEndpoint() : () => void handleOpenWorkspace()}
              icon={workspace ? Plus : undefined}
            />
          </div>
        }
        bottom={consoleHidden ? undefined : (
          <BottomConsole
            collapsed={consoleCollapsed}
            entries={consoleEntries}
            status={status}
            onToggleCollapsed={() => setConsoleCollapsed((value) => !value)}
            onClear={() => setConsoleEntries([])}
            onClose={() => setConsoleHidden(true)}
          />
        )}
        bottomCollapsed={!consoleHidden && consoleCollapsed}
      />
    );
  }

  return (
    <>
      <AppShell
        sidebar={
          <Sidebar
            workspace={workspace}
            selectedCollectionId={selectedCollectionId}
            selectedEndpointId={selectedEndpointId}
            onClose={() => setSidebarHidden(true)}
            onOpenWorkspace={handleOpenWorkspace}
            onCreateWorkspace={handleCreateWorkspace}
            onCreateCollection={handleCreateCollection}
            onCreateEndpoint={handleCreateEndpoint}
            onCopyCollection={handleCopyCollection}
            onExportCollection={handleExportCollection}
            onSelectCollection={selectCollection}
            onSelectEndpoint={selectEndpointTab}
            onOpenEndpointHistory={openEndpointHistory}
          />
        }
        main={renderMainContent()}
        rightPanel={
          <RightTimelinePanel
            endpoint={selectedEndpoint}
            diffRows={diffRows}
            selectedHistoryPath={selectedHistoryPath}
            onClose={() => setTimelineHidden(true)}
            onSelectHistory={setSelectedHistoryPath}
            onCompare={setSelectedHistoryPath}
            onRestore={handleRestoreHistory}
          />
        }
        showSidebar={!sidebarHidden}
        showRightPanel={Boolean(selectedEndpoint) && !timelineHidden}
      />

      {textPrompt && (
        <div className="prompt-backdrop" role="presentation">
          <form
            className="prompt-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              resolveTextPrompt(textPrompt.value);
            }}
          >
            <h2>{textPrompt.title}</h2>
            <label>
              <span>{textPrompt.label}</span>
              <input
                autoFocus
                value={textPrompt.value}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => setTextPrompt({ ...textPrompt, value: event.currentTarget.value })}
              />
            </label>
            <div className="prompt-actions">
              <button type="button" onClick={() => resolveTextPrompt(null)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                {textPrompt.confirmText}
              </button>
            </div>
          </form>
        </div>
      )}

      {endpointPrompt && (
        <div className="prompt-backdrop" role="presentation">
          <form
            className="prompt-dialog endpoint-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              resolveEndpointPrompt({
                mode: endpointPrompt.mode,
                name: endpointPrompt.name,
                method: endpointPrompt.method,
                curl: endpointPrompt.curl,
              });
            }}
          >
            <h2>New Request</h2>
            <div className="tab-switch" role="tablist" aria-label="Request creation mode">
              <button
                type="button"
                role="tab"
                aria-selected={endpointPrompt.mode === "name"}
                className={endpointPrompt.mode === "name" ? "active" : ""}
                onClick={() => setEndpointPrompt({ ...endpointPrompt, mode: "name", error: null })}
              >
                Name
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={endpointPrompt.mode === "curl"}
                className={endpointPrompt.mode === "curl" ? "active" : ""}
                onClick={() => setEndpointPrompt({ ...endpointPrompt, mode: "curl", error: null })}
              >
                cURL
              </button>
            </div>
            {endpointPrompt.mode === "name" ? (
              <div className="request-create-row">
                <label>
                  <span>HTTP verb</span>
                  <select
                    value={endpointPrompt.method}
                    onChange={(event) =>
                      setEndpointPrompt({ ...endpointPrompt, method: event.currentTarget.value, error: null })
                    }
                  >
                    {HTTP_METHODS.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Request name</span>
                  <input
                    autoFocus
                    value={endpointPrompt.name}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(event) =>
                      setEndpointPrompt({ ...endpointPrompt, name: event.currentTarget.value, error: null })
                    }
                  />
                </label>
              </div>
            ) : (
              <>
                <label>
                  <span>Request name</span>
                  <input
                    autoFocus
                    value={endpointPrompt.name}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(event) =>
                      setEndpointPrompt({ ...endpointPrompt, name: event.currentTarget.value, error: null })
                    }
                  />
                </label>
                <label>
                  <span>cURL command</span>
                  <textarea
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={endpointPrompt.curl}
                    onChange={(event) =>
                      setEndpointPrompt({ ...endpointPrompt, curl: event.currentTarget.value, error: null })
                    }
                  />
                </label>
              </>
            )}
            {endpointPrompt.error && <span className="error-text">{endpointPrompt.error}</span>}
            <div className="prompt-actions">
              <button type="button" onClick={() => resolveEndpointPrompt(null)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
