import styles from "./MethodBadge.module.css";

interface MethodBadgeProps {
  method: string;
  compact?: boolean;
}

export function MethodBadge({ method, compact = false }: MethodBadgeProps) {
  const upperMethod = method.toUpperCase();
  const toneClass =
    upperMethod === "GET"
      ? styles.get
      : upperMethod === "POST"
        ? styles.post
        : upperMethod === "PUT"
          ? styles.put
          : upperMethod === "DELETE"
            ? styles.delete
            : styles.default;

  return (
    <span className={`${styles.badge} ${compact ? styles.compact : ""} ${toneClass}`}>
      {upperMethod}
    </span>
  );
}
