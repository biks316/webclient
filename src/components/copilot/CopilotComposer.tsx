import { useEffect, useMemo, useRef, useState } from "react";
import { CopilotContextReference, CopilotContextSearchItem, CopilotMode } from "../../types/copilot";
import { filterCopilotContextItems, resolveDroppedCopilotReference } from "../../services/copilotContextIndex";
import { CopilotComposerToolbar } from "./CopilotComposerToolbar";
import { CopilotContextChips } from "./CopilotContextChips";
import { CopilotDropZone } from "./CopilotDropZone";
import { CopilotMentionMenu } from "./CopilotMentionMenu";
import { CopilotPromptTextarea } from "./CopilotPromptTextarea";
import styles from "./CopilotComposer.module.css";

interface CopilotComposerProps {
  value: string;
  context: CopilotContextReference[];
  items: CopilotContextSearchItem[];
  mode: CopilotMode;
  suggestions: string[];
  isLoading: boolean;
  onChange: (value: string) => void;
  onModeChange: (mode: CopilotMode) => void;
  onAttachContext: (reference: CopilotContextReference) => void;
  onRemoveContext: (reference: CopilotContextReference) => void;
  onTogglePinned: (reference: CopilotContextReference) => void;
  onSuggestionSelect: (prompt: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

interface MentionState {
  query: string;
  start: number;
  end: number;
  pickerOnly: boolean;
}

function findMentionState(value: string, caret: number): MentionState | null {
  const prefix = value.slice(0, caret);
  const atIndex = prefix.lastIndexOf("@");
  if (atIndex === -1) {
    return null;
  }
  const before = prefix.slice(0, atIndex);
  if (before.length > 0 && !/\s$/.test(before)) {
    return null;
  }
  const query = prefix.slice(atIndex + 1);
  if (/\s/.test(query)) {
    return null;
  }
  return {
    query,
    start: atIndex,
    end: caret,
    pickerOnly: false,
  };
}

function caretCoordinates(textarea: HTMLTextAreaElement) {
  const rect = textarea.getBoundingClientRect();
  return {
    top: rect.top - 8,
    left: rect.left + 12,
  };
}

export function CopilotComposer({
  value,
  context,
  items,
  mode,
  suggestions,
  isLoading,
  onChange,
  onModeChange,
  onAttachContext,
  onRemoveContext,
  onTogglePinned,
  onSuggestionSelect,
  onSubmit,
  onStop,
}: CopilotComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const filteredItems = useMemo(() => {
    const query = mentionState?.query ?? "";
    return filterCopilotContextItems(items, query);
  }, [items, mentionState?.query]);

  const menuOpen = pickerOpen || Boolean(mentionState);
  const canSend = value.trim().length > 0 || context.length > 0;

  useEffect(() => {
    if (!menuOpen || !textareaRef.current) {
      return;
    }
    setAnchor(caretCoordinates(textareaRef.current));
    setActiveIndex(0);
  }, [menuOpen, mentionState?.query]);

  function focusTextarea() {
    textareaRef.current?.focus();
  }

  function handleSelectionSync() {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    if (pickerOpen) {
      return;
    }
    setMentionState(findMentionState(value, element.selectionStart ?? value.length));
  }

  function handleSelectItem(item: CopilotContextSearchItem) {
    onAttachContext({
      ...item.reference,
      source: mentionState && !mentionState.pickerOnly ? "mention" : "picker",
    });
    if (mentionState) {
      const nextValue = `${value.slice(0, mentionState.start)}${value.slice(mentionState.end)}`.replace(/\s{2,}/g, " ");
      onChange(nextValue);
    }
    setMentionState(null);
    setPickerOpen(false);
    focusTextarea();
  }

  function openAttachPicker() {
    setPickerOpen(true);
    setMentionState({
      query: "",
      start: value.length,
      end: value.length,
      pickerOnly: true,
    });
    window.requestAnimationFrame(focusTextarea);
  }

  function openMentionPicker() {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? value.length;
    const nextValue = `${value.slice(0, start)}@${value.slice(start)}`;
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      const input = textareaRef.current;
      if (!input) {
        return;
      }
      const nextCaret = start + 1;
      input.focus();
      input.setSelectionRange(nextCaret, nextCaret);
      setMentionState({ query: "", start, end: nextCaret, pickerOnly: false });
    });
  }

  return (
    <div className={styles.composer}>
      <CopilotContextChips context={context} onTogglePinned={onTogglePinned} onRemove={onRemoveContext} />
      <CopilotDropZone
        active={dropActive}
        onDragEnter={(event) => {
          event.preventDefault();
          setDropActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDropActive(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDropActive(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDropActive(false);
          const reference = resolveDroppedCopilotReference(event.dataTransfer, items);
          if (reference) {
            onAttachContext(reference);
          }
        }}
      >
        <CopilotPromptTextarea
          ref={textareaRef}
          value={value}
          disabled={isLoading}
          onChange={(nextValue) => {
            onChange(nextValue);
            window.requestAnimationFrame(handleSelectionSync);
          }}
          onSelect={handleSelectionSync}
          onKeyDown={(event) => {
            if (menuOpen && filteredItems.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => (current + 1) % filteredItems.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => (current - 1 + filteredItems.length) % filteredItems.length);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setPickerOpen(false);
                setMentionState(null);
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSelectItem(filteredItems[activeIndex] ?? filteredItems[0]);
                return;
              }
            }

            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) {
                onSubmit();
              }
            }
          }}
        />
        <CopilotMentionMenu
          open={menuOpen}
          items={filteredItems}
          activeIndex={activeIndex}
          anchor={anchor}
          onSelect={handleSelectItem}
        />
      </CopilotDropZone>

      {value.trim().length === 0 ? (
        <div className={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => onSuggestionSelect(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <CopilotComposerToolbar
        mode={mode}
        attachedCount={context.length}
        canSend={canSend}
        isLoading={isLoading}
        onModeChange={onModeChange}
        onOpenAttachPicker={openAttachPicker}
        onOpenMentionPicker={openMentionPicker}
        onSend={onSubmit}
        onStop={onStop}
      />
    </div>
  );
}
