import { Copy, Download, Save, Send } from "lucide-react";
import { VariableFile } from "../../types/bik";
import { MethodBadge } from "../common/MethodBadge";
import styles from "./RequestBar.module.css";

interface RequestBarProps {
  name: string;
  method: string;
  url: string;
  environments: VariableFile[];
  selectedEnvironmentId: string | null;
  selectedEnvironmentName: string | null;
  isBusy: boolean;
  sendDisabled?: boolean;
  onNameChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onEnvironmentChange: (environmentId: string | null) => void;
  onCreateEnvironment: () => void;
  onSave: () => void;
  onSend: () => void;
  onCopyRequest: () => void;
  onExportRequest: () => void;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function RequestBar({
  name,
  method,
  url,
  environments,
  selectedEnvironmentId,
  selectedEnvironmentName,
  isBusy,
  sendDisabled = false,
  onNameChange,
  onMethodChange,
  onUrlChange,
  onEnvironmentChange,
  onCreateEnvironment,
  onSave,
  onSend,
  onCopyRequest,
  onExportRequest,
}: RequestBarProps) {
  return (
    <section className={styles.bar}>
      <div className={styles.header}>
        <input className={styles.name} value={name} onChange={(event) => onNameChange(event.currentTarget.value)} />
        <div className={styles.rightMeta}>
          <span className={styles.metaLabel}>Environment</span>
          <select value={selectedEnvironmentId ?? ""} onChange={(event) => onEnvironmentChange(event.currentTarget.value || null)}>
            <option value="">No environment</option>
            {environments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={onCreateEnvironment}>New env</button>
          <div className={styles.variablePill}>
            <span>{selectedEnvironmentName ?? "Globals"}</span>
          </div>
        </div>
      </div>

      <div className={styles.requestRow}>
        <select value={method} className={styles.methodSelect} onChange={(event) => onMethodChange(event.currentTarget.value)}>
          {METHODS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <input
          className={styles.url}
          value={url}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => onUrlChange(event.currentTarget.value)}
        />
        <button type="button" onClick={onSave}>
          <Save size={14} />
          Save
        </button>
        <button type="button" className="primary" onClick={onSend} disabled={sendDisabled}>
          <Send size={14} />
          {isBusy ? "Sending..." : "Send"}
        </button>
      </div>

      <div className={styles.footer}>
        <MethodBadge method={method} />
        <div className={styles.footerActions}>
          <button type="button" onClick={onCopyRequest}>
            <Copy size={14} />
            Copy
          </button>
          <button type="button" onClick={onExportRequest}>
            <Download size={14} />
            Export
          </button>
        </div>
      </div>
    </section>
  );
}
