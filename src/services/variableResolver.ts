import { BikRequest, CollectionIndex, JsonValue, VariableFile, WorkspaceIndex } from "../types/bik";

export function buildVariableScope(
  workspace: WorkspaceIndex,
  collection: CollectionIndex | null,
  environment: VariableFile | null,
  request: BikRequest,
): Record<string, string> {
  return {
    ...workspace.globals,
    ...(collection?.variables ?? {}),
    ...(environment?.variables ?? {}),
    ...request.variables,
  };
}

export function resolveString(input: string, variables: Record<string, string>): string {
  return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => variables[key] ?? "");
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
