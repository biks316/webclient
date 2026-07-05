export type VariableScopeKey =
  | "request"
  | "flow"
  | "collection"
  | "environment"
  | "global"
  | "runtime"
  | "secrets";

export type VariableType = "default" | "secret" | "computed" | "readonly";

export interface ManagedVariable {
  id: string;
  enabled: boolean;
  name: string;
  initialValue: string;
  currentValue: string;
  description: string;
  scope: VariableScopeKey;
  sourceScope?: VariableScopeKey;
  environmentId?: string;
  type: VariableType;
  usedCount: number;
  usages: VariableUsage[];
  group: string;
}

export interface VariableUsage {
  id: string;
  requestName: string;
  location: string;
  excerpt: string;
}

export type VariableSortKey =
  | "enabled"
  | "name"
  | "initialValue"
  | "currentValue"
  | "description"
  | "type"
  | "usedCount";

export interface VariableDraft {
  id?: string;
  enabled: boolean;
  name: string;
  initialValue: string;
  currentValue: string;
  description: string;
  scope: VariableScopeKey;
  environmentId?: string;
  type: VariableType;
  group: string;
}

export const VARIABLE_SCOPE_ORDER: VariableScopeKey[] = [
  "request",
  "flow",
  "collection",
  "environment",
  "global",
  "runtime",
  "secrets",
];

export const VARIABLE_SCOPE_LABEL: Record<VariableScopeKey, string> = {
  request: "Request",
  flow: "Flow",
  collection: "Collection",
  environment: "Environment",
  global: "Globals",
  runtime: "Runtime",
  secrets: "Secrets",
};
