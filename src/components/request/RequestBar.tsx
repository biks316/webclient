import { Copy, Download, Save, Send } from "lucide-react";
import { VariableFile } from "../../types/bik";
import { MethodBadge } from "../common/MethodBadge";
import { CompactSelect } from "../common/CompactSelect";
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
  const environmentOptions = [
    { value: "", label: "No environment" },
    ...environments.map((environment) => ({ value: environment.id, label: environment.name })),
  ];
  const methodOptions = METHODS.map((item) => ({ value: item, label: item }));

  return (
    <section className={styles.bar}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <MethodBadge method={method} compact />
          <input
            className={styles.name}
            value={name}
            onChange={(event) => onNameChange(event.currentTarget.value)}
          />
        </div>
        <div className={styles.rightMeta}>
          <CompactSelect
            value={selectedEnvironmentId ?? ""}
            options={environmentOptions}
            placeholder="No environment"
            className={styles.environmentSelect}
            onChange={(next) => onEnvironmentChange(next || null)}
          />
          <button type="button" onClick={onCreateEnvironment}>New Env</button>
          <div className={styles.variablePill}>{selectedEnvironmentName ?? "Globals"}</div>
          <button type="button" className={styles.iconAction} onClick={onCopyRequest} title="Copy request">
            <Copy size={13} />
          </button>
          <button type="button" className={styles.iconAction} onClick={onExportRequest} title="Export request">
            <Download size={13} />
          </button>
        </div>
      </div>

      <div className={styles.requestRow}>
        <CompactSelect value={method} options={methodOptions} className={styles.methodSelect} onChange={onMethodChange} />
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
    </section>
  );
}
