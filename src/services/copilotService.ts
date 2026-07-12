import { CopilotContextSnapshot, CopilotMessage, CopilotResponse, CopilotService } from "../types/copilot";

function createMessage(content: string): CopilotMessage {
  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    followUps: ["Explain this collection", "Which request creates an order?", "Generate smoke test"],
  };
}

function summarizeContext(context: CopilotContextSnapshot) {
  return [
    context.workspaceName ? `Workspace: ${context.workspaceName}` : null,
    context.currentCollectionName ? `Collection: ${context.currentCollectionName}` : null,
    context.currentEnvironmentName ? `Environment: ${context.currentEnvironmentName}` : null,
    context.currentFlowName ? `Flow: ${context.currentFlowName}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function createUnavailableCopilotService(): CopilotService {
  return {
    async respond(context): Promise<CopilotResponse> {
      const summary = summarizeContext(context);
      return {
        message: createMessage(
          [
            "Copilot is available in the UI, but no LLM service is configured yet.",
            summary ? `Current context\n${summary}` : null,
            "Connect a Copilot adapter to generate flows, explain requests, and stage safe actions.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        ),
      };
    },
  };
}
