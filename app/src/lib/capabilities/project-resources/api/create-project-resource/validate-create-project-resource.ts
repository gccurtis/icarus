import {
  hasExactFields,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { CreateProjectResourceInput } from "$capabilities/project-resources/types/project-resources";

export const validateCreateProjectResource = (input: unknown): CreateProjectResourceInput => {
  const fields = storedFields(input);
  if (fields === undefined || !hasExactFields(fields, ["target"], ["title"])) {
    throw new Error("project-resources/create: only target and title are accepted");
  }
  const { target, title } = fields;
  if (target !== "document" && target !== "presentation" && target !== "spreadsheet") {
    throw new Error("project-resources/create: target is document, slides, or spreadsheet");
  }
  if (!Object.hasOwn(fields, "title")) {
    return { target };
  }
  if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 160) {
    throw new Error("project-resources/create: title, when supplied, is 1 to 160 characters");
  }
  return { target, title: title.trim() };
};
