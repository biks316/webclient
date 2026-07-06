import { Sparkles } from "lucide-react";
import styles from "./MappingBuilderModal.module.css";

interface AutoMapButtonProps {
  count: number;
  onClick: () => void;
}

export function AutoMapButton({ count, onClick }: AutoMapButtonProps) {
  return (
    <button type="button" className={styles.autoMapButton} onClick={onClick}>
      <Sparkles size={14} />
      {count > 0 ? `Auto Map (${count})` : "Auto Map"}
    </button>
  );
}
