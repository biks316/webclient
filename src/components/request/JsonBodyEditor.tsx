import { Wand2 } from "lucide-react";
import { JsonEditor } from "../common/JsonEditor";
import { VariableContext } from "../../services/variableResolver";
import styles from "./BodyEditor.module.css";

interface JsonBodyEditorProps {
  value: string;
  error: string | null;
  variableContext?: VariableContext;
  onChange: (value: string) => void;
  onFormat: () => void;
}

export function JsonBodyEditor({ value, error, variableContext, onChange, onFormat }: JsonBodyEditorProps) {
  return (
    <section className={styles.bodyPane}>
      <div className={styles.headerActions}>
        <button type="button" onClick={onFormat}>
          <Wand2 size={14} />
          Pretty JSON
        </button>
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.surface}>
        <JsonEditor value={value} variableContext={variableContext} onChange={onChange} fontSize={13} lineHeight={20} />
      </div>
    </section>
  );
}
