import { isStoredDocumentBody } from "$representation/data/behavior/documents/stored-body";
import { isStoredSlideDeckBody } from "$representation/data/behavior/slide-decks/stored-body";
import { isStoredSpreadsheetTemplate } from "$representation/data/behavior/templates/stored-spreadsheet-body";
import { storedFields } from "$representation/data/behavior/core/stored";
import type { TemplateBody } from "$representation/data/types/templates/template";

const portable = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.every(portable);
  const held = storedFields(value);
  if (held === undefined) return true;
  if (held.kind === "reference" && storedFields(held.target)?.to === "resource") return false;
  if (held.kind === "range" && "resourceId" in held) return false;
  if (held.kind === "function" && "formulaId" in held) return false;
  if ((held.kind === "formula" || held.type === "formula") && "formulaId" in held) return false;
  if (held.type === "prompt" && "derivedOutputId" in held) return false;
  if (
    storedFields(held.link)?.kind === "actor" ||
    storedFields(held.link)?.kind === "persona" ||
    storedFields(held.link)?.kind === "resource"
  ) return false;
  if (held.type === "image" && (
    storedFields(held.source)?.kind === "file" || storedFields(held.source)?.kind === "storage"
  )) return false;
  if (held.kind === "image" && "fileId" in held && "fit" in held) return false;
  return Object.values(held).every(portable);
};

/** Exact current portable template body; bound project identities are never admitted. */
export const isStoredTemplateBody = (value: unknown): value is TemplateBody => {
  const body = storedFields(value);
  if (body === undefined || !portable(body)) return false;
  const { resource, ...content } = body;
  if (resource === "document") return isStoredDocumentBody(content);
  if (resource === "slides") return isStoredSlideDeckBody(content);
  return resource === "spreadsheet" && isStoredSpreadsheetTemplate(content);
};
