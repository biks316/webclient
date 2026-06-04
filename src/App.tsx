import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Braces, FlaskConical, Plus, SquareCode } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CollectionPanel, CollectionPanelTab } from "./components/CollectionPanel";
import { EmptyState } from "./components/common/EmptyState";
import { AppShell } from "./components/layout/AppShell";
import { AppToolbar } from "./components/layout/AppToolbar";
import { BottomConsole, BottomDockTab, ConsoleEntry } from "./components/layout/BottomConsole";
import { CommandPalette, CommandPaletteCommand } from "./components/layout/CommandPalette";
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
  SyncStatusResult,
  WorkspaceIndex,
} from "./types/bik";

const EMPTY_COLLECTION_AUTOMATION: CollectionAutomation = { pre: "", post: "", test: "", assert: "" };
const EMPTY_SCRIPTS: Scripts = { pre: "", post: "" };
const REQUEST_VERSION = "1.0";
const DEFAULT_REQUEST_URL = "https://example.com/";
const DEFAULT_SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 52;
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 280;
const SYNC_PREFS_KEY = "bikapi:sync-preferences";
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [textPrompt, setTextPrompt] = useState<TextPromptState | null>(null);
  const [endpointPrompt, setEndpointPrompt] = useState<EndpointPromptState | null>(null);
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
  const startupSyncWorkspaceRef = useRef<string | null>(null);

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
          const prepared = await prepareWorkspaceWithGit(next, session.repoUrl);
          if (!prepared) {
            setStatus("Git repository setup is required to open this workspace.");
            return;
          }
          applyWorkspace(prepared, session.collectionId, session.endpointId);
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
    if (!workspace || !repoUrl.trim()) {
      setSyncStatus(null);
      return;
    }

    void refreshSyncStatus(true);
  }, [workspace?.path, repoUrl]);

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
    if (syncStatus.state !== "synced") {
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

  function pushToast(title: string, tone: ToastMessage["tone"] = "success") {
    setToasts((current) => [{ id: `${Date.now()}-${current.length}`, title, tone }, ...current].slice(0, 3));
  }

  async function refreshSyncStatus(silent = false) {
    if (!workspace) {
      return null;
    }

    try {
      const next = await api.getSyncStatus(workspace.path);
      setSyncStatus(next);
      if (next.repoUrl) {
        setRepoUrl(next.repoUrl);
      }
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
        return `${value.remoteChanges} updates available`;
      case "local_changes":
        return `${value.localChanges} local changes`;
      case "sync_required":
        return "Sync required";
      case "conflict":
        return "Review changes";
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
        title: "Open Workspace",
        label: "Workspace folder path",
        confirmText: "Open",
      });
      return fallback?.trim() || null;
    }
    return null;
  }

  async function requestRepoUrl(requiredForPath: string, defaultValue?: string | null): Promise<string | null> {
    const value = (
      await requestTextPrompt({
        title: "Connect Git Repository",
        label: `Repository URL for ${requiredForPath}`,
        defaultValue: (defaultValue ?? repoUrl.trim()) || "https://github.com/org/repo.git",
        confirmText: "Pull Latest",
      })
    )?.trim();

    return value || null;
  }

  async function prepareWorkspaceWithGit(
    next: WorkspaceIndex,
    initialRepoUrl?: string | null,
  ): Promise<WorkspaceIndex | null> {
    const discoveredRemoteUrl = await api.getGitRemoteUrl(next.path).catch(() => null);
    const configuredRepoUrl =
      initialRepoUrl?.trim() ||
      discoveredRemoteUrl?.trim() ||
      (workspace?.path === next.path ? repoUrl.trim() : "");

    const resolvedRepoUrl = configuredRepoUrl || (await requestRepoUrl(next.path, configuredRepoUrl));
    if (!resolvedRepoUrl) {
      return null;
    }

    setRepoUrl(resolvedRepoUrl);

    const syncResult = await runAction("Pulling latest workspace from git...", () =>
      (async () => {
        setIsSyncing(true);
        try {
          return await api.runGitAction(next.path, resolvedRepoUrl, "pull");
        } finally {
          setIsSyncing(false);
        }
      })(),
    );
    if (!syncResult) {
      return null;
    }

    appendConsole(`Connected ${resolvedRepoUrl} on ${syncResult.branch}.`, "success");
    if (syncResult.output.trim()) {
      appendConsole(syncResult.output, "info");
    }
    setLastSyncedAt(new Date().toISOString());

    return runAction("Refreshing workspace after pull...", () => api.openWorkspace(next.path));
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
    setWorkspace(null);
    setSelectedCollectionId(null);
    setSelectedEndpointId(null);
    setSelectedEnvironmentId(null);
    setDraftRequest(null);
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
    setReviewSyncOpen(false);
    setActiveCollectionTab("variables");
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

    const target = repoUrl.trim();
    if (!target) {
      const message = "Connect a repository before syncing.";
      setStatus(message);
      appendConsole(message, "warning");
      return;
    }

    const nextStatus = (await refreshSyncStatus(true)) ?? syncStatus;
    if (!nextStatus) {
      return;
    }

    if ((nextStatus.state === "sync_required" || nextStatus.state === "conflict") && fromToolbar) {
      setReviewSyncOpen(true);
      return;
    }

    const gitStatus = await runAction("Checking workspace changes...", () => api.getGitStatus(workspace.path));
    if (!gitStatus) {
      return;
    }

    let action: "pull" | "push" | "sync" = "sync";
    if (nextStatus.state === "remote_updates") {
      action = "pull";
    } else if (nextStatus.state === "local_changes") {
      action = "push";
    }

    let changeSummary: string | undefined;
    if (gitStatus.dirty && (action === "push" || action === "sync")) {
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
        ? "Workspace updated"
        : action === "push"
          ? "Workspace synchronized"
          : "Changes combined and synchronized";
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
        label: "Open Workspace",
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
    let next = await runAction("Opening workspace...", () => api.openWorkspace(path));
    if (!next) {
      next = await runAction("Initializing workspace...", () => api.createWorkspace(path));
    }
    if (next) {
      const prepared = await prepareWorkspaceWithGit(next);
      if (prepared) {
        applyWorkspace(prepared, null, null);
      } else {
        setStatus("A repository is only needed the first time this workspace is connected.");
      }
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
    clearWorkspaceViewForSwitch();
    const next = await runAction("Creating workspace...", () =>
      api.createWorkspace(path, name.trim() || undefined),
    );
    if (next) {
      const prepared = await prepareWorkspaceWithGit(next);
      if (prepared) {
        applyWorkspace(prepared, null, null);
      } else {
        setStatus("Connect a repository once to finish workspace setup.");
      }
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
    await captureSaveSnapshot("Saved collection automation at");
    maybeAutoSync();
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
      <AppShell
        toolbar={
          <AppToolbar
            workspaceName={workspace?.name ?? null}
            status={status}
            isSyncing={isSyncing}
            syncStatus={syncStatus}
            lastSyncedLabel={formatLastSyncedLabel()}
            environments={[
              { value: "", label: "No environment" },
              ...(workspace?.environments ?? []).map((environment) => ({
                value: environment.id,
                label: environment.name,
              })),
            ]}
            selectedEnvironmentId={selectedEnvironmentId ?? ""}
            sidebarHidden={sidebarHidden}
            timelineHidden={timelineHidden}
            consoleHidden={consoleHidden}
            onOpenWorkspace={() => void handleOpenWorkspace()}
            onCreateCollection={() => void handleCreateCollection()}
            onCreateRequest={() => void handleCreateEndpoint()}
            onSendRequest={() => void handleSendRequest()}
            onSync={() => void performSync(true)}
            onReviewChanges={() => setReviewSyncOpen(true)}
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
            collapsed={sidebarCollapsed}
            onClose={() => setSidebarHidden(true)}
            onToggleCollapsed={toggleSidebarCollapsed}
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
        sidebarWidth={sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth}
        sidebarMinWidth={sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_MIN_WIDTH}
        sidebarMaxWidth={sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_MAX_WIDTH}
        onSidebarWidthChange={handleSidebarWidthChange}
        showSidebar={!sidebarHidden}
        showRightPanel={Boolean(selectedEndpoint) && !timelineHidden}
      />
      <CommandPalette
        open={commandPaletteOpen}
        commands={paletteCommands}
        onClose={() => setCommandPaletteOpen(false)}
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
