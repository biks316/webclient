import { FlowMapping } from "../types/bik";
import { leafLabel } from "./jsonTreeService";

export type TargetType = FlowMapping["targetType"];
export type TransformType = FlowMapping["transformType"];

export function targetPathFor(type: TargetType, key: string) {
  switch (type) {
    case "variable":
    case "flowVariable":
      return `variables.${key}`;
    case "path":
      return `$.request.pathVariables.${key}`;
    case "header":
      return `$.request.headers.${key}`;
    case "body":
      return `$.request.body.${key}`;
    case "query":
      return `$.request.query.${key}`;
    case "cookie":
      return `$.request.cookies.${key}`;
    case "auth":
      return "$.request.auth.token";
    case "url":
      return "$.request.url";
    default:
      return `$.request.body.${key}`;
  }
}

export function templateFor(type: TransformType) {
  switch (type) {
    case "bearer":
      return "Bearer {{value}}";
    case "substring":
      return "0:8";
    case "jsonpath":
      return "$.id";
    case "javascript":
      return "return String(value);";
    default:
      return "{{value}}";
  }
}

export function suggestMapping(sourcePath: string): Pick<FlowMapping, "sourceLabel" | "targetType" | "targetKey" | "transformType" | "template" | "targetPath"> {
  const sourceLabel = leafLabel(sourcePath);
  const normalized = sourceLabel.toLowerCase();

  if (["token", "accesstoken", "access_token", "jwt"].some((token) => normalized.includes(token))) {
    return {
      sourceLabel,
      targetType: "header",
      targetKey: "Authorization",
      transformType: "bearer",
      template: "Bearer {{value}}",
      targetPath: "$.request.headers.Authorization",
    };
  }

  const idLike = normalized === "id" || normalized.endsWith("id");
  return {
    sourceLabel,
    targetType: idLike ? "flowVariable" : "flowVariable",
    targetKey: sourceLabel,
    transformType: "raw",
    template: "{{value}}",
    targetPath: targetPathFor(idLike ? "flowVariable" : "flowVariable", sourceLabel),
  };
}

export function maskSensitiveValue(label: string, value: string) {
  const normalized = label.toLowerCase();
  const sensitive = ["token", "authorization", "cookie", "password", "secret", "apikey", "api-key"].some((key) =>
    normalized.includes(key),
  );
  if (!sensitive || value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-3)}`;
}
