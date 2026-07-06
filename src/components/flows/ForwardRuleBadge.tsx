import styles from "./FlowBuilder.module.css";

interface ForwardRuleBadgeProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function ForwardRuleBadge({ label, active = false, onClick }: ForwardRuleBadgeProps) {
  return (
    <button
      type="button"
      className={`${styles.forwardRuleBadge} ${active ? styles.forwardRuleBadgeActive : ""}`}
      onClick={onClick}
      title={label}
    >
      {label}
    </button>
  );
}
