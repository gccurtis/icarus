import {
  descriptionOf,
  fieldsOf,
  has,
  nameOf,
  only,
  revisionOf,
  tagsOf,
  templateIdOf
} from "$capabilities/templates/api/shared/validation";
import type {
  UpdateTemplateInput,
  UpdateTemplatePatch
} from "$capabilities/templates/types/templates";

export const validateUpdateTemplate = (input: unknown): UpdateTemplateInput => {
  const fields = fieldsOf(input, "update-template");
  only(fields, ["templateId", "baseRevision", "patch"], "update-template");
  const incoming = fieldsOf(fields.patch, "update-template");
  only(incoming, ["name", "description", "tags"], "update-template");
  if (Object.keys(incoming).length === 0) {
    throw new Error("templates/update-template: patch changes at least one field");
  }

  const patch: UpdateTemplatePatch = {
    ...(has(incoming, "name") ? { name: nameOf(incoming.name, "update-template") } : {}),
    ...(has(incoming, "description")
      ? {
          description:
            incoming.description === null
              ? null
              : descriptionOf(incoming.description, "update-template")
        }
      : {}),
    ...(has(incoming, "tags") ? { tags: tagsOf(incoming.tags, "update-template") } : {})
  };

  return {
    templateId: templateIdOf(fields.templateId, "update-template"),
    baseRevision: revisionOf(fields.baseRevision, "update-template"),
    patch
  };
};
