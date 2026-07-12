import { FormEvent, useState } from "react";
import styles from "./PromptInput.module.css";

interface PromptInputProps {
  disabled?: boolean;
  onSubmit: (prompt: string) => void;
}

export function PromptInput({ disabled = false, onSubmit }: PromptInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = value.trim();
    if (!next) {
      return;
    }
    onSubmit(next);
    setValue("");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        value={value}
        placeholder="Ask BikAPI..."
        disabled={disabled}
        rows={3}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className={styles.actions}>
        <button type="submit" disabled={disabled || !value.trim()}>
          Send
        </button>
      </div>
    </form>
  );
}
