import { BikRequest, FlowEdge, FlowMapping, RunResponse } from "../../types/bik";
import { targetPathFor } from "../../services/mappingSuggestionService";
import { extractVariableNames } from "../../services/variableResolver";
import { isMapPlaceholder } from "../../services/mapPlaceholderService";
import { findRequestBodyPlaceholders, normalizeRequestBody, parseGraphqlVariables, parseJsonBody } from "../../services/requestBody";
import {
  AutoMapSuggestion,
  JsonFieldTreeNode,
  MappingSourceField,
  MappingTargetField,
  MappingTransformType,
} from "./mappingBuilderTypes";

interface SourceCatalog {
  allFields: MappingSourceField[];
  bodyTree: Array<JsonFieldTreeNode<MappingSourceField>>;
  headerFields: MappingSourceField[];
  metaFields: MappingSourceField[];
}

interface TargetCatalog {
  allFields: MappingTargetField[];
  bodyTree: Array<JsonFieldTreeNode<MappingTargetField>>;
  headerFields: MappingTargetField[];
  queryFields: MappingTargetField[];
  pathFields: MappingTargetField[];
  authFields: MappingTargetField[];
  variableFields: MappingTargetField[];
}

export function buildSourceCatalog(response: RunResponse | null): SourceCatalog {
  if (!response) {
    return {
      allFields: [],
      bodyTree: [],
      headerFields: [],
      metaFields: [],
    };
  }

  const bodyValue = parseMaybeJson(response.body);
  const bodyTree = buildSourceBodyTree(bodyValue);
  const bodyFields = collectTreeFields(bodyTree);
  const headerFields = Object.entries(response.headers ?? {}).map(([key, value]) => ({
    id: `source-header:${key}`,
    label: key,
    path: `$.response.headers.${key}`,
    value: previewValue(value),
    groupLabel: "Headers",
    section: "header" as const,
  }));
  const metaFields: MappingSourceField[] = [
    {
      id: "source-meta:status",
      label: "status",
      path: "$.response.status",
      value: String(response.status),
      groupLabel: "Meta",
      section: "meta",
    },
    {
      id: "source-meta:responseTimeMs",
      label: "responseTimeMs",
      path: "$.response.responseTimeMs",
      value: String(response.responseTimeMs),
      groupLabel: "Meta",
      section: "meta",
    },
  ];

  return {
    allFields: [...bodyFields, ...headerFields, ...metaFields],
    bodyTree,
    headerFields,
    metaFields,
  };
}

export function buildTargetCatalog(request: BikRequest): TargetCatalog {
  const normalizedBody = normalizeRequestBody(request.body);
  const bodyTree =
    normalizedBody.type === "json"
      ? buildTargetBodyTree(parseJsonBody(normalizedBody))
      : normalizedBody.type === "graphql"
        ? buildTargetBodyTree(parseGraphqlVariables(normalizedBody), "graphql.variables", "graphql.variables")
        : buildPlaceholderBodyTree(request);
  const bodyFields = collectTreeFields(bodyTree);
  const headerFields = Object.entries(request.headers ?? {}).map(([key, value]) =>
    targetField("header", "Headers", key, value),
  );
  const queryFields = Object.entries(request.queryParams ?? {}).map(([key, value]) =>
    targetField("query", "Query Params", key, value),
  );
  const pathFields = extractVariableNames(request.url ?? "").map((key) =>
    targetField("path", "Path Params", key, ""),
  );
  const authFields = [targetField("auth", "Auth Fields", "Authorization", "Bearer token")];
  const variableFields = Object.entries(request.variables ?? {}).map(([key, value]) =>
    targetField("variable", "Variables", key, value),
  );

  return {
    allFields: [...bodyFields, ...headerFields, ...queryFields, ...pathFields, ...authFields, ...variableFields],
    bodyTree,
    headerFields,
    queryFields,
    pathFields,
    authFields,
    variableFields,
  };
}

export function withEdgeSummary(edge: FlowEdge, mappings: FlowMapping[]): FlowEdge {
  const next = { ...edge, mappings };
  const label = mappings.length === 0 ? "Add mapping" : mappings.length === 1
    ? `${mappings[0].sourceLabel} → ${formatTargetLabel(mappings[0])}`
    : `${mappings.length} mappings`;
  return { ...next, label };
}

