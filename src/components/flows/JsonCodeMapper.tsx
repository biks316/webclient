import { useMemo } from "react";
import { JsonClickableToken } from "./JsonClickableToken";
import { MapPlaceholderHighlighter } from "./MapPlaceholderHighlighter";
import { JsonFieldTreeNode } from "./mappingBuilderTypes";
import styles from "./MappingBuilderModal.module.css";

interface BaseField {
  id: string;
  label: string;
  value: string;
  expectsMapping?: boolean;
}

interface JsonCodeMapperProps<TField extends BaseField> {
  side: "source" | "target";
  nodes: Array<JsonFieldTreeNode<TField>>;
  search: string;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId: string | null;
  glowFieldIds?: Set<string>;
  getFieldRef?: (field: TField) => (node: HTMLButtonElement | null) => void;
  getDisplayPath: (field: TField) => string;
  onFieldClick?: (field: TField) => void;
  onFieldHover?: (field: TField | null) => void;
}

interface CodeLine<TField extends BaseField> {
  id: string;
  depth: number;
  kind: "open" | "close" | "leaf";
  text: string;
  comma: boolean;
  bracket?: "{" | "}" | "[" | "]";
  keyLabel?: string;
  field?: TField;
}

export function JsonCodeMapper<TField extends BaseField>({
  side,
  nodes,
  search,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  glowFieldIds,
  getFieldRef,
  getDisplayPath,
  onFieldClick,
  onFieldHover,
}: JsonCodeMapperProps<TField>) {
  const lines = useMemo(() => buildCodeLines(nodes), [nodes]);
  const normalizedSearch = search.trim().toLowerCase();

  if (lines.length === 0) {
    return <div className={styles.jsonCodeEmpty}>{side === "source" ? "{}" : "{ }"}</div>;
  }

  return (
    <div className={styles.jsonCodePanel}>
      {lines.map((line, index) => {
        const lineNumber = index + 1;
        const field = line.field;
        const interactive = Boolean(field && (side === "source" || field.expectsMapping));
        const displayPath = field ? getDisplayPath(field) : "";
        const match = normalizedSearch
          ? `${line.text} ${displayPath}`.toLowerCase().includes(normalizedSearch)
          : false;
        const selected = field ? selectedFieldId === field.id : false;
        const active = field ? activeFieldIds.has(field.id) : false;
        const mapped = field ? mappedFieldIds.has(field.id) : false;
        const glow = field ? Boolean(glowFieldIds?.has(field.id)) : false;
        const expectsMapping = field?.expectsMapping ?? false;
        const dimmed = side === "target" && Boolean(field) && !expectsMapping;
        const anchor =
          field && (selected || active || mapped)
            ? side
            : null;

        return (
          <JsonClickableToken
            key={line.id}
            ref={field ? getFieldRef?.(field) : undefined}
            lineNumber={lineNumber}
            depth={line.depth}
            interactive={interactive}
            selected={selected}
            active={active}
            mapped={mapped}
            glow={glow}
            dimmed={dimmed}
            invalid={side === "target" && Boolean(field) && !expectsMapping}
            match={match}
            anchor={anchor}
            onClick={field ? () => onFieldClick?.(field) : undefined}
            onMouseEnter={field ? () => onFieldHover?.(field) : undefined}
            onMouseLeave={field ? () => onFieldHover?.(null) : undefined}
            ariaLabel={field ? `${side === "source" ? "Response" : "Request"} field ${displayPath}` : undefined}
          >
            {line.kind === "leaf" ? (
              <>
                {line.keyLabel ? (
                  <>
                    <span className={styles.jsonKeyToken}>"{line.keyLabel}"</span>
                    <span className={styles.jsonPunctuation}>: </span>
                  </>
                ) : null}
                {field?.expectsMapping && side === "target" ? (
                  <MapPlaceholderHighlighter
                    expectsMapping={true}
                    mapped={mapped}
                    active={selected || active}
                    value={field.value}
                  />
                ) : (
                  <span className={valueClassName(field?.value ?? "")}>{formatLeafValue(field?.value ?? "")}</span>
                )}
                {line.comma ? <span className={styles.jsonPunctuation}>,</span> : null}
              </>
            ) : line.kind === "open" ? (
              <>
                {line.keyLabel ? (
                  <>
                    <span className={styles.jsonKeyToken}>"{line.keyLabel}"</span>
                    <span className={styles.jsonPunctuation}>: </span>
                  </>
                ) : null}
                <span className={styles.jsonPunctuation}>{line.bracket}</span>
              </>
            ) : (
              <>
                <span className={styles.jsonPunctuation}>{line.bracket}</span>
                {line.comma ? <span className={styles.jsonPunctuation}>,</span> : null}
              </>
            )}
          </JsonClickableToken>
        );
      })}
    </div>
  );
}

