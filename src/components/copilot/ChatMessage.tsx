import { Copy, Sparkles } from "lucide-react";
import { CopilotAction, CopilotCard, CopilotMessage } from "../../types/copilot";
import { ActionToolbar } from "./ActionToolbar";
import { ExecutionPlanCard } from "./ExecutionPlanCard";
import { MissingInputForm } from "./MissingInputForm";
import styles from "./ChatMessage.module.css";

interface ChatMessageProps {
  message: CopilotMessage;
  typing?: boolean;
  onCopy: (content: string) => void;
  onAction: (action: CopilotAction) => void;
  onSubmitMissingInput: (prompt: string, values: Record<string, string>) => void;
}

function contextReferenceLabel(reference: NonNullable<CopilotMessage["contextReferences"]>[number]) {
  const endpointName = reference.metadata?.endpointName;
  return typeof endpointName === "string" ? endpointName : reference.label;
}

export function ChatMessage({
  message,
  typing = false,
  onCopy,
  onAction,
  onSubmitMissingInput,
}: ChatMessageProps) {
  return (
    <article className={`${styles.message} ${styles[message.role]}`}>
      <div className={styles.header}>
        <div className={styles.role}>
          {message.role !== "user" ? <Sparkles size={12} /> : null}
          <strong>{message.role === "user" ? "You" : message.role === "assistant" ? "BikAPI Copilot" : "System"}</strong>
        </div>
        {!typing && message.content ? (
          <button type="button" className={styles.copyButton} onClick={() => onCopy(message.content)} title="Copy message">
            <Copy size={12} />
          </button>
        ) : null}
      </div>
      <div className={styles.body}>
        <MarkdownContent content={message.content} typing={typing} />
        {message.contextReferences?.length ? (
          <div className={styles.contextReferences} aria-label="Context used for this message">
            {message.contextReferences.map((reference) => (
              <span
                key={`${reference.type}:${"id" in reference ? reference.id : reference.path}`}
                className={styles.contextReference}
              >
                <small>{reference.source === "mention" ? "@mention" : reference.pinned ? "pinned" : reference.type}</small>
                {contextReferenceLabel(reference)}
              </span>
            ))}
          </div>
        ) : null}
        {message.cards?.map((card, index) => (
          <CardRenderer
            key={`${message.id}:${card.type}:${index}`}
            card={card}
            onSubmitMissingInput={(values) => onSubmitMissingInput(message.content, values)}
          />
        ))}
        {message.actions?.length ? <ActionToolbar actions={message.actions} onAction={onAction} /> : null}
        {message.followUps?.length ? (
          <div className={styles.followUps}>
            {message.followUps.map((followUp) => (
              <span key={followUp}>{followUp}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CardRenderer({
  card,
  onSubmitMissingInput,
}: {
  card: CopilotCard;
  onSubmitMissingInput: (values: Record<string, string>) => void;
}) {
  if (card.type === "execution-plan") {
    return <ExecutionPlanCard card={card} />;
  }
  if (card.type === "missing-input") {
    return <MissingInputForm card={card} onSubmit={onSubmitMissingInput} />;
  }
  if (card.type === "progress") {
    return (
      <section className={styles.inlineCard}>
        <strong>{card.title}</strong>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(100, card.value))}%` }} />
        </div>
        {card.detail ? <span>{card.detail}</span> : null}
      </section>
    );
  }
  return (
    <section className={styles.inlineCard}>
      <strong>{card.title}</strong>
      <div className={styles.nodeStatuses}>
        {card.nodes.map((node) => (
          <div key={node.id} className={styles.nodeStatus}>
            <span className={`${styles.statusDot} ${styles[node.status]}`} />
            <strong>{node.name}</strong>
            {node.detail ? <span>{node.detail}</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function MarkdownContent({ content, typing }: { content: string; typing: boolean }) {
  if (typing) {
    return <div className={styles.typing}><span /><span /><span /></div>;
  }

  const blocks = content.split(/```/);
  return (
    <div className={styles.markdown}>
      {blocks.map((block, index) =>
        index % 2 === 1 ? (
          <pre key={`${block}-${index}`} className={styles.codeBlock}>
            <code>{block.replace(/^\w+\n/, "")}</code>
          </pre>
        ) : (
          block
            .split("\n\n")
            .filter((part) => part.trim())
            .map((part, partIndex) => {
              const trimmed = part.trim();
              if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
                const items = trimmed
                  .split("\n")
                  .map((line) => line.replace(/^[-•]\s*/, "").trim())
                  .filter(Boolean);
                return (
                  <ul key={`${trimmed}-${partIndex}`} className={styles.list}>
                    {items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                );
              }
              return <p key={`${trimmed}-${partIndex}`}>{trimmed}</p>;
            })
        ),
      )}
    </div>
  );
}
