import { Play, RotateCw } from "lucide-react";
import { RunResponse } from "../../types/bik";
import { byteSize } from "./mappingBuilderUtils";
import styles from "./MappingBuilderModal.module.css";

interface ResponseStatusCardProps {
  response: RunResponse | null;
  loading: boolean;
  onRun: () => void;
}

export function ResponseStatusCard({ response, loading, onRun }: ResponseStatusCardProps) {
  return (
    <div className={styles.responseStatusCard}>
      <div>
        <div className={styles.responseStatusLabel}>Previous Response</div>
        <div className={styles.responseStatusValue}>
          {response ? `${response.status} ${response.statusText || "OK"} · ${response.responseTimeMs} ms · ${byteSize(response.body)} B` : "No response captured yet."}
        </div>
      </div>
      <button type="button" className={styles.secondaryButton} onClick={onRun} disabled={loading}>
        {response ? <RotateCw size={14} /> : <Play size={14} />}
        {loading ? "Running..." : response ? "Run Again" : "Run Source Node"}
      </button>
    </div>
  );
}
