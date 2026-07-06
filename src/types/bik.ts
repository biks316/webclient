export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type RequestBodyType =
  | "none"
  | "json"
  | "xml"
  | "text"
  | "form-urlencoded"
  | "multipart"
  | "binary"
  | "graphql";

export interface FileRef {
  path: string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
}

export interface RequestFormField {
  enabled: boolean;
  key: string;
  value: string;
  description?: string;
}

export interface RequestMultipartField {
  enabled: boolean;
  key: string;
  kind: "text" | "file";
  value?: string;
  file?: FileRef | null;
  description?: string;
}

export interface RequestGraphqlBody {
  query: string;
  variables: string;
}

export interface RequestBody {
  type: RequestBodyType;
  raw?: string;
  form?: RequestFormField[];
  multipart?: RequestMultipartField[];
  binary?: FileRef | null;
  graphql?: RequestGraphqlBody;
}

export interface BikRequest {
  bikVersion: string;
  type: "request";
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: RequestBody;
  variables: Record<string, string>;
}

export interface VariableFile {
  bikVersion: string;
  type: "globals" | "environment" | "collection";
  id: string;
  name: string;
  variables: Record<string, string>;
}

export interface TimelineEntry {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface EndpointIndex {
  id: string;
  name: string;
  path: string;
  request: BikRequest;
  history: TimelineEntry[];
  examples: TimelineEntry[];
}

export interface FlowPosition {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  type: "request";
  requestPath: string;
  requestId: string;
  name: string;
  position: FlowPosition;
  lastRun: FlowNodeLastRun | null;
}

export interface FlowNodeLastRun {
  nodeId: string;
  requestId: string;
  status: "success" | "failed";
  statusCode: number | null;
  durationMs: number | null;
  responseHeaders: Record<string, string>;
  responseBody: string;
  error: string | null;
  ranAt: string;
}

export interface FlowMapping {
  source?: string;
  target?: string;
  transform?: string;
  sourcePath: string;
  sourceLabel: string;
  targetType: "variable" | "flowVariable" | "path" | "header" | "body" | "query" | "cookie" | "auth" | "url";
  targetKey: string;
  targetPath: string;
  targetVariable?: string;
  transformType: "raw" | "bearer" | "template" | "uppercase" | "lowercase" | "trim" | "substring" | "jsonpath" | "javascript";
  template: string;
  disabled?: boolean;
}

export interface FlowEdge {
  id: string;
  source?: string;
  target?: string;
  from: string;
  to: string;
  label?: string;
  mappings: FlowMapping[];
}

export interface FlowDefinition {
  bikVersion: string;
  type: "flow";
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowIndex {
  id: string;
  name: string;
  path: string;
  flow: FlowDefinition;
}

export interface CollectionIndex {
  id: string;
  name: string;
  path: string;
  variables: Record<string, string>;
  endpoints: EndpointIndex[];
  flows: FlowIndex[];
}

export interface WorkspaceIndex {
  path: string;
  name: string;
  globals: Record<string, string>;
  environments: VariableFile[];
  collections: CollectionIndex[];
}

export interface RunResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  responseTimeMs: number;
  sentAt: string;
  resolvedUrl: string;
}

export interface Scripts {
  pre: string;
  post: string;
  helpers: string;
}

export interface CollectionAutomation {
  pre: string;
  post: string;
  test: string;
  assert: string;
}

export interface DiffRow {
  path: string;
  before?: JsonValue;
  after?: JsonValue;
  change: "added" | "removed" | "changed";
}

export interface PanelVisibility {
  sidebar: boolean;
  timeline: boolean;
  console: boolean;
}

export interface AppState {
  workspacePath: string | null;
  collectionId: string | null;
  endpointId: string | null;
  panelVisibility: PanelVisibility;
}

export interface RecentWorkspace {
  name: string;
  path: string;
  lastOpenedAt: string;
  syncType: "local" | "git";
  remoteUrl: string | null;
  missing?: boolean;
}

export interface RecentWorkspaceList {
  recentWorkspaces: RecentWorkspace[];
}

export interface GitActionResult {
  action: string;
  branch: string;
  repoUrl: string;
  output: string;
}

export interface GitStatusResult {
  branch: string;
  dirty: boolean;
  hasLocalCommit: boolean;
}

export interface SyncCollectionStatus {
  collectionId: string;
  state: "synced" | "local_changes" | "remote_updates" | "sync_required" | "conflict" | "offline" | "not_git";
  localChanges: number;
  remoteChanges: number;
}

export interface SyncStatusResult {
  state: "synced" | "local_changes" | "remote_updates" | "sync_required" | "conflict" | "offline" | "not_git";
  branch: string;
  repoUrl: string | null;
  localChanges: number;
  remoteChanges: number;
  localChangeFiles: string[];
  remoteChangeFiles: string[];
  collections: SyncCollectionStatus[];
  remoteEmpty: boolean;
  checkedAt: string;
}
