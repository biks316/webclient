import { BikRequest, FlowDefinition } from "../../types/bik";

export type ImportSourceType = "postman" | "postman-environment" | "bruno" | "curl";

export interface ImportWarning {
  message: string;
  path?: string;
}

export interface ImportedRequest {
  name: string;
  request: BikRequest;
  preScript?: string;
  postScript?: string;
  folderPath: string[];
}

export interface ImportedCollection {
  name: string;
  variables: Record<string, string>;
  requests: ImportedRequest[];
  flows?: FlowDefinition[];
}

export interface ImportResult {
  sourceType: ImportSourceType;
  name: string;
  collections: ImportedCollection[];
  environments: Array<{ name: string; variables: Record<string, string> }>;
  warnings: ImportWarning[];
}

export interface ImportReport {
  importedAt: string;
  sourceType: ImportSourceType;
  collections: number;
  folders: number;
  requests: number;
  variables: number;
  warnings: ImportWarning[];
}
