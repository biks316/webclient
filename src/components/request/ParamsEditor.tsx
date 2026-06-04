import { KeyValueEditor } from "../KeyValueEditor";
import styles from "./TableEditor.module.css";

interface ParamsEditorProps {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function ParamsEditor({ values, onChange }: ParamsEditorProps) {
  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <strong>Params</strong>
        <span>Query string key/value pairs</span>
      </div>
      <KeyValueEditor values={values} keyPlaceholder="page" valuePlaceholder="1" onChange={onChange} />
    </section>
  );
}
