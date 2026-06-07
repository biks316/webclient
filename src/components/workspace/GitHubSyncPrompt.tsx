import { FolderGit2, Plus, X } from "lucide-react";
import styles from "./GitHubSyncPrompt.module.css";

interface GitHubSyncPromptProps {
  onCloneExisting: () => void;
  onCreateSyncedWorkspace: () => void;
  onClose: () => void;
}

export function GitHubSyncPrompt({
  onCloneExisting,
  onCreateSyncedWorkspace,
  onClose,
}: GitHubSyncPromptProps) {
  return (
    <div className="prompt-backdrop" role="presentation">
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="github-sync-title">
        <div className={styles.header}>
          <div>
            <h2 id="github-sync-title">GitHub Sync</h2>
            <p>Use Git-backed workspaces for sharing collections with a team.</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className={styles.options}>
          <button type="button" className={styles.option} onClick={onCloneExisting}>
            <FolderGit2 size={18} />
            <span>
              <strong>Clone existing workspace from GitHub</strong>
              <small>Download a workspace your team already keeps in a repository.</small>
            </span>
          </button>
          <button type="button" className={styles.option} onClick={onCreateSyncedWorkspace}>
            <Plus size={18} />
            <span>
              <strong>Create new GitHub-synced workspace</strong>
              <small>Start locally, save a checkpoint, and connect a remote now or later.</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
