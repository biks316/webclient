import { Search } from "lucide-react";
import { JsonCodeMapper } from "./JsonCodeMapper";
import { MappingTargetField, JsonFieldTreeNode } from "./mappingBuilderTypes";
import { formatTargetPath } from "./mappingBuilderUtils";
import styles from "./MappingBuilderModal.module.css";

interface CurrentRequestJsonViewProps {
  bodyTree: Array<JsonFieldTreeNode<MappingTargetField>>;
  hasPlaceholders: boolean;
  otherFields: MappingTargetField[];
  search: string;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  glowFieldIds?: Set<string>;
  selectedFieldId: string | null;
  getFieldRef?: (field: MappingTargetField) => (node: HTMLButtonElement | null) => void;
  onSearchChange: (value: string) => void;
  onSelectField: (field: MappingTargetField) => void;
  onHoverField: (field: MappingTargetField | null) => void;
}

export function CurrentRequestJsonView({
  bodyTree,
  hasPlaceholders,
  otherFields,
  search,
  mappedFieldIds,
  activeFieldIds,
  glowFieldIds,
  selectedFieldId,
  getFieldRef,
  onSearchChange,
  onSelectField,
  onHoverField,
}: CurrentRequestJsonViewProps) {
  return (
    <section className={styles.mappingPanel}>
      <header className={styles.mappingPanelHeader}>
        <div>
          <strong>Current Request</strong>
          <span>Click a request placeholder to complete the mapping</span>
        </div>
      </header>

      <label className={styles.searchField}>
        <Search size={14} />
        <input value={search} placeholder="Search request..." onChange={(event) => onSearchChange(event.currentTarget.value)} />
      </label>

      {!hasPlaceholders ? (
        <div className={styles.compactEmptyState}>
          <strong>No mapping placeholders found</strong>
          <span>Add `-&gt;map` to request fields that should come from the previous response.</span>
          <pre className={styles.emptyStateCode}>{`{\n  "userId": "->map"\n}`}</pre>
        </div>
      ) : null}

      <div className={styles.codeFrame}>
        <JsonCodeMapper
          side="target"
          nodes={bodyTree}
          search={search}
          mappedFieldIds={mappedFieldIds}
          activeFieldIds={activeFieldIds}
          selectedFieldId={selectedFieldId}
          glowFieldIds={glowFieldIds}
          getFieldRef={getFieldRef}
          getDisplayPath={(field) => formatTargetPath(field.targetPath)}
          onFieldClick={onSelectField}
          onFieldHover={onHoverField}
        />
      </div>

      {otherFields.length > 0 ? (
        <div className={styles.requestOtherFields}>
          {otherFields.map((field) => (
            <div key={field.id} className={styles.requestOtherField}>
              <span>{formatTargetPath(field.targetPath)}</span>
              <small>{field.value || field.groupLabel}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
