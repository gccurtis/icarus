import { messageText } from "$representation/data/behavior/agents/messages";
import type { Message } from "$representation/data/types/agents/message";
import type { ContentBlock } from "$representation/data/types/content/content-block";

export const pendingPrompts = (messages: readonly Message[]): readonly Message[] => {
  let after = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "response") {
      after = index + 1;
      break;
    }
  }
  return messages.slice(after).filter((message) => message.role === "prompt");
};

export const promptText = (messages: readonly Message[]): string => messages
  .map((message) => messageText(message))
  .filter((text) => text.length > 0)
  .join("\n\nAdditional direction:\n");

export const priorConversation = (
  messages: readonly Message[],
  current: readonly Message[]
): readonly { readonly asked: string; readonly answered: string }[] => {
  const currentIds = new Set(current.map((message) => message.id));
  const history: { asked: string; answered: string }[] = [];
  let asked: string[] = [];
  for (const message of messages) {
    if (currentIds.has(message.id)) continue;
    const text = messageText(message);
    if (text.length === 0) continue;
    if (message.role === "prompt") {
      asked.push(text);
      continue;
    }
    if (asked.length > 0) {
      history.push({ asked: asked.join("\n\n"), answered: text });
      asked = [];
    }
  }
  return history.slice(-4);
};

export const answerText = (blocks: readonly ContentBlock[]): string => blocks
  .flatMap((block) => (block.type === "text" ? [block.display] : []))
  .join("\n\n")
  .trim();

export const safeRunnerFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "The Agent task could not finish")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);
