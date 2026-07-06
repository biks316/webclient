import { Copy, Download, MoreHorizontal, Save, Send, TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MethodBadge } from "../common/MethodBadge";
import { CompactSelect } from "../common/CompactSelect";
import { VariableContext } from "../../services/variableResolver";
import { VariableInput } from "../variables/VariableInput";
import styles from "./RequestBar.module.css";

interface RequestBarProps {
  name: string;
  method: string;
  url: string;
  variableContext: VariableContext;
  isBusy: boolean;
  sendDisabled?: boolean;
  onNameChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onSave: () => void;
  onSend: () => void;
  onCopyRequest: () => void;
  onCopyCurl: () => void;
  onGenerateCurl: () => void;
  onExportRequest: () => void;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export function RequestBar({
  name,
  method,
  url,
  variableContext,
  isBusy,
  sendDisabled = false,
  onNameChange,
  onMethodChange,
  onUrlChange,
  onSave,
  onSend,
  onCopyRequest,
  onCopyCurl,
  onGenerateCurl,
  onExportRequest,
}: RequestBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const methodOptions = METHODS.map((item) => ({ value: item, label: item }));

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

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
      </div>

      <div className={styles.requestRow}>
        <CompactSelect value={method} options={methodOptions} className={styles.methodSelect} onChange={onMethodChange} />
        <VariableInput
          className={styles.url}
          value={url}
          variableContext={variableContext}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={onUrlChange}
        />
        <button type="button" className="primary" onClick={onSend} disabled={sendDisabled}>
          <Send size={14} />
          {isBusy ? "Sending..." : "Send"}
        </button>
        <div className={styles.requestMenuWrap} ref={menuRef}>
          <button type="button" className={styles.iconAction} onClick={() => setMenuOpen((open) => !open)} title="Request actions">
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className={styles.requestMenu}>
              <button type="button" onClick={() => { setMenuOpen(false); onSave(); }}>
                <Save size={13} />
                Save request
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onCopyRequest(); }}>
                <Copy size={13} />
                Copy request
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onCopyCurl(); }}>
                <TerminalSquare size={13} />
                Copy cURL
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onGenerateCurl(); }}>
                <TerminalSquare size={13} />
                Generate Code
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onExportRequest(); }}>
                <Download size={13} />
                Export request
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
