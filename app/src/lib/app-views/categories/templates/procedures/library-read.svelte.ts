import {
  readTemplate,
  readTemplateLibrary,
  type ReadTemplateLibraryResult,
  type ReadTemplateResult,
  type TemplateLibraryItem,
  type TemplateUnavailable,
  type TemplateTarget as StoredTemplateTarget
} from "$capabilities/templates/index.remote";
import { promptWordsIn } from "$representation/data/behavior/templates/prompt-holes";
import { relativeTime } from "$app-views/categories/templates/procedures/library-time";
import type {
  LibraryTemplate,
  LibraryTemplateDetail,
  TemplateScope,
  TemplateTarget
} from "$app-views/categories/templates/procedures/library-types";

const TARGET_LABEL: Record<StoredTemplateTarget, TemplateTarget> = {
  document: "Document",
  presentation: "Presentation",
  spreadsheet: "Spreadsheet"
};

const SCOPE_LABEL = {
  project: "Project",
  personal: "Personal"
} as const satisfies Record<TemplateLibraryItem["availability"], TemplateScope>;

const project = (row: TemplateLibraryItem, now: number): LibraryTemplate => ({
  id: row.id,
  name: row.name,
  description: row.description ?? "",
  makes: TARGET_LABEL[row.target],
  scope: SCOPE_LABEL[row.availability],
  tags: row.tags,
  holeCount: row.holeCount,
  createdBy: row.createdByName,
  revision: row.revision,
  updatedAt: row.updatedAt,
  updated: relativeTime(row.updatedAt, now),
  lastUsedAt: row.lastUsedAt,
  ...(row.lastUsedAt === null ? {} : { lastUsed: relativeTime(row.lastUsedAt, now) }),
  canEdit: row.canEdit,
  canDelete: row.canDelete
});

export const templateLibrary = () => readTemplateLibrary();
export const templateDetail = (templateId: string | undefined) =>
  templateId === undefined ? undefined : readTemplate({ templateId });
export const selectedTemplateIdIn = (
  templateId: string | undefined,
  availableIds: readonly string[]
): string | undefined =>
  templateId !== undefined && availableIds.includes(templateId) ? templateId : undefined;
export const emptyTemplateInspectorTitle = (templateCount: number | undefined): string =>
  templateCount === 0 ? "No templates exist." : "Select a template to inspect it.";
export const templatesIn = (
  answer: ReadTemplateLibraryResult | undefined,
  now: number
): readonly LibraryTemplate[] => answer?.templates.map((row) => project(row, now)) ?? [];
export const detailIn = (
  answer: ReadTemplateResult | undefined,
  now: number
): LibraryTemplateDetail | undefined => {
  if (answer === null || answer === undefined || "unavailable" in answer) return undefined;
  const row = project({ ...answer, holeCount: answer.holes.length }, now);
  return {
    ...row,
    prompts: promptWordsIn(answer.body),
    holes: answer.holes.map((hole) => ({ ...hole, id: `${answer.id}:${hole.name}` }))
  };
};
export const unavailableTemplateIn = (
  answer: ReadTemplateResult | undefined
): TemplateUnavailable | undefined =>
  answer !== null && answer !== undefined && "unavailable" in answer ? answer : undefined;
export const recentTemplatesIn = (
  rows: readonly LibraryTemplate[],
  limit = 10
): readonly (LibraryTemplate & { readonly lastUsed: string; readonly lastUsedAt: number })[] =>
  rows
    .filter(
      (row): row is LibraryTemplate & { readonly lastUsed: string; readonly lastUsedAt: number } =>
        row.lastUsed !== undefined && row.lastUsedAt !== null
    )
    .toSorted((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, Math.max(0, limit));
