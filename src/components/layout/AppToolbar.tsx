import {
  FolderOpen,
  LayoutPanelLeft,
  PanelsRightBottom,
  Plus,
  Search,
  Send,
  Settings2,
  TerminalSquare,
} from "lucide-react";
import { CompactSelect } from "../common/CompactSelect";
import { IconButton } from "../common/IconButton";
import styles from "./AppToolbar.module.css";

interface AppToolbarProps {
  workspaceName: string | null;
  status: string;
  isBusy: boolean;
  environments: Array<{ value: string; label: string }>;
  selectedEnvironmentId: string;
  sidebarHidden: boolean;
  timelineHidden: boolean;
  consoleHidden: boolean;
  onOpenWorkspace: () => void;
  onCreateCollection: () => void;
  onCreateRequest: () => void;
  onSendRequest: () => void;
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
  isBusy,
  environments,
  selectedEnvironmentId,
  sidebarHidden,
  timelineHidden,
  consoleHidden,
  onOpenWorkspace,
  onCreateCollection,
  onCreateRequest,
  onSendRequest,
  onEnvironmentChange,
  onToggleSidebar,
  onToggleTimeline,
  onToggleConsole,
  onOpenPalette,
  onOpenSettings,
}: AppToolbarProps) {
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
        <strong>{workspaceName ?? "BikAPI"}</strong>
        <span>{isBusy ? "Syncing..." : status}</span>
      </div>

      <div className={styles.trailing}>
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
