import {
  ArrowDown,
  ArrowUp,
  Check,
  FolderOpen,
  LayoutPanelLeft,
  PanelsRightBottom,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  TerminalSquare,
} from "lucide-react";
import { CompactSelect } from "../common/CompactSelect";
import { IconButton } from "../common/IconButton";
import { SyncStatusResult } from "../../types/bik";
import styles from "./AppToolbar.module.css";

interface AppToolbarProps {
  workspaceName: string | null;
  status: string;
  isSyncing: boolean;
  syncStatus: SyncStatusResult | null;
  lastSyncedLabel: string;
  environments: Array<{ value: string; label: string }>;
  selectedEnvironmentId: string;
  sidebarHidden: boolean;
  timelineHidden: boolean;
  consoleHidden: boolean;
  onOpenWorkspace: () => void;
  onCreateCollection: () => void;
  onCreateRequest: () => void;
  onSendRequest: () => void;
  onSync: () => void;
  onReviewChanges: () => void;
  onEnvironmentChange: (value: string) => void;
  onToggleSidebar: () => void;
  onToggleTimeline: () => void;
  onToggleConsole: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
}

export function AppToolbar({
  workspaceName,
  status,
  isSyncing,
  syncStatus,
  lastSyncedLabel,
  environments,
  selectedEnvironmentId,
  sidebarHidden,
  timelineHidden,
  consoleHidden,
  onOpenWorkspace,
  onCreateCollection,
  onCreateRequest,
  onSendRequest,
  onSync,
  onReviewChanges,
  onEnvironmentChange,
  onToggleSidebar,
  onToggleTimeline,
  onToggleConsole,
  onOpenPalette,
  onOpenSettings,
}: AppToolbarProps) {
  const syncMeta = getSyncMeta(syncStatus);

  return (
    <header className={styles.toolbar}>
      <div className={styles.leading}>
        <IconButton title="Toggle collections" onClick={onToggleSidebar} className={!sidebarHidden ? styles.active : ""}>
          <LayoutPanelLeft size={13} />
        </IconButton>
        <IconButton title="Open workspace" onClick={onOpenWorkspace}>
          <FolderOpen size={13} />
        </IconButton>
        <button type="button" className={styles.command} onClick={onOpenPalette}>
          <Search size={12} />
          <span>Command Palette</span>
          <kbd>Ctrl/Cmd+K</kbd>
        </button>
      </div>

      <div className={styles.center}>
        <div className={styles.workspaceSummary}>
          <strong>{workspaceName ?? "BikAPI"}</strong>
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
          {(syncStatus?.state === "sync_required" || syncStatus?.state === "conflict") && (
            <button type="button" className={styles.reviewButton} onClick={onReviewChanges}>
              Review Changes
            </button>
          )}
          <button type="button" className={styles.syncButton} onClick={onSync} disabled={isSyncing}>
            <RefreshCw size={12} className={isSyncing ? styles.spinning : ""} />
            Sync
          </button>
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
        label: "New changes available",
        summary: `${syncStatus.remoteChanges} updates available`,
        Icon: ArrowDown,
      };
    case "local_changes":
      return {
        tone: "blue",
        label: "Local changes pending",
        summary: `${syncStatus.localChanges} local changes`,
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
        label: "Review changes",
        summary: "Review changes",
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
