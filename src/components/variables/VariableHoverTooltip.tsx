import { ResolvedVariable, maskVariableValue } from "../../services/variableResolver";
import styles from "./Variables.module.css";

interface VariableHoverTooltipProps {
  variable: ResolvedVariable;
}

export function VariableHoverTooltip({ variable }: VariableHoverTooltipProps) {
  return (
    <span className={styles.tooltip}>
      <strong>{variable.name}</strong>
      <span>scope: {variable.scope}</span>
      <span>source: {variable.sourceId ?? "missing"}</span>
      <span>value: {variable.found ? maskVariableValue(variable.value, variable.isSecret) : "unresolved"}</span>
      {!variable.found && <em>Missing variable</em>}
    </span>
  );
}
