import {
  answersOf,
  fieldsOf,
  has,
  only,
  optionalNameOf,
  templateIdOf
} from "$capabilities/templates/api/shared/validation";
import type { InstantiateTemplateInput } from "$capabilities/templates/types/templates";

export const validateInstantiateTemplate = (input: unknown): InstantiateTemplateInput => {
  const fields = fieldsOf(input, "instantiate-template");
  only(fields, ["templateId", "name", "answers"], "instantiate-template");
  const name = optionalNameOf(fields.name, "instantiate-template");
  return {
    templateId: templateIdOf(fields.templateId, "instantiate-template"),
    ...(name === undefined ? {} : { name }),
    ...(has(fields, "answers") ? { answers: answersOf(fields.answers, "instantiate-template") } : {})
  };
};
