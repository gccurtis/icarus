import type { CreateThreadInput } from "$capabilities/research-chat/types/research-chat";

export const validateCreateThread = (input: unknown): CreateThreadInput => {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("createThread takes an object");
  }
  const asked = input as Record<string, unknown>;
  if (asked.title === undefined) return {};
  if (typeof asked.title !== "string" || asked.title.trim() === "" || asked.title.length > 200) {
    throw new Error("a title is between one and two hundred characters");
  }
  return { title: asked.title.trim() };
};
