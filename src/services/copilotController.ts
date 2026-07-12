import { useMemo, useState } from "react";
import { CopilotContextSnapshot, CopilotMessage, CopilotService } from "../types/copilot";

interface UseCopilotControllerArgs {
  context: CopilotContextSnapshot;
  service: CopilotService;
}

export function useCopilotController({ context, service }: UseCopilotControllerArgs) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const suggestions = useMemo(
    () => [
      "Create a booking flow",
      "Explain this collection",
      "Which request creates an order?",
      "Map customerId automatically",
      "Generate smoke test",
      "Explain why this request failed",
    ],
    [],
  );

  async function sendPrompt(prompt: string, providedValues?: Record<string, string>) {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) {
      return;
    }
    const userMessage: CopilotMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setIsLoading(true);

    try {
      const response = await service.respond(context, nextHistory, { prompt: trimmed, providedValues });
      setMessages((current) => [...current, response.message]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `system-${crypto.randomUUID()}`,
          role: "system",
          content: `Copilot request failed: ${error instanceof Error ? error.message : String(error)}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return { messages, suggestions, isLoading, sendPrompt };
}
