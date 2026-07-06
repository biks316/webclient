import { JsonValue } from "../types/bik";
import { normalizeRequestBody, replaceRequestBodyPlaceholder } from "./requestBody";

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

function parseRequestCookieHeader(header: string) {
  if (!header.trim()) {
    return {};
  }

  return header
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, cookie) => {
      const [name, ...rest] = cookie.split("=");
      if (!name || rest.length === 0) {
        return acc;
      }
      acc[name.trim()] = rest.join("=").trim();
      return acc;
    }, {});
}

function stringifyRequestCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([key, cookieValue]) => `${key}=${cookieValue}`)
    .join("; ");
}

export function getJsonPathValue(context: Record<string, unknown>, path: string): unknown {
  const normalizedPath = path.startsWith("$.") ? path.slice(2) : path;
  const response = context.response as Record<string, unknown> | undefined;
  const headers = (response?.headers ?? {}) as Record<string, unknown>;
  const cookies = parseCookies(String(headers["set-cookie"] ?? headers["Set-Cookie"] ?? ""));

  const normalizedContext = {
    ...context,
    response: {
      ...response,
      body: parseBody(String(response?.body ?? "")),
      cookies,
    },
  };

  return getByParts(normalizedContext, normalizedPath.split(".").filter(Boolean));
}

function parseCookies(setCookieHeader: string) {
  if (!setCookieHeader.trim()) {
    return {};
  }

  return setCookieHeader
    .split(/,\s*(?=[^;]+?=)/)
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, cookie) => {
      const [pair] = cookie.split(";");
      const [name, ...rest] = pair.split("=");
      if (!name || rest.length === 0) {
        return acc;
      }
      acc[name.trim()] = rest.join("=").trim();
      return acc;
    }, {});
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

  if (targetPath.startsWith("pathVariables.")) {
    const variables = (request.variables ?? {}) as Record<string, string>;
    variables[targetPath.slice("pathVariables.".length)] = String(value);
    request.variables = variables;
    return;
  }

  if (targetPath.startsWith("variables.")) {
    const variables = (request.variables ?? {}) as Record<string, string>;
    variables[targetPath.slice("variables.".length)] = String(value);
    request.variables = variables;
    return;
  }

  if (targetPath.startsWith("headers.")) {
    const headers = (request.headers ?? {}) as Record<string, string>;
    headers[targetPath.slice("headers.".length)] = String(value);
    request.headers = headers;
    return;
  }

  if (targetPath.startsWith("cookies.")) {
    const headers = (request.headers ?? {}) as Record<string, string>;
    const cookieName = targetPath.slice("cookies.".length);
    const cookies = parseRequestCookieHeader(String(headers.Cookie ?? headers.cookie ?? ""));
    cookies[cookieName] = String(value);
    headers.Cookie = stringifyRequestCookies(cookies);
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
    const normalizedBody = normalizeRequestBody(request.body);

    if (targetPath.startsWith("body.raw.") || targetPath.startsWith("body.form.") || targetPath.startsWith("body.multipart.") || targetPath.startsWith("body.graphql.variables.")) {
      request.body = replaceRequestBodyPlaceholder(normalizedBody, targetPath, String(value));
      return;
    }

    request.body = replaceRequestBodyPlaceholder(normalizedBody, targetPath, String(value));
  }
}
