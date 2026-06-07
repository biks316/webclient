export interface JsonTreeNode {
  label: string;
  path: string;
  value: unknown;
  children: JsonTreeNode[];
}

function parseBody(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildChildren(value: unknown, basePath: string): JsonTreeNode[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).map(([key, childValue]) => {
    const path = `${basePath}.${key}`;
    return {
      label: key,
      path,
      value: childValue,
      children: buildChildren(childValue, path),
    };
  });
}

export function buildResponseTree(response: unknown): JsonTreeNode[] {
  const responseObject = response as { body?: unknown; headers?: Record<string, unknown>; status?: unknown };
  const body = parseBody(responseObject?.body ?? null);
  const headers = responseObject?.headers ?? {};

  return [
    {
      label: "response.body",
      path: "$.response.body",
      value: body,
      children: buildChildren(body, "$.response.body"),
    },
    {
      label: "response.headers",
      path: "$.response.headers",
      value: headers,
      children: buildChildren(headers, "$.response.headers"),
    },
    {
      label: "response.status",
      path: "$.response.status",
      value: responseObject?.status,
      children: [],
    },
  ];
}

export function leafLabel(path: string) {
  return path.split(".").pop() ?? path;
}
