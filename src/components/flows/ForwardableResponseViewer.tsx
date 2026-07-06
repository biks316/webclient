import { RunResponse } from "../../types/bik";
import { ForwardFieldRow } from "./ForwardFieldRow";
import styles from "./FlowBuilder.module.css";

interface ForwardableResponseViewerProps {
  response: RunResponse | null;
  loading: boolean;
  onRunSourceRequest: () => void;
  onPickSource: (source: { location: "body" | "header" | "cookie" | "status" | "time"; path: string; label: string; value?: string }, anchor: DOMRect) => void;
}

export function ForwardableResponseViewer({
  response,
  loading,
  onRunSourceRequest,
  onPickSource,
}: ForwardableResponseViewerProps) {
  if (loading) {
    return <p className={styles.forwardLoading}>Loading response example...</p>;
  }

  if (!response) {
    return (
      <div className={styles.noExample}>
        <p>No response example found.</p>
        <span>Run source request to discover fields.</span>
        <button type="button" onClick={onRunSourceRequest}>Run Source Request</button>
      </div>
    );
  }

  const bodyValue = parseJson(response.body);
  const headerEntries = Object.entries(response.headers ?? {});
  const cookieEntries = extractCookieEntries(response.headers ?? {});

  return (
    <div className={styles.forwardViewer}>
      <section>
        <div className={styles.forwardSectionHeader}>
          <strong>Response Body</strong>
        </div>
        {bodyValue && typeof bodyValue === "object" && !Array.isArray(bodyValue) ? (
          <div className={styles.forwardTree}>
            {Object.entries(bodyValue as Record<string, unknown>).map(([key, value]) =>
              renderNode(key, value, key, 0, onPickSource),
            )}
          </div>
        ) : (
          <ForwardFieldRow
            label="body"
            value={typeof bodyValue === "string" ? bodyValue : JSON.stringify(bodyValue)}
            onAdd={(anchor) => onPickSource({ location: "body", path: "$.response.body", label: "body" }, anchor)}
          />
        )}
      </section>

      <section>
        <div className={styles.forwardSectionHeader}>
          <strong>Response Headers</strong>
        </div>
        <div className={styles.forwardTree}>
          {headerEntries.map(([key, value]) => (
            <ForwardFieldRow
              key={key}
              label={key}
              value={value}
              onAdd={(anchor) => onPickSource({
                location: "header",
                path: `$.response.headers.${key}`,
                label: key,
                value,
              }, anchor)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className={styles.forwardSectionHeader}>
          <strong>Response Cookies</strong>
        </div>
        <div className={styles.forwardTree}>
          {cookieEntries.length === 0 ? (
            <p className={styles.forwardEmptyHint}>No cookies found.</p>
          ) : cookieEntries.map(([key, value]) => (
            <ForwardFieldRow
              key={key}
              label={key}
              value={value}
              onAdd={(anchor) => onPickSource({
                location: "cookie",
                path: `$.response.cookies.${key}`,
                label: key,
                value,
              }, anchor)}
            />
          ))}
        </div>
      </section>

      <section className={styles.forwardMetaGrid}>
        <ForwardFieldRow
          label="Status Code"
          value={response.status}
          onAdd={(anchor) => onPickSource({
            location: "status",
            path: "$.response.status",
            label: "status",
            value: String(response.status),
          }, anchor)}
        />
        <ForwardFieldRow
          label="Response Time"
          value={`${response.responseTimeMs} ms`}
          onAdd={(anchor) => onPickSource({
            location: "time",
            path: "$.response.responseTimeMs",
            label: "response time",
            value: String(response.responseTimeMs),
          }, anchor)}
        />
      </section>
    </div>
  );
}

function renderNode(
  label: string,
  value: unknown,
  path: string,
  depth: number,
  onPickSource: ForwardableResponseViewerProps["onPickSource"],
): JSX.Element {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return (
      <div key={path}>
        <ForwardFieldRow label={label} value="" depth={depth} onAdd={(anchor) => onPickSource({ location: "body", path: `$.response.body.${path}`, label }, anchor)} />
        <div className={styles.forwardNested}>
          {Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) =>
            renderNode(childKey, childValue, `${path}.${childKey}`, depth + 1, onPickSource),
          )}
        </div>
      </div>
    );
  }

  const text = value === null || value === undefined ? "" : String(value);
  return (
    <ForwardFieldRow
      key={path}
      label={label}
      value={text}
      depth={depth}
      onAdd={(anchor) => onPickSource({ location: "body", path: `$.response.body.${path}`, label, value: text }, anchor)}
    />
  );
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractCookieEntries(headers: Record<string, string>) {
  const header = headers["set-cookie"] ?? headers["Set-Cookie"];
  if (!header) {
    return [];
  }
  return header
    .split(/,\s*(?=[^;]+?=)/)
    .map((entry) => {
      const [pair] = entry.split(";");
      const [name, ...rest] = pair.split("=");
      if (!name || rest.length === 0) {
        return null;
      }
      return [name.trim(), rest.join("=").trim()] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));
}
