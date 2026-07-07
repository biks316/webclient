import styles from "./MappingBuilderModal.module.css";

interface MappingStepperProps {
  activeStep: 1 | 2 | 3;
  message: string;
}

const STEPS = [
  "Select response value",
  "Select request placeholder",
  "Save mappings",
] as const;

export function MappingStepper({ activeStep, message }: MappingStepperProps) {
  return (
    <div className={styles.stepHeader}>
      <div className={styles.stepGuide}>
        {STEPS.map((step, index) => (
          <div
            key={step}
            className={`${styles.stepItem} ${activeStep === index + 1 ? styles.stepItemActive : ""} ${activeStep > index + 1 ? styles.stepItemDone : ""}`}
          >
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </div>
      <div className={styles.stepMessage}>{message}</div>
    </div>
  );
}
