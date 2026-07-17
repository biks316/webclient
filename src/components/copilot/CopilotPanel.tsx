import { Bot, GripVertical, History, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CopilotAction, CopilotContextSearchItem, CopilotContextSnapshot, CopilotMessage, CopilotSession } from "../../types/copilot";
import { ChatMessage } from "./ChatMessage";
import { ContextBadge } from "./ContextBadge";
import { CopilotComposer } from "./CopilotComposer";
import { IconButton } from "../common/IconButton";
import styles from "./CopilotPanel.module.css";

interface CopilotPanelProps {
  context: CopilotContextSnapshot;
  session: CopilotSession;
  sessions: CopilotSession[];
  mentionItems: CopilotContextSearchItem[];
  suggestions: string[];
  isLoading: boolean;
  isStopping: boolean;
  onClose: () => void;
  onCreateSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onSuggestionSelect: (prompt: string) => void;
  onPromptChange: (value: string) => void;
  onModeChange: (mode: CopilotSession["mode"]) => void;
  onAttachContext: (reference: CopilotContextSearchItem["reference"]) => void;
  onRemoveContext: (reference: CopilotContextSearchItem["reference"]) => void;
  onTogglePinned: (reference: CopilotContextSearchItem["reference"]) => void;
  onSubmitPrompt: () => void;
  onStopGeneration: () => void;
  onSubmitMissingInput: (prompt: string, values: Record<string, string>) => void;
  onAction: (action: CopilotAction) => void;
  onCopy: (content: string) => void;
}

export function CopilotPanel({
  context,
  session,
  sessions,
  mentionItems,
  suggestions,
  isLoading,
  isStopping,
  onClose,
  onCreateSession,
  onSwitchSession,
  onSuggestionSelect,
  onPromptChange,
  onModeChange,
  onAttachContext,
  onRemoveContext,
  onTogglePinned,
  onSubmitPrompt,
  onStopGeneration,
  onSubmitMissingInput,
  onAction,
  onCopy,
}: CopilotPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const messages: CopilotMessage[] = session.messages;
  const visibleContext = [...(session.pinnedContext ?? []), ...(session.draftContext ?? [])];

  useEffect(() => {
    if (!historyOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!historyRef.current?.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [historyOpen]);

  return (
    <aside className={styles.panel}>
      <div className={styles.resizeGrip} aria-hidden="true">
        <GripVertical size={12} />
      </div>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.title}>
            <Bot size={15} />
            <div>
              <strong>BikAPI Copilot</strong>
              <span>{isStopping ? "Generation stopped." : "Context-aware guidance for requests, flows, and collections."}</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <IconButton title="New session" aria-label="New session" onClick={onCreateSession}>
              <Plus size={12} />
            </IconButton>
            <div className={styles.historyWrap} ref={historyRef}>
              <IconButton
                title="Session history"
                aria-label="Session history"
                className={historyOpen ? styles.activeButton : ""}
                onClick={() => setHistoryOpen((current) => !current)}
              >
                <History size={12} />
              </IconButton>
              {historyOpen ? (
                <div className={styles.historyMenu}>
                  {sessions.slice(0, 10).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === session.id ? styles.historyItemActive : ""}
                      onClick={() => {
                        setHistoryOpen(false);
                        onSwitchSession(item.id);
                      }}
                    >
                      <strong>{item.title}</strong>
                      <small>{new Date(item.updatedAt).toLocaleString()}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <IconButton title="Close Copilot" aria-label="Close Copilot" onClick={onClose}>
              <X size={12} />
            </IconButton>
          </div>
        </div>
        <div className={styles.contextGrid}>
          <ContextBadge label="Workspace" value={context.workspaceName} />
          <ContextBadge label="Collection" value={context.currentCollectionName} />
          <ContextBadge label="Environment" value={context.currentEnvironmentName} />
          <ContextBadge label="Flow" value={context.currentFlowName} />
        </div>
      </div>

      <div className={styles.conversation}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Bot size={16} />
            </div>
            <strong>{session.title}</strong>
            <span className={styles.emptyText}>Use mentions, drag requests in, or pin context for this session.</span>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onCopy={onCopy}
                onAction={onAction}
                onSubmitMissingInput={onSubmitMissingInput}
              />
            ))}
            {isLoading ? (
              <ChatMessage
                message={{
                  id: "typing",
                  role: "assistant",
                  content: "",
                  createdAt: new Date().toISOString(),
                }}
                typing
                onCopy={onCopy}
                onAction={onAction}
                onSubmitMissingInput={onSubmitMissingInput}
              />
            ) : null}
          </>
        )}
      </div>

      <div className={styles.footer}>
        <CopilotComposer
          value={session.draftPrompt ?? ""}
          context={visibleContext}
          items={mentionItems}
          mode={session.mode}
          suggestions={suggestions}
          isLoading={isLoading}
          onChange={onPromptChange}
          onModeChange={onModeChange}
          onAttachContext={onAttachContext}
          onRemoveContext={onRemoveContext}
          onTogglePinned={onTogglePinned}
          onSuggestionSelect={onSuggestionSelect}
          onSubmit={onSubmitPrompt}
          onStop={onStopGeneration}
        />
      </div>
    </aside>
  );
}
