import type { TemplateStageTarget } from "$capabilities/templates/types/templates";

const requiredId = (value: unknown, subject: string, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`templates/${subject}: ${field} is required`);
  }
  return value;
};

export const stageTargetOf = (value: unknown, subject: string): TemplateStageTarget => {
  if (value !== "document" && value !== "slides") {
    throw new Error(`templates/${subject}: target is document or slides`);
  }
  return value;
};

const rowIdOf = (
  value: unknown,
  subject: string,
  table: string,
  field: string
): string => {
  const id = requiredId(value, subject, field);
  if (!new RegExp(`^${table}:[^.:\\s]+$`).test(id)) {
    throw new Error(`templates/${subject}: ${field} is one canonical ${table} row id`);
  }
  return id;
};

export const stageIdOf = (value: unknown, subject: string): string =>
  rowIdOf(value, subject, "templateStages", "stageId");

export const resourceIdOf = (value: unknown, subject: string): string => {
  const id = requiredId(value, subject, "resourceId");
  if (!/^(documents|slideDecks):[^.:\s]+$/.test(id)) {
    throw new Error(
      `templates/${subject}: resourceId is one canonical documents or slideDecks row id`
    );
  }
  return id;
};

export const slideIdOf = (value: unknown, subject: string): string => {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length === 0 ||
    value.length > 500
  ) {
    throw new Error(`templates/${subject}: slideId is an identifier`);
  }
  return value;
};
