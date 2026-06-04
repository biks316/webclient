import { CollectionAutomation } from "../../types/bik";
import styles from "./TestsEditor.module.css";

interface TestsEditorProps {
  automation: CollectionAutomation;
  onChange: (next: CollectionAutomation) => void;
  onSave: () => void;
}

export function TestsEditor({ automation, onChange, onSave }: TestsEditorProps) {
  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <strong>Tests</strong>
          <span>Collection-level test and assert scripts for this request flow</span>
        </div>
        <button type="button" onClick={onSave}>Save tests</button>
      </div>
      <div className={styles.grid}>
        <label>
          <span>test.js</span>
          <textarea
            spellCheck={false}
            value={automation.test}
            onChange={(event) => onChange({ ...automation, test: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>assert.js</span>
          <textarea
            spellCheck={false}
            value={automation.assert}
            onChange={(event) => onChange({ ...automation, assert: event.currentTarget.value })}
          />
        </label>
      </div>
    </section>
  );
}
