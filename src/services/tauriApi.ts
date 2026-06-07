import { invoke } from "@tauri-apps/api/core";
import {
  AppState,
  BikRequest,
  CollectionAutomation,
  DiffRow,
  FlowDefinition,
  GitActionResult,
  GitStatusResult,
  JsonValue,
  RecentWorkspaceList,
  RunResponse,
  SyncStatusResult,
  Scripts,
  WorkspaceIndex,
} from "../types/bik";

function ensureTauriRuntime() {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("Desktop app required. Run npm run tauri:dev to create and edit .bik files.");
  }
}

export function createWorkspace(path: string, name?: string): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("create_workspace", { path, name });
}

export function createWorkspaceInDirectory(
  parentPath: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("create_workspace_in_directory", { payload: { parentPath, name } });
}

export function openWorkspace(path: string): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("open_workspace", { path });
}

export function createCollection(
  workspacePath: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("create_collection", { workspacePath, name });
}

export function createEnvironment(
  workspacePath: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("create_environment", { workspacePath, name });
}

export function createEndpoint(
  workspacePath: string,
  collectionId: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("create_endpoint", { workspacePath, collectionId, name });
}

export function createFlow(
  workspacePath: string,
  collectionId: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("create_flow", { workspacePath, collectionId, name });
}

export function renameCollection(
  workspacePath: string,
  collectionId: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("rename_collection", { payload: { workspacePath, collectionId, name } });
}

export function deleteCollection(workspacePath: string, collectionId: string): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("delete_collection", { payload: { workspacePath, collectionId } });
}

export function duplicateCollection(
  workspacePath: string,
  collectionId: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("duplicate_collection", { payload: { workspacePath, collectionId, name } });
}

export function renameRequest(
  workspacePath: string,
  collectionId: string,
  requestId: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("rename_request", { payload: { workspacePath, collectionId, entityId: requestId, name } });
}

export function deleteRequest(
  workspacePath: string,
  collectionId: string,
  requestId: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("delete_request", { payload: { workspacePath, collectionId, entityId: requestId } });
}

export function duplicateRequest(
  workspacePath: string,
  collectionId: string,
  requestId: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("duplicate_request", { payload: { workspacePath, collectionId, entityId: requestId, name } });
}

export function renameFlow(
  workspacePath: string,
  collectionId: string,
  flowId: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("rename_flow", { payload: { workspacePath, collectionId, entityId: flowId, name } });
}

export function deleteFlow(
  workspacePath: string,
  collectionId: string,
  flowId: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("delete_flow", { payload: { workspacePath, collectionId, entityId: flowId } });
}

export function duplicateFlow(
  workspacePath: string,
  collectionId: string,
  flowId: string,
  name: string,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("duplicate_flow", { payload: { workspacePath, collectionId, entityId: flowId, name } });
}

export async function createEndpointWithRequest(
  workspacePath: string,
  collectionId: string,
  request: BikRequest,
): Promise<WorkspaceIndex> {
  const workspace = await createEndpoint(workspacePath, collectionId, request.name);
  const matchingEndpoints = workspace.collections
    .find((collection) => collection.id === collectionId)
    ?.endpoints.filter((item) => item.name === request.name);
  const endpoint = matchingEndpoints?.[matchingEndpoints.length - 1];

  if (!endpoint) {
    return workspace;
  }

  return saveRequest(workspacePath, collectionId, endpoint.id, {
    ...request,
    id: endpoint.id,
  });
}

export function saveRequest(
  workspacePath: string,
  collectionId: string,
  endpointId: string,
  request: BikRequest,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("save_request", {
    payload: { workspacePath, collectionId, endpointId, request },
  });
}

export function readFlow(
  workspacePath: string,
  collectionId: string,
  flowId: string,
): Promise<FlowDefinition> {
  ensureTauriRuntime();
  return invoke("read_flow", {
    payload: { workspacePath, collectionId, flowId },
  });
}

export function saveFlow(
  workspacePath: string,
  collectionId: string,
  flow: FlowDefinition,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("save_flow", {
    payload: { workspacePath, collectionId, flow },
  });
}

export function saveGlobals(
  workspacePath: string,
  variables: Record<string, string>,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("save_globals", {
    payload: { workspacePath, variables },
  });
}

export function saveCollectionVariables(
  workspacePath: string,
  collectionId: string,
  variables: Record<string, string>,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("save_collection_variables", {
    payload: { workspacePath, collectionId, variables },
  });
}

