import { VariableContext } from "../../services/variableResolver";
import { RequestFormField } from "../../types/bik";
import { VariableInput } from "../variables/VariableInput";
import styles from "./BodyEditor.module.css";

interface UrlEncodedFormEditorProps {
  values: RequestFormField[];
  variableContext?: VariableContext;
  onChange: (values: RequestFormField[]) => void;
}

export function UrlEncodedFormEditor({ values, variableContext, onChange }: UrlEncodedFormEditorProps) {
  return (
    <section className={styles.tableWrap}>
      <div className={styles.formHint}>Serialized as `application/x-www-form-urlencoded`.</div>
      <FormTable
        values={values}
        variableContext={variableContext}
        onChange={onChange}
      />
    </section>
  );
}

function FormTable({
  values,
  variableContext,
  onChange,
}: {
  values: RequestFormField[];
  variableContext?: VariableContext;
  onChange: (values: RequestFormField[]) => void;
}) {
  function patch(index: number, patch: Partial<RequestFormField>) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addRow() {
    onChange([...values, { enabled: true, key: "", value: "", description: "" }]);
  }

  function removeRow(index: number) {
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className={styles.formTable}>
      <div className={styles.formTableHead}>
        <span>On</span>
        <span>Key</span>
        <span>Value</span>
        <span>Description</span>
        <span />
      </div>
      {values.map((field, index) => (
        <div key={`${field.key}-${index}`} className={styles.formRow}>
          <input type="checkbox" checked={field.enabled} onChange={(event) => patch(index, { enabled: event.currentTarget.checked })} />
          <input value={field.key} placeholder="userId" onChange={(event) => patch(index, { key: event.currentTarget.value })} />
          {variableContext ? (
            <VariableInput value={field.value} variableContext={variableContext} placeholder="->map" onChange={(value) => patch(index, { value })} />
          ) : (
            <input value={field.value} placeholder="value" onChange={(event) => patch(index, { value: event.currentTarget.value })} />
          )}
          <input value={field.description ?? ""} placeholder="Description" onChange={(event) => patch(index, { description: event.currentTarget.value })} />
          <button type="button" onClick={() => removeRow(index)}>x</button>
        </div>
      ))}
      <button type="button" className="subtle" onClick={addRow}>Add row</button>
    </div>
  );
}
