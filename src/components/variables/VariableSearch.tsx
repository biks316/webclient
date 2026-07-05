import { Search } from "lucide-react";
import { RefObject } from "react";
import styles from "./Variables.module.css";

interface VariableSearchProps {
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement>;
}

export function VariableSearch({ value, onChange, inputRef }: VariableSearchProps) {
  return (
    <label className={styles.managerSearch}>
      <Search size={14} />
      <input
        ref={inputRef}
        value={value}
        placeholder="Search variables..."
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}
