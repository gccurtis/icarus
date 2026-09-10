import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import type { ContentBlock, ImageBlock, TableBlock, TextBlock } from "$representation/data/types/content/content-block";
import type { ElementContent, Slide, SlideDeckBody, SlideElement } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { deckEdit, idBefore, noDeckEdit, type Edit } from "$app-views/categories/slide-deck-editor/procedures/deck-edit";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";
import { placedById } from "$app-views/categories/slide-deck-editor/procedures/deck-placed-element";
import { slideHolding } from "$app-views/categories/slide-deck-editor/procedures/deck-slide-holding";

const freshBlock = (block: ContentBlock): ContentBlock => {
  const id = mint("block");
  switch (block.type) {
    case "text":
    case "prompt":
      return {
        ...block,
        id,
        atoms: block.atoms.map((atom) => ({ ...atom, id: mint("atom") })),
        marks: block.marks.map((mark) => ({ ...mark, id: mint("atom") }))
      };
    case "image":
      return {
        ...block,
        id,
        caption: block.caption === undefined ? undefined : (freshBlock(block.caption) as TextBlock)
      };
    case "table":
      return {
        ...block,
        id,
        rows: block.rows.map((row) => ({
          ...row,
          id: mint("block"),
          cells: row.cells.map((cell) => ({
            ...cell,
            id: mint("block"),
            blocks: cell.blocks.map(freshBlock)
          }))
        }))
      };
    default:
      return { ...block, id };
  }
};

const freshContent = (content: ElementContent): ElementContent => {
  switch (content.type) {
    case "text": return { ...content, block: freshBlock(content.block) as TextBlock };
    case "formula": return { ...content, block: freshBlock(content.block) as typeof content.block };
    case "prompt": return { ...content, block: freshBlock(content.block) as typeof content.block };
    case "shape":
      return { ...content, block: content.block === undefined ? undefined : (freshBlock(content.block) as TextBlock) };
    case "image": return { ...content, block: freshBlock(content.block) as ImageBlock };
    case "table": return { ...content, block: freshBlock(content.block) as TableBlock };
    case "group": return { ...content, children: content.children.map(freshElement) };
    default: return content;
  }
};

export const freshElement = (element: SlideElement): SlideElement => ({
  ...element,
  id: mint("element"),
  content: freshContent(element.content)
});

export const freshSlide = (slide: Slide): Slide => ({
  ...slide,
  id: mint("slide"),
  elements: slide.elements.map(freshElement),
  notes: slide.notes.map(freshBlock)
});

export const emptyText = (style?: string, text = ""): TextBlock => {
  const id = mint("block");
  return {
    id,
    type: "text",
    variant: "paragraph",
    style,
    atoms: [{ id: mint("atom"), kind: "literal", text }],
    display: text,
    marks: []
  };
};

const listPathFor = (slide: Slide, parents: readonly string[]): string =>
  parents.length === 0 ? `${slide.id}/elements` : `${parents[parents.length - 1]}/content/children`;

export const siblingsOf = (slide: Slide, parents: readonly string[]): readonly SlideElement[] => {
  if (parents.length === 0) return slide.elements;
  const group = placedById(slide, parents[parents.length - 1])?.element;
  return group?.content.type === "group" ? group.content.children : [];
};

export const withInsertedElements = (
  body: SlideDeckBody,
  slideId: string,
  elements: readonly SlideElement[],
  after: string | null = "last"
): Edit => {
  const slide = body.slides.find((held) => held.id === slideId);
  if (slide === undefined || elements.length === 0) return noDeckEdit(body);
  const anchor = after === "last" ? (slide.elements.at(-1)?.id ?? null) : after;
  return deckEdit(body, [{
    op: "insert",
    target: "element",
    path: `${slideId}/elements`,
    ids: elements.map((element) => element.id),
    after: anchor,
    values: [...elements]
  }]);
};

export const withoutElements = (body: SlideDeckBody, ids: readonly string[]): Edit => {
  const ops: SlideDeckOp[] = [];
  let held = body;
  for (const id of ids) {
    const slide = slideHolding(held, id);
    if (slide === undefined) continue;
    const placed = placedById(slide, id);
    if (placed === undefined) continue;
    const siblings = siblingsOf(slide, placed.parents);
    const op: SlideDeckOp = {
      op: "remove",
      target: "element",
      path: listPathFor(slide, placed.parents),
      ids: [id],
      after: idBefore(siblings, id),
      values: [placed.element]
    };
    held = applyOps(held, [op]);
    ops.push(op);
  }
  return { body: held, ops };
};

export const withDuplicatedElements = (body: SlideDeckBody, ids: readonly string[]): Edit => {
  const slide = slideHolding(body, ids[0] ?? "");
  if (slide === undefined) return noDeckEdit(body);
  const copies = slide.elements
    .filter((element) => ids.includes(element.id))
    .map((element) => ({
      ...freshElement(element),
      frame: {
        ...element.frame,
        x: Math.min(element.frame.x + 0.02, 1 - element.frame.width),
        y: Math.min(element.frame.y + 0.02, 1 - element.frame.height)
      }
    }));
  return withInsertedElements(body, slide.id, copies, "last");
};
