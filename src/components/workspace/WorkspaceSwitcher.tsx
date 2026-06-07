import { Check, ChevronDown, FolderOpen, Plus, Settings2, Trash2, GitBranch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RecentWorkspace } from "../../types/bik";
import styles from "./WorkspaceSwitcher.module.css";

interface WorkspaceSwitcherProps {
  currentWorkspaceName: string;
  currentWorkspacePath: string;
  recentWorkspaces: RecentWorkspace[];
  onOpenRecentWorkspace: (workspace: RecentWorkspace) => void;
  onRemoveRecentWorkspace: (path: string) => void;
  onOpenLocalWorkspace: () => void;
  onCreateWorkspace: () => void;
  onCloneWorkspace: () => void;
  onOpenSettings: () => void;
}

export function WorkspaceSwitcher({
  currentWorkspaceName,
  currentWorkspacePath,
  recentWorkspaces,
  onOpenRecentWorkspace,
  onRemoveRecentWorkspace,
  onOpenLocalWorkspace,
  onCreateWorkspace,
  onCloneWorkspace,
  onOpenSettings,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className={styles.switcher} ref={menuRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((value) => !value)}>
        <span>{currentWorkspaceName}</span>
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className={styles.menu}>
          <div className={styles.current}>
            <span>Current workspace</span>
            <strong>{currentWorkspaceName}</strong>
            <small title={currentWorkspacePath}>{currentWorkspacePath}</small>
          </div>

          <div className={styles.sectionLabel}>Recent workspaces</div>
          <div className={styles.recentList}>
            {recentWorkspaces.length === 0 ? (
              <div className={styles.empty}>No recent workspaces</div>
            ) : (
              recentWorkspaces.map((workspace) => {
                const current = workspace.path === currentWorkspacePath;
                return (
                  <div className={`${styles.recentRow} ${current ? styles.selected : ""}`} key={workspace.path}>
                    <button
                      type="button"
                      className={styles.recentButton}
                      onClick={() => runAction(() => onOpenRecentWorkspace(workspace))}
                      disabled={current || workspace.missing}
                    >
                      {current ? <Check size={13} /> : <FolderOpen size={13} />}
                      <span>
                        <strong>{workspace.name}</strong>
                        <small title={workspace.path}>
                          {workspace.missing ? "Missing" : workspace.path}
                        </small>
                      </span>
                    </button>
                    {workspace.missing && (
                      <button
                        type="button"
                        className={styles.removeButton}
                        title="Remove from recent workspaces"
                        onClick={() => onRemoveRecentWorkspace(workspace.path)}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={() => runAction(onOpenLocalWorkspace)}>
              <FolderOpen size={13} />
              Open local workspace...
            </button>
            <button type="button" onClick={() => runAction(onCreateWorkspace)}>
              <Plus size={13} />
              Create new workspace...
            </button>
            <button type="button" onClick={() => runAction(onCloneWorkspace)}>
              <GitBranch size={13} />
              Clone from GitHub...
            </button>
            <button type="button" onClick={() => runAction(onOpenSettings)}>
              <Settings2 size={13} />
              Workspace settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
