import { nodeIn } from "$representation/data/behavior/presentations/apply-ops";
import type { PromptBlock, TextBlock } from "$representation/data/types/content/content-block";
import type { Slide, PresentationBody, SlideElement } from "$representation/data/types/presentations/body";
import { placedById } from "$app-views/categories/presentation-editor/procedures/presentation-placed-element";
import { placedOn } from "$app-views/categories/presentation-editor/procedures/presentation-placement";
import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";

export type EditableTextBlock = TextBlock | PromptBlock;

export const typeOf = (element: SlideElement) => element.content.type;

export const textOf = (element: SlideElement): EditableTextBlock | undefined =>
  element.content.type === "text" || element.content.type === "prompt" || element.content.type === "shape"
    ? element.content.block
    : undefined;

export const styleOf = (body: PresentationBody, block: EditableTextBlock) =>
  body.styles.styles[block.style ?? body.styles.defaultKey];

export const blockIn = (body: PresentationBody, blockId: string): EditableTextBlock | undefined => {
  const node = nodeIn(body, blockId);
  return node !== undefined &&
    (node.type === "text" || node.type === "prompt") &&
    Array.isArray(node.atoms)
    ? (node as unknown as EditableTextBlock)
    : undefined;
};

export const elementIn = (body: PresentationBody, elementId: string): SlideElement | undefined => {
  const slide = slideHolding(body, elementId);
  return slide === undefined ? undefined : placedById(slide, elementId)?.element;
};

const holds = (element: SlideElement, blockId: string): boolean => {
  const content = element.content;
  if (
    (content.type === "text" || content.type === "prompt" || content.type === "shape") &&
    content.block?.id === blockId
  ) return true;
  return content.type === "table" && content.block.rows.some((row) =>
    row.cells.some((cell) => cell.blocks.some((held) => held.id === blockId))
  );
};

export const holderOf = (body: PresentationBody, blockId: string): SlideElement | undefined => {
  for (const slide of body.slides) {
    const found = placedOn(slide).find(({ element }) => holds(element, blockId));
    if (found) return found.element;
  }
  return undefined;
};

export const holderOn = (slide: Slide, blockId: string): SlideElement | undefined =>
  placedOn(slide).find(({ element }) => holds(element, blockId))?.element;

export const labelOf = (element: SlideElement): string => {
  switch (element.content.type) {
    case "text":
      return element.content.block.display.trim().split("\n")[0] || "Text";
    case "formula":
      return element.content.block.display.trim().split("\n")[0] || "Formula";
    case "prompt":
      return element.content.block.display.trim().split("\n")[0] || "Prompt";
    case "shape":
      return element.content.block?.display.trim()
        ? `Shape — ${element.content.block.display.trim().split("\n")[0]}`
        : "Shape";
    case "line": return "Line";
    case "image": return "Image";
    case "table": return "Table";
    case "chart": return "Chart";
    case "group": return `Group (${element.content.children.length})`;
  }
};
