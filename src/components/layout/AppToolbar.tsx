import {
  ArrowDown,
  ArrowUp,
  Check,
  LayoutPanelLeft,
  MoreHorizontal,
  PanelsRightBottom,
  Plus,
  Redo2,
  RefreshCw,
  Search,
  TerminalSquare,
  Undo2,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { CompactSelect } from "../common/CompactSelect";
import { IconButton } from "../common/IconButton";
import { SyncStatusResult } from "../../types/bik";
import styles from "./AppToolbar.module.css";

interface AppToolbarProps {
  workspaceSwitcher: ReactNode;
  isSyncing: boolean;
  syncStatus: SyncStatusResult | null;
  lastSyncedLabel: string;
  environments: Array<{ value: string; label: string }>;
  selectedEnvironmentId: string;
  sidebarHidden: boolean;
  timelineHidden: boolean;
  consoleHidden: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCreateRequest: () => void;
  onSync: () => void;
  onReviewChanges: () => void;
  onKeepLocalOnly: () => void;
  onConnectGitHub: () => void;
  onEnvironmentChange: (value: string) => void;
  onCreateEnvironment: () => void;
  onDeleteEnvironment: () => void;
  canDeleteEnvironment: boolean;
  onToggleSidebar: () => void;
  onToggleTimeline: () => void;
  onToggleConsole: () => void;
  onOpenPalette: () => void;
}

export function AppToolbar({
  workspaceSwitcher,
  isSyncing,
  syncStatus,
  lastSyncedLabel,
  environments,
  selectedEnvironmentId,
  sidebarHidden,
  timelineHidden,
  consoleHidden,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCreateRequest,
  onSync,
  onReviewChanges,
  onKeepLocalOnly,
  onConnectGitHub,
  onEnvironmentChange,
  onCreateEnvironment,
  onDeleteEnvironment,
  canDeleteEnvironment,
  onToggleSidebar,
  onToggleTimeline,
  onToggleConsole,
  onOpenPalette,
}: AppToolbarProps) {
  const syncMeta = getSyncMeta(syncStatus);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const syncMenuRef = useRef<HTMLDivElement | null>(null);
  const appMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!syncMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!syncMenuRef.current?.contains(event.target as Node)) {
        setSyncMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [syncMenuOpen]);

  useEffect(() => {
    if (!appMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!appMenuRef.current?.contains(event.target as Node)) {
        setAppMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [appMenuOpen]);

  function handleSyncClick() {
    if (syncStatus?.state === "not_git") {
      setSyncMenuOpen((value) => !value);
      return;
    }
    onSync();
  }

  return (
    <header className={styles.toolbar}>
      <div className={styles.leading}>
        <IconButton title="Toggle collections" onClick={onToggleSidebar} className={!sidebarHidden ? styles.active : ""}>
          <LayoutPanelLeft size={13} />
        </IconButton>
        {workspaceSwitcher}
        <button type="button" className={styles.primaryRequest} onClick={onCreateRequest}>
          <Plus size={13} />
          New Request
        </button>
      </div>

      <div className={styles.center}>
        <div className={styles.workspaceSummary}>
          <span>Last synced: {lastSyncedLabel}</span>
          <span>Status: {syncMeta.label}</span>
        </div>
      </div>

      <div className={styles.trailing}>
        <div className={styles.syncBar}>
          <div className={`${styles.syncStatus} ${styles[syncMeta.tone]}`}>
          <span className={styles.statusDot} />
          <syncMeta.Icon size={12} className={isSyncing ? styles.spinning : ""} />
          <span>{syncMeta.summary}</span>
        </div>
          {syncStatus?.state === "sync_required" && (
            <button type="button" className={styles.reviewButton} onClick={onReviewChanges}>
              Review Changes
            </button>
          )}
          <div className={styles.syncMenuWrap} ref={syncMenuRef}>
            <button type="button" className={styles.syncButton} onClick={handleSyncClick} disabled={isSyncing}>
              <RefreshCw size={12} className={isSyncing ? styles.spinning : ""} />
              Sync
            </button>
            {syncMenuOpen && (
              <div className={styles.syncMenu}>
                <button
                  type="button"
                  onClick={() => {
                    setSyncMenuOpen(false);
                    onKeepLocalOnly();
                  }}
                >
                  Keep local only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSyncMenuOpen(false);
                    onConnectGitHub();
                  }}
                >
                  Connect to GitHub
                </button>
              </div>
            )}
          </div>
        </div>
        <CompactSelect
          value={selectedEnvironmentId}
          options={environments}
          placeholder="No environment"
          className={styles.environment}
          onChange={onEnvironmentChange}
        />
        <div className={styles.syncMenuWrap} ref={appMenuRef}>
          <IconButton title="App menu" onClick={() => setAppMenuOpen((open) => !open)}>
            <MoreHorizontal size={14} />
          </IconButton>
          {appMenuOpen && (
            <div className={styles.syncMenu}>
              <button type="button" onClick={() => { setAppMenuOpen(false); onCreateEnvironment(); }}>
                <Plus size={13} />
                Create New Environment
              </button>
              <button
                type="button"
                onClick={() => { setAppMenuOpen(false); onDeleteEnvironment(); }}
                disabled={!canDeleteEnvironment}
              >
                Delete Environment
              </button>
              <button type="button" onClick={() => { setAppMenuOpen(false); onOpenPalette(); }}>
                <Search size={13} />
                Command Palette
              </button>
              <button type="button" onClick={() => { setAppMenuOpen(false); onUndo(); }} disabled={!canUndo}>
                <Undo2 size={13} />
                Undo
              </button>
              <button type="button" onClick={() => { setAppMenuOpen(false); onRedo(); }} disabled={!canRedo}>
                <Redo2 size={13} />
                Redo
              </button>
              <button type="button" onClick={() => { setAppMenuOpen(false); onToggleSidebar(); }}>
                <LayoutPanelLeft size={13} />
                {sidebarHidden ? "Show sidebar" : "Hide sidebar"}
              </button>
              <button type="button" onClick={() => { setAppMenuOpen(false); onToggleTimeline(); }}>
                <PanelsRightBottom size={13} />
                {timelineHidden ? "Show timeline" : "Hide timeline"}
              </button>
              <button type="button" onClick={() => { setAppMenuOpen(false); onToggleConsole(); }}>
                <TerminalSquare size={13} />
                {consoleHidden ? "Show console" : "Hide console"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function getSyncMeta(syncStatus: SyncStatusResult | null) {
  switch (syncStatus?.state) {
    case "remote_updates":
      return {
        tone: "orange",
        label: "Updates available",
        summary: "Updates available",
        Icon: ArrowDown,
      };
    case "local_changes":
      return {
        tone: "blue",
        label: "Local changes",
        summary: "Local changes",
        Icon: ArrowUp,
      };
    case "sync_required":
      return {
        tone: "red",
        label: "Sync required",
        summary: "Sync required",
        Icon: RefreshCw,
      };
    case "conflict":
      return {
        tone: "red",
        label: "Conflict",
        summary: "Conflict",
        Icon: RefreshCw,
      };
    case "offline":
      return {
        tone: "orange",
        label: "Offline",
        summary: "Offline",
        Icon: RefreshCw,
      };
    case "not_git":
      return {
        tone: "blue",
        label: "Local only",
        summary: "Local only",
        Icon: RefreshCw,
      };
    case "synced":
    default:
      return {
        tone: "green",
        label: "Synced",
        summary: "Up to date",
        Icon: Check,
      };
  }
}
