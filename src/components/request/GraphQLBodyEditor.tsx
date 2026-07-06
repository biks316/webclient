import { Wand2 } from "lucide-react";
import { JsonEditor } from "../common/JsonEditor";
import { VariableContext } from "../../services/variableResolver";
import styles from "./BodyEditor.module.css";

interface GraphQLBodyEditorProps {
  query: string;
  variables: string;
  error: string | null;
  variableContext?: VariableContext;
  onQueryChange: (value: string) => void;
  onVariablesChange: (value: string) => void;
  onFormatVariables: () => void;
}

export function GraphQLBodyEditor({
  query,
  variables,
  error,
  variableContext,
  onQueryChange,
  onVariablesChange,
  onFormatVariables,
}: GraphQLBodyEditorProps) {
  return (
    <section className={styles.graphqlPane}>
      <div className={styles.graphqlSection}>
        <div className={styles.sectionTitle}>Query</div>
        <div className={styles.surface}>
          <JsonEditor value={query} language="plaintext" variableContext={variableContext} onChange={onQueryChange} fontSize={13} lineHeight={20} />
        </div>
      </div>
      <div className={styles.graphqlSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Variables</span>
          <button type="button" onClick={onFormatVariables}>
            <Wand2 size={14} />
            Pretty JSON
          </button>
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.surface}>
          <JsonEditor value={variables} variableContext={variableContext} onChange={onVariablesChange} fontSize={13} lineHeight={20} />
        </div>
      </div>
    </section>
  );
}
