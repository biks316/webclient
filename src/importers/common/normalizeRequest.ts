import { BikRequest, JsonValue } from "../../types/bik";

export function slugId(input: string) {
  const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "imported-request";
}

export function createBikRequest(input: {
  id?: string;
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: JsonValue;
  variables?: Record<string, string>;
}): BikRequest {
  return {
    bikVersion: "1.0",
    type: "request",
    id: input.id ?? slugId(input.name),
    name: input.name,
    method: input.method.toUpperCase(),
    url: input.url || "https://example.com/",
    headers: input.headers ?? {},
    queryParams: input.queryParams ?? {},
    body: input.body ?? null,
    variables: input.variables ?? {},
  };
}