function buildCodeLines<TField extends BaseField>(nodes: Array<JsonFieldTreeNode<TField>>): Array<CodeLine<TField>> {
  const lines: Array<CodeLine<TField>> = [];
  const root = normalizeRoot(nodes);

  if (root.kind === "primitive" && root.node?.field) {
    lines.push({
      id: `${root.node.id}:leaf`,
      depth: 0,
      kind: "leaf",
      text: `${root.node.label} ${root.node.preview}`,
      comma: false,
      field: root.node.field,
      keyLabel: undefined,
    });
    return lines;
  }

  lines.push({
    id: "root-open",
    depth: 0,
    kind: "open",
    text: root.kind,
    comma: false,
    bracket: root.kind === "array" ? "[" : "{",
  });
  root.nodes.forEach((node, index) => {
    appendNode(lines, node, 1, index === root.nodes.length - 1);
  });
  lines.push({
    id: "root-close",
    depth: 0,
    kind: "close",
    text: root.kind,
    comma: false,
    bracket: root.kind === "array" ? "]" : "}",
  });
  return lines;
}

function appendNode<TField extends BaseField>(
  lines: Array<CodeLine<TField>>,
  node: JsonFieldTreeNode<TField>,
  depth: number,
  last: boolean,
) {
  const keyLabel = isArrayLabel(node.label) ? undefined : node.label;

  if (node.children.length > 0) {
    const isArray = node.preview.startsWith("Array");
    lines.push({
      id: `${node.id}:open`,
      depth,
      kind: "open",
      text: `${node.label} ${node.preview}`,
      comma: false,
      bracket: isArray ? "[" : "{",
      keyLabel,
    });
    node.children.forEach((child, index) => appendNode(lines, child, depth + 1, index === node.children.length - 1));
    lines.push({
      id: `${node.id}:close`,
      depth,
      kind: "close",
      text: `${node.label} ${node.preview}`,
      comma: !last,
      bracket: isArray ? "]" : "}",
    });
    return;
  }

  lines.push({
    id: `${node.id}:leaf`,
    depth,
    kind: "leaf",
    text: `${node.label} ${node.preview}`,
    comma: !last,
    keyLabel,
    field: node.field,
  });
}

function normalizeRoot<TField extends BaseField>(nodes: Array<JsonFieldTreeNode<TField>>) {
  if (nodes.length === 1 && nodes[0].label === "body" && nodes[0].children.length > 0) {
    return {
      kind: nodes[0].preview.startsWith("Array") ? "array" as const : "object" as const,
      nodes: nodes[0].children,
    };
  }
  if (nodes.length === 1 && nodes[0].label === "body" && nodes[0].field) {
    return {
      kind: "primitive" as const,
      node: nodes[0],
      nodes: [],
    };
  }
  if (nodes.length > 0 && nodes.every((node) => isArrayLabel(node.label))) {
    return {
      kind: "array" as const,
      nodes,
    };
  }
  return {
    kind: "object" as const,
    nodes,
  };
}

function isArrayLabel(label: string) {
  return /^\[\d+\]$/.test(label);
}

function formatLeafValue(value: string) {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "true" || trimmed === "false" || /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }
  return `"${value}"`;
}

function valueClassName(value: string) {
  const trimmed = value.trim();
  if (trimmed === "null") {
    return styles.jsonNullToken;
  }
  if (trimmed === "true" || trimmed === "false") {
    return styles.jsonBooleanToken;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return styles.jsonNumberToken;
  }
  return styles.jsonStringToken;
}
