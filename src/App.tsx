import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { FlowBuilder } from "./components/flows/FlowBuilder";
import { AppToolbar } from "./components/layout/AppToolbar";
import { BottomConsole, BottomDockTab, ConsoleEntry } from "./components/layout/BottomConsole";
import { CommandPalette, CommandPaletteCommand } from "./components/layout/CommandPalette";
import { Sidebar } from "./components/layout/Sidebar";
import { TopTabs } from "./components/layout/TopTabs";
import { WelcomeScreen } from "./components/onboarding/WelcomeScreen";
import { RequestEditor } from "./components/request/RequestEditor";
import { RightTimelinePanel } from "./components/layout/RightTimelinePanel";
import { GitHubSyncPrompt } from "./components/workspace/GitHubSyncPrompt";
import { WorkspaceSwitcher } from "./components/workspace/WorkspaceSwitcher";
import {
  loadRecentWorkspaces,
  rememberWorkspace,
  removeRecentWorkspace,
} from "./services/recentWorkspaceService";
import { runRequestScript } from "./services/scriptRunner";
import { loadWorkspaceSession, saveWorkspaceSession } from "./services/sessionStore";
import * as api from "./services/tauriApi";
import { findMissingVariablesInRequest } from "./services/variableResolver";
import { cloneJson, findCollection, findEndpoint, firstCollection } from "./services/workspaceService";
import {
  BikRequest,
  CollectionAutomation,
  CollectionIndex,
  DiffRow,
  FlowDefinition,
  RecentWorkspace,
  RunResponse,
  Scripts,
  SyncStatusResult,
  WorkspaceIndex,
} from "./types/bik";

const EMPTY_COLLECTION_AUTOMATION: CollectionAutomation = { pre: "", post: "", test: "", assert: "" };
const EMPTY_SCRIPTS: Scripts = { pre: "", post: "", helpers: "" };
const REQUEST_VERSION = "1.0";
const DEFAULT_REQUEST_URL = "https://example.com/";
const DEFAULT_SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 52;
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 280;
const SYNC_PREFS_KEY = "bikapi:sync-preferences";
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
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

interface SyncPreferences {
  every30Seconds: boolean;
  onStartup: boolean;
  onSave: boolean;
}

interface ToastMessage {
  id: string;
  title: string;
  tone: "success" | "info" | "warning" | "error";
}

type RequestEditorTab = "params" | "auth" | "headers" | "body" | "scripts" | "docs" | "tests";
type ResponseTab = "response" | "headers" | "timeline" | "tests";
type HiddenPanel = "sidebar" | "timeline" | "console";
type WorkspaceViewState = "NO_WORKSPACE" | "WORKSPACE_LOADING" | "WORKSPACE_READY" | "WORKSPACE_ERROR";

interface NewWorkspaceFormState {
  name: string;
  parentPath: string;
  initializeGit: boolean;
  remoteUrl: string;
  error: string | null;
}

interface CloneWorkspaceFormState {
  repoUrl: string;
  parentPath: string;
  directoryName: string;
  error: string | null;
}

