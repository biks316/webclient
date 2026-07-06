import { Search } from "lucide-react";
import { RunResponse } from "../../types/bik";
import { MappingEmptyState } from "./MappingEmptyState";
import { JsonTreeMapper } from "./JsonTreeMapper";
import { ResponseStatusCard } from "./ResponseStatusCard";
import { JsonFieldTreeNode, MappingSourceField } from "./mappingBuilderTypes";
import { formatSourcePath } from "./mappingBuilderUtils";
import styles from "./MappingBuilderModal.module.css";

interface PreviousResponsePanelProps {
  response: RunResponse | null;
  loading: boolean;
  bodyTree: Array<JsonFieldTreeNode<MappingSourceField>>;
  headerFields: MappingSourceField[];
  metaFields: MappingSourceField[];
  search: string;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId: string | null;
  getFieldRef?: (field: MappingSourceField) => (node: HTMLButtonElement | null) => void;
  onSearchChange: (value: string) => void;
  onRunSourceNode: () => void;
  onSelectField: (field: MappingSourceField) => void;
  onHoverField: (field: MappingSourceField | null) => void;
}

export function PreviousResponsePanel({
  response,
  loading,
  bodyTree,
  headerFields,
  metaFields,
  search,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  getFieldRef,
  onSearchChange,
  onRunSourceNode,
  onSelectField,
  onHoverField,
}: PreviousResponsePanelProps) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <strong>Previous Response</strong>
          <span>Choose a value from the previous response.</span>
        </div>
      </header>

      <ResponseStatusCard response={response} loading={loading} onRun={onRunSourceNode} />

      <label className={styles.searchField}>
        <Search size={14} />
        <input value={search} placeholder="Search response fields" onChange={(event) => onSearchChange(event.currentTarget.value)} />
      </label>

      {!response && !loading ? (
        <MappingEmptyState
          title="Run source node to discover response fields."
          description="Once a response is captured, you can click any leaf value here and map it to the current request."
        />
      ) : (
        <div className={styles.panelSections}>
          <section className={styles.treeSection}>
            <div className={styles.sectionHeading}>Response</div>
            <JsonTreeMapper
              nodes={bodyTree}
              mode="source"
              mappedFieldIds={mappedFieldIds}
              activeFieldIds={activeFieldIds}
              selectedFieldId={selectedFieldId}
              getFieldRef={getFieldRef}
              getDisplayPath={(field) => formatSourcePath(field.path)}
              onFieldClick={onSelectField}
              onFieldHover={onHoverField}
              onCopyPath={(field) => void navigator.clipboard.writeText(formatSourcePath(field.path))}
            />
          </section>

          {headerFields.length > 0 ? (
            <section className={styles.flatSection}>
              <div className={styles.sectionHeading}>Headers</div>
              <div className={styles.compactList}>
                {headerFields.map((field) => (
                  <button
                    ref={getFieldRef?.(field)}
                    key={field.id}
                    type="button"
                    className={`${styles.compactField} ${mappedFieldIds.has(field.id) ? styles.compactFieldMapped : ""} ${activeFieldIds.has(field.id) ? styles.compactFieldActive : ""} ${selectedFieldId === field.id ? styles.compactFieldSelected : ""}`}
                    onClick={() => onSelectField(field)}
                    onMouseEnter={() => onHoverField(field)}
                    onMouseLeave={() => onHoverField(null)}
                    aria-label={`Response header ${field.label}`}
                  >
                    <span>{field.label}</span>
                    <small>{field.value}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {metaFields.length > 0 ? (
            <section className={styles.flatSection}>
              <div className={styles.sectionHeading}>Meta</div>
              <div className={styles.compactList}>
                {metaFields.map((field) => (
                  <button
                    ref={getFieldRef?.(field)}
                    key={field.id}
                    type="button"
                    className={`${styles.compactField} ${mappedFieldIds.has(field.id) ? styles.compactFieldMapped : ""} ${activeFieldIds.has(field.id) ? styles.compactFieldActive : ""} ${selectedFieldId === field.id ? styles.compactFieldSelected : ""}`}
                    onClick={() => onSelectField(field)}
                    onMouseEnter={() => onHoverField(field)}
                    onMouseLeave={() => onHoverField(null)}
                    aria-label={`Response meta field ${field.label}`}
                  >
                    <span>{field.label}</span>
                    <small>{field.value}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}
