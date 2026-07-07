import styles from "./MappingBuilderModal.module.css";

export interface MappingOverlayPath {
  id: string;
  path: string;
  tone: "saved" | "active" | "temporary";
}

interface MappingSvgOverlayProps {
  paths: MappingOverlayPath[];
}

export function MappingSvgOverlay({ paths }: MappingSvgOverlayProps) {
  return (
    <div className={styles.mappingSvgOverlay}>
      <svg className={styles.mappingSvg} aria-hidden="true">
        <defs>
          <marker id="mapping-arrow-saved" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M0,0 L0,10 L10,5 z" className={styles.mappingSvgArrowSaved} />
          </marker>
          <marker id="mapping-arrow-active" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M0,0 L0,10 L10,5 z" className={styles.mappingSvgArrowActive} />
          </marker>
          <marker id="mapping-arrow-temporary" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M0,0 L0,10 L10,5 z" className={styles.mappingSvgArrowTemporary} />
          </marker>
        </defs>
        {paths.map((item) => (
          <path
            key={item.id}
            d={item.path}
            className={[
              styles.mappingSvgPath,
              item.tone === "saved" ? styles.mappingSvgPathSaved : "",
              item.tone === "active" ? styles.mappingSvgPathActive : "",
              item.tone === "temporary" ? styles.mappingSvgPathTemporary : "",
            ].filter(Boolean).join(" ")}
            markerEnd={
              item.tone === "saved"
                ? "url(#mapping-arrow-saved)"
                : item.tone === "active"
                  ? "url(#mapping-arrow-active)"
                  : "url(#mapping-arrow-temporary)"
            }
          />
        ))}
      </svg>
    </div>
  );
}
