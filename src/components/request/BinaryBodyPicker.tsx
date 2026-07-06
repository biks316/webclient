import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FileRef } from "../../types/bik";
import { createFileRef } from "../../services/requestBody";
import styles from "./BodyEditor.module.css";

interface BinaryBodyPickerProps {
  value: FileRef | null | undefined;
  onChange: (value: FileRef | null) => void;
}

export function BinaryBodyPicker({ value, onChange }: BinaryBodyPickerProps) {
  async function chooseFile() {
    const selected = await openDialog({ directory: false, multiple: false });
    if (typeof selected !== "string") {
      return;
    }
    onChange(createFileRef(selected));
  }

  return (
    <section className={styles.binaryWrap}>
      <div className={styles.binaryCard}>
        <strong>Binary payload</strong>
        <span>{value ? value.name : "No file selected"}</span>
        <small>{value?.path ?? "Choose a file to send as the raw request body."}</small>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => void chooseFile()}>{value ? "Change file" : "Choose file"}</button>
          {value ? <button type="button" onClick={() => onChange(null)}>Clear</button> : null}
        </div>
      </div>
    </section>
  );
}
