import styles from "./ResponseMetaBar.module.css";

interface ResponseMetaBarProps {
  status: number | null;
  statusText: string;
  responseTimeMs: number | null;
  size: number | null;
  sentAt?: string | null;
}

export function ResponseMetaBar({ status, statusText, responseTimeMs, size, sentAt = null }: ResponseMetaBarProps) {
  const statusTone = status === null ? "" : status >= 400 ? styles.error : styles.success;
  return (
    <div className={styles.meta}>
      <span className={`${styles.badge} ${statusTone}`}>
        {status === null ? "Idle" : `${status} ${statusText}`.trim()}
      </span>
      <span>{responseTimeMs === null ? "-- ms" : `${responseTimeMs} ms`}</span>
      <span>{size === null ? "-- B" : `${size} B`}</span>
      <span>{sentAt ? new Date(sentAt).toLocaleTimeString() : "--"}</span>
    </div>
  );
}
