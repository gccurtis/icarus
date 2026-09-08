import {
  descriptionOf,
  fieldsOf,
  has,
  nameOf,
  only,
  revisionOf,
  tagsOf,
  holesOf,
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
  only(incoming, ["name", "description", "tags", "holeDescription", "holes"], "update-template");
  if (Object.keys(incoming).length === 0) {
    throw new Error("templates/update-template: patch changes at least one field");
  }

  const holeDescription = has(incoming, "holeDescription")
    ? fieldsOf(incoming.holeDescription, "update-template")
    : undefined;
  if (holeDescription !== undefined) {
    only(holeDescription, ["name", "description"], "update-template");
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
    ...(has(incoming, "tags") ? { tags: tagsOf(incoming.tags, "update-template") } : {}),
    ...(has(incoming, "holes")
      ? { holes: holesOf(incoming.holes, "update-template", true) }
      : {}),
    ...(holeDescription === undefined
      ? {}
      : {
          holeDescription: {
            name: nameOf(holeDescription.name, "update-template"),
            description:
              holeDescription.description === null
                ? null
                : descriptionOf(holeDescription.description, "update-template")
          }
        })
  };

  return {
    templateId: templateIdOf(fields.templateId, "update-template"),
    baseRevision: revisionOf(fields.baseRevision, "update-template"),
    patch
  };
};
