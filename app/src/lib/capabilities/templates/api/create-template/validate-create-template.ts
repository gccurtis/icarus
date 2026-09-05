import {
  descriptionOf,
  fieldsOf,
  has,
  nameOf,
  only,
  tagsOf,
  targetOf
} from "$capabilities/templates/api/shared/validation";
import type { CreateTemplateInput } from "$capabilities/templates/types/templates";

export const validateCreateTemplate = (input: unknown): CreateTemplateInput => {
  const fields = fieldsOf(input, "create-template");
  only(fields, ["target", "name", "description", "tags"], "create-template");
  const description = has(fields, "description")
    ? descriptionOf(fields.description, "create-template")
    : undefined;
  return {
    target: targetOf(fields.target, "create-template"),
    name: nameOf(fields.name, "create-template"),
    ...(description === undefined ? {} : { description }),
    ...(has(fields, "tags") ? { tags: tagsOf(fields.tags, "create-template") } : {})
  };
};
