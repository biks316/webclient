import { Scripts } from "../../types/bik";
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
          <textarea
            spellCheck={false}
            value={scripts.pre}
            onChange={(event) => onChange({ ...scripts, pre: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>post.js</span>
          <textarea
            spellCheck={false}
            value={scripts.post}
            onChange={(event) => onChange({ ...scripts, post: event.currentTarget.value })}
          />
        </label>
      </div>
    </section>
  );
}
