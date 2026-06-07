import { BikRequest, CollectionIndex, JsonValue, VariableFile, WorkspaceIndex } from "../types/bik";

export type VariableScope = "runtime" | "flow" | "collection" | "environment" | "global" | "unresolved";

export interface VariableEntry {
  name: string;
  value: string;
  scope: Exclude<VariableScope, "unresolved">;
  sourceId: string;
  isSecret: boolean;
  description?: string;
}

export interface VariableContext {
  globals?: Record<string, string>;
  environment?: VariableFile | null;
  collection?: CollectionIndex | null;
  flowVariables?: Record<string, string>;
  runtimeVariables?: Record<string, string>;
  requestVariables?: Record<string, string>;
}

export interface ResolvedVariable {
  name: string;
  value: string;
  scope: VariableScope;
  found: boolean;
  isSecret: boolean;
  sourceId: string | null;
}

export interface TemplateResolution {
  text: string;
  variables: ResolvedVariable[];
  missing: ResolvedVariable[];
}

export const VARIABLE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

export function isSecretVariable(name: string) {
  return /(token|secret|password|passwd|apikey|api_key|authorization|auth)/i.test(name);
}

export function buildVariableEntries(context: VariableContext): VariableEntry[] {
  const entries: VariableEntry[] = [];
  addEntries(entries, context.globals ?? {}, "global", "globals");
  addEntries(entries, context.environment?.variables ?? {}, "environment", context.environment?.id ?? "environment");
  addEntries(entries, context.collection?.variables ?? {}, "collection", context.collection?.id ?? "collection");
  addEntries(entries, context.flowVariables ?? {}, "flow", "flow");
  addEntries(entries, context.requestVariables ?? {}, "runtime", "request");
  addEntries(entries, context.runtimeVariables ?? {}, "runtime", "runtime");
  return entries;
}

function addEntries(
  entries: VariableEntry[],
  values: Record<string, string>,
  scope: VariableEntry["scope"],
  sourceId: string,
) {
  Object.entries(values).forEach(([name, value]) => {
    entries.push({
      name,
      value,
      scope,
      sourceId,
      isSecret: isSecretVariable(name),
    });
  });
}

export function resolveVariable(name: string, context: VariableContext): ResolvedVariable {
  const trimmed = name.trim();
  const scopes: Array<[VariableEntry["scope"], string, Record<string, string>]> = [
    ["runtime", "runtime", { ...(context.requestVariables ?? {}), ...(context.runtimeVariables ?? {}) }],
    ["flow", "flow", context.flowVariables ?? {}],
    ["collection", context.collection?.id ?? "collection", context.collection?.variables ?? {}],
    ["environment", context.environment?.id ?? "environment", context.environment?.variables ?? {}],
    ["global", "globals", context.globals ?? {}],
  ];

  for (const [scope, sourceId, values] of scopes) {
    if (Object.prototype.hasOwnProperty.call(values, trimmed)) {
      return {
        name: trimmed,
        value: values[trimmed],
        scope,
        found: true,
        isSecret: isSecretVariable(trimmed),
        sourceId,
      };
    }
  }

  return {
    name: trimmed,
    value: "",
    scope: "unresolved",
    found: false,
    isSecret: false,
    sourceId: null,
  };
}

export function resolveTemplate(text: string, context: VariableContext): TemplateResolution {
  const variables: ResolvedVariable[] = [];
  const resolved = text.replace(VARIABLE_PATTERN, (_, key: string) => {
    const variable = resolveVariable(key, context);
    variables.push(variable);
    return variable.found ? variable.value : `{{${variable.name}}}`;
  });
  return {
    text: resolved,
    variables,
    missing: variables.filter((variable) => !variable.found),
  };
}

export function extractVariableNames(text: string) {
  const names = new Set<string>();
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    names.add(match[1].trim());
  }
  return [...names];
}

export function findMissingVariablesInRequest(request: BikRequest, context: VariableContext) {
  const text = [
    request.url,
    ...Object.values(request.headers),
    ...Object.values(request.queryParams),
    JSON.stringify(request.body ?? ""),
  ].join("\n");
  return extractVariableNames(text)
    .map((name) => resolveVariable(name, context))
    .filter((variable) => !variable.found);
}

export function buildVariableScope(
  workspace: WorkspaceIndex,
  collection: CollectionIndex | null,
  environment: VariableFile | null,
  request: BikRequest,
): Record<string, string> {
  return Object.fromEntries(
    buildVariableEntries({
      globals: workspace.globals,
      environment,
      collection,
      requestVariables: request.variables,
    }).map((entry) => [entry.name, resolveVariable(entry.name, {
      globals: workspace.globals,
      environment,
      collection,
      requestVariables: request.variables,
    }).value]),
  );
}

export function resolveString(input: string, variables: Record<string, string>): string {
  return input.replace(VARIABLE_PATTERN, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key.trim()) ? variables[key.trim()] : `{{${key.trim()}}}`,
  );
}

export function resolveJson(value: JsonValue, variables: Record<string, string>): JsonValue {
  if (typeof value === "string") {
    return resolveString(value, variables);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveJson(item, variables));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveJson(item, variables)]),
    );
  }
  return value;
}

export function maskVariableValue(value: string, isSecret: boolean) {
  return isSecret ? "********" : value.length > 42 ? `${value.slice(0, 39)}...` : value;
}
