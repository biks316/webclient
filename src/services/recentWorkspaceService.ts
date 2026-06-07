import { RecentWorkspace, WorkspaceIndex } from "../types/bik";
import * as api from "./tauriApi";

const MAX_RECENT_WORKSPACES = 12;

export async function loadRecentWorkspaces(): Promise<RecentWorkspace[]> {
  try {
    const result = await api.readRecentWorkspaces();
    return result.recentWorkspaces;
  } catch {
    return [];
  }
}

export async function rememberWorkspace(
  workspace: WorkspaceIndex,
  remoteUrl: string | null,
): Promise<RecentWorkspace[]> {
  const current = await loadRecentWorkspaces();
  const nextEntry: RecentWorkspace = {
    name: workspace.name,
    path: workspace.path,
    lastOpenedAt: new Date().toISOString(),
    syncType: remoteUrl ? "git" : "local",
    remoteUrl,
  };

  const next = [
    nextEntry,
    ...current.filter((item) => item.path !== workspace.path),
  ].slice(0, MAX_RECENT_WORKSPACES);

  await api.saveRecentWorkspaces({ recentWorkspaces: next });
  return next;
}

export async function removeRecentWorkspace(path: string): Promise<RecentWorkspace[]> {
  const current = await loadRecentWorkspaces();
  const next = current.filter((item) => item.path !== path);
  await api.saveRecentWorkspaces({ recentWorkspaces: next });
  return next;
}
