import {
  createTemplate as createTemplateRemote,
  duplicateTemplate as duplicateTemplateRemote,
  instantiateTemplate as instantiateTemplateRemote,
  openTemplateStage as openTemplateStageRemote,
  readTemplate,
  readTemplateLibrary,
  removeTemplate as removeTemplateRemote,
  updateTemplate as updateTemplateRemote,
  type ReadTemplateLibraryResult,
  type ReadTemplateResult,
  type TemplateAnswers,
  type TemplateDetail,
  type TemplateLibraryItem,
  type TemplateUnavailable,
  type TemplateTarget as StoredTemplateTarget
} from "$capabilities/templates/index.remote";
import {
  readProjectResourceIndex,
  type ProjectResourceIndex
} from "$capabilities/project-resources/index.remote";
import {
  readResourceSets,
  type ReadResourceSetsResult,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import { asId } from "$representation/data/behavior/core/id";
import {
  narrowed,
  type ScopeDraft,
  type ScopeNames,
  type ScopeOffering
} from "$representation/data/behavior/core/scope-draft";
import { promptWordsIn } from "$representation/data/behavior/templates/prompt-holes";
import type { Category, WorkspaceStateModel } from "$model/client/workspace-state";

export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type { TemplateAnswers } from "$capabilities/templates/index.remote";

export type TemplateTarget = "Document" | "Slide deck" | "Spreadsheet";
export type TemplateScope = "Project" | "Personal";

export type TemplateHole = TemplateDetail["holes"][number] & {
  readonly id: string;
};

export type LibraryTemplate = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly makes: TemplateTarget;
  readonly scope: TemplateScope;
  readonly tags: readonly string[];
  readonly holeCount: number;
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
  readonly holes: readonly TemplateHole[];
  /** What the prompt behind each hole asks, so placing it can show the question. */
  readonly prompts: Readonly<Record<string, string>>;
};

