import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { extractVariableNames } from "../../services/variableResolver";
import { BikRequest } from "../../types/bik";
import { ForwardDestinationPicker } from "./ForwardDestinationPicker";
import { ForwardSource, ForwardTargetLocation, ForwardRule } from "./forwarding";
import styles from "./FlowBuilder.module.css";

interface ForwardValuePopoverProps {
  source: ForwardSource;
  anchor: { top: number; left: number };
  request: BikRequest;
  editingRule?: ForwardRule | null;
  onClose: () => void;
  onCommit: (target: { location: ForwardTargetLocation; key: string }) => void;
}

const DESTINATIONS: Array<{ id: ForwardTargetLocation; label: string }> = [
  { id: "header", label: "Header" },
  { id: "body", label: "Body Field" },
  { id: "query", label: "Query Param" },
  { id: "path", label: "Path Variable" },
  { id: "cookie", label: "Cookie" },
  { id: "flowVariable", label: "Flow Variable" },
  { id: "auth", label: "Auth Token" },
];

export function ForwardValuePopover({
  source,
  anchor,
  request,
  editingRule,
  onClose,
  onCommit,
}: ForwardValuePopoverProps) {
  const [destination, setDestination] = useState<ForwardTargetLocation>(editingRule?.target.location ?? "header");
  const [customKey, setCustomKey] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [position, setPosition] = useState({ top: anchor.top, left: anchor.left });

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-forward-popover]")) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  useEffect(() => {
    const width = 336;
    const nextLeft = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12));
    const nextTop = Math.max(12, Math.min(anchor.top, window.innerHeight - 420));
    setPosition({ top: nextTop, left: nextLeft });
  }, [anchor.left, anchor.top]);

  const sourceValue = source.value ?? source.path.split(".").pop() ?? source.path;
  const headerKeys = Object.keys(request.headers);
  const bodyFields = useMemo(() => flattenBodyFields(request.body), [request.body]);
  const queryKeys = Object.keys(request.queryParams);
  const pathKeys = extractVariableNames(request.url);
  const flowKeys = Object.keys(request.variables);
  const cookieKeys = useMemo(() => extractCookieNames(request.headers), [request.headers]);
  const supportedFields = useMemo(() => {
    switch (destination) {
      case "header":
        return headerKeys;
      case "body":
        return bodyFields;
      case "query":
        return queryKeys;
      case "path":
        return pathKeys;
      case "cookie":
        return cookieKeys;
      case "flowVariable":
        return flowKeys;
      case "auth":
        return ["Authorization"];
      default:
        return [];
    }
  }, [bodyFields, cookieKeys, destination, flowKeys, headerKeys, pathKeys, queryKeys]);

  const title = `Forward "${sourceValue}"`;
  const actionLabel = destination === "auth"
    ? "Auth Token"
    : destination === "flowVariable"
      ? "Flow Variable"
      : destination === "path"
        ? "Path Variable"
        : destination === "cookie"
          ? "Cookie"
        : destination === "query"
          ? "Query Param"
          : destination === "body"
            ? "Body Field"
            : "Header";

  return createPortal(
    <div
      data-forward-popover
      className={styles.forwardPopover}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label={title}
    >
      <header className={styles.forwardPopoverHeader}>
        <strong>{title}</strong>
        <button type="button" onClick={onClose}>Close</button>
      </header>

      <div className={styles.forwardDestinationChips}>
        {DESTINATIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={destination === option.id ? styles.forwardDestinationActive : ""}
            onClick={() => {
              setDestination(option.id);
              setShowCustom(false);
              setCustomKey("");
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={styles.forwardPopoverBody}>
        <ForwardDestinationPicker
          destination={destination}
          sourceLabel={sourceValue}
          supportedFields={supportedFields}
          destinationLabel={actionLabel}
          showCustom={showCustom}
          customKey={customKey}
          onSelectField={(key) => onCommit({ location: destination, key })}
          onShowCustom={() => setShowCustom(true)}
          onCustomKeyChange={setCustomKey}
        />
      </div>
    </div>,
    document.body,
  );
}

function flattenBodyFields(value: unknown, prefix = ""): string[] {
  const parsed = typeof value === "string"
    ? (() => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return value;
        }
      })()
    : value;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return prefix ? [prefix] : [];
  }

  const fields = Object.entries(parsed as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const nested = flattenBodyFields(child, path);
      return nested.length > 0 ? nested : [path];
    }
    return [path];
  });

  return [...new Set(fields)];
}

function extractCookieNames(headers: Record<string, string>) {
  const header = headers.Cookie ?? headers.cookie;
  if (!header) {
    return [];
  }
  return header
    .split(";")
    .map((entry) => entry.split("=")[0]?.trim())
    .filter((value): value is string => Boolean(value));
}
