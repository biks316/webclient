import { FlowMapping } from "../../types/bik";
import { MappingChip } from "./MappingChip";
import { MappingEmptyState } from "./MappingEmptyState";
import styles from "./MappingBuilderModal.module.css";

interface MappingLaneProps {
  mappings: FlowMapping[];
  hoveredMappingIndex: number | null;
  selectedSourcePath: string | null;
  onHoverMapping: (mappingIndex: number | null) => void;
  onOpenTransform: (mappingIndex: number, target: HTMLButtonElement) => void;
  onDeleteMapping: (mappingIndex: number) => void;
  formatSourceLabel: (mapping: FlowMapping) => string;
  formatTargetLabel: (mapping: FlowMapping) => string;
}

export function MappingLane({
  mappings,
  hoveredMappingIndex,
  selectedSourcePath,
  onHoverMapping,
  onOpenTransform,
  onDeleteMapping,
  formatSourceLabel,
  formatTargetLabel,
}: MappingLaneProps) {
  return (
    <section className={styles.mappingLane}>
      <header className={styles.mappingLaneHeader}>
        <div>
          <strong>Mapping Lane</strong>
          <span>Connections appear here as you map response values into the request.</span>
        </div>
      </header>

      <div className={styles.mappingLaneBody}>
        {mappings.length === 0 ? (
          <MappingEmptyState
            title="No mappings yet."
            description={selectedSourcePath ? "Pick a target placeholder to connect the selected response value." : "Click a response field, then a target field."}
          />
        ) : (
          <div className={styles.mappingChipList}>
            {mappings.map((mapping, index) => (
              <MappingChip
                key={`${mapping.sourcePath}:${mapping.targetType}:${mapping.targetKey}:${index}`}
                mapping={mapping}
                sourceLabel={formatSourceLabel(mapping)}
                targetLabel={formatTargetLabel(mapping)}
                active={hoveredMappingIndex === index}
                onHover={(hovered) => onHoverMapping(hovered ? index : null)}
                onOpenTransform={(target) => onOpenTransform(index, target)}
                onDelete={() => onDeleteMapping(index)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
