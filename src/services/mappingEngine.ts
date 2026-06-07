import { BikRequest, FlowEdge, RunResponse } from "../types/bik";
import { getJsonPathValue, setJsonPathValue } from "./jsonPathService";
import { maskSensitiveValue } from "./mappingSuggestionService";

export interface AppliedMapping {
  source: string;
  target: string;
  sourceLabel: string;
  targetLabel: string;
  value: string;
  appliedValue: string;
  maskedValue: string;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function applyEdgeMappings(
  edge: FlowEdge,
  sourceRequest: BikRequest,
  response: RunResponse,
  targetRequest: BikRequest,
  contextVariables: Record<string, string> = {},
): AppliedMapping[] {
  const applied: AppliedMapping[] = [];
  const context = {
    request: sourceRequest,
    response,
  };

  edge.mappings.forEach((mapping) => {
    const sourcePath = mapping.sourcePath || mapping.source || "";
    const targetPath = mapping.targetPath || mapping.target || (mapping.targetVariable ? `variables.${mapping.targetVariable}` : "");
    const template = mapping.template || mapping.transform || "{{value}}";
    const rawValue = getJsonPathValue(context, sourcePath);
    const value = stringifyValue(rawValue);
    const appliedValue = template.trim()
      ? template.split("{{value}}").join(value)
      : value;

    if (targetPath.startsWith("variables.") || targetPath.startsWith("$.variables.")) {
      const variableName = targetPath.replace(/^\$?\./, "").replace(/^variables\./, "");
      contextVariables[variableName] = appliedValue;
      targetRequest.variables[variableName] = appliedValue;
    } else {
      setJsonPathValue({ request: targetRequest }, targetPath, appliedValue);
    }
    applied.push({
      source: sourcePath,
      target: targetPath,
      sourceLabel: mapping.sourceLabel || sourcePath.split(".").pop() || sourcePath,
      targetLabel: mapping.targetKey || targetPath.split(".").pop() || targetPath,
      value,
      appliedValue,
      maskedValue: maskSensitiveValue(`${mapping.targetKey} ${targetPath}`, appliedValue),
    });
  });

  return applied;
}
