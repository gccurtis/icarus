import { rangeOf } from "$representation/data/behavior/content/positions";
import type {
  LinkedPromptBlock,
  PromptBlock
} from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import type {
  PresentationBody,
  SlideElement
} from "$representation/data/types/presentations/body";
import type { PresentationOp } from "$representation/data/types/presentations/op";
import type { Edit } from "$app-views/categories/presentation-editor/procedures/presentation-edit";
import { placedOn } from "$app-views/categories/presentation-editor/procedures/presentation-placement";
import { blockIn, elementIn } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
import { withSet } from "$app-views/categories/presentation-editor/procedures/presentation-values";
import { mint } from "$app-views/categories/presentation-editor/procedures/ids";

export type { Id } from "$representation/data/types/core/id";
export type { LinkedPromptBlock } from "$representation/data/types/content/content-block";

export type SlidePromptBlock = {
  readonly slideId: string;
  readonly slideIndex: number;
  readonly elementId: string;
  readonly block: PromptBlock;
};

/** Prompt Blocks remain ordinary slide text nested inside an unchanged element shell. */
export const promptBlocksIn = (body: PresentationBody | undefined): readonly SlidePromptBlock[] =>
  body?.slides.flatMap((slide, slideIndex) =>
    placedOn(slide).flatMap(({ element }) =>
      element.content.type === "prompt"
        ? [{ slideId: slide.id, slideIndex, elementId: element.id, block: element.content.block }]
        : []
    )
  ) ?? [];

export const promptBlockIn = (
  body: PresentationBody,
  blockId: string
): PromptBlock | undefined => {
  const block = blockIn(body, blockId);
  return block?.type === "prompt" ? block : undefined;
};

/** Convert only a plain text element; its geometry, paint, order, text, marks and ids survive. */
export const withPromptElement = (body: PresentationBody, elementId: string): Edit => {
  const element = elementIn(body, elementId);
  if (element?.content.type === "prompt") return { body, ops: [] };
  if (element?.content.type !== "text") return { body, ops: [] };

  const {
    type: _type,
    variant: _variant,
    level: _level,
    listStyle: _listStyle,
    checked: _checked,
    language: _language,
    resolvedAt: _resolvedAt,
    ...presentation
  } = element.content.block;
  const block: PromptBlock = {
    ...presentation,
    type: "prompt",
    state: "idle"
  };
  return withSet(body, "element", `${element.id}/content`, { type: "prompt", block });
};

const setField = (
  block: PromptBlock,
  field: string,
  value: unknown,
  was: unknown
): PresentationOp | undefined =>
  JSON.stringify(value ?? null) === JSON.stringify(was ?? null)
    ? undefined
    : {
        op: "set",
        target: "block",
        path: `${block.id}/${field}`,
        value: value ?? null,
        was: was ?? null
      };

/** What this prompt's hole is called, and what it stands for. */
export const promptHoleOps = (
  block: PromptBlock,
  hole: { name: string; description?: string }
): PresentationOp[] => {
  const description = hole.description?.trim() ?? "";
  const next = { name: hole.name.trim(), ...(description === "" ? {} : { description }) };
  const op = setField(block, "hole", next, block.hole);
  return op === undefined ? [] : [op];
};

/**
 * What this prompt reads, while nothing else holds it.
 *
 * A block carries a scope only when there is no derived output to carry it: an
 * unlinked prompt, or one in a template. Once linked, the output is the scope
 * and this is not written again.
 */
export const promptScopeOps = (block: PromptBlock, scope: unknown): PresentationOp[] => {
  const op = setField(block, "scope", scope, block.scope);
  return op === undefined ? [] : [op];
};

/** Linking hands the question and scope to the output, so the block gives both up here. */
export const linkPromptBlockOps = (
  block: PromptBlock,
  derivedOutputId: Id<"derivedOutputs">
): PresentationOp[] =>
  [
    setField(block, "derivedOutputId", derivedOutputId, block.derivedOutputId),
    setField(block, "prompt", undefined, block.prompt),
    setField(block, "scope", undefined, block.scope)
  ].filter((op): op is PresentationOp => op !== undefined);

const responseOf = (output: DerivedOutput): string | undefined =>
  output.lastResponse?.type === "text" ? output.lastResponse.display : undefined;

/** Preserve authored ranges and clip only the part that no longer fits the refreshed response. */
const presentationOf = (
  block: PromptBlock,
  text: string
): Pick<PromptBlock, "atoms" | "display" | "marks"> => {
  const atomId = block.atoms.find((atom) => atom.kind === "literal")?.id ?? mint("atom");
  const nextLength = text.length;
  const marks = block.marks.flatMap((mark) => {
    const { from, to } = rangeOf(block.atoms, mark);
    const nextFrom = Math.min(from, nextLength);
    const nextTo = Math.min(to, nextLength);
    return nextFrom >= nextTo
      ? []
      : [{
          ...mark,
          from: { atom: atomId, offset: nextFrom },
          to: { atom: atomId, offset: nextTo }
        }];
  });

  return {
    atoms: [{ id: atomId, kind: "literal", text }],
    display: text,
    marks
  };
};

const presentationOps = (
  block: PromptBlock,
  presentation: Pick<PromptBlock, "atoms" | "display" | "marks">
): PresentationOp[] => {
  if (
    block.display === presentation.display &&
    JSON.stringify(block.atoms) === JSON.stringify(presentation.atoms) &&
    JSON.stringify(block.marks) === JSON.stringify(presentation.marks)
  ) return [];

  return [
    ...(block.marks.length === 0
      ? []
      : [{
          op: "remove" as const,
          target: "mark" as const,
          path: `${block.id}/marks`,
          ids: block.marks.map((mark) => mark.id),
          after: null,
          values: block.marks
        }]),
    ...(block.atoms.length === 0
      ? []
      : [{
          op: "remove" as const,
          target: "atom" as const,
          path: `${block.id}/atoms`,
          ids: block.atoms.map((atom) => atom.id),
          after: null,
          values: block.atoms
        }]),
    {
      op: "insert",
      target: "atom",
      path: `${block.id}/atoms`,
      ids: presentation.atoms.map((atom) => atom.id),
      after: null,
      values: presentation.atoms
    },
    ...(presentation.marks.length === 0
      ? []
      : [{
          op: "insert" as const,
          target: "mark" as const,
          path: `${block.id}/marks`,
          ids: presentation.marks.map((mark) => mark.id),
          after: null,
          values: presentation.marks
        }])
  ];
};

/** Publish a Derived Output value through the presentation's collaborative op stream. */
export const syncPromptBlockOps = (
  block: PromptBlock,
  output: DerivedOutput
): PresentationOp[] => {
  const response = responseOf(output);
  const presentation = response === undefined ? undefined : presentationOf(block, response);
  const candidates = [
    ...(presentation === undefined ? [] : presentationOps(block, presentation)),
    setField(block, "state", output.state, block.state),
    setField(block, "error", output.error, block.error),
    setField(block, "refreshedAt", output.refreshedAt, block.refreshedAt)
  ];

  return candidates.filter((op): op is PresentationOp => op !== undefined);
};

export const promptElementIn = (
  body: PresentationBody,
  elementId: string
): SlideElement | undefined => {
  const element = elementIn(body, elementId);
  return element?.content.type === "prompt" ? element : undefined;
};
