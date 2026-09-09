import {
  readProjectResourceIndex,
  type ProjectResourceIndex
} from "$capabilities/project-resources/index.remote";
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
import {
  narrowed,
  type ScopeDraft,
  type ScopeNames,
  type ScopeOffering
} from "$representation/data/behavior/core/scope-draft";
import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";
import {
  fillTemplateAtoms,
  resolveTemplateScopes
} from "$representation/data/behavior/templates/scopes";
import type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
import type { SlideDeckBody, SlideLayout } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { TemplateHole } from "$representation/data/types/templates/template";
import { mint, type IdKind } from "$app-views/categories/slide-deck-editor/procedures/ids";
import { addressOf } from "$app-views/categories/slide-deck-editor/procedures/selecting";
import type { Selection, WorkspaceStateModel } from "$model/client/workspace-state";

export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type {
  ResourceTemplateStage,
  TemplateAnswers,
  TemplateDetail,
  TemplateLibraryItem
} from "$capabilities/templates/index.remote";
export type { TemplatedResourceSet } from "$representation/data/types/core/resource-set";
export type { TemplateHole } from "$representation/data/types/templates/template";

export {
  defaultScopeOf,
  holeNameIn,
  offeredHoleName,
  offeredNameIn,
  promptWordsIn
} from "$representation/data/behavior/templates/prompt-holes";

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
  answers: TemplateAnswers = {},
  texts: Readonly<Record<string, string>> = {}
): Insertion => {
  if (template.body.resource !== "slides") return none(body);

  let source: SlideDeckBody = template.body;
  if (mode === "resolve") {
    const resolved = resolveTemplateScopes(template.body, template.holes, answers);
    if (!resolved.accepted || resolved.body.resource !== "slides") return none(body);
    const filled = fillTemplateAtoms(resolved.body, texts);
    if (filled.resource !== "slides") return none(body);
    source = filled;
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

/**
 * A hole as the client sends it, which is wider than one as it is stored: a
 * chosen rule may exclude things and may name particular resources, and the
 * server turns either into a row before it lands.
 */
export type ChosenHole = Omit<TemplateHole, "default"> & { default?: ScopeDraft };

export const withHoleField = (
  holes: readonly ChosenHole[],
  name: string,
  change: { label?: string; description?: string; default?: ScopeDraft; text?: string }
): readonly ChosenHole[] =>
  holes.map((hole) => {
    if (hole.name !== name) return hole;
    const next: ChosenHole = { name: hole.name, label: change.label ?? hole.label };
    const description = "description" in change ? change.description : hole.description;
    const fallback = "default" in change ? change.default : hole.default;
    const words = "text" in change ? change.text : hole.text;
    if (hole.kind !== undefined) next.kind = hole.kind;
    if (description !== undefined && description.trim().length > 0) next.description = description.trim();
    if (fallback !== undefined) next.default = fallback;
    if (words !== undefined && words.trim().length > 0) next.text = words;
    return next;
  });

export const mergedHoles = (
  held: readonly ChosenHole[],
  inserted: readonly ChosenHole[]
): readonly ChosenHole[] => {
  const names = new Set(held.map((hole) => hole.name));
  return [...held, ...inserted.filter((hole) => !names.has(hole.name))];
};

/**
 * A text hole made by hand, rather than found.
 *
 * A scope hole exists because a prompt asks for one, so it cannot be authored. A
 * text hole is a place in the prose, and nothing but the author knows where it
 * goes — so the panel declares it and drops its atom into the selected text in
 * the same act, and the next save finds it exactly as it finds any other.
 */
export const withNewTextHole = (
  holes: readonly ChosenHole[],
  asked: { name: string; description?: string; text?: string }
): readonly ChosenHole[] => {
  const name = asked.name.trim();
  const description = asked.description?.trim() ?? "";
  const words = asked.text ?? "";
  return [
    ...holes,
    {
      name,
      label: name,
      kind: "text",
      ...(description === "" ? {} : { description }),
      ...(words.trim() === "" ? {} : { text: words })
    }
  ];
};

/** Why a name will not do, or nothing when it will. */
export const holeNameRefusal = (
  holes: readonly ChosenHole[],
  asked: string
): string | undefined => {
  const name = asked.trim();
  if (name === "") return "Give the hole a name.";
  if (!/^[\w][\w -]*$/.test(name)) return "A hole's name is letters, digits, spaces, hyphens and underscores.";
  const taken = holes.some((hole) => hole.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  return taken ? `This template already has a hole called ${name}.` : undefined;
};

/**
 * The block a new text hole's atom lands in: the one the caret is in, else the
 * one inside the selected element, else the deck's last writable block.
 */
const holeBlockIn = (body: SlideDeckBody, selection: Selection | undefined) => {
  const blocks = body.slides.flatMap((slide) =>
    slide.elements.flatMap((element) =>
      element.content.type === "text" || element.content.type === "prompt"
        ? [{ elementId: element.id, block: element.content.block }]
        : []
    )
  );
  const held = selection?.id;
  const caret = held === undefined ? undefined : addressOf(held)?.blockId;
  return (
    blocks.find((entry) => entry.block.id === caret) ??
    blocks.find((entry) => entry.elementId === held) ??
    blocks.at(-1)
  );
};

/** The ops that put a text hole's atom into the selected text. */
export const textHoleInsertion = (
  body: SlideDeckBody,
  selection: Selection | undefined,
  name: string
): readonly SlideDeckOp[] => {
  const held = holeBlockIn(body, selection);
  if (held === undefined) return [];
  const atom = { id: mint("atom"), kind: "template" as const, name: name.trim() };
  return [
    {
      op: "insert",
      target: "atom",
      path: `${held.block.id}/atoms`,
      ids: [atom.id],
      after: held.block.atoms.at(-1)?.id ?? null,
      values: [atom]
    }
  ];
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

export const updateHoles = (
  view: WorkspaceStateModel,
  template: { readonly id: string; readonly revision: number },
  holes: readonly ChosenHole[],
  resourceId?: string
) =>
  view.singleFlight(
    ["template", view.project, template.id, "holes", template.revision, JSON.stringify(holes)],
    () =>
      updateTemplateRemote({
        templateId: template.id,
        baseRevision: template.revision,
        patch: { holes }
      }).updates(
        readTemplateLibrary,
        readTemplate({ templateId: template.id }),
        ...(resourceId === undefined ? [] : [readResourceTemplate({ resourceId })])
      )
  );
