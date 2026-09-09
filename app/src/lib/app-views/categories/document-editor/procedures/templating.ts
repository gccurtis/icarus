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
import { withFreshIds, type IdHint } from "$representation/data/behavior/templates/fresh-ids";
import {
  fillTemplateAtoms,
  resolveTemplateScopes
} from "$representation/data/behavior/templates/scopes";
import type { ResourceSet, TemplatedResourceSet } from "$representation/data/types/core/resource-set";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { TemplateHole } from "$representation/data/types/templates/template";
import { linearOf } from "$representation/data/behavior/content/positions";
import {
  defaultScopeOf as defaultScope,
  holeMarkOver,
  holeNameOver
} from "$representation/data/behavior/templates/prompt-holes";
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
export type { TemplateHole } from "$representation/data/types/templates/template";

export {
  answerRowsOf,
  missingIn,
  type AnswerRow
} from "$representation/data/behavior/templates/answers";

export {
  defaultScopeOf,
  holeMarkOver,
  holeNameOver,
  holeNamesIn,
  nextHoleName,
  offeredHoleName,
  promptWordsIn
} from "$representation/data/behavior/templates/prompt-holes";

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
/** The words typed for each text hole, with the untouched ones left out. */
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
  answers: TemplateAnswers = {},
  texts: Readonly<Record<string, string>> = {}
): Insertion => {
  if (template.body.resource !== "document") return { ops: [], firstBlockId: undefined };

  let source = template.body;
  if (mode === "resolve") {
    const resolved = resolveTemplateScopes(template.body, template.holes, answers);
    if (!resolved.accepted || resolved.body.resource !== "document") {
      return { ops: [], firstBlockId: undefined };
    }
    const filled = fillTemplateAtoms(resolved.body, texts);
    if (filled.resource !== "document") return { ops: [], firstBlockId: undefined };
    source = filled;
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

const blockWithAtoms = (body: DocumentBody, blockId: string) => {
  for (const row of body.rows) {
    if (row.kind !== "blocks") continue;
    for (const block of row.blocks) {
      if (block.id !== blockId) continue;
      return block.type === "text" || block.type === "prompt" ? block : undefined;
    }
  }
  return undefined;
};

/**
 * A prompt's scope as its generated output can hold it.
 *
 * The block is what the person set, so the output must be told the same thing
 * or the agent reads the whole project while the panel says otherwise. A body
 * open as a template is the one exception: its scope may still name a hole,
 * which selects nothing until the template is placed and cannot be sent.
 */
export const readableScope = (scope: unknown): ResourceSet | undefined => {
  const held = defaultScope(scope);
  if (held === undefined) return undefined;
  const include = held.include.filter((term) => term.select !== "hole");
  const exclude = held.exclude.filter((term) => term.select !== "hole");
  return include.length === held.include.length && exclude.length === held.exclude.length
    ? { include, exclude }
    : undefined;
};

/** What a selection covers, as one block and a range of its display. */
export const selectedRange = (
  body: DocumentBody,
  selection: Selection | undefined
): { readonly blockId: string; readonly from: number; readonly to: number } | undefined => {
  if (selection === undefined || selection.at === undefined) return undefined;
  const start = addressOf(selection.id);
  const end = addressOf(selection.at);
  if (start === undefined || end === undefined || start.blockId !== end.blockId) return undefined;
  const block = blockWithAtoms(body, start.blockId);
  if (block === undefined) return undefined;
  const from = linearOf(block.atoms, { atom: start.atomId, offset: start.offset });
  const to = linearOf(block.atoms, { atom: end.atomId, offset: end.offset });
  return from === to ? undefined : { blockId: block.id, from: Math.min(from, to), to: Math.max(from, to) };
};

/** The words a selection covers, which become what its hole says by default. */
export const selectedWords = (body: DocumentBody, selection: Selection | undefined): string => {
  const range = selectedRange(body, selection);
  if (range === undefined) return "";
  return blockWithAtoms(body, range.blockId)?.display.slice(range.from, range.to) ?? "";
};

/** Whether this run is already marked as a hole, and under what name. */
export const markedHoleAt = (
  body: DocumentBody,
  selection: Selection | undefined
): string | undefined => {
  const range = selectedRange(body, selection);
  if (range === undefined) return undefined;
  const block = blockWithAtoms(body, range.blockId);
  return block === undefined ? undefined : holeNameOver(block.atoms, block.marks, range.from, range.to);
};

/**
 * A run of text marked as a hole.
 *
 * Nothing about the document changes: the words stay, every other mark over
 * them stays, and the paragraph reads exactly as it did. The mark says where a
 * template's hole goes, and only the template — a copy — ever has one.
 */
export const markHoleOps = (
  body: DocumentBody,
  selection: Selection | undefined,
  name: string
): readonly DocumentOp[] => {
  const range = selectedRange(body, selection);
  if (range === undefined) return [];
  const block = blockWithAtoms(body, range.blockId);
  if (block === undefined) return [];
  const mark = holeMarkOver(block.atoms, range.from, range.to, name.trim(), () => mint("mark"));
  if (mark === undefined) return [];
  return [
    {
      op: "insert",
      target: "mark",
      path: `${block.id}/marks`,
      ids: [mark.id],
      after: block.marks.at(-1)?.id ?? null,
      values: [mark]
    }
  ];
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
