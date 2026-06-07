import { MutableRefObject, useEffect, useRef, useState } from "react";
import { VariableContext } from "../services/variableResolver";
import { VariableInput } from "./variables/VariableInput";

interface KeyValueEditorProps {
  values: Record<string, string>;
  keyPlaceholder: string;
  valuePlaceholder: string;
  variableContext?: VariableContext;
  onChange: (values: Record<string, string>) => void;
}

interface KeyValueRow {
  id: string;
  keyName: string;
  value: string;
}

export function KeyValueEditor({
  values,
  keyPlaceholder,
  valuePlaceholder,
  variableContext,
  onChange,
}: KeyValueEditorProps) {
  const nextIdRef = useRef(0);
  const [rows, setRows] = useState<KeyValueRow[]>(() => buildRows(values, nextIdRef));

  useEffect(() => {
    setRows((current) => reconcileRows(current, values, nextIdRef));
  }, [values]);

  function emitRows(nextRows: KeyValueRow[]) {
    setRows(nextRows);
    onChange(rowsToValues(nextRows));
  }

  function replaceKey(rowId: string, nextKeyName: string) {
    emitRows(
      rows.map((row) =>
        row.id === rowId
          ? { ...row, keyName: nextKeyName }
          : row,
      ),
    );
  }

  function replaceValue(rowId: string, nextValue: string) {
    emitRows(
      rows.map((row) =>
        row.id === rowId
          ? { ...row, value: nextValue }
          : row,
      ),
    );
  }

  function addRow() {
    let keyName = "key";
    let index = 2;
    const usedKeys = new Set(rows.map((row) => row.keyName).filter(Boolean));
    while (usedKeys.has(keyName)) {
      keyName = `key${index}`;
      index += 1;
    }

    emitRows([
      ...rows,
      {
        id: `row-${nextIdRef.current++}`,
        keyName,
        value: "",
      },
    ]);
  }

  function removeRow(rowId: string) {
    emitRows(rows.filter((row) => row.id !== rowId));
  }

  return (
    <div className="kv-editor">
      {rows.map((row) => (
        <div className="kv-row" key={row.id}>
          <input
            value={row.keyName}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={keyPlaceholder}
            onChange={(event) => replaceKey(row.id, event.target.value)}
          />
          {variableContext ? (
            <VariableInput
              value={row.value}
              variableContext={variableContext}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={valuePlaceholder}
              onChange={(value) => replaceValue(row.id, value)}
            />
          ) : (
            <input
              value={row.value}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={valuePlaceholder}
              onChange={(event) => replaceValue(row.id, event.target.value)}
            />
          )}
          <button type="button" title="Remove" onClick={() => removeRow(row.id)}>
            x
          </button>
        </div>
      ))}
      <button type="button" className="subtle" onClick={addRow}>
        Add row
      </button>
    </div>
  );
}

function buildRows(values: Record<string, string>, nextIdRef: MutableRefObject<number>): KeyValueRow[] {
  return Object.entries(values).map(([keyName, value]) => ({
    id: `row-${nextIdRef.current++}`,
    keyName,
    value,
  }));
}

function reconcileRows(
  currentRows: KeyValueRow[],
  values: Record<string, string>,
  nextIdRef: MutableRefObject<number>,
): KeyValueRow[] {
  const remaining = new Map(currentRows.map((row) => [row.keyName, row]));
  return Object.entries(values).map(([keyName, value]) => {
    const existing = remaining.get(keyName);
    if (existing) {
      remaining.delete(keyName);
      return existing.value === value ? existing : { ...existing, value };
    }

    return {
      id: `row-${nextIdRef.current++}`,
      keyName,
      value,
    };
  });
}

function rowsToValues(rows: KeyValueRow[]) {
  const next: Record<string, string> = {};
  for (const row of rows) {
    const keyName = row.keyName.trim();
    if (!keyName) {
      continue;
    }
    next[keyName] = row.value;
  }
  return next;
}
