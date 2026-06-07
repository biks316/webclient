import { resolveVariable, VariableContext } from "../../services/variableResolver";
import { VariableHoverTooltip } from "./VariableHoverTooltip";
import styles from "./Variables.module.css";

interface VariableTokenProps {
  name: string;
  context: VariableContext;
}

export function VariableToken({ name, context }: VariableTokenProps) {
  const variable = resolveVariable(name, context);
  return (
    <span className={`${styles.token} ${styles[`scope_${variable.scope}`]} ${variable.isSecret ? styles.secret : ""}`}>
      {"{{"}{variable.name}{"}}"}
      <VariableHoverTooltip variable={variable} />
    </span>
  );
}
