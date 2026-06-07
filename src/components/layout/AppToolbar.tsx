import {
  ArrowDown,
  ArrowUp,
  Check,
  LayoutPanelLeft,
  PanelsRightBottom,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  TerminalSquare,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { CompactSelect } from "../common/CompactSelect";
import { IconButton } from "../common/IconButton";
import { SyncStatusResult } from "../../types/bik";
import styles from "./AppToolbar.module.css";

interface AppToolbarProps {
  workspaceSwitcher: ReactNode;
  status: string;
  isSyncing: boolean;
  syncStatus: SyncStatusResult | null;
  lastSyncedLabel: string;
  environments: Array<{ value: string; label: string }>;
  selectedEnvironmentId: string;
  sidebarHidden: boolean;
  timelineHidden: boolean;
  consoleHidden: boolean;
  onCreateCollection: () => void;
  onCreateRequest: () => void;
  onSendRequest: () => void;
  onSync: () => void;
  onReviewChanges: () => void;
  onKeepLocalOnly: () => void;
  onConnectGitHub: () => void;
  onEnvironmentChange: (value: string) => void;
  onToggleSidebar: () => void;
  onToggleTimeline: () => void;
  onToggleConsole: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
}

export function AppToolbar({
  workspaceSwitcher,
  status,
  isSyncing,
  syncStatus,
  lastSyncedLabel,
  environments,
  selectedEnvironmentId,
  sidebarHidden,
  timelineHidden,
  consoleHidden,
  onCreateCollection,
  onCreateRequest,
  onSendRequest,
  onSync,
  onReviewChanges,
  onKeepLocalOnly,
  onConnectGitHub,
  onEnvironmentChange,
  onToggleSidebar,
  onToggleTimeline,
  onToggleConsole,
  onOpenPalette,
  onOpenSettings,
}: AppToolbarProps) {
  const syncMeta = getSyncMeta(syncStatus);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const syncMenuRef = useRef<HTMLDivElement | null>(null);

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
        <button type="button" className={styles.command} onClick={onOpenPalette}>
          <Search size={12} />
          <span>Command Palette</span>
          <kbd>Ctrl/Cmd+K</kbd>
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
        <button type="button" className={styles.toolButton} onClick={onCreateCollection}>
          <Plus size={13} />
          Collection
        </button>
        <button type="button" className={styles.toolButton} onClick={onCreateRequest}>
          <Plus size={13} />
          Request
        </button>
        <button type="button" className={styles.toolButton} onClick={onSendRequest}>
          <Send size={13} />
          Send
        </button>
        <IconButton title="Toggle timeline" onClick={onToggleTimeline} className={!timelineHidden ? styles.active : ""}>
          <PanelsRightBottom size={13} />
        </IconButton>
        <IconButton title="Toggle console" onClick={onToggleConsole} className={!consoleHidden ? styles.active : ""}>
          <TerminalSquare size={13} />
        </IconButton>
        <IconButton title="Settings" onClick={onOpenSettings}>
          <Settings2 size={13} />
        </IconButton>
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
