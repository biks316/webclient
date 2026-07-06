import { BikRequest, JsonValue, RequestBody } from "../../types/bik";
import { normalizeRequestBody } from "../../services/requestBody";

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
  body?: JsonValue | RequestBody;
  variables?: Record<string, string>;
}): BikRequest {
  return {
    bikVersion: "1.0",
    type: "request",
    id: input.id ?? slugId(input.name),
    name: input.name,
    method: input.method.toUpperCase(),
    url: input.url || "",
    headers: input.headers ?? {},
    queryParams: input.queryParams ?? {},
    body: normalizeRequestBody(input.body ?? null),
    variables: input.variables ?? {},
  };
}
