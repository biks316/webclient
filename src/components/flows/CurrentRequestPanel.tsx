import { Search } from "lucide-react";
import { MappingEmptyState } from "./MappingEmptyState";
import { JsonTreeMapper } from "./JsonTreeMapper";
import { JsonFieldTreeNode, MappingTargetField } from "./mappingBuilderTypes";
import { formatTargetPath } from "./mappingBuilderUtils";
import styles from "./MappingBuilderModal.module.css";

interface CurrentRequestPanelProps {
  needsMappingTree: Array<JsonFieldTreeNode<MappingTargetField>>;
  needsMappingFields: MappingTargetField[];
  otherFields: MappingTargetField[];
  search: string;
  mappedFieldIds: Set<string>;
  activeFieldIds: Set<string>;
  selectedFieldId: string | null;
  pickMode: boolean;
  getFieldRef?: (field: MappingTargetField) => (node: HTMLButtonElement | null) => void;
  onSearchChange: (value: string) => void;
  onSelectField: (field: MappingTargetField) => void;
  onHoverField: (field: MappingTargetField | null) => void;
}

export function CurrentRequestPanel({
  needsMappingTree,
  needsMappingFields,
  otherFields,
  search,
  mappedFieldIds,
  activeFieldIds,
  selectedFieldId,
  pickMode,
  getFieldRef,
  onSearchChange,
  onSelectField,
  onHoverField,
}: CurrentRequestPanelProps) {
  const glowFieldIds = pickMode ? new Set(needsMappingFields.map((field) => field.id)) : undefined;

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <strong>Current Request</strong>
          <span>Choose where to insert it in the current request.</span>
        </div>
      </header>

      <label className={styles.searchField}>
        <Search size={14} />
        <input value={search} placeholder="Search target fields" onChange={(event) => onSearchChange(event.currentTarget.value)} />
      </label>

      <div className={styles.panelSections}>
        <section className={styles.treeSection}>
          <div className={styles.sectionHeading}>Needs Mapping</div>
          {needsMappingFields.length === 0 ? (
            <MappingEmptyState
              title="No mapping placeholders found."
              description="Add `->map` to any request body value that should come from a previous response."
              example={`{\n  "userId": "->map"\n}`}
            />
          ) : (
            <JsonTreeMapper
              nodes={needsMappingTree}
              mode="target"
              mappedFieldIds={mappedFieldIds}
              activeFieldIds={activeFieldIds}
              selectedFieldId={selectedFieldId}
              glowFieldIds={glowFieldIds}
              getFieldRef={getFieldRef}
              getDisplayPath={(field) => formatTargetPath(field.targetPath)}
              onFieldClick={onSelectField}
              onFieldHover={onHoverField}
            />
          )}
        </section>

        {otherFields.length > 0 ? (
          <section className={styles.flatSection}>
            <div className={styles.sectionHeadingMuted}>Other Request Fields</div>
            <div className={styles.compactList}>
              {otherFields.map((field) => (
                <div key={field.id} className={styles.readonlyField}>
                  <span>{formatTargetPath(field.targetPath)}</span>
                  <small>{field.value || field.groupLabel}</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
