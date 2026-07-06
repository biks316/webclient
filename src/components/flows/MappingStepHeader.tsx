import styles from "./MappingBuilderModal.module.css";

interface MappingStepHeaderProps {
  message: string;
}

const STEPS = [
  "Select response field",
  "Select target placeholder",
  "Save mappings",
];

export function MappingStepHeader({ message }: MappingStepHeaderProps) {
  return (
    <div className={styles.stepHeader}>
      <div className={styles.stepGuide}>
        {STEPS.map((step, index) => (
          <div key={step} className={styles.stepItem}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>
      <div className={styles.stepMessage}>{message}</div>
    </div>
  );
}
