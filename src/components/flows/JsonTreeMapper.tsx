import { useEffect, useMemo, useState } from "react";
import { JsonFieldTreeNode } from "./mappingBuilderTypes";
import { JsonFieldRow } from "./JsonFieldRow";
import styles from "./MappingBuilderModal.module.css";

interface JsonTreeMapperProps<TField extends { id: string; label: string; value: string; expectsMapping?: boolean; path?: string; targetPath?: string }> {
  nodes: Array<JsonFieldTreeNode<TField>>;
  mode: "source" | "target";
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId?: string | null;
  glowFieldIds?: Set<string>;
  getFieldRef?: (field: TField) => (node: HTMLButtonElement | null) => void;
  getDisplayPath: (field: TField) => string;
  onFieldClick?: (field: TField) => void;
  onFieldHover?: (field: TField | null) => void;
  onCopyPath?: (field: TField) => void;
}

export function JsonTreeMapper<TField extends { id: string; label: string; value: string; expectsMapping?: boolean; path?: string; targetPath?: string }>({
  nodes,
  mode,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  glowFieldIds,
  getFieldRef,
  getDisplayPath,
  onFieldClick,
  onFieldHover,
  onCopyPath,
}: JsonTreeMapperProps<TField>) {
  const defaultExpanded = useMemo(() => collectExpandablePaths(nodes), [nodes]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(defaultExpanded);

  useEffect(() => {
    setExpandedPaths(defaultExpanded);
  }, [defaultExpanded]);

  function toggle(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  return (
    <ul className={styles.jsonTree}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          mode={mode}
          expandedPaths={expandedPaths}
          mappedFieldIds={mappedFieldIds}
          activeFieldIds={activeFieldIds}
          selectedFieldId={selectedFieldId}
          glowFieldIds={glowFieldIds}
          getFieldRef={getFieldRef}
          getDisplayPath={getDisplayPath}
          onToggle={toggle}
          onFieldClick={onFieldClick}
          onFieldHover={onFieldHover}
          onCopyPath={onCopyPath}
        />
      ))}
    </ul>
  );
}

function TreeNode<TField extends { id: string; label: string; value: string; expectsMapping?: boolean; path?: string; targetPath?: string }>({
  node,
  mode,
  expandedPaths,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  glowFieldIds,
  getFieldRef,
  getDisplayPath,
  onToggle,
  onFieldClick,
  onFieldHover,
  onCopyPath,
}: {
  node: JsonFieldTreeNode<TField>;
  mode: "source" | "target";
  expandedPaths: Set<string>;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId?: string | null;
  glowFieldIds?: Set<string>;
  getFieldRef?: (field: TField) => (node: HTMLButtonElement | null) => void;
  getDisplayPath: (field: TField) => string;
  onToggle: (path: string) => void;
  onFieldClick?: (field: TField) => void;
  onFieldHover?: (field: TField | null) => void;
  onCopyPath?: (field: TField) => void;
}) {
  const expanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const field = node.field;

  return (
    <li className={styles.jsonTreeNode}>
      {field ? (
        <JsonFieldRow
          label={node.label}
          preview={node.preview}
          path={getDisplayPath(field)}
          mode={mode}
          mapped={mappedFieldIds.has(field.id)}
          active={activeFieldIds.has(field.id)}
          selected={selectedFieldId === field.id}
          glow={Boolean(glowFieldIds?.has(field.id))}
          expectsMapping={field.expectsMapping}
          buttonRef={getFieldRef?.(field)}
          onClick={() => onFieldClick?.(field)}
          onHoverChange={(hovered) => onFieldHover?.(hovered ? field : null)}
          onCopy={onCopyPath ? () => onCopyPath(field) : undefined}
          ariaLabel={`${mode === "source" ? "Response field" : "Target field"} ${getDisplayPath(field)}`}
        />
      ) : (
        <JsonFieldRow
          label={node.label}
          preview={node.preview}
          path={node.path}
          mode={mode}
          expandable={hasChildren}
          expanded={expanded}
          onToggle={() => onToggle(node.path)}
          ariaLabel={`${mode === "source" ? "Response" : "Target"} branch ${node.label}`}
        />
      )}
      {hasChildren && expanded ? (
        <ul className={styles.jsonTreeChildren}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              mode={mode}
              expandedPaths={expandedPaths}
              mappedFieldIds={mappedFieldIds}
              activeFieldIds={activeFieldIds}
              selectedFieldId={selectedFieldId}
              glowFieldIds={glowFieldIds}
              getFieldRef={getFieldRef}
              getDisplayPath={getDisplayPath}
              onToggle={onToggle}
              onFieldClick={onFieldClick}
              onFieldHover={onFieldHover}
              onCopyPath={onCopyPath}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function collectExpandablePaths<TField>(nodes: Array<JsonFieldTreeNode<TField>>) {
  const paths = new Set<string>();
  const visit = (node: JsonFieldTreeNode<TField>) => {
    if (node.children.length > 0) {
      paths.add(node.path);
      node.children.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return paths;
}
