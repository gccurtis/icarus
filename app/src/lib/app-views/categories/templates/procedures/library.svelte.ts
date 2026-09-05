import {
  createTemplate as createTemplateRemote,
  duplicateTemplate as duplicateTemplateRemote,
  instantiateTemplate as instantiateTemplateRemote,
  readTemplate,
  readTemplateLibrary,
  removeTemplate as removeTemplateRemote,
  updateTemplate as updateTemplateRemote,
  type ReadTemplateLibraryResult,
  type ReadTemplateResult,
  type TemplateDetail,
  type TemplateLibraryItem,
  type TemplateUnavailable,
  type TemplateTarget as StoredTemplateTarget
} from "$capabilities/templates/index.remote";
import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/** The target and availability words used by the library UI. */
export type TemplateTarget = "Document" | "Slide deck" | "Spreadsheet";
export type TemplateScope = "Project" | "Shared" | "Personal";

export type TemplateVariable = TemplateDetail["variables"][number] & {
  /** Stable inside one template; represented variables are named rather than identified. */
  readonly id: string;
};

/**
 * The compact read model shared by the content, context, and inspector surfaces.
 * It is a projection of the Templates capability answer, never a second source of data.
 */
export type LibraryTemplate = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly makes: TemplateTarget;
  readonly scope: TemplateScope;
  readonly tags: readonly string[];
  readonly variableCount: number;
  readonly createdBy: string;
  readonly revision: number;
  readonly updatedAt: number;
  readonly updated: string;
  readonly lastUsedAt: number | null;
  readonly lastUsed?: string;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
};

export type LibraryTemplateDetail = LibraryTemplate & {
  readonly variables: readonly TemplateVariable[];
};

export type TemplateLibrarySummary = {
  readonly total: number;
  readonly project: number;
  readonly shared: number;
  readonly personal: number;
  readonly documents: number;
  readonly slideDecks: number;
  readonly spreadsheets: number;
};

const TARGET_LABEL: Record<StoredTemplateTarget, TemplateTarget> = {
  document: "Document",
  slides: "Slide deck",
  spreadsheet: "Spreadsheet"
};

const TARGET_VALUE: Record<TemplateTarget, StoredTemplateTarget> = {
  Document: "document",
  "Slide deck": "slides",
  Spreadsheet: "spreadsheet"
};

