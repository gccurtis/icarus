import {
  hasExactFields,
  storedFields
} from "$representation/data/behavior/core/stored";

import { assertStoredValue } from "$capabilities/templates/api/shared/body-validation/primitives";
import type { TemplateTarget } from "$capabilities/templates/types/templates";

export type Fields = Record<string, unknown>;

export const fieldsOf = (value: unknown, subject: string): Fields => {
  const fields = storedFields(value);
  if (fields === undefined) {
    throw new Error(`templates/${subject}: an object is required`);
  }
  return fields;
};

export const requiredId = (value: unknown, subject: string, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`templates/${subject}: ${field} is required`);
  }
  return value;
};

export const templateIdOf = (value: unknown, subject: string): string => {
  const id = requiredId(value, subject, "templateId");
  if (!/^templates:[^.:\s]+$/.test(id)) {
    throw new Error(`templates/${subject}: templateId is one canonical templates row id`);
  }
  return id;
};

export const revisionOf = (value: unknown, subject: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`templates/${subject}: baseRevision is a safe positive revision number`);
  }
  return value;
};

export const targetOf = (value: unknown, subject: string): TemplateTarget => {
  if (value !== "document" && value !== "presentation" && value !== "spreadsheet") {
    throw new Error(`templates/${subject}: target is document, slides, or spreadsheet`);
  }
  return value;
};

export const nameOf = (value: unknown, subject: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`templates/${subject}: name is required`);
  }
  const name = value.trim();
  if (name.length > 160) {
    throw new Error(`templates/${subject}: name is at most 160 characters`);
  }
  return name;
};

export const optionalNameOf = (value: unknown, subject: string): string | undefined =>
  value === undefined ? undefined : nameOf(value, subject);

export const descriptionOf = (value: unknown, subject: string): string => {
  if (typeof value !== "string") {
    throw new Error(`templates/${subject}: description is text`);
  }
  const description = value.trim();
  if (description.length > 4_000) {
    throw new Error(`templates/${subject}: description is at most 4000 characters`);
  }
  return description;
};

export const tagsOf = (value: unknown, subject: string): readonly string[] => {
  assertStoredValue(value, subject);
  if (!Array.isArray(value)) {
    throw new Error(`templates/${subject}: tags is a list of text`);
  }
  if (value.length > 50) {
    throw new Error(`templates/${subject}: a template has at most 50 tags`);
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`templates/${subject}: every tag is non-empty text`);
    }
    const tag = entry.trim();
    if (tag.length > 80) {
      throw new Error(`templates/${subject}: a tag is at most 80 characters`);
    }
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
};

export const has = (fields: Fields, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(fields, field);

export const only = (fields: Fields, allowed: readonly string[], subject: string): void => {
  if (hasExactFields(fields, [], allowed)) return;
  const extra = Reflect.ownKeys(fields).filter(
    (field): field is string => typeof field === "string" && !allowed.includes(field)
  );
  if (extra.length > 0) {
    throw new Error(
      `templates/${subject}: unknown ${extra.length === 1 ? "field" : "fields"} ${extra.join(", ")}`
    );
  }
  throw new Error(`templates/${subject}: fields must be exact current data`);
};
