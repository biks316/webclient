import { AlertTriangle } from "lucide-react";
import styles from "./ErrorBox.module.css";

interface ErrorBoxProps {
  title: string;
  message: string;
}

export function ErrorBox({ title, message }: ErrorBoxProps) {
  return (
    <div className={styles.box}>
      <div className={styles.title}>
        <AlertTriangle size={16} />
        <strong>{title}</strong>
      </div>
      <pre>{message}</pre>
    </div>
  );
}
