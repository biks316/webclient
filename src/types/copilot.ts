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
  currentCollectionName: string | null;
  currentRequestName: string | null;
  currentEnvironmentName: string | null;
  currentFlowName: string | null;
  collections: CopilotCollectionSummary[];
  variables: CopilotVariable[];
  flowGraph: {
    nodes: CopilotFlowNodeSummary[];
    edges: CopilotFlowEdgeSummary[];
  } | null;
  recentExecutionHistory: CopilotExecutionEntry[];
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
  cards?: CopilotCard[];
  actions?: CopilotAction[];
  followUps?: string[];
}

export interface CopilotResponse {
  message: CopilotMessage;
}

export interface CopilotConversationTurn {
  prompt: string;
  providedValues?: Record<string, string>;
}

export interface CopilotService {
  respond: (
    context: CopilotContextSnapshot,
    history: CopilotMessage[],
    turn: CopilotConversationTurn,
  ) => Promise<CopilotResponse>;
}
