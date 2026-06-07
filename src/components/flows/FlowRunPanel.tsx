import { FlowRunStep } from "../../services/flowRunner";
import styles from "./FlowBuilder.module.css";

interface FlowRunPanelProps {
  steps: FlowRunStep[];
}

export function FlowRunPanel({ steps }: FlowRunPanelProps) {
  return (
    <section className={styles.runPanel}>
      <header>
        <strong>Flow Runner</strong>
        <span>{steps.length} step{steps.length === 1 ? "" : "s"}</span>
      </header>
      <div className={styles.runSteps}>
        {steps.length === 0 ? (
          <span className={styles.emptyText}>Run the flow to see each request, response, and mapping.</span>
        ) : (
          steps.map((step) => (
            <details key={step.nodeId} className={styles.runStep} open={step.status === "error"}>
              <summary>
                <span className={styles[`runStatus_${step.status}`]}>
                  {step.status === "success" ? "✓" : step.status === "error" ? "✗" : step.status === "running" ? "…" : "○"}
                </span>
                <strong>{step.name}</strong>
                {step.response && <em>{step.response.status} {step.response.statusText} {step.response.responseTimeMs}ms</em>}
                {step.error && <em>{step.error}</em>}
              </summary>
              <div className={styles.runStepBody}>
                <h4>Request sent</h4>
                <pre>{JSON.stringify(step.request, null, 2)}</pre>
                {step.response && (
                  <>
                    <h4>Response received</h4>
                    <pre>{step.response.body}</pre>
                  </>
                )}
                <h4>Mappings applied</h4>
                {step.appliedMappings.length === 0 ? (
                  <p>No mappings applied from this step.</p>
                ) : (
                  step.appliedMappings.map((mapping) => (
                    <code key={`${mapping.source}-${mapping.target}`}>
                      extracted {mapping.sourceLabel}; set {mapping.targetLabel}: {mapping.maskedValue}
                    </code>
                  ))
                )}
              </div>
            </details>
          ))
        )}
      </div>
    </section>
  );
}
