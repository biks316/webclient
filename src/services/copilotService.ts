import {
  CopilotBuildPlan,
  CopilotContextReference,
  CopilotContextSnapshot,
  CopilotConversationTurn,
  CopilotMessage,
  CopilotResponse,
  CopilotService,
} from "../types/copilot";
import { AiConnectionConfig, AiChatMessage, sendAiChat } from "./tauriApi";
import {
  BUILD_MODE_SYSTEM_INSTRUCTIONS,
  buildOperationLabel,
  parseCopilotBuildResponse,
  parseExplicitBuildPrompt,
} from "./copilotBuildPlan";

function createMessage(content: string, extras: Partial<CopilotMessage> = {}): CopilotMessage {
  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    followUps: ["Explain this collection", "Which request creates an order?", "Generate smoke test"],
    ...extras,
  };
}

function historyAfterUnavailableMessage(history: CopilotMessage[]) {
  let lastUnavailableIndex = -1;
  history.forEach((message, index) => {
    if (
      message.role === "assistant" &&
      (message.content.includes("no LLM service is configured yet") ||
        message.content.includes("Connect a Copilot adapter") ||
        message.content.trim() === "Connection unavailable")
    ) {
      lastUnavailableIndex = index;
    }
  });
  return history.slice(lastUnavailableIndex + 1);
}

function boundedJson(value: unknown, maxLength = 14_000) {
  const serialized = JSON.stringify(value);
  if (serialized.length <= maxLength) {
    return serialized;
  }
  return `${serialized.slice(0, maxLength)}...[context truncated]`;
}

function workspaceContextForTurn(
  context: CopilotContextSnapshot,
  turn: CopilotConversationTurn,
) {
  if (turn.references.length === 0) {
    return context;
  }
  return {
    workspaceName: context.workspaceName,
    workspacePath: context.workspacePath,
    currentSelection: {
      collectionId: context.currentCollectionId,
      collectionName: context.currentCollectionName,
      requestId: context.currentRequestId,
      requestName: context.currentRequestName,
      environmentId: context.currentEnvironmentId,
      environmentName: context.currentEnvironmentName,
      flowId: context.currentFlowId,
      flowName: context.currentFlowName,
    },
    collections: context.collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      requestCount: collection.requestCount,
      flowCount: collection.flowCount,
    })),
    variables: context.variables,
    recentExecutionHistory: context.recentExecutionHistory,
  };
}

