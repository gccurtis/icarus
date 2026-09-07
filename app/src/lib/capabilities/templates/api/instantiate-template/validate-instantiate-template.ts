import {
  answersOf,
  fieldsOf,
  has,
  only,
  optionalNameOf,
  templateIdOf,
  textsOf
} from "$capabilities/templates/api/shared/validation";
import type { InstantiateTemplateInput } from "$capabilities/templates/types/templates";

export const validateInstantiateTemplate = (input: unknown): InstantiateTemplateInput => {
  const fields = fieldsOf(input, "instantiate-template");
  only(fields, ["templateId", "name", "answers", "texts"], "instantiate-template");
  const name = optionalNameOf(fields.name, "instantiate-template");
  return {
    templateId: templateIdOf(fields.templateId, "instantiate-template"),
    ...(name === undefined ? {} : { name }),
    ...(has(fields, "answers") ? { answers: answersOf(fields.answers, "instantiate-template") } : {}),
    ...(has(fields, "texts") ? { texts: textsOf(fields.texts, "instantiate-template") } : {})
  };
};
