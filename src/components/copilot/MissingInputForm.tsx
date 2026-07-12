import { FormEvent, useState } from "react";
import { CopilotMissingInputCard } from "../../types/copilot";
import styles from "./MissingInputForm.module.css";

interface MissingInputFormProps {
  card: CopilotMissingInputCard;
  onSubmit: (values: Record<string, string>) => void;
}

export function MissingInputForm({ card, onSubmit }: MissingInputFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <strong>{card.title}</strong>
      {card.description ? <p>{card.description}</p> : null}
      <div className={styles.fields}>
        {card.fields.map((field) => (
          <label key={field.id} className={styles.field}>
            <span>{field.label}</span>
            <input
              value={values[field.id] ?? ""}
              placeholder={field.placeholder}
              required={field.required}
              onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className={styles.actions}>
        <button type="submit">{card.submitLabel || "Continue"}</button>
      </div>
    </form>
  );
}
