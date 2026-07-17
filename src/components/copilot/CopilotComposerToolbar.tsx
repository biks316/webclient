import { AtSign, Paperclip, Send, Square } from "lucide-react";
import { CopilotMode } from "../../types/copilot";
import { IconButton } from "../common/IconButton";
import { CopilotModeSelector } from "./CopilotModeSelector";
import styles from "./CopilotComposer.module.css";

interface CopilotComposerToolbarProps {
  mode: CopilotMode;
  attachedCount: number;
  canSend: boolean;
  isLoading: boolean;
  onModeChange: (mode: CopilotMode) => void;
  onOpenAttachPicker: () => void;
  onOpenMentionPicker: () => void;
  onSend: () => void;
  onStop: () => void;
}

export function CopilotComposerToolbar({
  mode,
  attachedCount,
  canSend,
  isLoading,
  onModeChange,
  onOpenAttachPicker,
  onOpenMentionPicker,
  onSend,
  onStop,
}: CopilotComposerToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeading}>
        <IconButton title="Attach context" aria-label="Attach context" onClick={onOpenAttachPicker}>
          <Paperclip size={12} />
        </IconButton>
        <IconButton title="Mention context" aria-label="Mention context" onClick={onOpenMentionPicker}>
          <AtSign size={12} />
        </IconButton>
        <CopilotModeSelector mode={mode} onChange={onModeChange} />
      </div>
      <div className={styles.toolbarTrailing}>
        <span className={styles.countBadge}>{attachedCount}</span>
        <IconButton
          title={isLoading ? "Stop generation" : "Send prompt"}
          aria-label={isLoading ? "Stop generation" : "Send prompt"}
          className={canSend || isLoading ? styles.sendButton : ""}
          disabled={!isLoading && !canSend}
          onClick={isLoading ? onStop : onSend}
        >
          {isLoading ? <Square size={12} /> : <Send size={12} />}
        </IconButton>
      </div>
    </div>
  );
}
