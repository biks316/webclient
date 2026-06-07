import { Cloud, FolderOpen, GitBranch, Plus, Users } from "lucide-react";
import styles from "./WelcomeScreen.module.css";

interface WelcomeScreenProps {
  state: "idle" | "loading" | "error";
  error: string | null;
  onContinueWithGitHub: () => void;
  onOpenLocalWorkspace: () => void;
  onCreateLocalWorkspace: () => void;
  onBackToWelcome: () => void;
}

export function WelcomeScreen({
  state,
  error,
  onContinueWithGitHub,
  onOpenLocalWorkspace,
  onCreateLocalWorkspace,
  onBackToWelcome,
}: WelcomeScreenProps) {
  if (state === "loading") {
    return (
      <main className={styles.screen}>
        <section className={styles.panel}>
          <div className={styles.spinner} aria-hidden="true" />
          <h1>Loading workspace...</h1>
          <p>Please wait while BikAPI opens your workspace.</p>
        </section>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className={styles.screen}>
        <section className={styles.panel}>
          <h1>Workspace unavailable</h1>
          <p>{error ?? "The workspace could not be opened."}</p>
          <div className={styles.actions}>
            <button type="button" className="primary" onClick={onOpenLocalWorkspace}>
              <FolderOpen size={14} />
              Open another workspace
            </button>
            <button type="button" onClick={onBackToWelcome}>
              Back
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <section className={styles.panel}>
        <div className={styles.heading}>
          <h1>Welcome to BikAPI</h1>
          <p>Local-first API client with optional GitHub sync for collaboration.</p>
        </div>

        <div className={styles.primaryActions}>
          <button type="button" className="primary" onClick={onContinueWithGitHub}>
            <Cloud size={15} />
            Continue with GitHub Sync
          </button>
          <button type="button" onClick={onOpenLocalWorkspace}>
            <FolderOpen size={15} />
            Open local workspace
          </button>
          <button type="button" onClick={onCreateLocalWorkspace}>
            <Plus size={15} />
            Create local workspace
          </button>
        </div>

        <aside className={styles.recommendation}>
          <div className={styles.recommendationHeader}>
            <span>
              <Users size={14} />
              Recommended for teams
            </span>
          </div>
          <ul>
            <li>Sync collections through Git</li>
            <li>Collaborate with teammates</li>
            <li>Keep full local ownership</li>
            <li>Works with GitHub, GitLab, Bitbucket</li>
          </ul>
          <button type="button" onClick={onContinueWithGitHub}>
            <GitBranch size={14} />
            Connect GitHub / Clone workspace
          </button>
        </aside>
      </section>
    </main>
  );
}
