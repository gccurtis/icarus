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
import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import {
  readResourceSets,
  type ReadResourceSetsResult,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import { asId } from "$representation/data/behavior/core/id";
import type {
  ResourceSet,
  TemplatedResourceSet,
  TemplatedTerm
} from "$representation/data/types/core/resource-set";
import type { TemplateVariable as StoredTemplateVariable } from "$representation/data/types/templates/template";
import type { Category, WorkspaceStateModel } from "$model/client/workspace-state";

export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type { TemplateAnswers } from "$capabilities/templates/index.remote";

export type TemplateTarget = "Document" | "Slide deck" | "Spreadsheet";
export type TemplateScope = "Project" | "Personal";

export type TemplateVariable = TemplateDetail["variables"][number] & {
  readonly id: string;
};

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

  const row = project({ ...answer, variableCount: answer.variables.length }, now);
  return {
    ...row,
    variables: answer.variables.map((variable) => ({
      ...variable,
      id: `${answer.id}:${variable.name}`
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

export const KINDS = [
  { kind: "document", label: "Documents" },
  { kind: "slides", label: "Slide decks" },
  { kind: "spreadsheet", label: "Spreadsheets" },
  { kind: "finding", label: "Findings" },
  { kind: "research", label: "Research threads" }
] as const;

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  KINDS.map((entry) => [entry.kind, entry.label])
);

export const resourceSets = () => readResourceSets();

export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
  answer?.sets ?? [];

export const namesOf = (sets: readonly ResourceSetItem[]): ReadonlyMap<string, string> =>
  new Map(sets.map((set) => [set.id, set.name]));

export const kindsOf = (rule: TemplatedResourceSet | undefined): readonly string[] =>
  (rule?.include ?? []).flatMap((term) => (term.select === "kinds" ? term.kinds : []));

export const setIdsOf = (rule: TemplatedResourceSet | undefined): readonly string[] =>
  (rule?.include ?? []).flatMap((term) => (term.select === "set" ? [term.setId] : []));

export const isWholeProject = (rule: TemplatedResourceSet | undefined): boolean =>
  rule === undefined || rule.include.some((term) => term.select === "project");

const termWords = (
  terms: readonly TemplatedTerm[],
  names: ReadonlyMap<string, string>
): readonly string[] =>
  terms.map((term) =>
    term.select === "project"
      ? "everything in the project"
      : term.select === "kinds"
        ? term.kinds.map((kind) => KIND_LABEL[kind] ?? kind).join(", ")
        : term.select === "set"
          ? (names.get(term.setId) ?? "a set that no longer exists")
          : `whatever ${term.name} holds`
  );

export const ruleOf = (
  rule: TemplatedResourceSet | undefined,
  names: ReadonlyMap<string, string> = new Map()
): string => {
  if (rule === undefined) return "Everything in the project";
  if (rule.include.length === 0) return "Nothing";
  const words = termWords(rule.include, names).join(" and ");
  const included = isWholeProject(rule)
    ? "Everything in the project"
    : words.charAt(0).toUpperCase() + words.slice(1);
  const excluded = termWords(rule.exclude, names);
  return excluded.length === 0 ? included : `${included}, minus ${excluded.join(", ")}`;
};

export const ruleFrom = (
  whole: boolean,
  kinds: readonly string[],
  setIds: readonly string[] = []
): TemplatedResourceSet => {
  if (whole) return { include: [{ select: "project" }], exclude: [] };
  const include: TemplatedTerm[] = [];
  if (kinds.length > 0) include.push({ select: "kinds", kinds: [...kinds] as never[] });
  for (const setId of setIds) include.push({ select: "set", setId: asId<"resourceSets">(setId) });
  return { include, exclude: [] };
};

export const DEFAULT_ANSWER = "default";

export type AnswerOption = { readonly value: string; readonly label: string };

export const answerOptions = (
  variable: StoredTemplateVariable,
  sets: readonly ResourceSetItem[]
): readonly AnswerOption[] => [
  { value: DEFAULT_ANSWER, label: `Default · ${ruleOf(variable.default, namesOf(sets))}` },
  { value: "project", label: "Everything in the project" },
  ...KINDS.map((entry) => ({ value: `kind:${entry.kind}`, label: `Only ${entry.label.toLocaleLowerCase()}` })),
  ...sets.map((set) => ({ value: `set:${set.id}`, label: set.name }))
];

export const answerFrom = (choice: string): ResourceSet | undefined => {
  if (choice === "project") return { include: [{ select: "project" }], exclude: [] };
  if (choice.startsWith("kind:")) {
    return { include: [{ select: "kinds", kinds: [choice.slice("kind:".length)] as never[] }], exclude: [] };
  }
  if (choice.startsWith("set:")) {
    return { include: [{ select: "set", setId: asId<"resourceSets">(choice.slice("set:".length)) }], exclude: [] };
  }
  return undefined;
};

export const answersFrom = (choices: Readonly<Record<string, string>>): TemplateAnswers =>
  Object.fromEntries(
    Object.entries(choices).flatMap(([name, choice]) => {
      const answer = answerFrom(choice);
      return answer === undefined ? [] : [[name, answer] as const];
    })
  );

export const defaultChoices = (
  variables: readonly StoredTemplateVariable[]
): Record<string, string> =>
  Object.fromEntries(variables.map((variable) => [variable.name, DEFAULT_ANSWER]));

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

export const updateTemplateVariableDefault = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  variableName: string,
  rule: TemplatedResourceSet
) => {
  const variables = row.variables.map(({ id: _id, ...variable }) =>
    variable.name === variableName ? { ...variable, default: rule } : variable
  );
  return view.singleFlight(
    ["template", view.project, row.id, "update", row.revision, "variable-default", variableName, JSON.stringify(rule)],
    () =>
      updateTemplateRemote({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { variables }
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
  answers: TemplateAnswers = {}
) =>
  view.singleFlight(
    ["template", view.project, row.id, "instantiate", JSON.stringify(answers)],
    () =>
      instantiateTemplateRemote({
        templateId: row.id,
        ...(Object.keys(answers).length === 0 ? {} : { answers })
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
