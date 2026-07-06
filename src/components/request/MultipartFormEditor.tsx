import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { VariableContext } from "../../services/variableResolver";
import { RequestMultipartField } from "../../types/bik";
import { createFileRef } from "../../services/requestBody";
import { VariableInput } from "../variables/VariableInput";
import styles from "./BodyEditor.module.css";

interface MultipartFormEditorProps {
  values: RequestMultipartField[];
  variableContext?: VariableContext;
  onChange: (values: RequestMultipartField[]) => void;
}

export function MultipartFormEditor({ values, variableContext, onChange }: MultipartFormEditorProps) {
  async function chooseFile(index: number) {
    const selected = await openDialog({ directory: false, multiple: false });
    if (typeof selected !== "string") {
      return;
    }
    patch(index, { file: createFileRef(selected) });
  }

  function patch(index: number, patchValue: Partial<RequestMultipartField>) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, ...patchValue } : item));
  }

  function addRow() {
    onChange([...values, { enabled: true, key: "", kind: "text", value: "", description: "" }]);
  }

  function removeRow(index: number) {
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className={styles.tableWrap}>
      <div className={styles.formHint}>Multipart form fields. File fields use the chosen local path at send time.</div>
      <div className={styles.multipartTable}>
        <div className={styles.multipartHead}>
          <span>On</span>
          <span>Key</span>
          <span>Type</span>
          <span>Value</span>
          <span>Description</span>
          <span />
        </div>
        {values.map((field, index) => (
          <div key={`${field.key}-${index}`} className={styles.multipartRow}>
            <input type="checkbox" checked={field.enabled} onChange={(event) => patch(index, { enabled: event.currentTarget.checked })} />
            <input value={field.key} placeholder="avatar" onChange={(event) => patch(index, { key: event.currentTarget.value })} />
            <select
              value={field.kind}
              onChange={(event) => patch(index, {
                kind: event.currentTarget.value as RequestMultipartField["kind"],
                value: event.currentTarget.value === "text" ? field.value ?? "" : undefined,
              })}
            >
              <option value="text">Text</option>
              <option value="file">File</option>
            </select>
            {field.kind === "file" ? (
              <div className={styles.fileCell}>
                <button type="button" onClick={() => void chooseFile(index)}>Choose file</button>
                <small>{field.file?.name ?? "No file selected"}</small>
              </div>
            ) : variableContext ? (
              <VariableInput value={field.value ?? ""} variableContext={variableContext} placeholder="->map" onChange={(value) => patch(index, { value })} />
            ) : (
              <input value={field.value ?? ""} placeholder="value" onChange={(event) => patch(index, { value: event.currentTarget.value })} />
            )}
            <input value={field.description ?? ""} placeholder="Description" onChange={(event) => patch(index, { description: event.currentTarget.value })} />
            <button type="button" onClick={() => removeRow(index)}>x</button>
          </div>
        ))}
      </div>
      <button type="button" className="subtle" onClick={addRow}>Add row</button>
    </section>
  );
}
