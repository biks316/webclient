import { JsonEditor } from "../common/JsonEditor";
import { VariableContext } from "../../services/variableResolver";
import styles from "./BodyEditor.module.css";

interface TextBodyEditorProps {
  value: string;
  variableContext?: VariableContext;
  onChange: (value: string) => void;
}

export function TextBodyEditor({ value, variableContext, onChange }: TextBodyEditorProps) {
  return (
    <section className={styles.bodyPane}>
      <div className={styles.surface}>
        <JsonEditor value={value} language="plaintext" variableContext={variableContext} onChange={onChange} fontSize={13} lineHeight={20} />
      </div>
    </section>
  );
}
