import { ForwardedRef, KeyboardEvent, SyntheticEvent, forwardRef, useLayoutEffect } from "react";
import styles from "./CopilotComposer.module.css";

interface CopilotPromptTextareaProps {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect: (event: SyntheticEvent<HTMLTextAreaElement>) => void;
}

function CopilotPromptTextareaInner({
  value,
  disabled = false,
  placeholder = "Ask BikAPI or drag context here...",
  onChange,
  onKeyDown,
  onSelect,
}: CopilotPromptTextareaProps, ref: ForwardedRef<HTMLTextAreaElement>) {
  useLayoutEffect(() => {
    const element = typeof ref === "function" ? null : ref?.current;
    if (!element) {
      return;
    }
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }, [ref, value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      disabled={disabled}
      className={styles.textarea}
      placeholder={placeholder}
      aria-label="Copilot prompt"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onClick={onSelect}
      onKeyUp={onSelect}
      onSelect={onSelect}
    />
  );
}

export const CopilotPromptTextarea = forwardRef(CopilotPromptTextareaInner);
