export type CopilotMode = "ask" | "build" | "debug" | "run";

export type CopilotContextReferenceSource = "drag-and-drop" | "mention" | "picker" | "session" | "response" | "suggestion";

export interface CopilotVariable {
  scope: "global" | "collection" | "environment" | "request";
  key: string;
  value?: string;
  secret: boolean;
}

export interface CopilotRequestSummary {
  id: string;
  name: string;
  method: string;
  url: string;
}

export interface CopilotCollectionSummary {
  id: string;
  name: string;
  requestCount: number;
  flowCount: number;
  requests: CopilotRequestSummary[];
}

export interface CopilotFlowNodeSummary {
  id: string;
  name: string;
  requestId: string;
  status: "idle" | "running" | "success" | "failed";
  statusCode: number | null;
  durationMs: number | null;
  ranAt: string | null;
}

export interface CopilotFlowEdgeSummary {
  id: string;
  from: string;
  to: string;
  mappingCount: number;
  mappings: Array<{
    sourcePath: string;
    targetPath: string;
    transformType: string;
  }>;
}

export interface CopilotExecutionEntry {
  id: string;
  kind: "request" | "flow-node";
  name: string;
  status: "success" | "failed";
  statusCode: number | null;
  timestamp: string;
  durationMs: number | null;
  error?: string | null;
}

export interface CopilotContextSnapshot {
  workspaceName: string | null;
  workspacePath: string | null;
  currentCollectionId: string | null;
  currentCollectionName: string | null;
  currentRequestId: string | null;
  currentRequestName: string | null;
  currentEnvironmentId: string | null;
  currentEnvironmentName: string | null;
  currentFlowId: string | null;
  currentFlowName: string | null;
  collections: CopilotCollectionSummary[];
  variables: CopilotVariable[];
  flowGraph: {
    nodes: CopilotFlowNodeSummary[];
    edges: CopilotFlowEdgeSummary[];
  } | null;
  recentExecutionHistory: CopilotExecutionEntry[];
}

export interface CopilotReferenceBase {
  label: string;
  pinned: boolean;
  source: CopilotContextReferenceSource;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface RequestContextReference extends CopilotReferenceBase {
  type: "request";
  id: string;
  collectionId: string;
  method: string;
  url: string;
  path: string;
}

export interface CollectionContextReference extends CopilotReferenceBase {
  type: "collection";
  id: string;
  path: string;
}

export interface FlowContextReference extends CopilotReferenceBase {
  type: "flow";
  id: string;
  collectionId: string;
  path: string;
}

export interface FlowNodeContextReference extends CopilotReferenceBase {
  type: "flow-node";
  id: string;
  flowId: string;
  collectionId: string;
  requestId: string;
}

export interface FileContextReference extends CopilotReferenceBase {
  type: "file";
  path: string;
  extension: string;
}

export interface ResponseContextReference extends CopilotReferenceBase {
  type: "response";
  id: string;
  requestId?: string | null;
  status?: number | null;
  sentAt?: string | null;
}

export interface SchemaContextReference extends CopilotReferenceBase {
  type: "schema";
  path: string;
  format: "json" | "yaml" | "yml";
}

export interface EnvironmentContextReference extends CopilotReferenceBase {
  type: "environment";
  id: string;
}

export type CopilotContextReference =
  | RequestContextReference
  | CollectionContextReference
  | FlowContextReference
  | FlowNodeContextReference
  | FileContextReference
  | ResponseContextReference
  | SchemaContextReference
  | EnvironmentContextReference;

export interface CopilotResolvedRequestContext {
  id: string;
  collectionId: string;
  label: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body?: string | null;
}

export interface CopilotResolvedCollectionContext {
  id: string;
  label: string;
  path: string;
  variables: string[];
  requestIds: string[];
  flowIds: string[];
}

export interface CopilotResolvedFlowContext {
  id: string;
  label: string;
  path: string;
  nodes: Array<{
    id: string;
    name: string;
    requestId: string;
    status: "idle" | "running" | "success" | "failed";
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    mappingCount: number;
  }>;
}

export interface CopilotResolvedFileContext {
  path: string;
  label: string;
  content: string;
  headings: string[];
}

export interface CopilotResolvedSchemaContext {
  path: string;
  label: string;
  content: string;
}

export interface CopilotResolvedResponseContext {
  id: string;
  label: string;
  status: number | null;
  statusText?: string;
  sentAt?: string | null;
  headers: Record<string, string>;
  body: string;
}

export interface CopilotResolvedEnvironmentContext {
  id: string;
  label: string;
  variableKeys: string[];
}

export interface CopilotResolvedContext {
  requests: CopilotResolvedRequestContext[];
  collections: CopilotResolvedCollectionContext[];
  flows: CopilotResolvedFlowContext[];
  files: CopilotResolvedFileContext[];
  schemas: CopilotResolvedSchemaContext[];
  responses: CopilotResolvedResponseContext[];
  environments: CopilotResolvedEnvironmentContext[];
}

export interface CopilotAction {
  id: string;
  label: string;
  intent: "preview_flow" | "insert_into_flow" | "run_flow" | "cancel" | "create_request" | "modify_collection" | "delete_request";
  requiresConfirmation: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

export interface CopilotExecutionPlanCard {
  type: "execution-plan";
  title: string;
  steps: Array<{
    id: string;
    label: string;
    status: "pending" | "running" | "done" | "failed";
  }>;
}

export interface CopilotMissingInputCard {
  type: "missing-input";
  title: string;
  description?: string;
  fields: Array<{
    id: string;
    label: string;
    placeholder?: string;
    required?: boolean;
  }>;
  submitLabel?: string;
}

export interface CopilotProgressCard {
  type: "progress";
  title: string;
  value: number;
  detail?: string;
}

export interface CopilotNodeStatusCard {
  type: "node-status";
  title: string;
  nodes: Array<{
    id: string;
    name: string;
    status: "idle" | "running" | "success" | "failed";
    detail?: string;
  }>;
}

export type CopilotCard =
  | CopilotExecutionPlanCard
  | CopilotMissingInputCard
  | CopilotProgressCard
  | CopilotNodeStatusCard;

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  mode?: CopilotMode;
  contextReferences?: CopilotContextReference[];
  cards?: CopilotCard[];
  actions?: CopilotAction[];
  followUps?: string[];
}

export interface CopilotSession {
  id: string;
  title: string;
  mode: CopilotMode;
  createdAt: string;
  updatedAt: string;
  messages: CopilotMessage[];
  pinnedContext: CopilotContextReference[];
  draftPrompt?: string;
  draftContext?: CopilotContextReference[];
}

export interface CopilotResponse {
  message: CopilotMessage;
}

export interface CopilotConversationTurn {
  sessionId: string;
  prompt: string;
  mode: CopilotMode;
  references: CopilotContextReference[];
  resolvedContext: CopilotResolvedContext;
  providedValues?: Record<string, string>;
}

export interface CopilotService {
  respond: (
    context: CopilotContextSnapshot,
    history: CopilotMessage[],
    turn: CopilotConversationTurn,
  ) => Promise<CopilotResponse>;
}

export interface CopilotContextSearchItem {
  key: string;
  title: string;
  subtitle?: string;
  keywords: string[];
  reference: CopilotContextReference;
}
