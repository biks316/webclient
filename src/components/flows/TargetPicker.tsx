import { TargetType, TransformType, targetPathFor, templateFor } from "../../services/mappingSuggestionService";
import { VariableContext } from "../../services/variableResolver";
import { VariableInput } from "../variables/VariableInput";
import styles from "./FlowBuilder.module.css";

interface TargetPickerProps {
  targetType: TargetType;
  targetKey: string;
  targetPath: string;
  transformType: TransformType;
  template: string;
  variableContext?: VariableContext;
  onChange: (next: {
    targetType: TargetType;
    targetKey: string;
    targetPath: string;
    transformType: TransformType;
    template: string;
  }) => void;
}

const TARGET_OPTIONS: Array<{ id: TargetType; label: string; needsKey: boolean }> = [
  { id: "header", label: "Forward to Header", needsKey: true },
  { id: "body", label: "Forward to Body", needsKey: true },
  { id: "query", label: "Forward to Query Param", needsKey: true },
  { id: "path", label: "Forward to Path Variable", needsKey: true },
  { id: "cookie", label: "Forward to Cookie", needsKey: true },
  { id: "flowVariable", label: "Forward to Flow Variable", needsKey: true },
  { id: "auth", label: "Forward to Auth Token", needsKey: false },
];

export function TargetPicker({
  targetType,
  targetKey,
  transformType,
  template,
  variableContext,
  onChange,
}: TargetPickerProps) {
  const selectedTarget = TARGET_OPTIONS.find((option) => option.id === targetType) ?? TARGET_OPTIONS[0];

  function emit(patch: Partial<Parameters<TargetPickerProps["onChange"]>[0]>) {
    const nextTargetType = patch.targetType ?? targetType;
    const nextTargetKey = patch.targetKey ?? targetKey;
    const nextTransformType = patch.transformType ?? transformType;
    const nextTemplate =
      patch.template ?? (patch.transformType ? templateFor(patch.transformType) : template);
    onChange({
      targetType: nextTargetType,
      targetKey: nextTargetKey,
      targetPath: targetPathFor(nextTargetType, nextTargetKey),
      transformType: nextTransformType,
      template: nextTemplate,
    });
  }

  return (
    <div className={styles.targetPicker}>
      <span>Target</span>
      <div className={styles.targetOptions}>
        {TARGET_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={targetType === option.id ? styles.targetOptionActive : ""}
            onClick={() => emit({ targetType: option.id })}
          >
            {option.label}
          </button>
        ))}
      </div>
      {selectedTarget.needsKey && (
        <label>
          <span>Target key</span>
          {variableContext ? (
            <VariableInput value={targetKey} variableContext={variableContext} onChange={(targetKey) => emit({ targetKey })} />
          ) : (
            <input value={targetKey} onChange={(event) => emit({ targetKey: event.currentTarget.value })} />
          )}
        </label>
      )}
      <label>
        <span>Transform</span>
        <select
          value={transformType}
          onChange={(event) => emit({ transformType: event.currentTarget.value as TransformType })}
        >
          <option value="raw">Raw value</option>
          <option value="bearer">Bearer token</option>
          <option value="template">Template</option>
        </select>
      </label>
      {transformType === "template" && (
        <label>
          <span>Template</span>
          {variableContext ? (
            <VariableInput value={template} variableContext={variableContext} onChange={(template) => emit({ template })} />
          ) : (
            <input value={template} onChange={(event) => emit({ template: event.currentTarget.value })} />
          )}
        </label>
      )}
    </div>
  );
}
