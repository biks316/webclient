import { CollectionAutomation } from "../../types/bik";
import { JsonEditor } from "../common/JsonEditor";
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
          <div className={styles.editorSurface}>
            <JsonEditor
              language="javascript"
              value={automation.test}
              onChange={(value) => onChange({ ...automation, test: value })}
            />
          </div>
        </label>
        <label>
          <span>assert.js</span>
          <div className={styles.editorSurface}>
            <JsonEditor
              language="javascript"
              value={automation.assert}
              onChange={(value) => onChange({ ...automation, assert: value })}
            />
          </div>
        </label>
      </div>
    </section>
  );
}
