import { CheckCircle2, Circle, LoaderCircle, XCircle } from "lucide-react";
import { CopilotExecutionPlanCard } from "../../types/copilot";
import styles from "./ExecutionPlanCard.module.css";

interface ExecutionPlanCardProps {
  card: CopilotExecutionPlanCard;
}

export function ExecutionPlanCard({ card }: ExecutionPlanCardProps) {
  return (
    <section className={styles.card}>
      <strong>{card.title}</strong>
      <div className={styles.steps}>
        {card.steps.map((step) => (
          <div key={step.id} className={styles.step}>
            <StatusIcon status={step.status} />
            <span>{step.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusIcon({ status }: { status: CopilotExecutionPlanCard["steps"][number]["status"] }) {
  if (status === "done") {
    return <CheckCircle2 size={14} className={styles.done} />;
  }
  if (status === "running") {
    return <LoaderCircle size={14} className={styles.running} />;
  }
  if (status === "failed") {
    return <XCircle size={14} className={styles.failed} />;
  }
  return <Circle size={14} className={styles.pending} />;
}