export type TemplateLibrarySummary = {
  readonly total: number;
  readonly project: number;
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

export const EDITOR_CATEGORY: Record<Exclude<StoredTemplateTarget, "spreadsheet">, Category> = {
  document: "document-editor",
  slides: "slide-deck-editor"
};

const EDITOR_TEMPLATES_PANEL = {
  document: "document-editor.templates",
  slides: "slide-deck-editor.templates"
} as const;

const SCOPE_LABEL = {
  project: "Project",
  personal: "Personal"
} as const satisfies Record<TemplateLibraryItem["availability"], TemplateScope>;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

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
    holes: answer.holes.map((hole) => ({
      ...hole,
      id: `${answer.id}:${hole.name}`
    }))
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
      (
        row
      ): row is LibraryTemplate & {
        readonly lastUsed: string;
        readonly lastUsedAt: number;
      } => row.lastUsed !== undefined && row.lastUsedAt !== null
    )
    .toSorted((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, Math.max(0, limit));

export const templateLibrarySummaryIn = (
  rows: readonly LibraryTemplate[]
): TemplateLibrarySummary => {
  const count = (predicate: (row: LibraryTemplate) => boolean): number =>
    rows.filter(predicate).length;

  return {
    total: rows.length,
    project: count((row) => row.scope === "Project"),
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

export {
  answerRowsOf,
  missingIn,
  type AnswerRow
} from "$representation/data/behavior/templates/answers";

export {
  PROJECT_KINDS as KINDS,
  builderView,
  draftOf,
  isWholeProject,
  narrowed,
  needsRow,
  ruleWords as ruleOf,
  termFor,
  withTerm,
  withWholeProject,
  withoutTerm,
  type OfferSource,
  type ScopeDraft,
  type ScopeNames,
  type ScopeSide
} from "$representation/data/behavior/core/scope-draft";

export const resourceSets = () => readResourceSets();

export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
  answer?.sets ?? [];

export const projectResources = () => readProjectResourceIndex();

export const resourcesIn = (
  answer: ProjectResourceIndex | undefined
): readonly { readonly id: string; readonly kind: string; readonly name: string }[] =>
  (answer?.resources ?? []).map((item) => ({ id: item.id, kind: item.kind, name: item.name }));

/** What the builder and every sentence read a set or a resource by. */
export const scopeNamesOf = (
  sets: readonly ResourceSetItem[],
  resources: readonly { readonly id: string; readonly name: string }[]
): ScopeNames => ({
  sets: new Map(sets.map((set) => [set.id, set.name])),
  resources: new Map(resources.map((resource) => [resource.id, resource.name]))
});

/** What the builder is handed for a hole's default, or for an answer. */
export const offeringOf = (
  sets: readonly ResourceSetItem[],
  resources: readonly { readonly id: string; readonly kind: string; readonly name: string }[]
): ScopeOffering => ({
  sets: sets.map((set) => ({ id: set.id, name: set.name, set: set.set })),
  resources
});

/**
 * The answers a caller chose, as rules.
 *
 * A hole nobody touched is absent, which is what makes the template's own
 * default apply. Everything present is sent as built; the server decides
 * whether it needs a row.
 */
/** The words typed for each text parameter, with the untouched ones left out. */
export const wordsFrom = (
  texts: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(texts).flatMap(([name, words]) =>
      words === undefined || words.trim() === "" ? [] : [[name, words] as const]
    )
  );

export const answersFrom = (
  choices: Readonly<Record<string, ScopeDraft | undefined>>
): TemplateAnswers =>
  Object.fromEntries(
    Object.entries(choices).flatMap(([name, draft]) => {
      if (draft === undefined) return [];
      const rule = narrowed(draft);
      return rule === undefined ? [] : [[name, rule] as const];
    })
  );

export const inspectTemplate = (view: WorkspaceStateModel, templateId: string): void => {
  view.open({ category: "templates", focus: templateId });
  view.inspect("templates.template", { kind: "template", id: templateId });
};

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

export const updateTemplateHoleDescription = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  holeName: string,
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
      "hole-description",
      holeName,
      storedDescription
    ],
    () =>
      updateTemplateRemote({
        templateId: row.id,
        baseRevision: row.revision,
        patch: {
          holeDescription: { name: holeName, description: storedDescription }
        }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
};

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

export const updateTemplateHoleDefault = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  holeName: string,
  rule: ScopeDraft
) => {
  const holes = row.holes.map(({ id: _id, ...hole }) =>
    hole.name === holeName ? { ...hole, default: rule } : hole
  );
  return view.singleFlight(
    ["template", view.project, row.id, "update", row.revision, "hole-default", holeName, JSON.stringify(rule)],
    () =>
      updateTemplateRemote({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { holes }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
};

export const duplicateTemplate = (view: WorkspaceStateModel, row: LibraryTemplateDetail) =>
  view.singleFlight(["template", view.project, row.id, "duplicate"], () =>
    duplicateTemplateRemote({ templateId: row.id }).updates(readTemplateLibrary)
  );

export const removeTemplate = (view: WorkspaceStateModel, row: LibraryTemplateDetail) =>
  view.singleFlight(["template", view.project, row.id, "remove", row.revision], () =>
    removeTemplateRemote({ templateId: row.id, baseRevision: row.revision }).updates(
      readTemplateLibrary,
      readTemplate({ templateId: row.id })
    )
  );

export const instantiateTemplate = (
  view: WorkspaceStateModel,
  row: LibraryTemplate,
  answers: TemplateAnswers = {},
  texts: Readonly<Record<string, string>> = {}
) =>
  view.singleFlight(
    ["template", view.project, row.id, "instantiate", JSON.stringify(answers), JSON.stringify(texts)],
    () =>
      instantiateTemplateRemote({
        templateId: row.id,
        ...(Object.keys(answers).length === 0 ? {} : { answers }),
        ...(Object.keys(texts).length === 0 ? {} : { texts })
      }).updates(readTemplateLibrary, readProjectResourceIndex)
  );

export const editTemplate = async (view: WorkspaceStateModel, row: LibraryTemplate) => {
  const result = await view.singleFlight(["template", view.project, row.id, "stage"], () =>
    openTemplateStageRemote({ templateId: row.id }).updates(
      readTemplateLibrary,
      readTemplate({ templateId: row.id }),
      view.readStore(row.makes === "Document" ? "documents" : "slideDecks")
    )
  );
  if (result.accepted) {
    view.open({
      category: EDITOR_CATEGORY[result.target],
      resourceId: result.resourceId,
      context: EDITOR_TEMPLATES_PANEL[result.target]
    });
  }
  return result;
};
