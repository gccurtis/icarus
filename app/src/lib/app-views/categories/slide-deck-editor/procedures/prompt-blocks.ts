import { rangeOf } from "$representation/data/behavior/content/positions";
import type { PromptBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import type {
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import {
  blockIn,
  elementIn,
  placedOn,
  withSet,
  type Edit
} from "$app-views/categories/slide-deck-editor/procedures/deck";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";

export type { Id } from "$representation/data/types/core/id";

export type LinkedPromptBlock = PromptBlock & {
  derivedOutputId: Id<"derivedOutputs">;
};

export type SlidePromptBlock = {
  readonly slideId: string;
  readonly slideIndex: number;
  readonly elementId: string;
  readonly block: PromptBlock;
};

/** Prompt Blocks remain ordinary slide text nested inside an unchanged element shell. */
export const promptBlocksIn = (body: SlideDeckBody | undefined): readonly SlidePromptBlock[] =>
  body?.slides.flatMap((slide, slideIndex) =>
    placedOn(slide).flatMap(({ element }) =>
      element.content.type === "prompt"
        ? [{ slideId: slide.id, slideIndex, elementId: element.id, block: element.content.block }]
        : []
    )
  ) ?? [];

export const promptBlockIn = (
  body: SlideDeckBody,
  blockId: string
): PromptBlock | undefined => {
  const block = blockIn(body, blockId);
  return block?.type === "prompt" ? block : undefined;
};

/** Convert only a plain text element; its geometry, paint, order, text, marks and ids survive. */
export const withPromptElement = (body: SlideDeckBody, elementId: string): Edit => {
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
  return withSet(body, `${element.id}/content`, { type: "prompt", block });
};

const setField = (
  block: PromptBlock,
  field: string,
  value: unknown,
  was: unknown
): SlideDeckOp | undefined =>
  JSON.stringify(value ?? null) === JSON.stringify(was ?? null)
    ? undefined
    : {
        op: "set",
        target: "block",
        path: `${block.id}/${field}`,
        value: value ?? null,
        was: was ?? null
      };

export const linkPromptBlockOps = (
  block: PromptBlock,
  derivedOutputId: Id<"derivedOutputs">
): SlideDeckOp[] => {
  const op = setField(block, "derivedOutputId", derivedOutputId, block.derivedOutputId);
  return op === undefined ? [] : [op];
};

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
): SlideDeckOp[] => {
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

/** Publish a Derived Output value through the deck's collaborative op stream. */
export const syncPromptBlockOps = (
  block: PromptBlock,
  output: DerivedOutput
): SlideDeckOp[] => {
  const response = responseOf(output);
  const presentation = response === undefined ? undefined : presentationOf(block, response);
  const candidates = [
    ...(presentation === undefined ? [] : presentationOps(block, presentation)),
    setField(block, "state", output.state, block.state),
    setField(block, "error", output.error, block.error),
    setField(block, "refreshedAt", output.refreshedAt, block.refreshedAt)
  ];

  return candidates.filter((op): op is SlideDeckOp => op !== undefined);
};

export const promptElementIn = (
  body: SlideDeckBody,
  elementId: string
): SlideElement | undefined => {
  const element = elementIn(body, elementId);
  return element?.content.type === "prompt" ? element : undefined;
};