function loadSyncPreferences(): SyncPreferences {
  try {
    const raw = window.localStorage.getItem(SYNC_PREFS_KEY);
    if (!raw) {
      return { every30Seconds: false, onStartup: true, onSave: false };
    }

    const value = JSON.parse(raw) as Partial<SyncPreferences>;
    return {
      every30Seconds: Boolean(value.every30Seconds),
      onStartup: value.onStartup !== false,
      onSave: Boolean(value.onSave),
    };
  } catch {
    return { every30Seconds: false, onStartup: true, onSave: false };
  }
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceIndex | null>(null);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceViewState>("NO_WORKSPACE");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [draftRequest, setDraftRequest] = useState<BikRequest | null>(null);
  const [draftFlow, setDraftFlow] = useState<FlowDefinition | null>(null);
  const [collectionAutomation, setCollectionAutomation] =
    useState<CollectionAutomation>(EMPTY_COLLECTION_AUTOMATION);
  const [endpointScripts, setEndpointScripts] = useState<Scripts>(EMPTY_SCRIPTS);
  const [response, setResponse] = useState<RunResponse | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [selectedHistoryPath, setSelectedHistoryPath] = useState<string | null>(null);
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [textPrompt, setTextPrompt] = useState<TextPromptState | null>(null);
  const [endpointPrompt, setEndpointPrompt] = useState<EndpointPromptState | null>(null);
  const [newWorkspaceForm, setNewWorkspaceForm] = useState<NewWorkspaceFormState | null>(null);
  const [cloneWorkspaceForm, setCloneWorkspaceForm] = useState<CloneWorkspaceFormState | null>(null);
  const [githubSyncPromptOpen, setGithubSyncPromptOpen] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenEndpointTab[]>([]);
  const [activeRequestTab, setActiveRequestTab] = useState<RequestEditorTab>("body");
  const [activeResponseTab, setActiveResponseTab] = useState<ResponseTab>("response");
  const [repoUrl, setRepoUrl] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatusResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncPreferences, setSyncPreferences] = useState<SyncPreferences>(() => loadSyncPreferences());
  const [reviewSyncOpen, setReviewSyncOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [expandedSidebarWidth, setExpandedSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [timelineHidden, setTimelineHidden] = useState(true);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [consoleHidden, setConsoleHidden] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomDockTab>("response");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [flowHistoryAvailability, setFlowHistoryAvailability] = useState({ canUndo: false, canRedo: false });
  const startupSyncWorkspaceRef = useRef<string | null>(null);
  const lastSavedFlowDraftRef = useRef<string | null>(null);
  const hasWorkspace = Boolean(workspace?.path);

  useEffect(() => {
    function handleFlowHistory(event: Event) {
      const detail = (event as CustomEvent<{ canUndo: boolean; canRedo: boolean }>).detail;
      setFlowHistoryAvailability({
        canUndo: Boolean(detail?.canUndo),
        canRedo: Boolean(detail?.canRedo),
      });
    }
    window.addEventListener("bikapi:flow-history", handleFlowHistory);
    return () => window.removeEventListener("bikapi:flow-history", handleFlowHistory);
  }, []);

  const selectedCollection = useMemo(
    () => findCollection(workspace, selectedCollectionId),
    [workspace, selectedCollectionId],
  );
  const selectedEndpoint = useMemo(
    () => findEndpoint(workspace, selectedCollectionId, selectedEndpointId),
    [workspace, selectedCollectionId, selectedEndpointId],
  );
  const selectedFlow = useMemo(
    () => selectedCollection?.flows.find((flow) => flow.id === selectedFlowId) ?? null,
    [selectedCollection, selectedFlowId],
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
  const flowItems = useMemo(
    () =>
      openEndpointTabs.map((tab) => ({
        id: `${tab.collectionId}:${tab.endpointId}`,
        method: tab.endpoint.request.method,
        name: tab.endpoint.name,
      })),
    [openEndpointTabs],
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
        timelineHidden ? "timeline" : null,
        consoleHidden ? "console" : null,
      ].filter((panel): panel is HiddenPanel => panel !== null),
    [consoleHidden, sidebarHidden, timelineHidden],
  );
  const collectionStatusById = useMemo(
    () =>
      Object.fromEntries((syncStatus?.collections ?? []).map((item) => [item.collectionId, item])),
    [syncStatus],
  );

  useEffect(() => {
    void loadRecentWorkspaces().then(setRecentWorkspaces);
  }, []);

  useEffect(() => {
    const restoredSession = loadWorkspaceSession();
    if (!restoredSession) {
      setWorkspaceState("NO_WORKSPACE");
      return;
    }
    const session = restoredSession;

    let cancelled = false;

    async function restoreWorkspace() {
      setWorkspaceState("WORKSPACE_LOADING");
      setWorkspaceError(null);
      setIsBusy(true);
      setStatus("Opening last workspace...");
      try {
        const next = await api.openWorkspace(session.workspacePath);
        if (!cancelled) {
          await openWorkspaceFromIndex(next, session.collectionId, session.endpointId);
          setStatus("Ready");
        }
      } catch (error) {
        if (!cancelled) {
          saveWorkspaceSession(null);
          const message = `Last workspace unavailable: ${String(error)}`;
          setWorkspaceError(message);
          setWorkspaceState("WORKSPACE_ERROR");
          setStatus(message);
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
    window.localStorage.setItem(SYNC_PREFS_KEY, JSON.stringify(syncPreferences));
  }, [syncPreferences]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    saveWorkspaceSession({
      workspacePath: workspace.path,
      collectionId: selectedCollectionId,
      endpointId: selectedEndpointId,
      repoUrl: repoUrl.trim() || null,
    });
  }, [workspace, selectedCollectionId, selectedEndpointId, repoUrl]);

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
    setActiveBottomTab("response");
  }, [selectedEndpoint?.path]);

  useEffect(() => {
    const nextDraft = selectedFlow ? cloneJson(selectedFlow.flow) : null;
    setDraftFlow(nextDraft);
    lastSavedFlowDraftRef.current = nextDraft ? JSON.stringify(nextDraft) : null;
    if (selectedFlow) {
      setResponse(null);
      setResponseError(null);
      setActiveBottomTab("console");
    }
  }, [selectedFlow?.path]);

  useEffect(() => {
    if (!workspace || !selectedCollectionId || !selectedFlowId || !draftFlow) {
      return;
    }

    const serialized = JSON.stringify(draftFlow);
    if (serialized === lastSavedFlowDraftRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveFlowDraftSilently(selectedCollectionId, draftFlow);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [workspace?.path, selectedCollectionId, selectedFlowId, draftFlow]);

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
    if (!workspace) {
      setSyncStatus(null);
      return;
    }

    void refreshSyncStatus(true);
  }, [workspace?.path]);

  useEffect(() => {
    if (!workspace || !syncPreferences.every30Seconds) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshSyncStatus(true);
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [workspace?.path, syncPreferences.every30Seconds, repoUrl]);

  useEffect(() => {
    if (!workspace || !syncPreferences.onStartup || !syncStatus) {
      return;
    }

    if (startupSyncWorkspaceRef.current === workspace.path) {
      return;
    }

    startupSyncWorkspaceRef.current = workspace.path;
    if (syncStatus.state === "local_changes" || syncStatus.state === "remote_updates") {
      void performSync(false);
    }
  }, [workspace?.path, syncPreferences.onStartup, syncStatus?.checkedAt]);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [toasts]);

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

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (draftRequest) {
          void handleSaveRequest();
        }
        return;
      }
      if (meta && event.key === "Enter") {
        event.preventDefault();
        void handleSendRequest();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [draftRequest]);

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

  function appendScriptConsole(message: string, level: "log" | "info" | "warn" | "error") {
    const tone: ConsoleEntry["tone"] =
      level === "error" ? "error" : level === "warn" ? "warning" : "info";
    appendConsole(`[script] ${message}`, tone);
  }

  function pushToast(title: string, tone: ToastMessage["tone"] = "success") {
    setToasts((current) => [{ id: `${Date.now()}-${current.length}`, title, tone }, ...current].slice(0, 3));
  }

  async function refreshSyncStatus(silent = false) {
    if (!workspace) {
      return null;
    }

    return refreshSyncStatusForPath(workspace.path, silent);
  }

  async function refreshSyncStatusForPath(workspacePath: string, silent = false) {
    try {
      const next = await api.getSyncStatus(workspacePath);
      setSyncStatus(next);
      setRepoUrl(next.repoUrl ?? "");
      if (!silent) {
        setStatus(syncHeadline(next));
      }
      return next;
    } catch (error) {
      if (!silent) {
        const message = String(error);
        setStatus(message);
        appendConsole(message, "error");
      }
      return null;
    }
  }

  function formatLastSyncedLabel() {
    if (!lastSyncedAt) {
      return "Not yet";
    }

    const elapsed = Math.max(0, Date.now() - new Date(lastSyncedAt).getTime());
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) {
      return "just now";
    }
    if (minutes === 1) {
      return "1 min ago";
    }
    if (minutes < 60) {
      return `${minutes} min ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours === 1) {
      return "1 hour ago";
    }
    return `${hours} hours ago`;
  }

  function syncHeadline(value: SyncStatusResult) {
    switch (value.state) {
      case "remote_updates":
        return "Updates available";
      case "local_changes":
        return "Local changes";
      case "sync_required":
        return "Sync required";
      case "conflict":
        return "Conflict";
      case "offline":
        return "Offline";
      case "not_git":
        return "Local only";
      case "synced":
      default:
        return "Up to date";
    }
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
        title: "Open local workspace",
        label: "Workspace folder path",
        confirmText: "Open",
      });
      return fallback?.trim() || null;
    }
    return null;
  }

  function joinPath(parentPath: string, childName: string) {
    const trimmedParent = parentPath.replace(/[\\/]+$/, "");
    if (!trimmedParent) {
      return childName;
    }
    const separator = trimmedParent.includes("\\") && !trimmedParent.includes("/") ? "\\" : "/";
    return `${trimmedParent}${separator}${childName}`;
  }

  function repoFolderName(url: string) {
    const cleaned = url.trim().replace(/\/+$/, "");
    const segment = cleaned.split("/").pop()?.replace(/\.git$/i, "") ?? "";
    return segment.trim() || "bikapi-workspace";
  }

  async function openWorkspaceFromIndex(
    next: WorkspaceIndex,
    preferredCollectionId: string | null = null,
    preferredEndpointId: string | null = null,
  ) {
    applyWorkspace(next, preferredCollectionId, preferredEndpointId);
    setWorkspaceState("WORKSPACE_READY");
    setWorkspaceError(null);
    const remoteUrl = await api.getGitRemoteUrl(next.path).catch(() => null);
    setRepoUrl(remoteUrl ?? "");
    setRecentWorkspaces(await rememberWorkspace(next, remoteUrl));
    void refreshSyncStatusForPath(next.path, true);
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
    setSelectedFlowId(null);
    setSelectedEnvironmentId((currentEnvironmentId) =>
      currentEnvironmentId &&
      next.environments.some((environment) => environment.id === currentEnvironmentId)
        ? currentEnvironmentId
        : null,
    );
  }

  async function saveFlowDraftSilently(collectionId: string, flow: FlowDefinition) {
    if (!workspace) {
      return false;
    }

    const serialized = JSON.stringify(flow);
    if (serialized === lastSavedFlowDraftRef.current) {
      return true;
    }

    try {
      const next = await api.saveFlow(workspace.path, collectionId, flow);
      lastSavedFlowDraftRef.current = serialized;
      setWorkspace((current) => (current?.path === next.path ? next : current));
      return true;
    } catch (error) {
      const message = `Flow autosave failed: ${String(error)}`;
      setStatus(message);
      appendConsole(message, "error");
      return false;
    }
  }

  function persistCurrentFlowDraft() {
    if (!selectedCollectionId || !selectedFlowId || !draftFlow) {
      return;
    }

    void saveFlowDraftSilently(selectedCollectionId, draftFlow);
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
    persistCurrentFlowDraft();
    setSelectedCollectionId(collectionId);
    setSelectedEndpointId(endpointId);
    setSelectedFlowId(null);
  }

  function selectCollection(collectionId: string) {
    persistCurrentFlowDraft();
    setSelectedCollectionId(collectionId);
    setSelectedEndpointId(null);
    setSelectedFlowId(null);
  }

  function selectFlow(collectionId: string, flowId: string) {
    persistCurrentFlowDraft();
    setSelectedCollectionId(collectionId);
    setSelectedEndpointId(null);
    setSelectedFlowId(flowId);
    setActiveRequestTab("body");
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
      setSelectedFlowId(null);
    }
  }

  function restorePanel(panel: HiddenPanel) {
    if (panel === "sidebar") {
      setSidebarHidden(false);
      return;
    }
    if (panel === "timeline") {
      setTimelineHidden(false);
      return;
    }
    setConsoleHidden(false);
    setConsoleCollapsed(false);
  }

  function toggleSidebarPanel() {
    setSidebarHidden((current) => !current);
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      if (current) {
        setSidebarWidth(expandedSidebarWidth);
        return false;
      }

      setExpandedSidebarWidth(sidebarWidth);
      setSidebarWidth(SIDEBAR_COLLAPSED_WIDTH);
      return true;
    });
  }

  function handleSidebarWidthChange(size: number) {
    setSidebarWidth(size);
    if (size > SIDEBAR_COLLAPSED_WIDTH) {
      setExpandedSidebarWidth(size);
      if (sidebarCollapsed) {
        setSidebarCollapsed(false);
      }
    }
  }

  function clearWorkspaceViewForSwitch() {
    saveWorkspaceSession(null);
    setWorkspace(null);
    setWorkspaceState("NO_WORKSPACE");
    setWorkspaceError(null);
    setSelectedCollectionId(null);
    setSelectedEndpointId(null);
    setSelectedFlowId(null);
    setSelectedEnvironmentId(null);
    setDraftRequest(null);
    setDraftFlow(null);
    setCollectionAutomation(EMPTY_COLLECTION_AUTOMATION);
    setEndpointScripts(EMPTY_SCRIPTS);
    setResponse(null);
    setResponseError(null);
    setSelectedHistoryPath(null);
    setDiffRows([]);
    setOpenTabs([]);
    setSyncStatus(null);
    setRepoUrl("");
    setLastSyncedAt(null);
    startupSyncWorkspaceRef.current = null;
    setReviewSyncOpen(false);
    setActiveRequestTab("body");
    setActiveResponseTab("response");
    setActiveBottomTab("response");
  }

  function toggleTimelinePanel() {
    if (!selectedEndpoint) {
      return;
    }
    setTimelineHidden((current) => !current);
  }

  function toggleConsolePanel() {
    setConsoleHidden((current) => {
      if (current) {
        setConsoleCollapsed(false);
      }
      return !current;
    });
  }

  async function requestChangeSummary(kind: "upload" | "sync") {
    const requested = await requestTextPrompt({
      title: kind === "upload" ? "Describe Local Changes" : "Describe Changes Before Sync",
      label: "What changed locally?",
      defaultValue: `Workspace update ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
      confirmText: kind === "upload" ? "Upload Changes" : "Sync Workspace",
    });

    if (requested === null) {
      setStatus(kind === "upload" ? "Upload cancelled." : "Sync cancelled.");
      return null;
    }

    const value = requested.trim();
    if (!value) {
      setStatus("A short description is required.");
      appendConsole("A short description is required.", "warning");
      return null;
    }

    return value;
  }

  async function performSync(fromToolbar = true) {
    if (!workspace) {
      const message = "Open a workspace before syncing.";
      setStatus(message);
      appendConsole(message, "warning");
      return;
    }

    const nextStatus = (await refreshSyncStatus(true)) ?? syncStatus;
    if (!nextStatus) {
      return;
    }

    if (nextStatus.state === "not_git") {
      const message = "This workspace is local only.";
      setStatus(message);
      appendConsole(message, "info");
      pushToast(message, "info");
      return;
    }

    if (nextStatus.state === "offline") {
      const message = "You appear to be offline.";
      setStatus(message);
      appendConsole(message, "warning");
      return;
    }

    if (nextStatus.state === "synced") {
      const message = "Up to date";
      setStatus(message);
      appendConsole("No updates found.", "info");
      return;
    }

    if ((nextStatus.state === "sync_required" || nextStatus.state === "conflict") && fromToolbar) {
      setReviewSyncOpen(true);
      return;
    }

    const target = nextStatus.repoUrl?.trim() || repoUrl.trim();
    if (!target) {
      const message = "This workspace is local only.";
      setStatus(message);
      appendConsole(message, "info");
      return;
    }

    let action: "pull" | "push" | "sync" = "sync";
    if (nextStatus.state === "remote_updates") {
      action = "pull";
    } else if (nextStatus.state === "local_changes") {
      action = "push";
    }

    let changeSummary: string | undefined;
    if (nextStatus.localChanges > 0 && (action === "push" || action === "sync")) {
      changeSummary = await requestChangeSummary(action === "push" ? "upload" : "sync") ?? undefined;
      if (!changeSummary) {
        return;
      }
    }

    const message =
      action === "pull"
        ? "Downloading updates..."
        : action === "push"
          ? "Uploading changes..."
          : "Synchronizing workspace...";

    const result = await runAction(message, async () => {
      setIsSyncing(true);
      try {
        return await api.runGitAction(workspace.path, target, action, changeSummary);
      } finally {
        setIsSyncing(false);
      }
    });
    if (!result) {
      return;
    }

    setLastSyncedAt(new Date().toISOString());
    await refreshSyncStatus(true);
    setReviewSyncOpen(false);
    const successMessage =
      action === "pull"
        ? "Download complete"
        : action === "push"
          ? "Upload complete"
          : "Sync complete";
    setStatus(successMessage);
    appendConsole(successMessage, "success");
    if (result.output.trim()) {
      appendConsole(result.output, "info");
    }
    pushToast(successMessage, "success");
  }

  function maybeAutoSync() {
    if (syncPreferences.onSave) {
      void performSync(false);
    } else {
      void refreshSyncStatus(true);
    }
  }

  async function captureSaveSnapshot(label: string) {
    if (!workspace) {
      return;
    }

    try {
      const result = await api.saveWorkspaceSnapshot(workspace.path, label);
      if (result) {
        appendConsole(`Saved snapshot: ${result.split("\n")[0]}.`, "success");
      }
    } catch (error) {
      appendConsole(`Snapshot save failed: ${String(error)}`, "warning");
    }
  }

  const paletteCommands = useMemo<CommandPaletteCommand[]>(
    () => [
      {
        id: "open-workspace",
        label: "Open Local Workspace",
        shortcut: "Ctrl/Cmd+O",
        run: () => void handleOpenWorkspace(),
      },
      {
        id: "new-collection",
        label: "Create Collection",
        run: () => void handleCreateCollection(),
      },
      {
        id: "new-request",
        label: "Create Request",
        run: () => void handleCreateEndpoint(),
      },
      {
        id: "save-request",
        label: "Save Current Request",
        shortcut: "Ctrl/Cmd+S",
        run: () => void handleSaveRequest(),
      },
      {
        id: "send-request",
        label: "Send Current Request",
        shortcut: "Ctrl/Cmd+Enter",
        run: () => void handleSendRequest(),
      },
      {
        id: "toggle-sidebar",
        label: `${sidebarHidden ? "Show" : "Hide"} Collections Panel`,
        run: toggleSidebarPanel,
      },
      {
        id: "toggle-timeline",
        label: `${timelineHidden ? "Show" : "Hide"} Timeline Panel`,
        hint: selectedEndpoint ? selectedEndpoint.name : "Select a request first",
        run: toggleTimelinePanel,
      },
      {
        id: "toggle-console",
        label: `${consoleHidden ? "Show" : "Hide"} Console`,
        run: toggleConsolePanel,
      },
      {
        id: "show-response-dock",
        label: "Show Response Dock",
        run: () => {
          setConsoleHidden(false);
          setConsoleCollapsed(false);
          setActiveBottomTab("response");
        },
      },
    ],
    [consoleHidden, selectedEndpoint, sidebarHidden, timelineHidden],
  );

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

    clearWorkspaceViewForSwitch();
    setWorkspaceState("WORKSPACE_LOADING");
    const next = await runAction("Opening workspace...", () => api.openWorkspace(path));
    if (next) {
      await openWorkspaceFromIndex(next);
      return;
    }

    setWorkspaceError(`Could not open workspace at ${path}.`);
    setWorkspaceState("WORKSPACE_ERROR");
  }

  function handleCreateWorkspace(initializeGit = false) {
    setNewWorkspaceForm({
      name: "BikAPI Workspace",
      parentPath: "",
      initializeGit,
      remoteUrl: "",
      error: null,
    });
  }

  function handleContinueWithGitHubSync() {
    setGithubSyncPromptOpen(true);
  }

  function handleCloneFromGitHub() {
    setGithubSyncPromptOpen(false);
    handleCloneWorkspace();
  }

  function handleCreateGitHubSyncedWorkspace() {
    setGithubSyncPromptOpen(false);
    handleCreateWorkspace(true);
  }

  async function handleOpenRecentWorkspace(recentWorkspace: RecentWorkspace) {
    if (recentWorkspace.missing) {
      return;
    }

    clearWorkspaceViewForSwitch();
    setWorkspaceState("WORKSPACE_LOADING");
    const next = await runAction("Opening workspace...", () => api.openWorkspace(recentWorkspace.path));
    if (next) {
      await openWorkspaceFromIndex(next, null, null);
      setStatus("Workspace ready.");
      return;
    }

    setWorkspaceError(`Could not open workspace at ${recentWorkspace.path}.`);
    setWorkspaceState("WORKSPACE_ERROR");
    setRecentWorkspaces(await loadRecentWorkspaces());
  }

  async function handleRemoveRecentWorkspace(path: string) {
    setRecentWorkspaces(await removeRecentWorkspace(path));
  }

  async function submitNewWorkspace() {
    if (!newWorkspaceForm) {
      return;
    }

    const name = newWorkspaceForm.name.trim();
    const parentPath = newWorkspaceForm.parentPath.trim();
    if (!name || !parentPath) {
      setNewWorkspaceForm({ ...newWorkspaceForm, error: "Workspace name and folder location are required." });
      return;
    }

    clearWorkspaceViewForSwitch();
    setWorkspaceState("WORKSPACE_LOADING");
    setNewWorkspaceForm(null);
    const next = await runAction("Creating workspace...", () => api.createWorkspaceInDirectory(parentPath, name));
    if (!next) {
      setWorkspaceError("Could not create workspace.");
      setWorkspaceState("WORKSPACE_ERROR");
      return;
    }

    if (newWorkspaceForm.initializeGit) {
      const initialized = await runAction("Initializing workspace history...", () =>
        api.initializeGitRepository(next.path, "Initial BikAPI workspace"),
      );
      if (!initialized) {
        setWorkspaceError("Workspace created, but history setup failed.");
        setWorkspaceState("WORKSPACE_ERROR");
        return;
      }
      appendConsole("Workspace history initialized.", "success");

      const remoteUrl = newWorkspaceForm.remoteUrl.trim();
      if (remoteUrl) {
        const pushed = await runAction("Uploading initial workspace...", () =>
          api.runGitAction(next.path, remoteUrl, "push"),
        );
        if (!pushed) {
          setWorkspaceError("Workspace created, but upload setup failed.");
          setWorkspaceState("WORKSPACE_ERROR");
          return;
        }
        appendConsole("Initial workspace uploaded.", "success");
      }
    }

    await openWorkspaceFromIndex(next);
    setStatus("Workspace ready.");
  }

  function handleCloneWorkspace() {
    setCloneWorkspaceForm({
      repoUrl: "",
      parentPath: "",
      directoryName: "",
      error: null,
    });
  }

  async function submitCloneWorkspace() {
    if (!cloneWorkspaceForm) {
      return;
    }

    const repo = cloneWorkspaceForm.repoUrl.trim();
    const parentPath = cloneWorkspaceForm.parentPath.trim();
    const directoryName = (cloneWorkspaceForm.directoryName.trim() || repoFolderName(repo)).trim();
    if (!repo || !parentPath || !directoryName) {
      setCloneWorkspaceForm({
        ...cloneWorkspaceForm,
        error: "Repository URL and folder location are required.",
      });
      return;
    }

    clearWorkspaceViewForSwitch();
    setWorkspaceState("WORKSPACE_LOADING");
    setCloneWorkspaceForm(null);
    const destinationPath = joinPath(parentPath, directoryName);
    const clonedPath = await runAction("Cloning workspace...", () => api.cloneWorkspace(repo, destinationPath));
    if (!clonedPath) {
      setWorkspaceError("Could not clone workspace.");
      setWorkspaceState("WORKSPACE_ERROR");
      return;
    }

    let next = await runAction("Opening cloned workspace...", () => api.openWorkspace(clonedPath));
    if (!next) {
      const shouldCreateWorkspace = window.confirm(
        "This repo is not a BikAPI workspace. Create workspace files here?",
      );
      if (!shouldCreateWorkspace) {
        setWorkspaceError("Cloned repository does not contain workspace.bik.");
        setWorkspaceState("WORKSPACE_ERROR");
        return;
      }

      next = await runAction("Creating BikAPI workspace files...", () =>
        api.createWorkspace(clonedPath, directoryName),
      );
      if (!next) {
        setWorkspaceError("Cloned repository could not be prepared as a BikAPI workspace.");
        setWorkspaceState("WORKSPACE_ERROR");
        return;
      }
    }

    await openWorkspaceFromIndex(next);
    setRepoUrl(repo);
    setStatus("Workspace ready.");
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

  async function handleCreateFlow(collectionId?: string) {
    if (!workspace) {
      return;
    }

    const targetCollectionId = collectionId ?? selectedCollectionId ?? workspace.collections[0]?.id;
    if (!targetCollectionId) {
      setStatus("Create a collection first.");
      return;
    }

    const name = (
      await requestTextPrompt({
        title: "New Flow",
        label: "Flow name",
        defaultValue: "Booking Flow",
        confirmText: "Create",
      })
    )?.trim();
    if (!name) {
      return;
    }

    const existingFlowIds = new Set(
      workspace.collections.find((collection) => collection.id === targetCollectionId)?.flows.map((flow) => flow.id) ?? [],
    );
    const next = await runAction("Creating flow...", () => api.createFlow(workspace.path, targetCollectionId, name));
    if (next) {
      const collection = next.collections.find((item) => item.id === targetCollectionId);
      const createdFlow = collection?.flows.find((flow) => !existingFlowIds.has(flow.id));
      applyWorkspace(next, targetCollectionId, null);
      setSelectedFlowId(createdFlow?.id ?? null);
      appendConsole(`Created flow ${name}.`, "success");
      maybeAutoSync();
    }
  }

  async function handleSaveFlow() {
    if (!workspace || !selectedCollectionId || !draftFlow) {
      return;
    }

    const next = await runAction("Saving flow.bik...", () =>
      api.saveFlow(workspace.path, selectedCollectionId, draftFlow),
    );
    if (next) {
      lastSavedFlowDraftRef.current = JSON.stringify(draftFlow);
      setWorkspace(next);
      setSelectedCollectionId(selectedCollectionId);
      setSelectedEndpointId(null);
      setSelectedFlowId(draftFlow.id);
      appendConsole(`Saved flow ${draftFlow.name}.`, "success");
      await captureSaveSnapshot(`Saved ${draftFlow.name} flow at`);
      maybeAutoSync();
    }
  }

  async function handleRenameCollection(collectionId: string) {
    if (!workspace) {
      return;
    }
    const collection = workspace.collections.find((item) => item.id === collectionId);
    if (!collection) {
      return;
    }
    const name = (await requestTextPrompt({
      title: "Rename Collection",
      label: "Collection name",
      defaultValue: collection.name,
      confirmText: "Rename",
    }))?.trim();
    if (!name || name === collection.name) {
      return;
    }
    const next = await runAction("Renaming collection...", () => api.renameCollection(workspace.path, collectionId, name));
    if (next) {
      applyWorkspace(next, collectionId, selectedEndpointId);
      pushToast("Collection renamed", "success");
      maybeAutoSync();
    }
  }

  async function handleDeleteCollection(collectionId: string) {
    if (!workspace) {
      return;
    }
    const collection = workspace.collections.find((item) => item.id === collectionId);
    if (!collection || !window.confirm(`Delete collection "${collection.name}" and all requests/flows inside it?`)) {
      return;
    }
    const next = await runAction("Deleting collection...", () => api.deleteCollection(workspace.path, collectionId));
    if (next) {
      applyWorkspace(next, null, null);
      pushToast("Collection deleted", "success");
      maybeAutoSync();
    }
  }

  async function handleRenameRequest(collectionId: string, endpointId: string) {
    if (!workspace) {
      return;
    }
    const endpoint = findEndpoint(workspace, collectionId, endpointId);
    if (!endpoint) {
      return;
    }
    const name = (await requestTextPrompt({
      title: "Rename Request",
      label: "Request name",
      defaultValue: endpoint.name,
      confirmText: "Rename",
    }))?.trim();
    if (!name || name === endpoint.name) {
      return;
    }
    const next = await runAction("Renaming request...", () => api.renameRequest(workspace.path, collectionId, endpointId, name));
    if (next) {
      applyWorkspace(next, collectionId, endpointId);
      pushToast("Request renamed", "success");
      maybeAutoSync();
    }
  }

  async function handleDeleteRequest(collectionId: string, endpointId: string) {
    if (!workspace) {
      return;
    }
    const collection = workspace.collections.find((item) => item.id === collectionId);
    const endpoint = collection?.endpoints.find((item) => item.id === endpointId);
    if (!collection || !endpoint) {
      return;
    }
    const usageCount = collection.flows.reduce(
      (count, flow) => count + flow.flow.nodes.filter((node) => node.requestId === endpointId).length,
      0,
    );
    const warning = usageCount > 0
      ? `\n\nThis request is used in ${usageCount} flow node${usageCount === 1 ? "" : "s"}. Delete will remove those nodes from flows.`
      : "";
    if (!window.confirm(`Delete request "${endpoint.name}"?${warning}`)) {
      return;
    }
    const next = await runAction("Deleting request...", () => api.deleteRequest(workspace.path, collectionId, endpointId));
    if (next) {
      applyWorkspace(next, collectionId, null);
      pushToast("Request deleted", "success");
      maybeAutoSync();
    }
  }

  async function handleRenameFlow(collectionId: string, flowId: string) {
    if (!workspace) {
      return;
    }
    const flow = workspace.collections.find((item) => item.id === collectionId)?.flows.find((item) => item.id === flowId);
    if (!flow) {
      return;
    }
    const name = (await requestTextPrompt({
      title: "Rename Flow",
      label: "Flow name",
      defaultValue: flow.name,
      confirmText: "Rename",
    }))?.trim();
    if (!name || name === flow.name) {
      return;
    }
    const next = await runAction("Renaming flow...", () => api.renameFlow(workspace.path, collectionId, flowId, name));
    if (next) {
      setWorkspace(next);
      setSelectedCollectionId(collectionId);
      setSelectedEndpointId(null);
      setSelectedFlowId(flowId);
      pushToast("Flow renamed", "success");
      maybeAutoSync();
    }
  }

  async function handleDeleteFlow(collectionId: string, flowId: string) {
    if (!workspace) {
      return;
    }
    const flow = workspace.collections.find((item) => item.id === collectionId)?.flows.find((item) => item.id === flowId);
    if (!flow || !window.confirm(`Delete flow "${flow.name}"?`)) {
      return;
    }
    const next = await runAction("Deleting flow...", () => api.deleteFlow(workspace.path, collectionId, flowId));
    if (next) {
      setWorkspace(next);
      setSelectedCollectionId(collectionId);
      setSelectedEndpointId(null);
      setSelectedFlowId(null);
      pushToast("Flow deleted", "success");
      maybeAutoSync();
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

  async function handleDuplicateCollection(collectionId: string) {
    if (!workspace) {
      return;
    }
    const collection = workspace.collections.find((item) => item.id === collectionId);
    if (!collection) {
      return;
    }
    const name = (await requestTextPrompt({
      title: "Duplicate Collection",
      label: "Collection name",
      defaultValue: `${collection.name} Copy`,
      confirmText: "Duplicate",
    }))?.trim();
    if (!name) {
      return;
    }
    const next = await runAction("Duplicating collection...", () =>
      api.duplicateCollection(workspace.path, collectionId, name),
    );
    if (next) {
      const created = next.collections.find((item) => item.name === name);
      applyWorkspace(next, created?.id ?? collectionId, null);
      pushToast("Collection duplicated", "success");
      maybeAutoSync();
    }
  }

  async function handleDuplicateRequest(collectionId: string, endpointId: string) {
    if (!workspace) {
      return;
    }
    const endpoint = findEndpoint(workspace, collectionId, endpointId);
    if (!endpoint) {
      return;
    }
    const name = (await requestTextPrompt({
      title: "Duplicate Request",
      label: "Request name",
      defaultValue: `${endpoint.name} Copy`,
      confirmText: "Duplicate",
    }))?.trim();
    if (!name) {
      return;
    }
    const next = await runAction("Duplicating request...", () =>
      api.duplicateRequest(workspace.path, collectionId, endpointId, name),
    );
    if (next) {
      const created = next.collections
        .find((collection) => collection.id === collectionId)
        ?.endpoints.find((item) => item.name === name);
      applyWorkspace(next, collectionId, created?.id ?? endpointId);
      pushToast("Request duplicated", "success");
      maybeAutoSync();
    }
  }

  async function handleDuplicateFlow(collectionId: string, flowId: string) {
    if (!workspace) {
      return;
    }
    const flow = workspace.collections.find((item) => item.id === collectionId)?.flows.find((item) => item.id === flowId);
    if (!flow) {
      return;
    }
    const name = (await requestTextPrompt({
      title: "Duplicate Flow",
      label: "Flow name",
      defaultValue: `${flow.name} Copy`,
      confirmText: "Duplicate",
    }))?.trim();
    if (!name) {
      return;
    }
    const next = await runAction("Duplicating flow...", () =>
      api.duplicateFlow(workspace.path, collectionId, flowId, name),
    );
    if (next) {
      const created = next.collections
        .find((collection) => collection.id === collectionId)
        ?.flows.find((item) => item.name === name);
      setWorkspace(next);
      setSelectedCollectionId(collectionId);
      setSelectedEndpointId(null);
      setSelectedFlowId(created?.id ?? flowId);
      pushToast("Flow duplicated", "success");
      maybeAutoSync();
    }
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
      await captureSaveSnapshot(`Saved ${draftRequest.name} at`);
      maybeAutoSync();
    }
  }

  async function handleSaveGlobals() {
    if (!workspace) {
      return;
    }
    const next = await runAction("Saving globals.bik...", () => api.saveGlobals(workspace.path, workspace.globals));
    if (next) {
      applyWorkspace(next, selectedCollectionId, selectedEndpointId);
      await captureSaveSnapshot("Saved globals at");
      maybeAutoSync();
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
      await captureSaveSnapshot(`Saved ${selectedCollection.name} variables at`);
      maybeAutoSync();
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
      await captureSaveSnapshot(`Saved ${selectedEnvironment.name} environment at`);
      maybeAutoSync();
    }
  }

  async function handleSaveEndpointScripts() {
    if (!workspace || !selectedCollectionId || !selectedEndpointId) {
      return;
    }

    await runAction("Saving endpoint scripts...", async () => {
      await api.saveScript(workspace.path, selectedCollectionId, selectedEndpointId, "pre", endpointScripts.pre);
      await api.saveScript(workspace.path, selectedCollectionId, selectedEndpointId, "post", endpointScripts.post);
      await api.saveScript(workspace.path, selectedCollectionId, selectedEndpointId, "helpers", endpointScripts.helpers);
    });
    appendConsole("Endpoint scripts saved.", "success");
    await captureSaveSnapshot("Saved endpoint scripts at");
    maybeAutoSync();
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
    if (!workspace || !selectedCollectionId || !selectedEndpointId || !selectedCollection || !draftRequest) {
      return;
    }

    const requestToSend = cloneJson(draftRequest);
    const missingVariables = findMissingVariablesInRequest(requestToSend, {
      globals: workspace.globals,
      environment: selectedEnvironment,
      collection: selectedCollection,
      requestVariables: requestToSend.variables,
    });
    if (missingVariables.length > 0) {
      const message = `Missing variable: ${missingVariables.map((variable) => variable.name).join(", ")}`;
      setStatus(message);
      pushToast(message, "warning");
      if (!window.confirm(`${message}\n\nSend anyway with unresolved templates?`)) {
        return;
      }
    }
    const scriptVariables = {
      ...workspace.globals,
      ...selectedCollection.variables,
      ...(selectedEnvironment?.variables ?? {}),
      ...requestToSend.variables,
    };

    setIsBusy(true);
    setResponse(null);
    setResponseError(null);
    setStatus(`Sending ${draftRequest.method} ${draftRequest.url}...`);
    appendConsole(`Sending ${draftRequest.method} ${draftRequest.url}...`);

    try {
      await runRequestScript({
        name: "Collection",
        phase: "pre",
        script: collectionAutomation.pre,
        request: requestToSend,
        variables: scriptVariables,
        onLog: appendScriptConsole,
      });
      await runRequestScript({
        name: "Endpoint",
        phase: "pre",
        script: endpointScripts.pre,
        helpers: endpointScripts.helpers,
        request: requestToSend,
        variables: scriptVariables,
        onLog: appendScriptConsole,
      });
      setDraftRequest(cloneJson(requestToSend));

      const result = await api.sendRequest(
        workspace.path,
        selectedCollectionId,
        selectedEndpointId,
        selectedEnvironmentId,
        requestToSend,
      );
      setResponse(result);
      setActiveResponseTab("response");
      setStatus(`Received ${result.status} ${result.statusText || ""} from ${result.resolvedUrl}`.trim());
      appendConsole(`Response ${result.status} in ${result.responseTimeMs} ms from ${result.resolvedUrl}.`, result.status >= 400 ? "error" : "success");

      try {
        await runRequestScript({
          name: "Endpoint",
          phase: "post",
          script: endpointScripts.post,
          helpers: endpointScripts.helpers,
          request: requestToSend,
          response: result,
          variables: scriptVariables,
          onLog: appendScriptConsole,
        });
        await runRequestScript({
          name: "Collection",
          phase: "post",
          script: collectionAutomation.post,
          request: requestToSend,
          response: result,
          variables: scriptVariables,
          onLog: appendScriptConsole,
        });
      } catch (error) {
        const message = String(error);
        setStatus(message);
        appendConsole(message, "error");
      }
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
    await captureSaveSnapshot("Saved collection automation at");
    maybeAutoSync();
  }

  function renderMainContent() {
    if (workspace && selectedCollection && draftFlow) {
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
              onCreate={() => void handleCreateEndpoint(selectedCollection.id)}
              onRestorePanel={restorePanel}
            />
          }
          content={
            <FlowBuilder
              workspacePath={workspace.path}
              collection={selectedCollection}
              flow={draftFlow}
              environmentId={selectedEnvironmentId}
              onChange={setDraftFlow}
              onSave={() => void handleSaveFlow()}
            />
          }
          bottom={undefined}
          bottomCollapsed={false}
        />
      );
    }

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
              activeTab={activeBottomTab}
              response={response}
              responseError={responseError}
              responseBusy={isBusy}
              responseTab={activeResponseTab}
              diffRows={diffRows}
              selectedHistoryPath={selectedHistoryPath}
              flowItems={flowItems}
              onToggleCollapsed={() => setConsoleCollapsed((value) => !value)}
              onClear={() => setConsoleEntries([])}
              onClose={() => setConsoleHidden(true)}
              onTabChange={setActiveBottomTab}
              onResponseTabChange={setActiveResponseTab}
              onSaveExample={handleSaveExample}
              onCopyResponse={handleCopyResponse}
              onExportResponse={handleExportResponse}
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
            <div className="workspace-ready-empty">
              <h2>Select a request</h2>
              <p>Choose a request from the sidebar or create a new one.</p>
              <div className="workspace-ready-actions">
                <button type="button" className="primary" onClick={() => void handleCreateEndpoint()}>
                  New request
                </button>
                <button type="button" onClick={() => void handleCreateCollection()}>
                  New collection
                </button>
              </div>
            </div>
          </div>
        }
        bottom={consoleHidden ? undefined : (
          <BottomConsole
            collapsed={consoleCollapsed}
            entries={consoleEntries}
            status={status}
            activeTab={activeBottomTab}
            response={response}
            responseError={responseError}
            responseBusy={isBusy}
            responseTab={activeResponseTab}
            diffRows={diffRows}
            selectedHistoryPath={selectedHistoryPath}
            flowItems={flowItems}
            onToggleCollapsed={() => setConsoleCollapsed((value) => !value)}
            onClear={() => setConsoleEntries([])}
            onClose={() => setConsoleHidden(true)}
            onTabChange={setActiveBottomTab}
            onResponseTabChange={setActiveResponseTab}
            onSaveExample={handleSaveExample}
            onCopyResponse={handleCopyResponse}
            onExportResponse={handleExportResponse}
          />
        )}
        bottomCollapsed={!consoleHidden && consoleCollapsed}
      />
    );
  }

  return (
    <>
      {hasWorkspace && workspace ? (
        <AppShell
          toolbar={
            <AppToolbar
              workspaceSwitcher={
                <WorkspaceSwitcher
                  currentWorkspaceName={workspace.name}
                  currentWorkspacePath={workspace.path}
                  recentWorkspaces={recentWorkspaces}
                  onOpenRecentWorkspace={(recentWorkspace) => void handleOpenRecentWorkspace(recentWorkspace)}
                  onRemoveRecentWorkspace={(path) => void handleRemoveRecentWorkspace(path)}
                  onOpenLocalWorkspace={() => void handleOpenWorkspace()}
                  onCreateWorkspace={() => handleCreateWorkspace(false)}
                  onCloneWorkspace={handleCloneWorkspace}
                  onOpenSettings={() => setSettingsOpen(true)}
                />
              }
              status={status}
              isSyncing={isSyncing}
              syncStatus={syncStatus}
              lastSyncedLabel={formatLastSyncedLabel()}
              environments={[
                { value: "", label: "No environment" },
                ...workspace.environments.map((environment) => ({
                  value: environment.id,
                  label: environment.name,
                })),
              ]}
              selectedEnvironmentId={selectedEnvironmentId ?? ""}
              sidebarHidden={sidebarHidden}
              timelineHidden={timelineHidden}
              consoleHidden={consoleHidden}
              canUndo={flowHistoryAvailability.canUndo}
              canRedo={flowHistoryAvailability.canRedo}
              onCreateCollection={() => void handleCreateCollection()}
              onUndo={() => window.dispatchEvent(new Event("bikapi:flow-undo"))}
              onRedo={() => window.dispatchEvent(new Event("bikapi:flow-redo"))}
              onCreateRequest={() => void handleCreateEndpoint()}
              onSendRequest={() => void handleSendRequest()}
              onSync={() => void performSync(true)}
              onReviewChanges={() => setReviewSyncOpen(true)}
              onKeepLocalOnly={() => {
                setStatus("This workspace is local only.");
                pushToast("Kept local only", "info");
              }}
              onConnectGitHub={handleContinueWithGitHubSync}
              onEnvironmentChange={(value) => setSelectedEnvironmentId(value || null)}
              onToggleSidebar={toggleSidebarPanel}
              onToggleTimeline={toggleTimelinePanel}
              onToggleConsole={toggleConsolePanel}
              onOpenPalette={() => setCommandPaletteOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          }
          sidebar={
            <Sidebar
              workspace={workspace}
              collectionStatuses={collectionStatusById}
              selectedCollectionId={selectedCollectionId}
              selectedEndpointId={selectedEndpointId}
              selectedFlowId={selectedFlowId}
              collapsed={sidebarCollapsed}
              onClose={() => setSidebarHidden(true)}
              onToggleCollapsed={toggleSidebarCollapsed}
              onCreateCollection={handleCreateCollection}
              onCreateEndpoint={handleCreateEndpoint}
              onCreateFlow={handleCreateFlow}
              onDuplicateCollection={(collectionId) => void handleDuplicateCollection(collectionId)}
              onExportCollection={handleExportCollection}
              onSelectCollection={selectCollection}
              onSelectEndpoint={selectEndpointTab}
              onSelectFlow={selectFlow}
              onOpenEndpointHistory={openEndpointHistory}
              onRenameCollection={(collectionId) => void handleRenameCollection(collectionId)}
              onDeleteCollection={(collectionId) => void handleDeleteCollection(collectionId)}
              onRenameRequest={(collectionId, endpointId) => void handleRenameRequest(collectionId, endpointId)}
              onDuplicateRequest={(collectionId, endpointId) => void handleDuplicateRequest(collectionId, endpointId)}
              onDeleteRequest={(collectionId, endpointId) => void handleDeleteRequest(collectionId, endpointId)}
              onRenameFlow={(collectionId, flowId) => void handleRenameFlow(collectionId, flowId)}
              onDuplicateFlow={(collectionId, flowId) => void handleDuplicateFlow(collectionId, flowId)}
              onDeleteFlow={(collectionId, flowId) => void handleDeleteFlow(collectionId, flowId)}
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
          sidebarWidth={sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth}
          sidebarMinWidth={sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_MIN_WIDTH}
          sidebarMaxWidth={sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_MAX_WIDTH}
          onSidebarWidthChange={handleSidebarWidthChange}
          showSidebar={!sidebarHidden}
          showRightPanel={Boolean(selectedEndpoint) && !timelineHidden}
        />
      ) : (
        <WelcomeScreen
          state={
            workspaceState === "WORKSPACE_LOADING"
              ? "loading"
              : workspaceState === "WORKSPACE_ERROR"
                ? "error"
                : "idle"
          }
          error={workspaceError}
          onContinueWithGitHub={handleContinueWithGitHubSync}
          onOpenLocalWorkspace={() => void handleOpenWorkspace()}
          onCreateLocalWorkspace={() => handleCreateWorkspace(false)}
          onBackToWelcome={() => {
            clearWorkspaceViewForSwitch();
            setWorkspaceState("NO_WORKSPACE");
          }}
        />
      )}
      <CommandPalette
        open={commandPaletteOpen}
        commands={paletteCommands}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {githubSyncPromptOpen && (
        <GitHubSyncPrompt
          onCloneExisting={handleCloneFromGitHub}
          onCreateSyncedWorkspace={handleCreateGitHubSyncedWorkspace}
          onClose={() => setGithubSyncPromptOpen(false)}
        />
      )}

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

      {newWorkspaceForm && (
        <div className="prompt-backdrop" role="presentation">
          <form
            className="prompt-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void submitNewWorkspace();
            }}
          >
            <h2>New Workspace</h2>
            <label>
              <span>Workspace name</span>
              <input
                autoFocus
                value={newWorkspaceForm.name}
                onChange={(event) =>
                  setNewWorkspaceForm({ ...newWorkspaceForm, name: event.currentTarget.value, error: null })
                }
              />
            </label>
            <label>
              <span>Folder location</span>
              <div className="path-picker-row">
                <input
                  value={newWorkspaceForm.parentPath}
                  onChange={(event) =>
                    setNewWorkspaceForm({ ...newWorkspaceForm, parentPath: event.currentTarget.value, error: null })
                  }
                />
                <button
                  type="button"
                  onClick={async () => {
                    const selected = await chooseFolder();
                    if (selected) {
                      setNewWorkspaceForm({ ...newWorkspaceForm, parentPath: selected, error: null });
                    }
                  }}
                >
                  Choose…
                </button>
              </div>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={newWorkspaceForm.initializeGit}
                onChange={(event) =>
                  setNewWorkspaceForm({
                    ...newWorkspaceForm,
                    initializeGit: event.currentTarget.checked,
                    error: null,
                  })
                }
              />
              <span>Enable collaboration sync</span>
            </label>
            {newWorkspaceForm.initializeGit && (
              <label>
                <span>Repository URL (optional)</span>
                <input
                  value={newWorkspaceForm.remoteUrl}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="https://github.com/user/repo.git"
                  onChange={(event) =>
                    setNewWorkspaceForm({
                      ...newWorkspaceForm,
                      remoteUrl: event.currentTarget.value,
                      error: null,
                    })
                  }
                />
              </label>
            )}
            {newWorkspaceForm.error && <span className="error-text">{newWorkspaceForm.error}</span>}
            <div className="prompt-actions">
              <button type="button" onClick={() => setNewWorkspaceForm(null)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Create workspace
              </button>
            </div>
          </form>
        </div>
      )}

      {cloneWorkspaceForm && (
        <div className="prompt-backdrop" role="presentation">
          <form
            className="prompt-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCloneWorkspace();
            }}
          >
            <h2>Clone workspace</h2>
            <label>
              <span>Repository URL</span>
              <input
                autoFocus
                value={cloneWorkspaceForm.repoUrl}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) =>
                  setCloneWorkspaceForm({
                    ...cloneWorkspaceForm,
                    repoUrl: event.currentTarget.value,
                    directoryName:
                      cloneWorkspaceForm.directoryName || repoFolderName(event.currentTarget.value),
                    error: null,
                  })
                }
              />
            </label>
            <label>
              <span>Folder location</span>
              <div className="path-picker-row">
                <input
                  value={cloneWorkspaceForm.parentPath}
                  onChange={(event) =>
                    setCloneWorkspaceForm({
                      ...cloneWorkspaceForm,
                      parentPath: event.currentTarget.value,
                      error: null,
                    })
                  }
                />
                <button
                  type="button"
                  onClick={async () => {
                    const selected = await chooseFolder();
                    if (selected) {
                      setCloneWorkspaceForm({ ...cloneWorkspaceForm, parentPath: selected, error: null });
                    }
                  }}
                >
                  Choose…
                </button>
              </div>
            </label>
            <label>
              <span>Folder name</span>
              <input
                value={cloneWorkspaceForm.directoryName}
                onChange={(event) =>
                  setCloneWorkspaceForm({
                    ...cloneWorkspaceForm,
                    directoryName: event.currentTarget.value,
                    error: null,
                  })
                }
              />
            </label>
            {cloneWorkspaceForm.error && <span className="error-text">{cloneWorkspaceForm.error}</span>}
            <div className="prompt-actions">
              <button type="button" onClick={() => setCloneWorkspaceForm(null)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Clone workspace
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

      {reviewSyncOpen && syncStatus && (
        <div className="prompt-backdrop" role="presentation">
          <div className="prompt-dialog sync-review-dialog">
            <h2>Review Changes</h2>
            <div className="sync-review-summary">
              <div>
                <strong>{syncStatus.localChanges}</strong>
                <span>local changes</span>
              </div>
              <div>
                <strong>{syncStatus.remoteChanges}</strong>
                <span>updates available</span>
              </div>
            </div>
            <div className="sync-review-grid">
              <section>
                <strong>Local Changes</strong>
                <div className="sync-file-list">
                  {syncStatus.localChangeFiles.length === 0 ? (
                    <span>No local changes</span>
                  ) : (
                    syncStatus.localChangeFiles.map((file) => <code key={file}>{file}</code>)
                  )}
                </div>
              </section>
              <section>
                <strong>Available Updates</strong>
                <div className="sync-file-list">
                  {syncStatus.remoteChangeFiles.length === 0 ? (
                    <span>No remote updates</span>
                  ) : (
                    syncStatus.remoteChangeFiles.map((file) => <code key={file}>{file}</code>)
                  )}
                </div>
              </section>
            </div>
            <div className="prompt-actions">
              <button type="button" onClick={() => setReviewSyncOpen(false)}>
                Close
              </button>
              <button type="button" className="primary" onClick={() => void performSync(false)}>
                Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="prompt-backdrop" role="presentation">
          <div className="prompt-dialog settings-dialog">
            <h2>Settings</h2>
            <div className="settings-section">
              <strong>Synchronization</strong>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={syncPreferences.every30Seconds}
                  onChange={(event) =>
                    setSyncPreferences((current) => ({ ...current, every30Seconds: event.currentTarget.checked }))
                  }
                />
                <span>Auto Sync every 30 seconds</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={syncPreferences.onStartup}
                  onChange={(event) =>
                    setSyncPreferences((current) => ({ ...current, onStartup: event.currentTarget.checked }))
                  }
                />
                <span>Auto Sync on startup</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={syncPreferences.onSave}
                  onChange={(event) =>
                    setSyncPreferences((current) => ({ ...current, onSave: event.currentTarget.checked }))
                  }
                />
                <span>Auto Sync on save</span>
              </label>
            </div>
            <div className="settings-section">
              <strong>Repository</strong>
              <details className="settings-details">
                <summary>Advanced Git</summary>
                <label>
                  <span>Repository URL</span>
                  <input
                    value={repoUrl}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(event) => setRepoUrl(event.currentTarget.value)}
                  />
                </label>
              </details>
            </div>
            <div className="prompt-actions">
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.tone}`}>
              {toast.title}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
