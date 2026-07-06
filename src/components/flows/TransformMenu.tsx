import { MappingTransformType } from "./mappingBuilderTypes";
import { defaultTransformTemplate, needsTransformInput } from "./mappingBuilderUtils";
import styles from "./MappingBuilderModal.module.css";

const TRANSFORM_OPTIONS: Array<{ id: MappingTransformType; label: string; placeholder?: string }> = [
  { id: "raw", label: "Raw" },
  { id: "uppercase", label: "Uppercase" },
  { id: "lowercase", label: "Lowercase" },
  { id: "trim", label: "Trim" },
  { id: "substring", label: "Substring", placeholder: "0:8" },
  { id: "jsonpath", label: "JSONPath", placeholder: "$.id" },
  { id: "javascript", label: "Custom JavaScript", placeholder: "return String(value);" },
  { id: "template", label: "Template", placeholder: "{{value}}" },
  { id: "bearer", label: "Bearer" },
];

interface TransformMenuProps {
  anchor: { left: number; top: number };
  transformType: MappingTransformType;
  template: string;
  onChange: (transformType: MappingTransformType, template: string) => void;
  onClose: () => void;
}

export function TransformMenu({
  anchor,
  transformType,
  template,
  onChange,
  onClose,
}: TransformMenuProps) {
  return (
    <div className={styles.transformMenu} style={{ left: anchor.left, top: anchor.top }}>
      <label className={styles.transformField}>
        <span>Transform</span>
        <select
          value={transformType}
          onChange={(event) => {
            const nextType = event.currentTarget.value as MappingTransformType;
            onChange(nextType, defaultTransformTemplate(nextType));
          }}
        >
          {TRANSFORM_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      {needsTransformInput(transformType) && (
        <label className={styles.transformField}>
          <span>Config</span>
          <input
            value={template}
            placeholder={TRANSFORM_OPTIONS.find((option) => option.id === transformType)?.placeholder}
            onChange={(event) => onChange(transformType, event.currentTarget.value)}
          />
        </label>
      )}
      <div className={styles.transformFooter}>
        <button type="button" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
