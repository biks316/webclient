import { useEffect, useMemo, useRef, useState } from "react";
import { CollectionIndex, RunResponse, VariableFile, WorkspaceIndex } from "../types/bik";
import {
  CopilotContextReference,
  CopilotContextSnapshot,
  CopilotMessage,
  CopilotMode,
  CopilotService,
  CopilotSession,
} from "../types/copilot";
import { dedupeContextReferences, toPinnedReference } from "./copilotContextIndex";
import { resolveCopilotContext } from "./copilotContextResolver";
import { loadCopilotSessions, saveCopilotSessions } from "./copilotSessionStore";

interface UseCopilotControllerArgs {
  context: CopilotContextSnapshot;
  workspace: WorkspaceIndex | null;
  selectedCollection: CollectionIndex | null;
  selectedEnvironment: VariableFile | null;
  response: RunResponse | null;
  responseError: string | null;
  textFiles: Array<{ path: string; content: string }>;
  service: CopilotService;
}

const DEFAULT_SESSION_TITLE = "New session";

function createSession(mode: CopilotMode = "ask"): CopilotSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: DEFAULT_SESSION_TITLE,
    mode,
    createdAt: now,
    updatedAt: now,
    messages: [],
    pinnedContext: [],
    draftPrompt: "",
    draftContext: [],
  };
}

function sessionTitleFromPrompt(prompt: string) {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return DEFAULT_SESSION_TITLE;
  }
  return normalized.length <= 48 ? normalized : `${normalized.slice(0, 45)}...`;
}

function updateSession(
  sessions: CopilotSession[],
  sessionId: string,
  updater: (session: CopilotSession) => CopilotSession,
) {
  return sessions.map((session) => (session.id === sessionId ? updater(session) : session));
}

function sameReference(left: CopilotContextReference, right: CopilotContextReference) {
  if (left.type !== right.type) {
    return false;
  }
  if ("id" in left && "id" in right) {
    return left.id === right.id;
  }
  if ("path" in left && "path" in right) {
    return left.path === right.path;
  }
  return left.label === right.label;
}

