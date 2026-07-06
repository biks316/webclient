import { RequestBodyType } from "../../types/bik";
import { BODY_TYPE_OPTIONS } from "../../services/requestBody";
import styles from "./BodyEditor.module.css";

interface RequestBodyTypeSelectorProps {
  value: RequestBodyType;
  onChange: (value: RequestBodyType) => void;
}

export function RequestBodyTypeSelector({ value, onChange }: RequestBodyTypeSelectorProps) {
  const groups = BODY_TYPE_OPTIONS.reduce<Record<string, Array<{ value: RequestBodyType; label: string }>>>((acc, option) => {
    acc[option.group] = [...(acc[option.group] ?? []), { value: option.value, label: option.label }];
    return acc;
  }, {});

  return (
    <label className={styles.typeSelector}>
      <span>Body Type</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as RequestBodyType)}>
        {Object.entries(groups).map(([group, options]) => (
          <optgroup key={group} label={group}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