export function saveEnvironmentVariables(
  workspacePath: string,
  environmentId: string,
  variables: Record<string, string>,
): Promise<WorkspaceIndex> {
  ensureTauriRuntime();
  return invoke("save_environment_variables", {
    payload: { workspacePath, environmentId, variables },
  });
}

export function sendRequest(
  workspacePath: string,
  collectionId: string,
  endpointId: string,
  environmentId: string | null,
  request: BikRequest,
): Promise<RunResponse> {
  ensureTauriRuntime();
  return invoke("send_request", {
    payload: { workspacePath, collectionId, endpointId, environmentId, request },
  });
}

export function saveResponseExample(
  workspacePath: string,
  collectionId: string,
  endpointId: string,
  request: BikRequest,
  response: RunResponse,
  label?: string,
): Promise<string> {
  ensureTauriRuntime();
  return invoke("save_response_example", {
    payload: { workspacePath, collectionId, endpointId, request, response, label },
  });
}

export function readScripts(
  workspacePath: string,
  collectionId: string,
  endpointId: string,
): Promise<Scripts> {
  ensureTauriRuntime();
  return invoke("read_scripts", {
    payload: { workspacePath, collectionId, endpointId },
  });
}

export function saveScript(
  workspacePath: string,
  collectionId: string,
  endpointId: string,
  scriptName: keyof Scripts,
  content: string,
): Promise<void> {
  ensureTauriRuntime();
  return invoke("save_script", {
    payload: { workspacePath, collectionId, endpointId, scriptName, content },
  });
}

export function readCollectionAutomation(
  workspacePath: string,
  collectionId: string,
): Promise<CollectionAutomation> {
  ensureTauriRuntime();
  return invoke("read_collection_automation", {
    payload: { workspacePath, collectionId },
  });
}

export function saveCollectionAutomationScript(
  workspacePath: string,
  collectionId: string,
  scriptName: keyof CollectionAutomation,
  content: string,
): Promise<void> {
  ensureTauriRuntime();
  return invoke("save_collection_automation_script", {
    payload: { workspacePath, collectionId, scriptName, content },
  });
}

export function readHistoryEntry(path: string): Promise<JsonValue> {
  ensureTauriRuntime();
  return invoke("read_history_entry", { payload: { path } });
}

export function requestDiff(
  current: BikRequest,
  historicalPath: string,
): Promise<DiffRow[]> {
  ensureTauriRuntime();
  return invoke("request_diff", {
    payload: { current, historicalPath },
  });
}

export function readAppState(): Promise<AppState | null> {
  ensureTauriRuntime();
  return invoke("read_app_state");
}

export function saveAppState(state: AppState): Promise<void> {
  ensureTauriRuntime();
  return invoke("save_app_state", { payload: state });
}

export function readRecentWorkspaces(): Promise<RecentWorkspaceList> {
  ensureTauriRuntime();
  return invoke("read_recent_workspaces");
}

export function saveRecentWorkspaces(list: RecentWorkspaceList): Promise<void> {
  ensureTauriRuntime();
  return invoke("save_recent_workspaces", { payload: list });
}

export function getGitRemoteUrl(workspacePath: string): Promise<string | null> {
  ensureTauriRuntime();
  return invoke("get_git_remote_url", { payload: { workspacePath } });
}

export function getGitStatus(workspacePath: string): Promise<GitStatusResult> {
  ensureTauriRuntime();
  return invoke("get_git_status", { payload: { workspacePath } });
}

export function getSyncStatus(workspacePath: string): Promise<SyncStatusResult> {
  ensureTauriRuntime();
  return invoke("get_sync_status", { payload: { workspacePath } });
}

export function runGitAction(
  workspacePath: string,
  repoUrl: string,
  action: "push" | "pull" | "sync",
  commitMessage?: string,
): Promise<GitActionResult> {
  ensureTauriRuntime();
  return invoke("run_git_action", {
    payload: { workspacePath, repoUrl, action, commitMessage },
  });
}

export function initializeGitRepository(
  workspacePath: string,
  commitMessage = "Initial BikAPI workspace",
): Promise<GitActionResult> {
  ensureTauriRuntime();
  return invoke("initialize_git_repository", {
    payload: { workspacePath, commitMessage },
  });
}

export function cloneWorkspace(
  repoUrl: string,
  destinationPath: string,
): Promise<string> {
  ensureTauriRuntime();
  return invoke("clone_workspace", {
    payload: { repoUrl, destinationPath },
  });
}

export function saveWorkspaceSnapshot(
  workspacePath: string,
  label?: string,
): Promise<string | null> {
  ensureTauriRuntime();
  return invoke("save_workspace_snapshot", {
    payload: { workspacePath, label },
  });
}
