import { fieldsOf, has, idOf, only, optionalTextOf } from "$capabilities/agents/api/shared/validation";
import type { CreateChatInput } from "$capabilities/agents/types/agents";

export const validateCreateChat = (input: unknown): CreateChatInput => {
  const fields = fieldsOf(input, "create-chat");
  only(fields, ["personaId", "title"], "create-chat");
  const title = has(fields, "title") ? optionalTextOf(fields.title, "create-chat", "title", 200) : undefined;
  return {
    personaId: idOf(fields.personaId, "personas", "create-chat", "personaId"),
    ...(title === undefined ? {} : { title })
  };
};
