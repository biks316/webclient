import styles from "./MappingBuilderModal.module.css";

interface MappingFooterProps {
  count: number;
  onCancel: () => void;
  onSave: () => void;
}

export function MappingFooter({ count, onCancel, onSave }: MappingFooterProps) {
  return (
    <footer className={styles.modalFooter}>
      <div className={styles.footerCount}>{count} mapping{count === 1 ? "" : "s"} created</div>
      <div className={styles.footerActions}>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className={styles.primaryButton} onClick={onSave}>
          Save Mapping ({count})
        </button>
      </div>
    </footer>
  );
}
