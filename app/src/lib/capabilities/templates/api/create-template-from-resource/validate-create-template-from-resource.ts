import {
  descriptionOf,
  fieldsOf,
  has,
  nameOf,
  only,
  tagsOf
} from "$capabilities/templates/api/shared/validation";
import {
  resourceIdOf,
  slideIdOf,
  stageTargetOf
} from "$capabilities/templates/api/shared/stage-validation";
import type { CreateTemplateFromResourceInput } from "$capabilities/templates/types/templates";

export const validateCreateTemplateFromResource = (
  input: unknown
): CreateTemplateFromResourceInput => {
  const fields = fieldsOf(input, "create-template-from-resource");
  only(
    fields,
    ["target", "resourceId", "name", "description", "tags", "slideId"],
    "create-template-from-resource"
  );
  const target = stageTargetOf(fields.target, "create-template-from-resource");
  const resourceId = resourceIdOf(fields.resourceId, "create-template-from-resource");
  if (resourceId.startsWith(target === "document" ? "slideDecks:" : "documents:")) {
    throw new Error(
      `templates/create-template-from-resource: a ${target} template comes from a ${target === "document" ? "document" : "deck"}`
    );
  }
  if (has(fields, "slideId") && target !== "slides") {
    throw new Error("templates/create-template-from-resource: only a deck template names a slide");
  }
  const description = has(fields, "description")
    ? descriptionOf(fields.description, "create-template-from-resource")
    : undefined;
  return {
    target,
    resourceId,
    name: nameOf(fields.name, "create-template-from-resource"),
    ...(description === undefined || description === "" ? {} : { description }),
    ...(has(fields, "tags") ? { tags: tagsOf(fields.tags, "create-template-from-resource") } : {}),
    ...(has(fields, "slideId") ? { slideId: slideIdOf(fields.slideId, "create-template-from-resource") } : {})
  };
};