export function createMapping(sourceField: MappingSourceField, targetField: MappingTargetField): FlowMapping {
  return {
    sourcePath: sourceField.path,
    sourceLabel: sourceField.label,
    targetType: targetField.targetType,
    targetKey: targetField.key,
    targetPath: targetField.targetPath,
    targetVariable:
      targetField.targetType === "variable" || targetField.targetType === "flowVariable"
        ? targetField.key
        : undefined,
    transformType: "raw",
    template: "{{value}}",
    disabled: false,
  };
}

export function buildAutoMapSuggestions(
  sourceFields: MappingSourceField[],
  targetFields: MappingTargetField[],
  existingMappings: FlowMapping[],
): AutoMapSuggestion[] {
  const existing = new Set(existingMappings.map((mapping) => `${mapping.sourcePath}:${mapping.targetType}:${mapping.targetKey}`));
  const byName = new Map<string, MappingTargetField[]>();
  targetFields.forEach((field) => {
    const normalized = normalizeFieldName(field.label);
    byName.set(normalized, [...(byName.get(normalized) ?? []), field]);
  });

  return sourceFields.flatMap((sourceField) => {
    const normalized = normalizeFieldName(sourceField.label);
    const match = (byName.get(normalized) ?? [])[0];
    if (!match) {
      return [];
    }
    const id = `${sourceField.path}:${match.targetType}:${match.key}`;
    if (existing.has(id)) {
      return [];
    }
    return [{ id, sourceField, targetField: match }];
  });
}

export function defaultTransformTemplate(type: MappingTransformType) {
  switch (type) {
    case "template":
      return "{{value}}";
    case "substring":
      return "0:8";
    case "jsonpath":
      return "$.id";
    case "javascript":
      return "return String(value);";
    case "bearer":
      return "Bearer {{value}}";
    default:
      return "{{value}}";
  }
}

export function needsTransformInput(type: MappingTransformType) {
  return type === "template" || type === "substring" || type === "jsonpath" || type === "javascript";
}

export function previewValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function byteSize(text: string) {
  return new TextEncoder().encode(text).length;
}

export function formatSourcePath(path: string) {
  return path.replace("$.response.body.", "body.").replace("$.response.", "");
}

export function formatTargetPath(path: string) {
  return path.replace("$.request.", "");
}

export function filterTreeNodes<TField>(
  nodes: Array<JsonFieldTreeNode<TField>>,
  query: string,
): Array<JsonFieldTreeNode<TField>> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return nodes;
  }
  return nodes.flatMap((node) => {
    const children = filterTreeNodes(node.children, normalized);
    const matches = `${node.label} ${node.path} ${node.preview}`.toLowerCase().includes(normalized);
    if (!matches && children.length === 0) {
      return [];
    }
    return [{ ...node, children }];
  });
}

export function filterTreeByField<TField>(
  nodes: Array<JsonFieldTreeNode<TField>>,
  predicate: (field: TField) => boolean,
): Array<JsonFieldTreeNode<TField>> {
  return nodes.flatMap((node) => {
    const children = filterTreeByField(node.children, predicate);
    const includeField = node.field ? predicate(node.field) : false;
    if (!includeField && children.length === 0) {
      return [];
    }
    return [{ ...node, children }];
  });
}

export function filterFields<TField extends { label: string; value: string; path?: string; key?: string; groupLabel: string }>(
  fields: TField[],
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return fields;
  }
  return fields.filter((field) =>
    `${field.label} ${field.value} ${field.path ?? ""} ${field.key ?? ""} ${field.groupLabel}`
      .toLowerCase()
      .includes(normalized),
  );
}

function buildSourceBodyTree(value: unknown, path = "$.response.body", label = "body"): Array<JsonFieldTreeNode<MappingSourceField>> {
  const node = buildSourceNode(value, path, label, "Response Body");
  return node ? [node] : [];
}

function buildSourceNode(
  value: unknown,
  path: string,
  label: string,
  groupLabel: string,
): JsonFieldTreeNode<MappingSourceField> | null {
  if (Array.isArray(value)) {
    return {
      id: `source-node:${path}`,
      label,
      path,
      preview: `Array(${value.length})`,
      children: value
        .map((item, index) => buildSourceNode(item, `${path}.${index}`, `[${index}]`, groupLabel))
        .filter((child): child is JsonFieldTreeNode<MappingSourceField> => Boolean(child)),
    };
  }

  if (value && typeof value === "object") {
    return {
      id: `source-node:${path}`,
      label,
      path,
      preview: "Object",
      children: Object.entries(value as Record<string, unknown>)
        .map(([key, child]) => buildSourceNode(child, `${path}.${key}`, key, groupLabel))
        .filter((child): child is JsonFieldTreeNode<MappingSourceField> => Boolean(child)),
    };
  }

  const field: MappingSourceField = {
    id: `source-field:${path}`,
    label,
    path,
    value: previewValue(value),
    groupLabel,
    section: "body",
  };

  return {
    id: `source-node:${path}`,
    label,
    path,
    preview: field.value,
    field,
    children: [],
  };
}