function metadataString(reference: CopilotContextReference, key: string) {
  const value = reference.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function collectionNameById(context: CopilotContextSnapshot, collectionId: string) {
  return context.collections.find((collection) => collection.id === collectionId)?.name ?? null;
}

function collectionNameForReference(
  context: CopilotContextSnapshot,
  reference: CopilotContextReference,
) {
  if (reference.type === "collection") {
    return collectionNameById(context, reference.id) ?? reference.label;
  }
  if (
    reference.type === "request" ||
    reference.type === "flow" ||
    reference.type === "flow-node"
  ) {
    return collectionNameById(context, reference.collectionId)
      ?? metadataString(reference, "collectionName");
  }
  return null;
}

function collectionNamesForReferences(
  context: CopilotContextSnapshot,
  references: CopilotContextReference[],
) {
  const names = references
    .map((reference) => collectionNameForReference(context, reference))
    .filter((name): name is string => Boolean(name?.trim()));
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.trim().toLocaleLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function preferredBuildCollectionName(
  context: CopilotContextSnapshot,
  turn: CopilotConversationTurn,
) {
  const mentionNames = collectionNamesForReferences(
    context,
    turn.references.filter((reference) => reference.source === "mention"),
  );
  if (mentionNames.length === 1) {
    return mentionNames[0];
  }
  if (mentionNames.length > 1) {
    return null;
  }

  const temporaryNames = collectionNamesForReferences(
    context,
    turn.references.filter((reference) => !reference.pinned),
  );
  if (temporaryNames.length === 1) {
    return temporaryNames[0];
  }
  if (temporaryNames.length > 1) {
    return null;
  }

  const attachedNames = collectionNamesForReferences(context, turn.references);
  if (attachedNames.length === 1) {
    return attachedNames[0];
  }
  if (attachedNames.length > 1) {
    return null;
  }
  return context.currentCollectionName;
}

function referenceSummary(context: CopilotContextSnapshot, reference: CopilotContextReference) {
  const attachment = reference.source === "mention"
    ? "@mention"
    : reference.pinned
      ? "pinned"
      : "attached";
  const collectionName = collectionNameForReference(context, reference);
  switch (reference.type) {
    case "collection":
      return `- [${attachment}] Collection “${reference.label}” (id: ${reference.id})`;
    case "request":
      return `- [${attachment}] Request “${metadataString(reference, "endpointName") ?? reference.label}” in collection “${collectionName ?? "unknown"}”: ${reference.method} ${reference.url || "(URL not set)"}`;
    case "flow":
      return `- [${attachment}] Flow “${reference.label}” in collection “${collectionName ?? "unknown"}”`;
    case "flow-node":
      return `- [${attachment}] Flow node “${reference.label}” in collection “${collectionName ?? "unknown"}”`;
    case "file":
      return `- [${attachment}] File “${reference.label}” at ${reference.path}`;
    case "schema":
      return `- [${attachment}] Schema “${reference.label}” at ${reference.path}`;
    case "environment":
      return `- [${attachment}] Environment “${reference.label}” (id: ${reference.id})`;
    case "response":
      return `- [${attachment}] Response “${reference.label}”${reference.status !== null && reference.status !== undefined ? ` with status ${reference.status}` : ""}`;
  }
}

function groundedUserContent(
  context: CopilotContextSnapshot,
  turn: CopilotConversationTurn,
) {
  if (turn.references.length === 0) {
    return turn.prompt;
  }
  return [
    `User request:\n${turn.prompt}`,
    "Explicit @mention/attached context for this turn (@mentions and temporary attachments have highest priority; pinned items are supplemental):",
    ...turn.references.map((reference) => referenceSummary(context, reference)),
    `Resolved context data:\n${boundedJson(turn.resolvedContext)}`,
    "Resolve words such as this, it, that, current, or selected against the attached context above before using the UI's current selection.",
    "Answer the user request from this context; do not merely repeat the context payload.",
  ].join("\n\n");
}

function groundedHistory(
  context: CopilotContextSnapshot,
  history: CopilotMessage[],
  turn: CopilotConversationTurn,
): AiChatMessage[] {
  const messages = historyAfterUnavailableMessage(history)
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-20)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
  let lastUserIndex = -1;
  messages.forEach((message, index) => {
    if (message.role === "user") {
      lastUserIndex = index;
    }
  });
  const content = groundedUserContent(context, turn);
  if (lastUserIndex >= 0) {
    messages[lastUserIndex] = { role: "user", content };
  } else {
    messages.push({ role: "user", content });
  }
  return messages;
}

function createBuildPlanResponse(plan: CopilotBuildPlan): CopilotResponse {
  return {
    message: createMessage(plan.summary, {
      cards: [{
        type: "execution-plan",
        title: "Build plan",
        steps: plan.operations.map((operation) => ({
          id: operation.id,
          label: buildOperationLabel(operation),
          status: "pending",
        })),
      }],
      actions: [{
        id: `apply-${plan.id}`,
        label: plan.operations.length === 1 ? "Apply change" : `Apply ${plan.operations.length} changes`,
        intent: "apply_build_plan",
        requiresConfirmation: true,
        buildPlan: plan,
      }],
      followUps: [],
    }),
  };
}

export function createUnavailableCopilotService(): CopilotService {
  return {
    async respond(): Promise<CopilotResponse> {
      return {
        message: createMessage("Connection unavailable"),
      };
    },
  };
}

export function createConnectedCopilotService(
  connection: AiConnectionConfig | null | undefined,
): CopilotService {
  if (!connection?.enabled) {
    return createUnavailableCopilotService();
  }

  return {
    async respond(context, history, turn): Promise<CopilotResponse> {
      const buildCollectionName = preferredBuildCollectionName(context, turn);
      if (turn.mode === "build") {
        const explicitPlan = parseExplicitBuildPrompt(turn.prompt, buildCollectionName);
        if (explicitPlan) {
          return createBuildPlanResponse(explicitPlan);
        }
      }

      const systemMessage: AiChatMessage = {
        role: "system",
        content: [
          "You are BikAPI Copilot, an assistant for API requests, collections, environments, and flows.",
          "Give concise, actionable answers grounded in the supplied BikAPI context.",
          "Answer the request itself. Do not merely echo or restate raw context JSON unless the user asks for it.",
          "You are connected to the configured model. Never claim that no LLM service or Copilot adapter is configured.",
          "When the latest user message contains an explicit @mention/attached-context block, it is authoritative and takes priority over the current UI selection.",
          `Current workspace context:\n${boundedJson(workspaceContextForTurn(context, turn))}`,
          `Current mode: ${turn.mode}`,
          turn.providedValues ? `Provided values:\n${JSON.stringify(turn.providedValues)}` : null,
          turn.mode === "build" ? BUILD_MODE_SYSTEM_INSTRUCTIONS : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      };
      const messages: AiChatMessage[] = [
        systemMessage,
        ...groundedHistory(context, history, turn),
      ];

      try {
        const result = await sendAiChat(messages);
        if (turn.mode === "build") {
          const parsed = parseCopilotBuildResponse(result.content, buildCollectionName);
          if (!parsed.plan) {
            return {
              message: createMessage(parsed.message, {
                followUps: ["Create a collection", "Create an endpoint in the current collection"],
              }),
            };
          }

          return createBuildPlanResponse(parsed.plan);
        }
        return { message: createMessage(result.content) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Connection unavailable")) {
          return { message: createMessage("Connection unavailable") };
        }
        throw new Error(message);
      }
    },
  };
}
