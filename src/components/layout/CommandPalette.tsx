import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./CommandPalette.module.css";

export interface CommandPaletteCommand {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: CommandPaletteCommand[];
  onClose: () => void;
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    queueMicrotask(() => inputRef.current?.focus());
  }, [open]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return commands;
    }
    return commands.filter((command) =>
      `${command.label} ${command.hint ?? ""} ${command.shortcut ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) {
    return null;
  }

  const current = filtered[activeIndex] ?? null;

  function runCurrent(command: CommandPaletteCommand | null) {
    if (!command) {
      return;
    }
    onClose();
    command.run();
  }

  return (
    <div className="prompt-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((value) => Math.min(filtered.length - 1, value + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((value) => Math.max(0, value - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            runCurrent(current);
          }
        }}
      >
        <div className={styles.searchRow}>
          <Search size={14} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Type a command"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
        <div className={styles.results}>
          {filtered.map((command, index) => (
            <button
              key={command.id}
              type="button"
              className={`${styles.item} ${index === activeIndex ? styles.itemActive : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => runCurrent(command)}
            >
              <span className={styles.itemLabel}>{command.label}</span>
              <span className={styles.itemMeta}>{command.shortcut ?? command.hint ?? ""}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className={styles.empty}>No matching commands</div>}
        </div>
      </div>
    </div>
  );
}
