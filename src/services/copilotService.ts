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
    async respond(context, _history, turn): Promise<CopilotResponse> {
      const summary = summarizeContext(context);
      const contextSummary = [
        turn.references.length ? `Attached references: ${turn.references.map((reference) => reference.label).join(", ")}` : null,
        turn.mode ? `Mode: ${turn.mode}` : null,
        turn.resolvedContext.requests.length ? `Requests: ${turn.resolvedContext.requests.length}` : null,
        turn.resolvedContext.files.length ? `Files: ${turn.resolvedContext.files.length}` : null,
        turn.resolvedContext.flows.length ? `Flows: ${turn.resolvedContext.flows.length}` : null,
        turn.resolvedContext.responses.length ? `Responses: ${turn.resolvedContext.responses.length}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      return {
        message: createMessage(
          [
            "Copilot is available in the UI, but no LLM service is configured yet.",
            summary ? `Current context\n${summary}` : null,
            contextSummary ? `Resolved turn context\n${contextSummary}` : null,
            "Connect a Copilot adapter to generate flows, explain requests, and stage safe actions.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        ),
      };
    },
  };
}
