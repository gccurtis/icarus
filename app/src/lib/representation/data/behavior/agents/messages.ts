import type { Message, MessageRole } from "$representation/data/types/agents/message";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";

export const textBlockOf = (id: string, text: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-a`, kind: "literal", text }],
  display: text,
  marks: []
});

export const textMessage = (
  id: string,
  role: MessageRole,
  author: Actor,
  sentAt: number,
  text: string
): Message => ({
  id,
  role,
  author,
  sentAt,
  blocks: [textBlockOf(`${id}-b`, text)],
  state: "complete"
});

export const messageText = (message: Message): string =>
  message.blocks
    .flatMap((block) => (block.type === "text" ? [block.display] : []))
    .join("\n")
    .trim();
