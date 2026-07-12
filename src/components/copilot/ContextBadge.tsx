import styles from "./ContextBadge.module.css";

interface ContextBadgeProps {
  label: string;
  value: string | null;
}

export function ContextBadge({ label, value }: ContextBadgeProps) {
  return (
    <div className={styles.badge}>
      <span>{label}</span>
      <strong>{value || "Not selected"}</strong>
    </div>
  );
}
