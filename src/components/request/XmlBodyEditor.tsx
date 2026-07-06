import { Wand2 } from "lucide-react";
import { JsonEditor } from "../common/JsonEditor";
import { VariableContext } from "../../services/variableResolver";
import styles from "./BodyEditor.module.css";

interface XmlBodyEditorProps {
  value: string;
  variableContext?: VariableContext;
  onChange: (value: string) => void;
  onFormat: () => void;
}

export function XmlBodyEditor({ value, variableContext, onChange, onFormat }: XmlBodyEditorProps) {
  return (
    <section className={styles.bodyPane}>
      <div className={styles.headerActions}>
        <button type="button" onClick={onFormat}>
          <Wand2 size={14} />
          Pretty XML
        </button>
      </div>
      <div className={styles.surface}>
        <JsonEditor value={value} language="xml" variableContext={variableContext} onChange={onChange} fontSize={13} lineHeight={20} />
      </div>
    </section>
  );
}