const SCOPE_LABEL = {
  project: "Project",
  shared: "Shared",
  personal: "Personal"
} as const satisfies Record<TemplateLibraryItem["availability"], TemplateScope>;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** One timestamp, said the same way in the shelf, table, and inspector. */
export const relativeTime = (at: number, now: number): string => {
  const gap = Math.max(0, now - at);
  if (gap < MINUTE) return "just now";
  if (gap < HOUR) {
    const minutes = Math.max(1, Math.round(gap / MINUTE));
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (gap < DAY) {
    const hours = Math.max(1, Math.round(gap / HOUR));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (gap < 2 * DAY) return "yesterday";
  if (gap < 30 * DAY) return `${Math.round(gap / DAY)} days ago`;
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const project = (row: TemplateLibraryItem, now: number): LibraryTemplate => ({
  id: row.id,
  name: row.name,
  description: row.description ?? "",
  makes: TARGET_LABEL[row.target],
  scope: SCOPE_LABEL[row.availability],
  tags: row.tags,
  variableCount: row.variableCount,
  createdBy: row.createdByName,
  revision: row.revision,
  updatedAt: row.updatedAt,
  updated: relativeTime(row.updatedAt, now),
  lastUsedAt: row.lastUsedAt,
  ...(row.lastUsedAt === null ? {} : { lastUsed: relativeTime(row.lastUsedAt, now) }),
  canEdit: row.canEdit,
  canDelete: row.canDelete
});

/** Start the scoped, metadata-only library read. */
export const templateLibrary = () => readTemplateLibrary();

/** Start the body-bearing read for exactly one selected template. */
export const templateDetail = (templateId: string | undefined) =>
  readTemplate({ templateId: templateId ?? "templates:none" });

/** Every template visible to the current scoped capability call. */
export const templatesIn = (
  answer: ReadTemplateLibraryResult | undefined,
  now: number
): readonly LibraryTemplate[] => answer?.templates.map((row) => project(row, now)) ?? [];

/** The full selected template, projected into the same display vocabulary as the table. */
export const detailIn = (
  answer: ReadTemplateResult | undefined,
  now: number
): LibraryTemplateDetail | undefined => {
  if (answer === null || answer === undefined || "unavailable" in answer) return undefined;

  const row = project({ ...answer, variableCount: answer.variables.length }, now);
  return {
    ...row,
    variables: answer.variables.map((variable) => ({
      ...variable,
      id: `${answer.id}:${variable.name}`
    }))
  };
};

/** A selected legacy row can be unavailable without taking down the library. */
export const unavailableTemplateIn = (
  answer: ReadTemplateResult | undefined
): TemplateUnavailable | undefined =>
  answer !== null && answer !== undefined && "unavailable" in answer ? answer : undefined;

/** The bounded usage shelf, newest use first. */
export const recentTemplatesIn = (
  rows: readonly LibraryTemplate[],
  limit = 10
): readonly (LibraryTemplate & { readonly lastUsed: string; readonly lastUsedAt: number })[] =>
  rows
    .filter(
      (
        row
      ): row is LibraryTemplate & {
        readonly lastUsed: string;
        readonly lastUsedAt: number;
      } => row.lastUsed !== undefined && row.lastUsedAt !== null
    )
    .toSorted((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, Math.max(0, limit));

/** Counts used by the compact library overview. */
export const templateLibrarySummaryIn = (
  rows: readonly LibraryTemplate[]
): TemplateLibrarySummary => {
  const count = (predicate: (row: LibraryTemplate) => boolean): number =>
    rows.filter(predicate).length;

  return {
    total: rows.length,
    project: count((row) => row.scope === "Project"),
    shared: count((row) => row.scope === "Shared"),
    personal: count((row) => row.scope === "Personal"),
    documents: count((row) => row.makes === "Document"),
    slideDecks: count((row) => row.makes === "Slide deck"),
    spreadsheets: count((row) => row.makes === "Spreadsheet")
  };
};

const defaultName = (target: TemplateTarget): string =>
  ({
    Document: "Untitled document template",
    "Slide deck": "Untitled slide deck template",
    Spreadsheet: "Untitled spreadsheet template"
  })[target];

/** Give a no-name creation control a required, visibly editable unique name. */
export const nextTemplateName = (
  target: TemplateTarget,
  rows: readonly LibraryTemplate[]
): string => {
  const base = defaultName(target);
  const taken = new Set(rows.map((row) => row.name.toLocaleLowerCase()));
  let suffix = 1;
  while (taken.has(`${base} ${suffix}`.toLocaleLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
};

/** Keep a singleton Template tab's durable focus and transient inspector selection aligned. */
export const inspectTemplate = (view: WorkspaceStateModel, templateId: string): void => {
  view.open({ category: "templates", focus: templateId });
  view.inspect("templates.template", { kind: "template", id: templateId });
};

/** Create a represented template, then refresh every mounted library query. */
export const createTemplate = (
  view: WorkspaceStateModel,
  target: TemplateTarget,
  name: string
) => {
  const storedTarget = TARGET_VALUE[target];
  const storedName = name.trim();
  return view.singleFlight(
    ["template", view.project, "create", storedTarget, storedName],
    () =>
      createTemplateRemote({ target: storedTarget, name: storedName }).updates(readTemplateLibrary)
  );
};

/** Persist one name edit with the revision the inspector actually read. */
export const updateTemplateName = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  name: string
) => {
  const storedName = name.trim();
  return view.singleFlight(
    ["template", view.project, row.id, "update", row.revision, "name", storedName],
    () =>
      updateTemplateRemote({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { name: storedName }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
};

/** Persist one description edit with the revision the inspector actually read. */
export const updateTemplateDescription = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  description: string
) => {
  const storedDescription = description.trim() || null;
  return view.singleFlight(
    [
      "template",
      view.project,
      row.id,
      "update",
      row.revision,
      "description",
      storedDescription
    ],
    () =>
      updateTemplateRemote({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { description: storedDescription }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
};

/** Update variable help text while preserving its stable key, label, and default selection. */
export const updateTemplateVariableDescription = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  variableName: string,
  description: string
) => {
  const storedDescription = description.trim() || null;
  return view.singleFlight(
    [
      "template",
      view.project,
      row.id,
      "update",
      row.revision,
      "variable-description",
      variableName,
      storedDescription
    ],
    () =>
      updateTemplateRemote({
        templateId: row.id,
        baseRevision: row.revision,
        patch: {
          variableDescription: { name: variableName, description: storedDescription }
        }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
};

/** Persist the complete flat tag set; the server normalizes and versions it. */
export const updateTemplateTags = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  tags: readonly string[]
) =>
  view.singleFlight(
    ["template", view.project, row.id, "update", row.revision, "tags", ...tags],
    () =>
      updateTemplateRemote({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { tags }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );

/** Copy any visible template into the current viewer's ownership. */
export const duplicateTemplate = (view: WorkspaceStateModel, row: LibraryTemplateDetail) =>
  view.singleFlight(["template", view.project, row.id, "duplicate"], () =>
    duplicateTemplateRemote({ templateId: row.id }).updates(readTemplateLibrary)
  );

/** Remove an owned template at the revision currently shown. */
export const removeTemplate = (view: WorkspaceStateModel, row: LibraryTemplateDetail) =>
  view.singleFlight(["template", view.project, row.id, "remove", row.revision], () =>
    removeTemplateRemote({ templateId: row.id, baseRevision: row.revision }).updates(
      readTemplateLibrary,
      readTemplate({ templateId: row.id })
    )
  );

/** Materialize an independent project resource and refresh recency provenance. */
export const instantiateTemplate = (view: WorkspaceStateModel, row: LibraryTemplate) =>
  view.singleFlight(["template", view.project, row.id, "instantiate"], () =>
    instantiateTemplateRemote({ templateId: row.id }).updates(
      readTemplateLibrary,
      readProjectResourceIndex
    )
  );
