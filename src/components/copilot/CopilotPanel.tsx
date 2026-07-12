import { Bot, GripVertical, Sparkles } from "lucide-react";
import { CopilotAction, CopilotContextSnapshot, CopilotMessage } from "../../types/copilot";
import { ChatMessage } from "./ChatMessage";
import { ContextBadge } from "./ContextBadge";
import { PromptInput } from "./PromptInput";
import styles from "./CopilotPanel.module.css";

interface CopilotPanelProps {
  context: CopilotContextSnapshot;
  messages: CopilotMessage[];
  suggestions: string[];
  isLoading: boolean;
  onClose: () => void;
  onSuggestionSelect: (prompt: string) => void;
  onSubmitPrompt: (prompt: string) => void;
  onSubmitMissingInput: (prompt: string, values: Record<string, string>) => void;
  onAction: (action: CopilotAction) => void;
  onCopy: (content: string) => void;
}

export function CopilotPanel({
  context,
  messages,
  suggestions,
  isLoading,
  onClose,
  onSuggestionSelect,
  onSubmitPrompt,
  onSubmitMissingInput,
  onAction,
  onCopy,
}: CopilotPanelProps) {
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
              <span>Context-aware guidance for requests, flows, and collections.</span>
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            Close
          </button>
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
              <Sparkles size={16} />
            </div>
            <strong>Ask BikAPI...</strong>
            <div className={styles.suggestionList}>
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => onSuggestionSelect(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
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
        <PromptInput disabled={isLoading} onSubmit={onSubmitPrompt} />
      </div>
    </aside>
  );
}
