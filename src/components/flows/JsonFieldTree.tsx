import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { JsonFieldTreeNode } from "./mappingBuilderTypes";
import styles from "./MappingBuilderModal.module.css";

interface JsonFieldTreeProps<TField extends { id: string; label: string; value: string; expectsMapping?: boolean }> {
  nodes: Array<JsonFieldTreeNode<TField>>;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId?: string | null;
  getFieldRef?: (field: TField) => (node: HTMLButtonElement | null) => void;
  onFieldClick?: (field: TField) => void;
  onFieldHover?: (field: TField | null) => void;
}

export function JsonFieldTree<TField extends { id: string; label: string; value: string; expectsMapping?: boolean }>({
  nodes,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  getFieldRef,
  onFieldClick,
  onFieldHover,
}: JsonFieldTreeProps<TField>) {
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
          expandedPaths={expandedPaths}
          mappedFieldIds={mappedFieldIds}
          activeFieldIds={activeFieldIds}
          selectedFieldId={selectedFieldId}
          getFieldRef={getFieldRef}
          onToggle={toggle}
          onFieldClick={onFieldClick}
          onFieldHover={onFieldHover}
        />
      ))}
    </ul>
  );
}

function TreeNode<TField extends { id: string; label: string; value: string; expectsMapping?: boolean }>({
  node,
  expandedPaths,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  getFieldRef,
  onToggle,
  onFieldClick,
  onFieldHover,
}: {
  node: JsonFieldTreeNode<TField>;
  expandedPaths: Set<string>;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId?: string | null;
  getFieldRef?: (field: TField) => (node: HTMLButtonElement | null) => void;
  onToggle: (path: string) => void;
  onFieldClick?: (field: TField) => void;
  onFieldHover?: (field: TField | null) => void;
}) {
  const expanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const field = node.field;
  const isMapped = field ? mappedFieldIds.has(field.id) : false;
  const isActive = field ? activeFieldIds.has(field.id) : false;
  const isSelected = field ? selectedFieldId === field.id : false;

  return (
    <li className={styles.jsonTreeNode}>
      <div className={styles.jsonTreeRow}>
        {hasChildren ? (
          <button type="button" className={styles.jsonTreeToggle} onClick={() => onToggle(node.path)}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className={styles.jsonTreeSpacer} />
        )}
        {field ? (
          <button
            ref={getFieldRef?.(field)}
            type="button"
            className={`${styles.jsonFieldButton} ${isMapped ? styles.jsonFieldMapped : ""} ${isActive ? styles.jsonFieldActive : ""} ${isSelected ? styles.jsonFieldSelected : ""}`}
            onClick={() => onFieldClick?.(field)}
            onMouseEnter={() => onFieldHover?.(field)}
            onMouseLeave={() => onFieldHover?.(null)}
          >
            <span className={styles.jsonFieldLabel}>
              {node.label}
              {field.expectsMapping && <small className={styles.mapPlaceholderBadge}>map</small>}
            </span>
            <em>{node.preview}</em>
            {isMapped && <Check size={13} />}
          </button>
        ) : (
          <div className={styles.jsonBranchLabel}>
            <span>{node.label}</span>
            <em>{node.preview}</em>
          </div>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className={styles.jsonTreeChildren}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expandedPaths={expandedPaths}
              mappedFieldIds={mappedFieldIds}
              activeFieldIds={activeFieldIds}
              selectedFieldId={selectedFieldId}
              getFieldRef={getFieldRef}
              onToggle={onToggle}
              onFieldClick={onFieldClick}
              onFieldHover={onFieldHover}
            />
          ))}
        </ul>
      )}
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
