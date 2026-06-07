import { JsonValue } from "../types/bik";

function parseBody(body: string): JsonValue {
  if (!body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body) as JsonValue;
  } catch {
    return body;
  }
}

function getByParts(value: unknown, parts: string[]): unknown {
  return parts.reduce<unknown>((current, part) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current)) {
      return current[Number(part)];
    }
    if (typeof current === "object") {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, value);
}

function setByParts(target: Record<string, unknown>, parts: string[], value: unknown) {
  let current: Record<string, unknown> = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }

    const existing = current[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  });
}

export function getJsonPathValue(context: Record<string, unknown>, path: string): unknown {
  const normalizedPath = path.startsWith("$.") ? path.slice(2) : path;

  const normalizedContext = {
    ...context,
    response: {
      ...(context.response as Record<string, unknown> | undefined),
      body: parseBody(String((context.response as Record<string, unknown> | undefined)?.body ?? "")),
    },
  };

  return getByParts(normalizedContext, normalizedPath.split(".").filter(Boolean));
}

export function setJsonPathValue(context: Record<string, unknown>, path: string, value: unknown) {
  if (!path.startsWith("$.request.")) {
    return;
  }

  const request = context.request as Record<string, unknown>;
  const targetPath = path.slice("$.request.".length);

  if (targetPath === "url") {
    request.url = String(value);
    return;
  }

  if (targetPath === "auth.token") {
    const headers = (request.headers ?? {}) as Record<string, string>;
    headers.Authorization = `Bearer ${String(value)}`;
    request.headers = headers;
    return;
  }

  if (targetPath.startsWith("headers.")) {
    const headers = (request.headers ?? {}) as Record<string, string>;
    headers[targetPath.slice("headers.".length)] = String(value);
    request.headers = headers;
    return;
  }

  if (targetPath.startsWith("query.")) {
    const queryParams = (request.queryParams ?? {}) as Record<string, string>;
    queryParams[targetPath.slice("query.".length)] = String(value);
    request.queryParams = queryParams;
    return;
  }

  if (targetPath.startsWith("body.")) {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      request.body = {};
    }
    setByParts(request.body as Record<string, unknown>, targetPath.slice("body.".length).split("."), value);
  }
}
