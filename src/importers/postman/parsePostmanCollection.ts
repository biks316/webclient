import { JsonValue } from "../../types/bik";
import { ImportResult, ImportedRequest, ImportWarning } from "../common/ImportResult";
import { createBikRequest, slugId } from "../common/normalizeRequest";

type PostmanItem = {
  id?: string;
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest | string;
  event?: PostmanEvent[];
  response?: unknown[];
};

type PostmanRequest = {
  method?: string;
  url?: string | { raw?: string; protocol?: string; host?: string[]; path?: string[]; query?: Array<{ key?: string; value?: string; disabled?: boolean }> };
  header?: Array<{ key?: string; value?: string; disabled?: boolean }>;
  body?: { mode?: string; raw?: string; urlencoded?: Array<{ key?: string; value?: string; disabled?: boolean }>; formdata?: Array<{ key?: string; value?: string; disabled?: boolean }>; graphql?: { query?: string; variables?: string } };
  auth?: { type?: string; [key: string]: unknown };
};

type PostmanEvent = { listen?: string; script?: { exec?: string[] | string } };

interface PostmanCollection {
  info?: { name?: string; _postman_id?: string };
  item?: PostmanItem[];
  variable?: Array<{ key?: string; value?: unknown }>;
}

export function parsePostmanCollection(collection: PostmanCollection): ImportResult {
  const warnings: ImportWarning[] = [];
  const requests: ImportedRequest[] = [];
  const variables: Record<string, string> = {};
  collection.variable?.forEach((variable) => {
    if (variable.key) {
      variables[variable.key] = String(variable.value ?? "");
    }
  });

  function visit(items: PostmanItem[] = [], folderPath: string[]) {
    items.forEach((item) => {
      if (item.item) {
        visit(item.item, [...folderPath, item.name || "Folder"]);
        return;
      }
      if (!item.request || typeof item.request === "string") {
        warnings.push({ message: `Skipped item without structured request: ${item.name ?? "Unnamed"}`, path: folderPath.join("/") });
        return;
      }
      requests.push(mapRequest(item, item.request, folderPath, warnings));
    });
  }
  visit(collection.item ?? [], []);

  return {
    sourceType: "postman",
    name: collection.info?.name || "Postman Collection",
    collections: [{
      name: collection.info?.name || "Postman Collection",
      variables,
      requests,
    }],
    environments: [],
    warnings,
  };
}

function mapRequest(item: PostmanItem, request: PostmanRequest, folderPath: string[], warnings: ImportWarning[]): ImportedRequest {
  const { url, queryParams } = mapUrl(request.url);
  const body = mapBody(request.body, item.name || "Request", warnings);
  const scripts = mapScripts(item.event ?? []);
  const headers: Record<string, string> = {};
  request.header?.forEach((header) => {
    if (!header.disabled && header.key) {
      headers[header.key] = header.value ?? "";
    }
  });
  if (request.auth && request.auth.type && !["bearer", "basic", "apikey", "apiKey", "noauth", "inherit"].includes(request.auth.type)) {
    warnings.push({ message: `Unsupported auth type: ${request.auth.type}`, path: [...folderPath, item.name || "Request"].join("/") });
  }

  return {
    name: item.name || "Imported Request",
    folderPath,
    preScript: scripts.pre,
    postScript: scripts.test,
    request: createBikRequest({
      id: slugId(item.name || item.id || "postman-request"),
      name: item.name || "Imported Request",
      method: request.method || "GET",
      url,
      headers,
      queryParams,
      body,
    }),
  };
}

function mapUrl(url: PostmanRequest["url"]) {
  if (!url) {
    return { url: "https://example.com/", queryParams: {} };
  }
  if (typeof url === "string") {
    return { url, queryParams: {} };
  }
  const raw = url.raw || `${url.protocol || "https"}://${(url.host ?? []).join(".")}/${(url.path ?? []).join("/")}`;
  const queryParams: Record<string, string> = {};
  url.query?.forEach((query) => {
    if (!query.disabled && query.key) {
      queryParams[query.key] = query.value ?? "";
    }
  });
  return { url: raw, queryParams };
}

function mapBody(body: PostmanRequest["body"], name: string, warnings: ImportWarning[]): JsonValue {
  if (!body) {
    return null;
  }
  if (body.mode === "raw") {
    const raw = body.raw ?? "";
    try {
      return JSON.parse(raw) as JsonValue;
    } catch {
      return raw;
    }
  }
  if (body.mode === "urlencoded") {
    return Object.fromEntries((body.urlencoded ?? []).filter((item) => !item.disabled && item.key).map((item) => [item.key!, item.value ?? ""]));
  }
  if (body.mode === "formdata") {
    warnings.push({ message: `Form-data body imported as key/value placeholder: ${name}` });
    return Object.fromEntries((body.formdata ?? []).filter((item) => !item.disabled && item.key).map((item) => [item.key!, item.value ?? ""]));
  }
  if (body.mode === "graphql") {
    return { query: body.graphql?.query ?? "", variables: body.graphql?.variables ?? "" };
  }
  warnings.push({ message: `Unsupported body type: ${body.mode ?? "unknown"}` });
  return null;
}

function mapScripts(events: PostmanEvent[]) {
  const scriptText = (listen: string) => {
    const event = events.find((item) => item.listen === listen);
    const exec = event?.script?.exec;
    return Array.isArray(exec) ? exec.join("\n") : exec ?? "";
  };
  return { pre: scriptText("prerequest"), test: scriptText("test") };
}
