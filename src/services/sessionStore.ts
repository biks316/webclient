const LAST_WORKSPACE_KEY = "bikapi:last-workspace";

export interface WorkspaceSession {
  workspacePath: string;
  collectionId: string | null;
  endpointId: string | null;
  repoUrl: string | null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function loadWorkspaceSession(): WorkspaceSession | null {
  try {
    const raw = window.localStorage.getItem(LAST_WORKSPACE_KEY);
    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as Partial<WorkspaceSession>;
    if (typeof value.workspacePath !== "string" || !value.workspacePath) {
      return null;
    }

    return {
      workspacePath: value.workspacePath,
      collectionId: nullableString(value.collectionId),
      endpointId: nullableString(value.endpointId),
      repoUrl: nullableString(value.repoUrl),
    };
  } catch {
    return null;
  }
}

export function saveWorkspaceSession(session: WorkspaceSession | null) {
  try {
    if (!session) {
      window.localStorage.removeItem(LAST_WORKSPACE_KEY);
      return;
    }

    window.localStorage.setItem(LAST_WORKSPACE_KEY, JSON.stringify(session));
  } catch {
    // Browsers can reject storage in private or locked-down contexts.
  }
}
