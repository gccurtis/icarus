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
import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";
import { resolveTemplateScopes } from "$representation/data/behavior/templates/scopes";
import type {
  ResourceSet,
  TemplatedResourceSet,
  TemplatedTerm
} from "$representation/data/types/core/resource-set";
import type { SlideDeckBody, SlideLayout } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { TemplateVariable } from "$representation/data/types/templates/template";
import { mint, type IdKind } from "$app-views/categories/slide-deck-editor/procedures/ids";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

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

export const deckTemplatesIn = (
  answer: ReadTemplateLibraryResult | undefined
): readonly TemplateLibraryItem[] =>
  (answer?.templates ?? []).filter((item) => item.target === "slides");

const HINT_KIND: Record<IdHint, IdKind> = {
  slide: "slide",
  element: "element",
  layout: "layout",
  block: "block",
  cell: "block",
  row: "block",
  section: "block",
  atom: "atom",
  mark: "atom"
};

const mintFor = (hint: IdHint): string => mint(HINT_KIND[hint]);

export type Insertion = {
  readonly body: SlideDeckBody;
  readonly ops: readonly SlideDeckOp[];
  readonly firstSlideId: string | undefined;
};

const none = (body: SlideDeckBody): Insertion => ({ body, ops: [], firstSlideId: undefined });

export const insertionOf = (
  body: SlideDeckBody,
  template: TemplateDetail,
  afterSlideId: string | null,
  mode: "resolve" | "keep",
  answers: TemplateAnswers = {}
): Insertion => {
  if (template.body.resource !== "slides") return none(body);

  let source: SlideDeckBody = template.body;
  if (mode === "resolve") {
    const resolved = resolveTemplateScopes(template.body, template.variables, answers);
    if (!resolved.accepted || resolved.body.resource !== "slides") return none(body);
    source = resolved.body;
  }
  if (source.slides.length === 0) return none(body);

  const fresh = withFreshIds({ layouts: source.layouts, slides: source.slides }, mintFor);
  const ops: SlideDeckOp[] = [];

  const heldKeys = new Set(body.layouts.map((layout) => layout.key));
  const layouts: SlideLayout[] = fresh.layouts.filter((layout) => !heldKeys.has(layout.key));
  if (layouts.length > 0) {
    ops.push({
      op: "insert",
      target: "layout",
      path: "layouts",
      ids: layouts.map((layout) => layout.id),
      after: body.layouts.at(-1)?.id ?? null,
      values: layouts
    });
  }
  for (const [key, style] of Object.entries(source.styles.styles)) {
    if (key in body.styles.styles) continue;
    ops.push({ op: "set", path: `styles/styles/${key}`, value: style, was: null });
  }
  const anchor = afterSlideId !== null && body.slides.some((slide) => slide.id === afterSlideId)
    ? afterSlideId
    : (body.slides.at(-1)?.id ?? null);
  ops.push({
    op: "insert",
    target: "slide",
    path: "slides",
    ids: fresh.slides.map((slide) => slide.id),
    after: anchor,
    values: fresh.slides
  });

  return { body: applyOps(body, ops), ops, firstSlideId: fresh.slides[0]?.id };
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

export const saveAsTemplate = (
  view: WorkspaceStateModel,
  resourceId: string,
  name: string,
  slideId?: string
) =>
  view.singleFlight(
    ["template", view.project, "from-resource", resourceId, slideId ?? null, name.trim()],
    () =>
      createTemplateFromResourceRemote({
        target: "slides",
        resourceId,
        name: name.trim(),
        ...(slideId === undefined ? {} : { slideId })
      }).updates(readTemplateLibrary)
  );

export const openStage = (view: WorkspaceStateModel, templateId: string) =>
  view.singleFlight(["template", view.project, templateId, "stage"], () =>
    openTemplateStageRemote({ templateId }).updates(
      readTemplateLibrary,
      readTemplate({ templateId }),
      view.readStore("slideDecks")
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
      view.readStore("slideDecks")
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
