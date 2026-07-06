import { ImportResult, ImportedRequest, ImportWarning } from "../common/ImportResult";
import { createBikRequest, slugId } from "../common/normalizeRequest";
import { parseBruFile, parseKeyValues } from "./parseBruFile";

export interface TextFileEntry {
  path: string;
  content: string;
}

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

export function parseBrunoFolder(files: TextFileEntry[], folderName = "Bruno Collection"): ImportResult {
  const warnings: ImportWarning[] = [];
  const requests: ImportedRequest[] = [];
  const variables: Record<string, string> = {};
  let collectionName = folderName;

  files.forEach((file) => {
    if (file.path.endsWith("bruno.json")) {
      try {
        const parsed = JSON.parse(file.content) as { name?: string };
        collectionName = parsed.name || collectionName;
      } catch {
        warnings.push({ message: "Could not parse bruno.json", path: file.path });
      }
      return;
    }
    if (!file.path.endsWith(".bru")) {
      return;
    }
    const bru = parseBruFile(file.content);
    bru.unknownSections.forEach((section) => warnings.push({ message: `Unsupported Bruno section: ${section.name}`, path: file.path }));
    const meta = parseKeyValues(bru.sections.find((section) => section.name === "meta")?.body ?? "");
    const methodSection = bru.sections.find((section) => METHODS.includes(section.name));
    const vars = parseKeyValues(bru.sections.find((section) => section.name === "vars")?.body ?? "");
    if (file.path.endsWith("collection.bru")) {
      Object.assign(variables, vars);
      if (meta.name) {
        collectionName = meta.name;
      }
      return;
    }
    if (!methodSection) {
      return;
    }
    requests.push(mapBruRequest(file, methodSection.name.toUpperCase(), methodSection.body, meta, vars, warnings));
  });

  return {
    sourceType: "bruno",
    name: collectionName,
    collections: [{ name: collectionName, variables, requests }],
    environments: [],
    warnings,
  };
}

function mapBruRequest(
  file: TextFileEntry,
  method: string,
  requestLine: string,
  meta: Record<string, string>,
  variables: Record<string, string>,
  warnings: ImportWarning[],
): ImportedRequest {
  const bru = parseBruFile(file.content);
  const headers = parseKeyValues(bru.sections.find((section) => section.name === "headers")?.body ?? "");
  const queryParams = parseKeyValues(bru.sections.find((section) => section.name === "params")?.body ?? "");
  const bodyText = bru.sections.find((section) => section.name === "body")?.body ?? "";
  const preScript = bru.sections.find((section) => section.name === "script:pre-request")?.body;
  const postScript = bru.sections.find((section) => section.name === "script:post-response" || section.name === "tests")?.body;
  let body = null;
  if (bodyText.trim()) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
  }
  if (bru.sections.some((section) => section.name === "auth")) {
    warnings.push({ message: "Bruno auth imported as raw request metadata; review manually", path: file.path });
  }
  const name = meta.name || file.path.split(/[\\/]/).pop()?.replace(/\.bru$/, "") || "Bruno Request";
  return {
    name,
    folderPath: file.path.split(/[\\/]/).slice(0, -1).filter((part) => part && part !== "."),
    preScript,
    postScript,
    request: createBikRequest({
      id: slugId(name),
      name,
      method,
      url: requestLine.trim() || "",
      headers,
      queryParams,
      body,
      variables,
    }),
  };
}
