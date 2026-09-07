import {
  readResourceSets,
  type ReadResourceSetsResult,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import {
  commitTemplateStage as commitTemplateStageRemote,
  createTemplateFromResource as createTemplateFromResourceRemote,
  discardTemplateStage as discardTemplateStageRemote,
  openTemplateStage as openTemplateStageRemote,
  readResourceTemplate,
  readTemplate,
  readTemplateLibrary,
  updateTemplate as updateTemplateRemote,
  type ReadResourceTemplateResult,
  type ReadTemplateLibraryResult,
  type ReadTemplateResult,
  type ResourceTemplateStage,
  type TemplateAnswers,
  type TemplateDetail,
  type TemplateLibraryItem
} from "$capabilities/templates/index.remote";
import { asId } from "$representation/data/behavior/core/id";
import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";
import { resolveTemplateScopes } from "$representation/data/behavior/templates/scopes";
import type {
  ResourceSet,
  TemplatedResourceSet,
  TemplatedTerm
} from "$representation/data/types/core/resource-set";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { TemplateVariable } from "$representation/data/types/templates/template";
import { rowHolding } from "$app-views/categories/document-editor/procedures/blocks";
import { mint, type IdKind } from "$app-views/categories/document-editor/procedures/ids";
import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
import type { Selection, WorkspaceStateModel } from "$model/client/workspace-state";

export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type {
  ResourceTemplateStage,
  TemplateAnswers,
  TemplateDetail,
  TemplateLibraryItem
} from "$capabilities/templates/index.remote";
export type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
export type { TemplateVariable } from "$representation/data/types/templates/template";

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
  variable: TemplateVariable,
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

export const defaultChoices = (variables: readonly TemplateVariable[]): Record<string, string> =>
  Object.fromEntries(variables.map((variable) => [variable.name, DEFAULT_ANSWER]));

export const resourceTemplate = (resourceId: string) => readResourceTemplate({ resourceId });
export const templateLibrary = () => readTemplateLibrary();
export const templateDetail = (templateId: string | undefined) =>
  templateId === undefined ? undefined : readTemplate({ templateId });

export const stageIn = (
  answer: ReadResourceTemplateResult | undefined
): ResourceTemplateStage | undefined => answer?.stage ?? undefined;

export const detailIn = (answer: ReadTemplateResult | undefined): TemplateDetail | undefined =>
  answer === null || answer === undefined || "unavailable" in answer ? undefined : answer;

export const documentTemplatesIn = (
  answer: ReadTemplateLibraryResult | undefined
): readonly TemplateLibraryItem[] =>
  (answer?.templates ?? []).filter((item) => item.target === "document");

export const currentRowId = (
  body: DocumentBody,
  selection: Selection | undefined
): string | null => {
  const blockId = selection === undefined ? undefined : addressOf(selection.id)?.blockId;
  const row = blockId === undefined ? undefined : rowHolding(body, blockId);
  return row?.id ?? body.rows.at(-1)?.id ?? null;
};

const HINT_KIND: Record<IdHint, IdKind> = {
  row: "row",
  block: "block",
  cell: "block",
  atom: "atom",
  mark: "mark",
  slide: "block",
  element: "block",
  layout: "block",
  section: "block"
};

const mintFor = (hint: IdHint): string => mint(HINT_KIND[hint]);

export type Insertion = {
  readonly ops: readonly DocumentOp[];
  readonly firstBlockId: string | undefined;
};

const firstBlockIn = (rows: readonly DocumentRow[]): string | undefined => {
  for (const row of rows) {
    if (row.kind === "blocks" && row.blocks.length > 0) return row.blocks[0].id;
  }
  return undefined;
};

export const insertionOf = (
  body: DocumentBody,
  template: TemplateDetail,
  afterRowId: string | null,
  mode: "resolve" | "keep",
  answers: TemplateAnswers = {}
): Insertion => {
  if (template.body.resource !== "document") return { ops: [], firstBlockId: undefined };

  let source = template.body;
  if (mode === "resolve") {
    const resolved = resolveTemplateScopes(template.body, template.variables, answers);
    if (!resolved.accepted || resolved.body.resource !== "document") {
      return { ops: [], firstBlockId: undefined };
    }
    source = resolved.body;
  }

  const rows = withFreshIds(source.rows, mintFor, "row");
  if (rows.length === 0) return { ops: [], firstBlockId: undefined };

  const ops: DocumentOp[] = [];
  const held = body.styles?.styles ?? {};
  for (const [key, style] of Object.entries(source.styles?.styles ?? {})) {
    if (key in held) continue;
    ops.push({ op: "insert", target: "document", path: "styles", ids: [key], after: null, values: [style] });
  }
  ops.push({
    op: "insert",
    target: "row",
    path: "rows",
    ids: rows.map((row) => row.id),
    after: afterRowId,
    values: rows
  });
  return { ops, firstBlockId: firstBlockIn(rows) };
};

export const withVariableField = (
  variables: readonly TemplateVariable[],
  name: string,
  change: Partial<Pick<TemplateVariable, "label" | "description" | "default">>
): readonly TemplateVariable[] =>
  variables.map((variable) => {
    if (variable.name !== name) return variable;
    const next: TemplateVariable = { name: variable.name, label: change.label ?? variable.label };
    const description = "description" in change ? change.description : variable.description;
    const fallback = "default" in change ? change.default : variable.default;
    if (description !== undefined && description.trim().length > 0) next.description = description.trim();
    if (fallback !== undefined) next.default = fallback;
    return next;
  });

export const mergedVariables = (
  held: readonly TemplateVariable[],
  inserted: readonly TemplateVariable[]
): readonly TemplateVariable[] => {
  const names = new Set(held.map((variable) => variable.name));
  return [...held, ...inserted.filter((variable) => !names.has(variable.name))];
};

export const saveAsTemplate = (view: WorkspaceStateModel, resourceId: string, name: string) =>
  view.singleFlight(["template", view.project, "from-resource", resourceId, name.trim()], () =>
    createTemplateFromResourceRemote({ target: "document", resourceId, name: name.trim() }).updates(
      readTemplateLibrary
    )
  );

export const openStage = (view: WorkspaceStateModel, templateId: string) =>
  view.singleFlight(["template", view.project, templateId, "stage"], () =>
    openTemplateStageRemote({ templateId }).updates(
      readTemplateLibrary,
      readTemplate({ templateId }),
      view.readStore("documents")
    )
  );

export const commitStage = (
  view: WorkspaceStateModel,
  stage: { readonly stageId: string; readonly templateId: string; readonly baseRevision: number },
  resourceId: string
) =>
  view.singleFlight(["template", view.project, stage.stageId, "commit", stage.baseRevision], () =>
    commitTemplateStageRemote({ stageId: stage.stageId, baseRevision: stage.baseRevision }).updates(
      readTemplateLibrary,
      readTemplate({ templateId: stage.templateId }),
      readResourceTemplate({ resourceId })
    )
  );

export const discardStage = (
  view: WorkspaceStateModel,
  stage: { readonly stageId: string; readonly templateId: string },
  resourceId: string
) =>
  view.singleFlight(["template", view.project, stage.stageId, "discard"], () =>
    discardTemplateStageRemote({ stageId: stage.stageId }).updates(
      readTemplateLibrary,
      readTemplate({ templateId: stage.templateId }),
      readResourceTemplate({ resourceId }),
      view.readStore("documents")
    )
  );

export const updateVariables = (
  view: WorkspaceStateModel,
  template: { readonly id: string; readonly revision: number },
  variables: readonly TemplateVariable[],
  resourceId?: string
) =>
  view.singleFlight(
    ["template", view.project, template.id, "variables", template.revision, JSON.stringify(variables)],
    () =>
      updateTemplateRemote({
        templateId: template.id,
        baseRevision: template.revision,
        patch: { variables }
      }).updates(
        readTemplateLibrary,
        readTemplate({ templateId: template.id }),
        ...(resourceId === undefined ? [] : [readResourceTemplate({ resourceId })])
      )
  );
