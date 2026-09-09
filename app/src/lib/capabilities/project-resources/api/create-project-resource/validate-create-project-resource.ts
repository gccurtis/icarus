import type { CreateProjectResourceInput } from "$capabilities/project-resources/types/project-resources";

export const validateCreateProjectResource = (input: unknown): CreateProjectResourceInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("project-resources/create: an input is an object");
  }
  const fields = Object.keys(input);
  if (fields.some((field) => field !== "target" && field !== "title")) {
    throw new Error("project-resources/create: only target and title are accepted");
  }
  const { target, title } = input as { target?: unknown; title?: unknown };
  if (target !== "document" && target !== "slides" && target !== "spreadsheet") {
    throw new Error("project-resources/create: target is document, slides, or spreadsheet");
  }
  if (!Object.prototype.hasOwnProperty.call(input, "title")) {
    return { target };
  }
  if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 160) {
    throw new Error("project-resources/create: title, when supplied, is 1 to 160 characters");
  }
  return { target, title: title.trim() };
};
