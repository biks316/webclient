import { ChevronDown, ChevronRight } from "lucide-react";
import { ReactNode } from "react";
import styles from "./Variables.module.css";

interface VariableGroupProps {
  name: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function VariableGroup({ name, count, open, onToggle, children }: VariableGroupProps) {
  return (
    <section className={styles.managerGroup}>
      <button type="button" className={styles.managerGroupHeader} onClick={onToggle}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <strong>{name}</strong>
        <span>{count}</span>
      </button>
      <div className={`${styles.managerGroupBody} ${open ? styles.managerGroupBodyOpen : ""}`}>
        {open && children}
      </div>
    </section>
  );
}
