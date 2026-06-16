import { ImportResult } from "../common/ImportResult";

interface PostmanEnvironment {
  name?: string;
  values?: Array<{ key?: string; value?: unknown; enabled?: boolean; type?: string }>;
}

export function parsePostmanEnvironment(value: PostmanEnvironment): ImportResult {
  const variables: Record<string, string> = {};
  value.values?.forEach((item) => {
    if (item.enabled === false || !item.key) {
      return;
    }
    variables[item.key] = String(item.value ?? "");
  });
  return {
    sourceType: "postman-environment",
    name: value.name || "Postman Environment",
    collections: [],
    environments: [{ name: value.name || "Postman Environment", variables }],
    warnings: [],
  };
}
