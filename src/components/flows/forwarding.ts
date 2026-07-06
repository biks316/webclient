import { FlowEdge, FlowMapping } from "../../types/bik";
import { targetPathFor } from "../../services/mappingSuggestionService";

export type ForwardSourceLocation = "body" | "header" | "cookie" | "status" | "time";
export type ForwardTargetLocation = "header" | "body" | "query" | "path" | "cookie" | "auth" | "flowVariable";

export interface ForwardRule {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  source: {
    location: ForwardSourceLocation;
    path: string;
  };
  target: {
    location: ForwardTargetLocation;
    key: string;
  };
  transform: {
    type: "raw";
  };
}

export interface ForwardSource {
  location: ForwardSourceLocation;
  path: string;
  label: string;
  value?: string;
}

export function mappingToForwardRule(edge: FlowEdge, mapping: FlowMapping): ForwardRule {
  return {
    id: `${edge.id}:${mapping.sourcePath}:${mapping.targetPath}`,
    sourceNodeId: edge.source ?? edge.from,
    targetNodeId: edge.target ?? edge.to,
    source: {
      location: sourceLocationFromPath(mapping.sourcePath),
      path: mapping.sourcePath,
    },
    target: {
      location: targetLocationFromType(mapping.targetType, mapping.targetPath),
      key: mapping.targetKey,
    },
    transform: { type: "raw" },
  };
}

export function forwardRuleToMapping(rule: ForwardRule): FlowMapping {
  const targetType = rule.target.location;
  const targetPath = targetPathFor(rule.target.location, rule.target.key);
  return {
    sourcePath: rule.source.path,
    sourceLabel: rule.source.path.split(".").pop() ?? rule.source.path,
    targetType: targetType === "flowVariable" ? "flowVariable" : targetType,
    targetKey: rule.target.key,
    targetPath,
    targetVariable: rule.target.location === "flowVariable" ? rule.target.key : undefined,
    transformType: "raw",
    template: "{{value}}",
  };
}

export function forwardRuleLabel(rule: ForwardRule | FlowMapping) {
  const source = isForwardRule(rule)
    ? rule.source.path.split(".").pop() ?? rule.source.path
    : rule.sourceLabel || rule.sourcePath.split(".").pop() || rule.sourcePath;
  const target = isForwardRule(rule)
    ? `${formatTargetLocation(rule.target.location)}.${rule.target.key}`
    : formatTargetLabel(rule.targetType, rule.targetKey, rule.targetPath);
  return `${source} → ${target}`;
}

export function forwardRuleSummary(edge: FlowEdge) {
  if (edge.mappings.length === 0) {
    return "Forward Value";
  }
  if (edge.mappings.length === 1) {
    return forwardRuleLabel(edge.mappings[0]);
  }
  return `${edge.mappings.length} forwarded values`;
}

export function formatTargetLabel(targetType: FlowMapping["targetType"], targetKey: string, targetPath: string) {
  switch (targetType) {
    case "header":
      return `Header.${targetKey}`;
    case "body":
      return `Body.${targetKey}`;
    case "query":
      return `Query.${targetKey}`;
    case "cookie":
      return `Cookie.${targetKey}`;
    case "auth":
      return "Auth Token";
    case "path":
      return `Path.${targetKey}`;
    case "flowVariable":
    case "variable":
      return `Flow.${targetKey}`;
    default:
      if (targetPath.startsWith("$.request.headers.")) {
        return `Header.${targetKey}`;
      }
      if (targetPath.startsWith("$.request.body.")) {
        return `Body.${targetKey}`;
      }
      if (targetPath.startsWith("$.request.query.")) {
        return `Query.${targetKey}`;
      }
      if (targetPath.startsWith("$.request.cookies.")) {
        return `Cookie.${targetKey}`;
      }
      if (targetPath.startsWith("$.request.pathVariables.")) {
        return `Path.${targetKey}`;
      }
      if (targetPath.startsWith("variables.")) {
        return `Flow.${targetKey}`;
      }
      return targetKey || targetPath;
  }
}

function formatTargetLocation(location: ForwardTargetLocation) {
  switch (location) {
    case "header":
      return "Header";
    case "body":
      return "Body";
    case "query":
      return "Query";
    case "path":
      return "Path";
    case "cookie":
      return "Cookie";
    case "auth":
      return "Auth";
    case "flowVariable":
      return "Flow";
    default:
      return location;
  }
}

function sourceLocationFromPath(path: string): ForwardSourceLocation {
  if (path.startsWith("$.response.headers.")) {
    return "header";
  }
  if (path.startsWith("$.response.cookies.")) {
    return "cookie";
  }
  if (path === "$.response.status") {
    return "status";
  }
  if (path === "$.response.responseTimeMs") {
    return "time";
  }
  return "body";
}

function targetLocationFromType(targetType: FlowMapping["targetType"], targetPath: string): ForwardTargetLocation {
  if (targetType === "flowVariable" || targetType === "variable") {
    return "flowVariable";
  }
  if (targetType === "path" || targetPath.startsWith("$.request.pathVariables.")) {
    return "path";
  }
  if (targetType === "header") return "header";
  if (targetType === "body") return "body";
  if (targetType === "query") return "query";
  if (targetType === "cookie" || targetPath.startsWith("$.request.cookies.")) return "cookie";
  if (targetType === "auth") return "auth";
  return targetPath.startsWith("variables.") ? "flowVariable" : "body";
}

function isForwardRule(rule: ForwardRule | FlowMapping): rule is ForwardRule {
  return typeof (rule as ForwardRule).source === "object" && typeof (rule as ForwardRule).target === "object";
}
