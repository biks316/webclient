import { Play, Search } from "lucide-react";
import { RunResponse } from "../../types/bik";
import { JsonFieldTree } from "./JsonFieldTree";
import { JsonFieldTreeNode, MappingSourceField } from "./mappingBuilderTypes";
import { byteSize } from "./mappingBuilderUtils";
import styles from "./MappingBuilderModal.module.css";

interface SourceResponsePanelProps {
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

export function SourceResponsePanel({
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
}: SourceResponsePanelProps) {
  const responseSize = response ? `${byteSize(response.body)} B` : "--";

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <strong>Source Node Response</strong>
          <span>Run source node, inspect live response fields, then pick a value.</span>
        </div>
        <button type="button" className={styles.primaryButton} onClick={onRunSourceNode} disabled={loading}>
          <Play size={14} />
          {loading ? "Running..." : "Run Source Node"}
        </button>
      </header>

      <div className={styles.responseStats}>
        <StatChip label="Status" value={response ? String(response.status) : "--"} />
        <StatChip label="Time" value={response ? `${response.responseTimeMs} ms` : "--"} />
        <StatChip label="Size" value={responseSize} />
      </div>

      <label className={styles.searchField}>
        <Search size={14} />
        <input value={search} placeholder="Search response fields" onChange={(event) => onSearchChange(event.currentTarget.value)} />
      </label>

      {!response && !loading ? (
        <div className={styles.emptyPanel}>
          <strong>No response captured yet.</strong>
          <span>Run the source node to populate response fields for mapping.</span>
        </div>
      ) : (
        <div className={styles.panelSections}>
          <section className={styles.panelSection}>
            <div className={styles.sectionHeading}>Response Body</div>
            <JsonFieldTree
              nodes={bodyTree}
              mappedFieldIds={mappedFieldIds}
              activeFieldIds={activeFieldIds}
              selectedFieldId={selectedFieldId}
              getFieldRef={getFieldRef}
              onFieldClick={onSelectField}
              onFieldHover={onHoverField}
            />
          </section>

          <section className={styles.panelSection}>
            <div className={styles.sectionHeading}>Response Headers</div>
            <FieldList
              fields={headerFields}
              mappedFieldIds={mappedFieldIds}
              activeFieldIds={activeFieldIds}
              selectedFieldId={selectedFieldId}
              getFieldRef={getFieldRef}
              onSelectField={onSelectField}
              onHoverField={onHoverField}
            />
          </section>

          <section className={styles.panelSection}>
            <div className={styles.sectionHeading}>Response Meta</div>
            <FieldList
              fields={metaFields}
              mappedFieldIds={mappedFieldIds}
              activeFieldIds={activeFieldIds}
              selectedFieldId={selectedFieldId}
              getFieldRef={getFieldRef}
              onSelectField={onSelectField}
              onHoverField={onHoverField}
            />
          </section>
        </div>
      )}
    </section>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statChip}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FieldList({
  fields,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  getFieldRef,
  onSelectField,
  onHoverField,
}: {
  fields: MappingSourceField[];
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId: string | null;
  getFieldRef?: (field: MappingSourceField) => (node: HTMLButtonElement | null) => void;
  onSelectField: (field: MappingSourceField) => void;
  onHoverField: (field: MappingSourceField | null) => void;
}) {
  if (fields.length === 0) {
    return <div className={styles.emptyInline}>No fields available.</div>;
  }

  return (
    <div className={styles.simpleFieldList}>
      {fields.map((field) => (
        <button
          ref={getFieldRef?.(field)}
          key={field.id}
          type="button"
          className={`${styles.simpleFieldButton} ${mappedFieldIds.has(field.id) ? styles.simpleFieldMapped : ""} ${activeFieldIds.has(field.id) ? styles.simpleFieldActive : ""} ${selectedFieldId === field.id ? styles.simpleFieldSelected : ""}`}
          onClick={() => onSelectField(field)}
          onMouseEnter={() => onHoverField(field)}
          onMouseLeave={() => onHoverField(null)}
        >
          <span>{field.label}</span>
          <em>{field.value}</em>
        </button>
      ))}
    </div>
  );
}
