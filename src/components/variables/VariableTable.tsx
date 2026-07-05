import { MouseEvent, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ManagedVariable, VariableSortKey } from "./VariableManagerTypes";
import { VariableGroup } from "./VariableGroup";
import { VariableRow } from "./VariableRow";
import styles from "./Variables.module.css";

interface VariableTableProps {
  variables: ManagedVariable[];
  maskedIds: Set<string>;
  sortKey: VariableSortKey;
  sortDirection: "asc" | "desc";
  onSort: (key: VariableSortKey) => void;
  onToggleMask: (id: string) => void;
  onToggleEnabled: (variable: ManagedVariable) => void;
  onEdit: (variable: ManagedVariable) => void;
  onCopy: (variable: ManagedVariable) => void;
  onDuplicate: (variable: ManagedVariable) => void;
  onDelete: (variable: ManagedVariable) => void;
  onUsage: (variable: ManagedVariable) => void;
}

const ROW_HEIGHT = 34;
const OVERSCAN = 8;

const COLUMNS: Array<{ key: VariableSortKey; label: string; className?: string }> = [
  { key: "enabled", label: "✓", className: styles.colCheck },
  { key: "name", label: "Name" },
  { key: "initialValue", label: "Initial Value" },
  { key: "currentValue", label: "Current Value" },
  { key: "description", label: "Description" },
  { key: "type", label: "Type" },
  { key: "usedCount", label: "Used" },
];

export function VariableTable({
  variables,
  maskedIds,
  sortKey,
  sortDirection,
  onSort,
  onToggleMask,
  onToggleEnabled,
  onEdit,
  onCopy,
  onDuplicate,
  onDelete,
  onUsage,
}: VariableTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; variable: ManagedVariable } | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<string, ManagedVariable[]>();
    variables.forEach((variable) => {
      const group = variable.group || "Variables";
      groups.set(group, [...(groups.get(group) ?? []), variable]);
    });
    return [...groups.entries()];
  }, [variables]);

  function renderSortIcon(key: VariableSortKey) {
    if (sortKey !== key) {
      return null;
    }
    return sortDirection === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  function visibleRows(rows: ManagedVariable[]) {
    const viewportHeight = scrollRef.current?.clientHeight ?? 520;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
    return {
      before: start * ROW_HEIGHT,
      after: Math.max(0, (rows.length - end) * ROW_HEIGHT),
      rows: rows.slice(start, end),
    };
  }

  function handleContextMenu(event: MouseEvent, variable: ManagedVariable) {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, variable });
  }

  if (variables.length === 0) {
    return null;
  }

  return (
    <div className={styles.managerTableShell} onClick={() => setContextMenu(null)}>
      <div className={styles.managerTableHeader}>
        {COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            className={column.className}
            onClick={() => onSort(column.key)}
          >
            <span>{column.label}</span>
            {renderSortIcon(column.key)}
          </button>
        ))}
        <span>Actions</span>
      </div>

      <div
        ref={scrollRef}
        className={styles.managerTableBody}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {grouped.map(([groupName, rows]) => {
          const open = openGroups[groupName] ?? true;
          const visible = visibleRows(rows);
          return (
            <VariableGroup
              key={groupName}
              name={groupName}
              count={rows.length}
              open={open}
              onToggle={() => setOpenGroups((current) => ({ ...current, [groupName]: !open }))}
            >
              <div style={{ height: visible.before }} />
              {visible.rows.map((variable) => (
                <VariableRow
                  key={variable.id}
                  variable={variable}
                  masked={maskedIds.has(variable.id)}
                  onToggleMask={onToggleMask}
                  onToggleEnabled={onToggleEnabled}
                  onEdit={onEdit}
                  onCopy={onCopy}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  onUsage={onUsage}
                  onContextMenu={handleContextMenu}
                />
              ))}
              <div style={{ height: visible.after }} />
            </VariableGroup>
          );
        })}
      </div>

      {contextMenu && (
        <div
          className={styles.managerContextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => onEdit(contextMenu.variable)}>Edit</button>
          <button type="button" onClick={() => onCopy(contextMenu.variable)}>Copy value</button>
          <button type="button" onClick={() => onDuplicate(contextMenu.variable)}>Duplicate</button>
          <button type="button" onClick={() => onDelete(contextMenu.variable)}>Delete</button>
        </div>
      )}
    </div>
  );
}
