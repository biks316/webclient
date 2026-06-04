import { Scripts } from "../../types/bik";
import { JsonEditor } from "../common/JsonEditor";
import styles from "./ScriptsEditor.module.css";

interface ScriptsEditorProps {
  scripts: Scripts;
  onChange: (next: Scripts) => void;
  onSave: () => void;
}

export function ScriptsEditor({ scripts, onChange, onSave }: ScriptsEditorProps) {
  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <strong>Scripts</strong>
          <span>Pre-request and post-response scripts</span>
        </div>
        <button type="button" onClick={onSave}>Save scripts</button>
      </div>
      <div className={styles.grid}>
        <label>
          <span>pre.js</span>
          <div className={styles.editorSurface}>
            <JsonEditor
              language="javascript"
              value={scripts.pre}
              onChange={(value) => onChange({ ...scripts, pre: value })}
            />
          </div>
        </label>
        <label>
          <span>post.js</span>
          <div className={styles.editorSurface}>
            <JsonEditor
              language="javascript"
              value={scripts.post}
              onChange={(value) => onChange({ ...scripts, post: value })}
            />
          </div>
        </label>
      </div>
    </section>
  );
}
