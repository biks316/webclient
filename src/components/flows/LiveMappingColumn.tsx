import { FlowMapping } from "../../types/bik";
import { AutoMapButton } from "./AutoMapButton";
import { MappingEmptyState } from "./MappingEmptyState";
import { MappingPairRow } from "./MappingPairRow";
import styles from "./MappingBuilderModal.module.css";

interface LiveMappingColumnProps {
  mappings: FlowMapping[];
  autoMapCount: number;
  instruction: string;
  hoveredMappingIndex: number | null;
  selectedSourcePath: string | null;
  getSourceValue: (mapping: FlowMapping) => string;
  formatSourceLabel: (mapping: FlowMapping) => string;
  formatTargetLabel: (mapping: FlowMapping) => string;
  onAutoMap: () => void;
  onHoverMapping: (mappingIndex: number | null) => void;
  onOpenTransform: (mappingIndex: number, target: HTMLButtonElement) => void;
  onDeleteMapping: (mappingIndex: number) => void;
}

export function LiveMappingColumn({
  mappings,
  autoMapCount,
  instruction,
  hoveredMappingIndex,
  selectedSourcePath,
  getSourceValue,
  formatSourceLabel,
  formatTargetLabel,
  onAutoMap,
  onHoverMapping,
  onOpenTransform,
  onDeleteMapping,
}: LiveMappingColumnProps) {
  return (
    <section className={styles.mappingLane}>
      <header className={styles.mappingLaneHeader}>
        <div>
          <strong>Live Mapping</strong>
          <span>{instruction}</span>
        </div>
        <AutoMapButton count={autoMapCount} onClick={onAutoMap} />
      </header>

      <div className={styles.mappingLaneBody}>
        {mappings.length === 0 ? (
          <MappingEmptyState
            title="No mappings yet."
            description={selectedSourcePath ? "Pick a request placeholder on the right to complete the connection." : "Click any value in the previous response."}
          />
        ) : (
          <div className={styles.mappingPairList}>
            {mappings.map((mapping, index) => (
              <MappingPairRow
                key={`${mapping.sourcePath}:${mapping.targetType}:${mapping.targetKey}:${index}`}
                mapping={mapping}
                sourceLabel={formatSourceLabel(mapping)}
                sourceValue={getSourceValue(mapping)}
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
