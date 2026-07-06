import styles from "./MappingBuilderModal.module.css";

interface MappingEmptyStateProps {
  title: string;
  description: string;
  example?: string;
}

export function MappingEmptyState({ title, description, example }: MappingEmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <strong>{title}</strong>
      <span>{description}</span>
      {example ? <pre className={styles.emptyStateCode}>{example}</pre> : null}
    </div>
  );
}
