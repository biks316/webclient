import { FlowMapping } from "../../types/bik";
import { MappingRow } from "./MappingRow";
import styles from "./MappingBuilderModal.module.css";

interface MappingListProps {
  mappings: FlowMapping[];
  hoveredMappingIndex: number | null;
  onHoverMapping: (mappingIndex: number | null) => void;
  onOpenTransform: (mappingIndex: number, target: HTMLButtonElement) => void;
  onDeleteMapping: (mappingIndex: number) => void;
}

export function MappingList({
  mappings,
  hoveredMappingIndex,
  onHoverMapping,
  onOpenTransform,
  onDeleteMapping,
}: MappingListProps) {
  return (
    <section className={styles.mappingListSection}>
      <header className={styles.mappingListHeader}>
        <div>
          <strong>Mappings</strong>
          <span>{mappings.length === 0 ? "No mappings yet." : `${mappings.length} mapping${mappings.length === 1 ? "" : "s"}`}</span>
        </div>
      </header>
      <div className={styles.mappingList}>
        {mappings.length === 0 ? (
          <div className={styles.mappingEmpty}>
            Click a source field, then click a target field to create a mapping.
          </div>
        ) : mappings.map((mapping, index) => (
          <MappingRow
            key={`${mapping.sourcePath}:${mapping.targetType}:${mapping.targetKey}:${index}`}
            mapping={mapping}
            sourceLabel={mapping.sourcePath.replace("$.response.body.", "").replace("$.response.", "")}
            targetLabel={mapping.targetPath.replace("$.request.", "")}
            active={hoveredMappingIndex === index}
            onHover={(hovered) => onHoverMapping(hovered ? index : null)}
            onOpenTransform={(target) => onOpenTransform(index, target)}
            onDelete={() => onDeleteMapping(index)}
          />
        ))}
      </div>
    </section>
  );
}
