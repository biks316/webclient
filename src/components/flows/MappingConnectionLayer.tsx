import styles from "./MappingBuilderModal.module.css";

interface ConnectionPath {
  id: string;
  path: string;
  active: boolean;
}

interface MappingConnectionLayerProps {
  paths: ConnectionPath[];
}

export function MappingConnectionLayer({ paths }: MappingConnectionLayerProps) {
  return (
    <div className={styles.connectionLayer}>
      <svg className={styles.connectionSvg}>
        {paths.map((item) => (
          <path
            key={item.id}
            d={item.path}
            className={`${styles.connectionPath} ${item.active ? styles.connectionPathActive : ""}`}
          />
        ))}
      </svg>
    </div>
  );
}