export function useCopilotController({
  context,
  workspace,
  selectedCollection,
  selectedEnvironment,
  response,
  responseError,
  textFiles,
  service,
}: UseCopilotControllerArgs) {
  const storageState = useMemo(() => loadCopilotSessions(context.workspacePath), [context.workspacePath]);
  const initialSession = useMemo(() => createSession(), []);
  const [sessions, setSessions] = useState<CopilotSession[]>(() => storageState?.sessions?.length ? storageState.sessions : [initialSession]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => storageState?.activeSessionId ?? storageState?.sessions?.[0]?.id ?? initialSession.id);
  const [isLoading, setIsLoading] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const activeRequestId = context.currentRequestId;
  const requestTokenRef = useRef(0);

  useEffect(() => {
    const stored = loadCopilotSessions(context.workspacePath);
    const nextSessions = stored?.sessions?.length ? stored.sessions : [createSession()];
    setSessions(nextSessions);
    setActiveSessionId(stored?.activeSessionId ?? nextSessions[0].id);
  }, [context.workspacePath]);

  useEffect(() => {
    if (!sessions.some((session) => session.id === activeSessionId) && sessions[0]) {
      setActiveSessionId(sessions[0].id);
    }
    saveCopilotSessions(context.workspacePath, { activeSessionId, sessions });
  }, [activeSessionId, context.workspacePath, sessions]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? createSession(),
    [activeSessionId, sessions],
  );

  const temporaryContext = activeSession.draftContext ?? [];
  const pinnedContext = activeSession.pinnedContext ?? [];
  const visibleContext = dedupeContextReferences([...pinnedContext, ...temporaryContext]);

  const suggestions = useMemo(() => {
    if (visibleContext.length === 0) {
      return ["Explain endpoint", "Create flow", "Generate tests", "Debug response"];
    }
    const primary = visibleContext[0];
    if (primary.type === "request") {
      return ["Explain", "Generate sample body", "Add to flow", "Generate tests"];
    }
    if (primary.type === "file") {
      return ["Summarize", "Find business rules", "Create flow", "Compare with collection"];
    }
    if (primary.type === "response") {
      return ["Explain failure", "Find root cause", "Suggest fix", "Create test"];
    }
    return ["Explain context", "Propose next step", "Generate tests", "Create flow"];
  }, [visibleContext]);

  function patchActiveSession(updater: (session: CopilotSession) => CopilotSession) {
    setSessions((current) => updateSession(current, activeSessionId, updater));
  }

  function createNewSession() {
    const session = createSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setIsLoading(false);
    setIsStopping(false);
  }

  function setDraftPrompt(prompt: string) {
    patchActiveSession((session) => ({
      ...session,
      draftPrompt: prompt,
      updatedAt: new Date().toISOString(),
    }));
  }

  function setMode(mode: CopilotMode) {
    patchActiveSession((session) => ({
      ...session,
      mode,
      updatedAt: new Date().toISOString(),
    }));
  }

  function attachContext(reference: CopilotContextReference) {
    patchActiveSession((session) => ({
      ...session,
      draftContext: dedupeContextReferences([
        ...(session.draftContext ?? []),
        toPinnedReference(reference, false, reference.source),
      ]),
      updatedAt: new Date().toISOString(),
    }));
  }

  function removeContext(reference: CopilotContextReference) {
    patchActiveSession((session) => ({
      ...session,
      pinnedContext: (session.pinnedContext ?? []).filter((item) => !sameReference(item, reference)),
      draftContext: (session.draftContext ?? []).filter((item) => !sameReference(item, reference)),
      updatedAt: new Date().toISOString(),
    }));
  }

  function togglePinned(reference: CopilotContextReference) {
    patchActiveSession((session) => {
      const pinned = session.pinnedContext ?? [];
      const temporary = session.draftContext ?? [];
      const isPinned = pinned.some((item) => sameReference(item, reference));
      if (isPinned) {
        return {
          ...session,
          pinnedContext: pinned.filter((item) => !sameReference(item, reference)),
          draftContext: dedupeContextReferences([...temporary, toPinnedReference(reference, false, "session")]),
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...session,
        pinnedContext: dedupeContextReferences([...pinned, toPinnedReference(reference, true, "session")]),
        draftContext: temporary.filter((item) => !sameReference(item, reference)),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function clearTemporaryContext() {
    patchActiveSession((session) => ({
      ...session,
      draftContext: [],
      updatedAt: new Date().toISOString(),
    }));
  }

  function stopGeneration() {
    if (!isLoading) {
      return;
    }
    requestTokenRef.current += 1;
    setIsLoading(false);
    setIsStopping(true);
    window.setTimeout(() => setIsStopping(false), 800);
  }

  function updateActionStep(
    actionId: string,
    stepId: string,
    status: "pending" | "running" | "done" | "failed",
  ) {
    patchActiveSession((session) => ({
      ...session,
      messages: session.messages.map((message) => {
        if (!message.actions?.some((action) => action.id === actionId)) {
          return message;
        }
        return {
          ...message,
          actions: message.actions.map((action) =>
            action.id === actionId ? { ...action, disabled: true } : action,
          ),
          cards: message.cards?.map((card) =>
            card.type === "execution-plan"
              ? {
                  ...card,
                  steps: card.steps.map((step) =>
                    step.id === stepId ? { ...step, status } : step,
                  ),
                }
              : card,
          ),
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  }

  function completeAction(actionId: string, outcome: "success" | "failed", detail: string) {
    patchActiveSession((session) => {
      let matched = false;
      const messages = session.messages.map((message) => {
        if (!message.actions?.some((action) => action.id === actionId)) {
          return message;
        }
        matched = true;
        return {
          ...message,
          actions: message.actions.map((action) =>
            action.id === actionId ? { ...action, disabled: true } : action,
          ),
          cards: message.cards?.map((card) =>
            card.type === "execution-plan"
              ? {
                  ...card,
                  steps: card.steps.map((step) => ({
                    ...step,
                    status:
                      outcome === "success"
                        ? "done" as const
                        : step.status === "running"
                          ? "failed" as const
                          : step.status,
                  })),
                }
              : card,
          ),
        };
      });

      if (!matched) {
        return session;
      }

      return {
        ...session,
        messages: [
          ...messages,
          {
            id: `system-${crypto.randomUUID()}`,
            role: "system",
            content: detail,
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async function sendPrompt(prompt = activeSession.draftPrompt ?? "", providedValues?: Record<string, string>) {
    const trimmed = prompt.trim();
    const references = dedupeContextReferences([...(activeSession.pinnedContext ?? []), ...(activeSession.draftContext ?? [])]);
    if ((!trimmed && references.length === 0) || isLoading) {
      return;
    }

    const nextRequestToken = requestTokenRef.current + 1;
    requestTokenRef.current = nextRequestToken;

    const messageContent = trimmed || `Use attached context: ${references.map((reference) => reference.label).join(", ")}`;
    const userMessage: CopilotMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      content: messageContent,
      createdAt: new Date().toISOString(),
      mode: activeSession.mode,
      contextReferences: references,
    };

    const nextMessages = [...activeSession.messages, userMessage];

    patchActiveSession((session) => ({
      ...session,
      title: session.title === DEFAULT_SESSION_TITLE && messageContent ? sessionTitleFromPrompt(messageContent) : session.title,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
      draftPrompt: "",
    }));

    setIsLoading(true);
    setIsStopping(false);

    try {
      const promptText = trimmed || messageContent;
      const resolvedContext = resolveCopilotContext({
        prompt: promptText,
        references,
        workspace,
        selectedCollection,
        selectedEnvironment,
        response,
        responseError,
        textFiles,
      });

      const responseMessage = await service.respond(context, nextMessages, {
        sessionId: activeSession.id,
        prompt: promptText,
        mode: activeSession.mode,
        references,
        resolvedContext,
        providedValues,
      });

      if (requestTokenRef.current !== nextRequestToken) {
        return;
      }

      patchActiveSession((session) => ({
        ...session,
        messages: [...nextMessages, responseMessage.message],
        updatedAt: new Date().toISOString(),
        draftContext: [],
      }));
    } catch (error) {
      if (requestTokenRef.current !== nextRequestToken) {
        return;
      }

      patchActiveSession((session) => ({
        ...session,
        messages: [
          ...nextMessages,
          {
            id: `system-${crypto.randomUUID()}`,
            role: "system",
            content: `Copilot request failed: ${error instanceof Error ? error.message : String(error)}`,
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
        draftContext: session.draftContext ?? references.filter((item) => !item.pinned),
      }));
    } finally {
      if (requestTokenRef.current === nextRequestToken) {
        setIsLoading(false);
      }
    }
  }

  return {
    sessions,
    activeSession,
    activeSessionId,
    suggestions,
    isLoading,
    isStopping,
    temporaryContext,
    pinnedContext,
    visibleContext,
    setActiveSessionId,
    createNewSession,
    setDraftPrompt,
    setMode,
    attachContext,
    removeContext,
    togglePinned,
    clearTemporaryContext,
    sendPrompt,
    stopGeneration,
    updateActionStep,
    completeAction,
    activeRequestId,
  };
}