function buildTargetBodyTree(value: unknown, path = "", label = "body"): Array<JsonFieldTreeNode<MappingTargetField>> {
  const parsed = typeof value === "string" ? parseMaybeJson(value) : value;
  if (!parsed || typeof parsed !== "object") {
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed
      .map((item, index) => buildTargetNode(item, `${index}`, `[${index}]`))
      .filter((node): node is JsonFieldTreeNode<MappingTargetField> => Boolean(node));
  }
  const root = Object.entries(parsed as Record<string, unknown>)
    .map(([key, child]) => buildTargetNode(child, key, key))
    .filter((node): node is JsonFieldTreeNode<MappingTargetField> => Boolean(node));
  return path ? [{
    id: `target-node:${path}`,
    label,
    path,
    preview: "Object",
    children: root,
  }] : root;
}

function buildPlaceholderBodyTree(request: BikRequest): Array<JsonFieldTreeNode<MappingTargetField>> {
  return findRequestBodyPlaceholders(request.body).map((placeholder) => {
    const key = placeholder.path.slice("body.".length);
    const field = targetField("body", "Body", key, placeholder.value, placeholder.label);
    return {
      id: `target-node:${placeholder.path}`,
      label: placeholder.label,
      path: placeholder.path,
      preview: placeholder.value,
      field,
      children: [],
    };
  });
}

function buildTargetNode(value: unknown, path: string, label: string): JsonFieldTreeNode<MappingTargetField> | null {
  if (Array.isArray(value)) {
    return {
      id: `target-node:${path}`,
      label,
      path,
      preview: `Array(${value.length})`,
      children: value
        .map((item, index) => buildTargetNode(item, `${path}.${index}`, `[${index}]`))
        .filter((child): child is JsonFieldTreeNode<MappingTargetField> => Boolean(child)),
    };
  }

  if (value && typeof value === "object") {
    return {
      id: `target-node:${path}`,
      label,
      path,
      preview: "Object",
      children: Object.entries(value as Record<string, unknown>)
        .map(([key, child]) => buildTargetNode(child, `${path}.${key}`, key))
        .filter((child): child is JsonFieldTreeNode<MappingTargetField> => Boolean(child)),
    };
  }

  const field = targetField("body", "Body", path, previewValue(value), label);
  return {
    id: `target-node:${path}`,
    label,
    path,
    preview: field.value,
    field,
    children: [],
  };
}

function collectTreeFields<TField>(nodes: Array<JsonFieldTreeNode<TField>>): TField[] {
  return nodes.flatMap((node) => [
    ...(node.field ? [node.field] : []),
    ...collectTreeFields(node.children),
  ]);
}

function targetField(
  targetType: FlowMapping["targetType"],
  groupLabel: string,
  key: string,
  value: string,
  label = key,
): MappingTargetField {
  return {
    id: `target-field:${targetType}:${key}`,
    label,
    key,
    value,
    expectsMapping: isMappingPlaceholder(value),
    targetType,
    targetPath: targetPathFor(targetType, key),
    groupLabel,
    section:
      targetType === "body"
        ? "body"
        : targetType === "header"
          ? "header"
          : targetType === "query"
            ? "query"
            : targetType === "path"
              ? "path"
              : targetType === "auth"
                ? "auth"
                : "variable",
  };
}

function isMappingPlaceholder(value: string) {
  return isMapPlaceholder(value);
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseMaybeJson(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatTargetLabel(mapping: FlowMapping) {
  switch (mapping.targetType) {
    case "body":
      return `body.${mapping.targetKey}`;
    case "header":
      return `header.${mapping.targetKey}`;
    case "query":
      return `query.${mapping.targetKey}`;
    case "path":
      return `path.${mapping.targetKey}`;
    case "auth":
      return "auth.token";
    case "variable":
    case "flowVariable":
      return `variables.${mapping.targetKey}`;
    default:
      return mapping.targetPath;
  }
}
