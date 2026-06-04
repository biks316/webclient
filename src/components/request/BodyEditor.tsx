import { Wand2 } from "lucide-react";
import { JsonEditor } from "../common/JsonEditor";
import styles from "./BodyEditor.module.css";

interface BodyEditorProps {
  bodyText: string;
  bodyError: string | null;
  onChange: (value: string) => void;
  onFormat: () => void;
}

export function BodyEditor({ bodyText, bodyError, onChange, onFormat }: BodyEditorProps) {
  return (
    <section className={styles.editor}>
      <div className={styles.header}>
        <div>
          <strong>Body</strong>
          <span>JSON request payload</span>
        </div>
        <button type="button" onClick={onFormat}>
          <Wand2 size={14} />
          Pretty JSON
        </button>
      </div>
      {bodyError && <div className={styles.error}>{bodyError}</div>}
      <div className={styles.surface}>
        <JsonEditor value={bodyText} onChange={onChange} />
      </div>
    </section>
  );
}
