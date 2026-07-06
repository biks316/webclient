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

function applyTransform(value: unknown, transformType: string, template: string) {
  const text = stringifyValue(value);

  switch (transformType) {
    case "raw":
      return text;
    case "bearer":
    case "template":
      return (template || "{{value}}").split("{{value}}").join(text);
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "trim":
      return text.trim();
    case "substring": {
      const [startRaw, endRaw] = (template || "0:8").split(":");
      const start = Number(startRaw || 0);
      const end = endRaw === undefined || endRaw === "" ? undefined : Number(endRaw);
      return text.slice(Number.isNaN(start) ? 0 : start, end !== undefined && Number.isNaN(end) ? undefined : end);
    }
    case "jsonpath": {
      const targetPath = (template || "").trim();
      if (!targetPath) {
        return text;
      }
      const parsed = typeof value === "string"
        ? (() => {
            try {
              return JSON.parse(value) as unknown;
            } catch {
              return value;
            }
          })()
        : value;
      const next = getJsonPathValue({ value: parsed }, targetPath.startsWith("$.") ? targetPath : `$.${targetPath}`);
      return stringifyValue(next);
    }
    case "javascript": {
      const source = (template || "").trim();
      if (!source) {
        return text;
      }
      const executor = source.includes("return")
        ? new Function("value", "JSON", source)
        : new Function("value", "JSON", `return (${source});`);
      return stringifyValue(executor(value, JSON));
    }
    default:
      return text;
  }
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
    if (mapping.disabled) {
      return;
    }
    const sourcePath = mapping.sourcePath || mapping.source || "";
    const targetPath = mapping.targetPath || mapping.target || (mapping.targetVariable ? `variables.${mapping.targetVariable}` : "");
    const rawValue = getJsonPathValue(context, sourcePath);
    const value = stringifyValue(rawValue);
    const appliedValue = applyTransform(rawValue, mapping.transformType || "raw", mapping.template || mapping.transform || "{{value}}");

    if (targetPath.startsWith("variables.") || targetPath.startsWith("$.variables.")) {
      const variableName = targetPath.replace(/^\$?\./, "").replace(/^variables\./, "");
      contextVariables[variableName] = appliedValue;
      targetRequest.variables[variableName] = appliedValue;
    } else if (targetPath.startsWith("$.request.pathVariables.")) {
      const variableName = targetPath.slice("$.request.pathVariables.".length);
      targetRequest.variables[variableName] = appliedValue;
    } else if (targetPath.startsWith("$.request.variables.")) {
      const variableName = targetPath.slice("$.request.variables.".length);
      targetRequest.variables[variableName] = appliedValue;
    } else {
      setJsonPathValue({ request: targetRequest }, targetPath, appliedValue);
    }
    applied.push({
      source: sourcePath,
      target: targetPath,
      sourceLabel: mapping.sourceLabel || sourcePath.split(".").pop() || sourcePath,
      targetLabel:
        mapping.targetType === "header"
          ? `Header.${mapping.targetKey || targetPath.split(".").pop() || targetPath}`
          : mapping.targetType === "body"
            ? `Body.${mapping.targetKey || targetPath.split(".").pop() || targetPath}`
            : mapping.targetType === "query"
              ? `Query.${mapping.targetKey || targetPath.split(".").pop() || targetPath}`
              : mapping.targetType === "cookie"
                ? `Cookie.${mapping.targetKey || targetPath.split(".").pop() || targetPath}`
              : mapping.targetType === "path"
                ? `Path.${mapping.targetKey || targetPath.split(".").pop() || targetPath}`
                : mapping.targetType === "flowVariable" || targetPath.startsWith("variables.")
                  ? `Flow.${mapping.targetKey || targetPath.split(".").pop() || targetPath}`
                  : mapping.targetType === "auth"
                    ? "Auth Token"
                    : mapping.targetKey || targetPath.split(".").pop() || targetPath,
      value,
      appliedValue,
      maskedValue: maskSensitiveValue(`${mapping.targetKey} ${targetPath}`, appliedValue),
    });
  });

  return applied;
}
