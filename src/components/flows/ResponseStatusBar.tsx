import { Play, RotateCw } from "lucide-react";
import { RunResponse } from "../../types/bik";
import { byteSize } from "./mappingBuilderUtils";
import styles from "./MappingBuilderModal.module.css";

interface ResponseStatusBarProps {
  response: RunResponse | null;
  loading: boolean;
  onRun: () => void;
}

export function ResponseStatusBar({ response, loading, onRun }: ResponseStatusBarProps) {
  return (
    <div className={styles.responseStatusBar}>
      <div className={styles.responseStatusCopy}>
        <strong>Previous Response</strong>
        <span>
          {response
            ? `${response.status} ${response.statusText || "OK"} · ${response.responseTimeMs} ms · ${byteSize(response.body)} B`
            : "No response captured yet."}
        </span>
      </div>
      <button type="button" className={styles.ghostActionButton} onClick={onRun} disabled={loading}>
        {response ? <RotateCw size={14} /> : <Play size={14} />}
        {loading ? "Running..." : "Run Again"}
      </button>
    </div>
  );
}
