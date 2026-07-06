import { FlowMapping } from "../../types/bik";

export type MappingTransformType = Extract<FlowMapping["transformType"], string>;

export interface MappingSourceField {
  id: string;
  label: string;
  path: string;
  value: string;
  groupLabel: string;
  section: "body" | "header" | "meta";
}

export interface MappingTargetField {
  id: string;
  label: string;
  key: string;
  value: string;
  expectsMapping: boolean;
  targetType: FlowMapping["targetType"];
  targetPath: string;
  groupLabel: string;
  section: "body" | "header" | "query" | "path" | "auth" | "variable";
}

export interface JsonFieldTreeNode<TField> {
  id: string;
  label: string;
  path: string;
  preview: string;
  field?: TField;
  children: JsonFieldTreeNode<TField>[];
}

export interface AutoMapSuggestion {
  id: string;
  sourceField: MappingSourceField;
  targetField: MappingTargetField;
}
