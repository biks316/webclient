import { KeyValueEditor } from "../KeyValueEditor";
import { VariableContext } from "../../services/variableResolver";
import styles from "./TableEditor.module.css";

interface HeadersEditorProps {
  values: Record<string, string>;
  variableContext?: VariableContext;
  onChange: (values: Record<string, string>) => void;
}

export function HeadersEditor({ values, variableContext, onChange }: HeadersEditorProps) {
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
        variableContext={variableContext}
        onChange={onChange}
      />
    </section>
  );
}
