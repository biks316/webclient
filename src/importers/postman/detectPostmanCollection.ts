export function detectPostmanCollection(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { info?: { schema?: string }; item?: unknown };
  return Boolean(
    Array.isArray(candidate.item) &&
    (candidate.info?.schema?.includes("postman") || "info" in candidate),
  );
}
