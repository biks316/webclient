import { InputHTMLAttributes, KeyboardEvent, useMemo, useState } from "react";
import { extractVariableNames, VariableContext } from "../../services/variableResolver";
import { useVariableResolver } from "./useVariableResolver";
import { VariableAutocomplete } from "./VariableAutocomplete";
import { VariableToken } from "./VariableToken";
import styles from "./Variables.module.css";

interface VariableInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  variableContext: VariableContext;
  onChange: (value: string) => void;
}

export function VariableInput({ value, variableContext, onChange, className, onKeyDown, ...props }: VariableInputProps) {
  const { entries } = useVariableResolver(variableContext);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const variableQuery = useMemo(() => {
    const beforeCursor = value;
    const start = beforeCursor.lastIndexOf("{{");
    if (start < 0) {
      return null;
    }
    const after = beforeCursor.slice(start + 2);
    if (after.includes("}}") || /\s/.test(after)) {
      return null;
    }
    return after;
  }, [value]);
  const names = extractVariableNames(value);
  const matches = entries.filter((entry) => entry.name.toLowerCase().includes((variableQuery ?? "").toLowerCase()));

  function insertVariable(name: string) {
    const start = value.lastIndexOf("{{");
    const prefix = start >= 0 ? value.slice(0, start) : value;
    onChange(`${prefix}{{${name}}}`);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (open && matches.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        insertVariable(matches[activeIndex]?.name ?? matches[0].name);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(event);
  }

  return (
    <div className={styles.variableInput}>
      <input
        {...props}
        className={className}
        value={value}
        onChange={(event) => {
          const next = event.currentTarget.value;
          onChange(next);
          setOpen(next.includes("{{") && variableQuery !== null);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />
      {open && variableQuery !== null && (
        <VariableAutocomplete
          entries={entries}
          filter={variableQuery}
          activeIndex={activeIndex}
          onSelect={(entry) => insertVariable(entry.name)}
        />
      )}
      {names.length > 0 && (
        <div className={styles.tokenRow}>
          {names.map((name) => <VariableToken key={name} name={name} context={variableContext} />)}
        </div>
      )}
    </div>
  );
}
