export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface BikRequest {
  bikVersion: string;
  type: "request";
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body: JsonValue;
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

export interface CollectionIndex {
  id: string;
  name: string;
  path: string;
  variables: Record<string, string>;
  endpoints: EndpointIndex[];
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
