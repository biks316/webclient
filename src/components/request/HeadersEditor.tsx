import { KeyValueEditor } from "../KeyValueEditor";
import styles from "./TableEditor.module.css";

interface HeadersEditorProps {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function HeadersEditor({ values, onChange }: HeadersEditorProps) {
  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <strong>Headers</strong>
        <span>Configure request headers</span>
      </div>
      <KeyValueEditor
        values={values}
        keyPlaceholder="Content-Type"
        valuePlaceholder="application/json"
        onChange={onChange}
      />
    </section>
  );
}
