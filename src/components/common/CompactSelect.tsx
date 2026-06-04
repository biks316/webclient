import { ChevronDown, Check } from "lucide-react";
import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./CompactSelect.module.css";

interface CompactSelectOption {
  value: string;
  label: string;
}

interface CompactSelectProps {
  value: string;
  options: CompactSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

interface MenuPosition {
  top: number;
  left: number;
  minWidth: number;
}

export function CompactSelect({
  value,
  options,
  placeholder = "Select",
  className,
  disabled = false,
  onChange,
}: CompactSelectProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleReposition() {
      if (!triggerRef.current) {
        return;
      }
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
      });
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  const popoverStyle: CSSProperties | undefined = position
    ? {
        top: position.top,
        left: position.left,
        minWidth: position.minWidth,
      }
    : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, className].filter(Boolean).join(" ")}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.label}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={12} />
      </button>
      {open &&
        position &&
        createPortal(
          <div ref={popoverRef} className={styles.popover} style={popoverStyle} role="listbox">
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.option} ${active ? styles.optionActive : ""}`}
                  onClick={() => {
                    setOpen(false);
                    onChange(option.value);
                  }}
                >
                  <span>{option.label}</span>
                  {active && <Check size={12} />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
