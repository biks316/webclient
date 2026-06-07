import { Wand2 } from "lucide-react";
import { JsonEditor } from "../common/JsonEditor";
import { VariableContext } from "../../services/variableResolver";
import styles from "./BodyEditor.module.css";

interface BodyEditorProps {
  bodyText: string;
  bodyError: string | null;
  variableContext?: VariableContext;
  onChange: (value: string) => void;
  onFormat: () => void;
}

export function BodyEditor({ bodyText, bodyError, variableContext, onChange, onFormat }: BodyEditorProps) {
  return (
    <section className={styles.editor}>
      <div className={styles.header}>
        <button type="button" onClick={onFormat}>
          <Wand2 size={14} />
          Pretty JSON
        </button>
      </div>
      {bodyError && <div className={styles.error}>{bodyError}</div>}
      <div className={styles.surface}>
        <JsonEditor
          value={bodyText}
          variableContext={variableContext}
          onChange={onChange}
          fontSize={13}
          lineHeight={20}
        />
      </div>
    </section>
  );
}
