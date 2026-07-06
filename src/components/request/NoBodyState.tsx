import styles from "./BodyEditor.module.css";

export function NoBodyState() {
  return (
    <div className={styles.emptyState}>
      <strong>This request will be sent without a body.</strong>
      <span>Select another body type if this endpoint requires a payload.</span>
    </div>
  );
}
