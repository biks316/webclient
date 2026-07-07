import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { RunResponse } from "../../types/bik";
import { MappingSourceField, JsonFieldTreeNode } from "./mappingBuilderTypes";
import { JsonTreeRow } from "./JsonTreeRow";
import { ResponseStatusBar } from "./ResponseStatusBar";
import styles from "./MappingBuilderModal.module.css";

interface PreviousResponseJsonTreeProps {
  response: RunResponse | null;
  responseAvailable: boolean;
  loading: boolean;
  bodyTree: Array<JsonFieldTreeNode<MappingSourceField>>;
  extraFields: MappingSourceField[];
  search: string;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId: string | null;
  collapsed: boolean;
  selectedSource?: MappingSourceField | null;
  getFieldRef?: (field: MappingSourceField) => (node: HTMLButtonElement | null) => void;
  onToggleCollapse: () => void;
  onSearchChange: (value: string) => void;
  onRunSourceNode: () => void;
  onSelectField: (field: MappingSourceField) => void;
  onHoverField: (field: MappingSourceField | null) => void;
}

export function PreviousResponseJsonTree({
  response,
  responseAvailable,
  loading,
  bodyTree,
  extraFields,
  search,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  collapsed,
  selectedSource,
  getFieldRef,
  onToggleCollapse,
  onSearchChange,
  onRunSourceNode,
  onSelectField,
  onHoverField,
}: PreviousResponseJsonTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root", "body", "extras"]));
  const normalizedSearch = search.trim().toLowerCase();

  useEffect(() => {
    if (normalizedSearch) {
      setExpanded(collectAllExpandable(bodyTree, extraFields));
    }
  }, [bodyTree, extraFields, normalizedSearch]);

  const treeRoot = useMemo(
    () => normalizeSourceTree(bodyTree),
    [bodyTree],
  );

  if (collapsed) {
    return (
      <section className={styles.leftCollapsedPanel}>
        <button type="button" className={styles.collapseButton} onClick={onToggleCollapse}>Expand</button>
        <div className={styles.collapsedSelectionCard}>
          <strong>Selected Source</strong>
          {selectedSource ? (
            <>
              <span>{selectedSource.path.replace("$.response.", "")}</span>
              <small title={selectedSource.value}>{selectedSource.value}</small>
            </>
          ) : (
            <small>No source selected</small>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.mappingPanel}>
      <header className={styles.mappingPanelHeader}>
        <div>
          <strong>Previous Response</strong>
          <span>Compact response explorer</span>
        </div>
        <button type="button" className={styles.collapseButton} onClick={onToggleCollapse}>Collapse</button>
      </header>

      <ResponseStatusBar response={response} loading={loading} onRun={onRunSourceNode} />

      <label className={styles.searchField}>
        <Search size={14} />
        <input value={search} placeholder="Search response..." onChange={(event) => onSearchChange(event.currentTarget.value)} />
      </label>

      {!responseAvailable && !loading ? (
        <div className={styles.compactEmptyState}>
          <strong>No response yet</strong>
          <button type="button" className={styles.ghostActionButton} onClick={onRunSourceNode}>Run Source Node</button>
        </div>
      ) : (
        <div className={styles.jsonTreePanel}>
          <JsonTreeRow
            depth={0}
            label="root"
            value=""
            expandable
            expanded={expanded.has("root")}
            onToggle={() => toggleExpanded("root", setExpanded)}
          />
          {expanded.has("root") ? (
            <div className={styles.jsonTreeGroup}>
              <JsonTreeRow
                depth={1}
                label="body"
                value=""
                expandable
                expanded={expanded.has("body")}
                onToggle={() => toggleExpanded("body", setExpanded)}
              />
              {expanded.has("body") ? (
                <div className={styles.jsonTreeGroup}>
                  {treeRoot.map((node) => (
                    <SourceNodeBranch
                      key={node.id}
                      node={node}
                      depth={2}
                      expanded={expanded}
                      mappedFieldIds={mappedFieldIds}
                      activeFieldIds={activeFieldIds}
                      selectedFieldId={selectedFieldId}
                      getFieldRef={getFieldRef}
                      onToggle={(path) => toggleExpanded(path, setExpanded)}
                      onSelectField={onSelectField}
                      onHoverField={onHoverField}
                    />
                  ))}
                </div>
              ) : null}

              <JsonTreeRow
                depth={1}
                label="response extras"
                value=""
                expandable
                expanded={expanded.has("extras")}
                onToggle={() => toggleExpanded("extras", setExpanded)}
              />
              {expanded.has("extras") ? (
                <div className={styles.jsonTreeGroup}>
                  {extraFields.map((field) => (
                    <JsonTreeRow
                      ref={getFieldRef?.(field)}
                      key={field.id}
                      depth={2}
                      label={field.path.replace("$.response.", "")}
                      value={field.value}
                      interactive
                      selected={selectedFieldId === field.id}
                      active={activeFieldIds.has(field.id)}
                      mapped={mappedFieldIds.has(field.id)}
                      onClick={() => onSelectField(field)}
                      onMouseEnter={() => onHoverField(field)}
                      onMouseLeave={() => onHoverField(null)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SourceNodeBranch({
  node,
  depth,
  expanded,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  getFieldRef,
  onToggle,
  onSelectField,
  onHoverField,
}: {
  node: JsonFieldTreeNode<MappingSourceField>;
  depth: number;
  expanded: Set<string>;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId: string | null;
  getFieldRef?: (field: MappingSourceField) => (node: HTMLButtonElement | null) => void;
  onToggle: (path: string) => void;
  onSelectField: (field: MappingSourceField) => void;
  onHoverField: (field: MappingSourceField | null) => void;
}) {
  if (node.children.length > 0) {
    return (
      <>
        <JsonTreeRow
          depth={depth}
          label={node.label}
          value=""
          expandable
          expanded={expanded.has(node.path)}
          onToggle={() => onToggle(node.path)}
        />
        {expanded.has(node.path) ? (
          <div className={styles.jsonTreeGroup}>
            {node.children.map((child) => (
              <SourceNodeBranch
                key={child.id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                mappedFieldIds={mappedFieldIds}
                activeFieldIds={activeFieldIds}
                selectedFieldId={selectedFieldId}
                getFieldRef={getFieldRef}
                onToggle={onToggle}
                onSelectField={onSelectField}
                onHoverField={onHoverField}
              />
            ))}
          </div>
        ) : null}
      </>
    );
  }

  if (!node.field) {
    return null;
  }

  return (
    <JsonTreeRow
      ref={getFieldRef?.(node.field)}
      depth={depth}
      label={node.label}
      value={node.field.value}
      interactive
      selected={selectedFieldId === node.field.id}
      active={activeFieldIds.has(node.field.id)}
      mapped={mappedFieldIds.has(node.field.id)}
      onClick={() => onSelectField(node.field!)}
      onMouseEnter={() => onHoverField(node.field!)}
      onMouseLeave={() => onHoverField(null)}
    />
  );
}

function toggleExpanded(path: string, setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>) {
  setExpanded((current) => {
    const next = new Set(current);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return next;
  });
}

function collectAllExpandable(nodes: Array<JsonFieldTreeNode<MappingSourceField>>, extraFields: MappingSourceField[]) {
  const next = new Set<string>(["root", "body"]);
  if (extraFields.length > 0) {
    next.add("extras");
  }
  const visit = (node: JsonFieldTreeNode<MappingSourceField>) => {
    if (node.children.length > 0) {
      next.add(node.path);
      node.children.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return next;
}

function normalizeSourceTree(nodes: Array<JsonFieldTreeNode<MappingSourceField>>) {
  if (nodes.length === 1 && nodes[0].label === "body" && nodes[0].children.length > 0) {
    return nodes[0].children;
  }
  return nodes;
}
