import { Search } from "lucide-react";
import { MappingTargetField } from "./mappingBuilderTypes";
import styles from "./MappingBuilderModal.module.css";

interface TargetRequestPanelProps {
  needsMappingFields: MappingTargetField[];
  search: string;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  getFieldRef?: (field: MappingTargetField) => (node: HTMLButtonElement | null) => void;
  onSearchChange: (value: string) => void;
  onSelectField: (field: MappingTargetField) => void;
  onHoverField: (field: MappingTargetField | null) => void;
}

export function TargetRequestPanel({
  needsMappingFields,
  search,
  mappedFieldIds,
  activeFieldIds,
  getFieldRef,
  onSearchChange,
  onSelectField,
  onHoverField,
}: TargetRequestPanelProps) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <strong>Target Node Request</strong>
          <span>Click a request field after selecting a source field to create a mapping instantly.</span>
        </div>
      </header>

      <label className={styles.searchField}>
        <Search size={14} />
        <input value={search} placeholder="Search request fields" onChange={(event) => onSearchChange(event.currentTarget.value)} />
      </label>

      <div className={styles.panelSections}>
        <FlatSection
          title="Needs Mapping"
          fields={needsMappingFields}
          mappedFieldIds={mappedFieldIds}
          activeFieldIds={activeFieldIds}
          getFieldRef={getFieldRef}
          onSelectField={onSelectField}
          onHoverField={onHoverField}
          emptyMessage="No explicit ->map placeholders found."
          highlightPlaceholders
        />
      </div>
    </section>
  );
}

function FlatSection({
  title,
  fields,
  mappedFieldIds,
  activeFieldIds,
  getFieldRef,
  onSelectField,
  onHoverField,
  emptyMessage,
  highlightPlaceholders,
}: {
  title: string;
  fields: MappingTargetField[];
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  getFieldRef?: (field: MappingTargetField) => (node: HTMLButtonElement | null) => void;
  onSelectField: (field: MappingTargetField) => void;
  onHoverField: (field: MappingTargetField | null) => void;
  emptyMessage?: string;
  highlightPlaceholders?: boolean;
}) {
  return (
    <section className={styles.panelSection}>
      <div className={styles.sectionHeading}>{title}</div>
      {fields.length === 0 ? (
        <div className={styles.emptyInline}>{emptyMessage ?? "No fields available."}</div>
      ) : (
        <div className={styles.simpleFieldList}>
          {fields.map((field) => (
            <button
              ref={getFieldRef?.(field)}
              key={field.id}
              type="button"
              className={`${styles.simpleFieldButton} ${mappedFieldIds.has(field.id) ? styles.simpleFieldMapped : ""} ${activeFieldIds.has(field.id) ? styles.simpleFieldActive : ""} ${highlightPlaceholders && field.expectsMapping ? styles.simpleFieldNeedsMapping : ""}`}
              onClick={() => onSelectField(field)}
              onMouseEnter={() => onHoverField(field)}
              onMouseLeave={() => onHoverField(null)}
            >
              <span className={styles.targetFieldLabel}>
                {field.label}
                {field.expectsMapping && <small className={styles.mapPlaceholderBadge}>map</small>}
              </span>
              <em>{field.value || field.groupLabel}</em>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
