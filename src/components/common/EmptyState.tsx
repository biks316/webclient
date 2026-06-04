import { LucideIcon, PlusCircle } from "lucide-react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = PlusCircle,
}: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <div className={styles.iconWrap}>
        <Icon size={20} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
