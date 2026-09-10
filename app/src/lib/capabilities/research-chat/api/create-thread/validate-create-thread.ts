import type { CreateThreadInput } from "$capabilities/research-chat/types/research-chat";
import { exactCommandInput } from "$capabilities/research-chat/api/shared/validation";

export const validateCreateThread = (input: unknown): CreateThreadInput => {
  const asked = exactCommandInput(input, [], ["title"], "createThread");
  if (!Object.hasOwn(asked, "title")) return {};
  if (typeof asked.title !== "string" || asked.title.trim() === "" || asked.title.length > 200) {
    throw new Error("a title is between one and two hundred characters");
  }
  return { title: asked.title.trim() };
};
