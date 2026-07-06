import type { ReactNode } from "react";
import styles from "./FlowBuilder.module.css";

interface AdvancedForwardingPanelProps {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function AdvancedForwardingPanel({ open, onToggle, children }: AdvancedForwardingPanelProps) {
  return (
    <section className={styles.advancedForwarding}>
      <button type="button" className={styles.advancedForwardingToggle} onClick={onToggle}>
        {open ? "Hide Advanced Forwarding" : "Advanced Forwarding"}
      </button>
      {open && <div className={styles.advancedForwardingBody}>{children}</div>}
    </section>
  );
}
