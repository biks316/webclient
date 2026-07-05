import { VariableType } from "./VariableManagerTypes";
import styles from "./Variables.module.css";

interface VariableBadgeProps {
  type: VariableType;
}

export function VariableBadge({ type }: VariableBadgeProps) {
  return <span className={`${styles.managerBadge} ${styles[`type_${type}`]}`}>{type}</span>;
}
