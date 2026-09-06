import type {
  ContentBlock,
  ImageBlock,
  TableBlock,
  TextBlock
} from "$representation/data/types/content/content-block";
import { applyOps, nodeIn } from "$representation/data/behavior/slide-decks/apply-ops";
import type {
  DeckSection,
  ElementContent,
  Frame,
  Slide,
  SlideDeckBody,
  SlideElement,
  SlideLayout
} from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { restacked, type Restack } from "$app-views/categories/slide-deck-editor/procedures/arrange";
import { mint } from "$app-views/categories/slide-deck-editor/procedures/ids";

export type {
  AspectRatio,
  DeckSection,
  DeckTheme,
  ElementContent,
  ElementPaint,
  ElementType,
  Frame,
  LineEnd,
  Point,
  ShapeKind,
  Slide,
  SlideBackground,
  SlideDeckBody,
  SlideElement,
  SlideLayout
} from "$representation/data/types/slide-decks/body";
export type { TextStyle } from "$representation/data/types/slide-decks/style-set";
export type { Atom, ContentBlock, Mark, MarkStyle, TextBlock } from "$representation/data/types/content/content-block";
export type { SlideDeckOp } from "$representation/data/types/slide-decks/op";

export type Edit = { readonly body: SlideDeckBody; readonly ops: readonly SlideDeckOp[] };

export type Placed = {
  readonly element: SlideElement;
  readonly frame: Frame;
  readonly depth: number;
  readonly parents: readonly string[];
};

const none = (body: SlideDeckBody): Edit => ({ body, ops: [] });

const edit = (body: SlideDeckBody, ops: readonly SlideDeckOp[]): Edit =>
  ops.length === 0 ? none(body) : { body: applyOps(body, ops), ops };

export const typeOf = (element: SlideElement) => element.content.type;

export const textOf = (element: SlideElement): TextBlock | undefined =>
  element.content.type === "text" || element.content.type === "shape"
    ? element.content.block
    : undefined;

export const styleOf = (body: SlideDeckBody, block: TextBlock) =>
  body.styles.styles[block.style ?? body.styles.defaultKey];

export const slideAt = (body: SlideDeckBody, index: number): Slide | undefined => body.slides[index];

export const slideIndexOf = (body: SlideDeckBody, slideId: string | undefined): number => {
  const at = body.slides.findIndex((slide) => slide.id === slideId);
  return at === -1 ? 0 : at;
};

export const within = (outer: Frame, inner: Frame): Frame => ({
  x: outer.x + inner.x * outer.width,
  y: outer.y + inner.y * outer.height,
  width: inner.width * outer.width,
  height: inner.height * outer.height
});

export const relativeTo = (outer: Frame, absolute: Frame): Frame => ({
  x: outer.width === 0 ? 0 : (absolute.x - outer.x) / outer.width,
  y: outer.height === 0 ? 0 : (absolute.y - outer.y) / outer.height,
  width: outer.width === 0 ? 0 : absolute.width / outer.width,
  height: outer.height === 0 ? 0 : absolute.height / outer.height
});

const walk = (
  elements: readonly SlideElement[],
  outer: Frame | undefined,
  depth: number,
  parents: readonly string[],
  into: Placed[]
): void => {
  for (const element of elements) {
    const frame = outer === undefined ? element.frame : within(outer, element.frame);
    into.push({ element, frame, depth, parents });
    if (element.content.type === "group") {
      walk(element.content.children, frame, depth + 1, [...parents, element.id], into);
    }
  }
};

export const placedOn = (slide: Slide): readonly Placed[] => {
  const into: Placed[] = [];
  walk(slide.elements, undefined, 0, [], into);
  return into;
};

export const placedById = (slide: Slide, id: string): Placed | undefined =>
  placedOn(slide).find((placed) => placed.element.id === id);

export const slideHolding = (body: SlideDeckBody, elementId: string): Slide | undefined =>
  body.slides.find((slide) => placedOn(slide).some((placed) => placed.element.id === elementId));

export const boundsOf = (frames: readonly Frame[]): Frame => {
  if (frames.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.width));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const blockIn = (body: SlideDeckBody, blockId: string): TextBlock | undefined => {
  const node = nodeIn(body, blockId);
  return node !== undefined && node.type === "text" && Array.isArray(node.atoms) ? (node as unknown as TextBlock) : undefined;
};

export const elementIn = (body: SlideDeckBody, elementId: string): SlideElement | undefined => {
  const slide = slideHolding(body, elementId);
  return slide === undefined ? undefined : placedById(slide, elementId)?.element;
};

const holds = (element: SlideElement, blockId: string): boolean => {
  const content = element.content;
  if ((content.type === "text" || content.type === "shape") && content.block?.id === blockId) return true;
  return content.type === "table" && content.block.rows.some((row) => row.cells.some((cell) => cell.blocks.some((held) => held.id === blockId)));
};

export const holderOf = (body: SlideDeckBody, blockId: string): SlideElement | undefined => {
  for (const slide of body.slides) {
    const found = placedOn(slide).find(({ element }) => holds(element, blockId));
    if (found) return found.element;
  }
  return undefined;
};

export const holderOn = (slide: Slide, blockId: string): SlideElement | undefined =>
  placedOn(slide).find(({ element }) => holds(element, blockId))?.element;

export const notesBlock = (slide: Slide): TextBlock | undefined =>
  slide.notes.find((block): block is TextBlock => block.type === "text");

export const withNotes = (body: SlideDeckBody, slideId: string, block: TextBlock): Edit =>
  edit(body, [{ op: "insert", target: "block", path: `${slideId}/notes`, ids: [block.id], after: null, values: [block] }]);

export const valueAt = (body: SlideDeckBody, path: string): unknown => {
  const [head, ...rest] = path.split("/");
  const root = body as unknown as Record<string, unknown>;
  let node: unknown = head in root ? root[head] : nodeIn(body, head);
  for (const segment of rest) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
};

export const withSet = (body: SlideDeckBody, path: string, value: unknown): Edit => {
  const was = valueAt(body, path);
  if (JSON.stringify(was) === JSON.stringify(value)) return none(body);
  return edit(body, [{ op: "set", path, value, was: was === undefined ? null : was }]);
};

export const withSets = (body: SlideDeckBody, sets: readonly { path: string; value: unknown }[]): Edit => {
  const ops: SlideDeckOp[] = [];
  let held = body;
  for (const { path, value } of sets) {
    const step = withSet(held, path, value);
    held = step.body;
    ops.push(...step.ops);
  }
  return { body: held, ops };
};

export const withElementFrame = (body: SlideDeckBody, elementId: string, frame: Frame): Edit => {
  const slide = slideHolding(body, elementId);
  if (slide === undefined) return none(body);
  const placed = placedById(slide, elementId);
  if (placed === undefined) return none(body);

  const outer = placed.parents.length === 0 ? undefined : placedById(slide, placed.parents[placed.parents.length - 1])?.frame;
  const stored = outer === undefined ? frame : relativeTo(outer, frame);
  return withSet(body, `${elementId}/frame`, stored);
};

const before = <T extends { id: string }>(items: readonly T[], id: string): string | null => {
  const at = items.findIndex((item) => item.id === id);
  return at <= 0 ? null : items[at - 1].id;
};

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
    case "text":
      return { ...content, block: freshBlock(content.block) as TextBlock };
    case "shape":
      return { ...content, block: content.block === undefined ? undefined : (freshBlock(content.block) as TextBlock) };
    case "image":
      return { ...content, block: freshBlock(content.block) as ImageBlock };
    case "table":
      return { ...content, block: freshBlock(content.block) as TableBlock };
    case "group":
      return { ...content, children: content.children.map(freshElement) };
    default:
      return content;
  }
};

export const freshElement = (element: SlideElement): SlideElement => ({
  ...element,
  id: mint("element"),
  content: freshContent(element.content)
});

const freshSlide = (slide: Slide): Slide => ({
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

export const slideFromLayout = (layout: SlideLayout | undefined, previous: Slide | undefined): Slide => ({
  id: mint("slide"),
  layoutKey: layout?.key ?? previous?.layoutKey,
  elements: (layout?.placeholders ?? []).map((placeholder) => ({
    id: mint("element"),
    frame: placeholder.frame,
    overflow: "shrink",
    fromPlaceholder: placeholder.role,
    content: { type: "text", block: emptyText(placeholder.styleKey) }
  })),
  notes: []
});

const inserted = (body: SlideDeckBody, slide: Slide, after: string | null): Edit =>
  edit(body, [{ op: "insert", target: "slide", path: "slides", ids: [slide.id], after, values: [slide] }]);

export const withNewSlide = (body: SlideDeckBody, afterId: string | undefined, layoutKey?: string): Edit => {
  const after = body.slides.find((slide) => slide.id === afterId);
  const layout = body.layouts.find((held) => held.key === (layoutKey ?? after?.layoutKey));
  return inserted(body, slideFromLayout(layoutKey === undefined ? undefined : layout, after), after?.id ?? null);
};

export const withSavedLayout = (body: SlideDeckBody, slideId: string, name: string): Edit => {
  const slide = body.slides.find((held) => held.id === slideId);
  if (slide === undefined) return none(body);
  const id = mint("layout");
  const layout: SlideLayout = {
    id,
    key: id,
    name: name.trim() === "" ? `Layout ${body.layouts.length + 1}` : name.trim(),
    locked: slide.elements.map(freshElement),
    placeholders: [],
    ...(slide.background === undefined ? {} : { background: slide.background })
  };
  return edit(body, [
    { op: "insert", target: "layout", path: "layouts", ids: [layout.id], after: body.layouts.at(-1)?.id ?? null, values: [layout] }
  ]);
};

export const withoutLayout = (body: SlideDeckBody, layoutId: string): Edit => {
  const layout = body.layouts.find((held) => held.id === layoutId);
  if (layout === undefined) return none(body);
  return edit(body, [
    { op: "remove", target: "layout", path: "layouts", ids: [layout.id], after: before(body.layouts, layout.id), values: [layout] }
  ]);
};

export const withDuplicatedSlide = (body: SlideDeckBody, slideId: string): Edit => {
  const original = body.slides.find((slide) => slide.id === slideId);
  if (original === undefined) return none(body);
  return inserted(body, freshSlide(original), original.id);
};

const withoutAnchor = (body: SlideDeckBody, going: Slide): readonly SlideDeckOp[] => {
  const at = body.slides.findIndex((slide) => slide.id === going.id);
  const section = body.sections.find((held) => held.firstSlideId === going.id);
  if (section === undefined) return [];

  const next = body.slides[at + 1];
  if (next === undefined) {
    return [
      {
        op: "remove",
        target: "section",
        path: "sections",
        ids: [section.id],
        after: before(body.sections, section.id),
        values: [section]
      }
    ];
  }

  return [{ op: "set", target: "section", path: `${section.id}/firstSlideId`, value: next.id, was: going.id }];
};

export const withoutSlide = (body: SlideDeckBody, slideId: string): Edit => {
  const going = body.slides.find((slide) => slide.id === slideId);
  if (going === undefined || body.slides.length < 2) return none(body);

  return edit(body, [
    ...withoutAnchor(body, going),
    {
      op: "remove",
      target: "slide",
      path: "slides",
      ids: [slideId],
      after: before(body.slides, slideId),
      values: [going]
    }
  ]);
};

export const withMovedSlide = (body: SlideDeckBody, slideId: string, afterId: string | null): Edit => {
  const moving = body.slides.find((slide) => slide.id === slideId);
  const wasAfter = before(body.slides, slideId);
  if (moving === undefined || afterId === slideId || afterId === wasAfter) return none(body);

  const without = body.slides.filter((slide) => slide.id !== slideId);
  if (afterId !== null && !without.some((slide) => slide.id === afterId)) return none(body);

  return edit(body, [{ op: "move", target: "slide", path: "slides", id: slideId, after: afterId, wasAfter }]);
};

export const stepped = (body: SlideDeckBody, slideId: string, way: "up" | "down"): Edit => {
  const at = body.slides.findIndex((slide) => slide.id === slideId);
  if (at === -1) return none(body);

  if (way === "up") {
    if (at === 0) return none(body);
    return withMovedSlide(body, slideId, at === 1 ? null : body.slides[at - 2].id);
  }

  const next = body.slides[at + 1];
  return next === undefined ? none(body) : withMovedSlide(body, slideId, next.id);
};

export const sectionOf = (body: SlideDeckBody, slideId: string): DeckSection | undefined => {
  let found: DeckSection | undefined;
  for (const slide of body.slides) {
    const starts = body.sections.find((section) => section.firstSlideId === slide.id);
    if (starts) found = starts;
    if (slide.id === slideId) return found;
  }
  return undefined;
};

const listPathFor = (slide: Slide, parents: readonly string[]): string =>
  parents.length === 0 ? `${slide.id}/elements` : `${parents[parents.length - 1]}/content/children`;

const siblingsOf = (slide: Slide, parents: readonly string[]): readonly SlideElement[] => {
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
  if (slide === undefined || elements.length === 0) return none(body);
  const anchor = after === "last" ? (slide.elements.at(-1)?.id ?? null) : after;
  return edit(body, [
    {
      op: "insert",
      target: "element",
      path: `${slideId}/elements`,
      ids: elements.map((element) => element.id),
      after: anchor,
      values: [...elements]
    }
  ]);
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
      after: before(siblings, id),
      values: [placed.element]
    };
    held = applyOps(held, [op]);
    ops.push(op);
  }
  return { body: held, ops };
};

export type { Restack } from "$app-views/categories/slide-deck-editor/procedures/arrange";

export const withRestacked = (body: SlideDeckBody, id: string, way: Restack): Edit => {
  const slide = slideHolding(body, id);
  if (slide === undefined) return none(body);
  const placed = placedById(slide, id);
  if (placed === undefined) return none(body);
  const siblings = siblingsOf(slide, placed.parents);
  const at = siblings.findIndex((element) => element.id === id);
  const last = siblings.length - 1;
  const wasAfter = before(siblings, id);

  const after =
    way === "front" ? (at === last ? wasAfter : siblings[last].id)
    : way === "forward" ? (at === last ? wasAfter : siblings[at + 1].id)
    : way === "back" ? null
    : at === 0 ? null : (at === 1 ? null : siblings[at - 2].id);

  if (after === wasAfter) return none(body);
  return edit(body, [
    { op: "move", target: "element", path: listPathFor(slide, placed.parents), id, after, wasAfter }
  ]);
};

export const withRestackedSet = (body: SlideDeckBody, ids: readonly string[], way: Restack): Edit => {
  const first = ids[0];
  if (first === undefined) return none(body);
  const slide = slideHolding(body, first);
  if (slide === undefined) return none(body);
  const placed = placedById(slide, first);
  if (placed === undefined) return none(body);

  const order = siblingsOf(slide, placed.parents).map((element) => element.id);
  const target = restacked(order, ids, way);
  const path = listPathFor(slide, placed.parents);
  const working = [...order];
  const ops: SlideDeckOp[] = [];

  target.forEach((id, index) => {
    const after = index === 0 ? null : target[index - 1];
    const at = working.indexOf(id);
    const wasAfter = at <= 0 ? null : working[at - 1];
    if (wasAfter === after) return;
    ops.push({ op: "move", target: "element", path, id, after, wasAfter });
    working.splice(at, 1);
    working.splice(after === null ? 0 : working.indexOf(after) + 1, 0, id);
  });

  return edit(body, ops);
};

export const withReorderedElement = (body: SlideDeckBody, id: string, after: string | null): Edit => {
  const slide = slideHolding(body, id);
  if (slide === undefined) return none(body);
  const placed = placedById(slide, id);
  if (placed === undefined) return none(body);
  const siblings = siblingsOf(slide, placed.parents);
  const wasAfter = before(siblings, id);
  if (after === id || after === wasAfter) return none(body);
  if (after !== null && !siblings.some((element) => element.id === after)) return none(body);
  return edit(body, [
    { op: "move", target: "element", path: listPathFor(slide, placed.parents), id, after, wasAfter }
  ]);
};

export const withGrouped = (body: SlideDeckBody, ids: readonly string[]): Edit => {
  if (ids.length < 2) return none(body);
  const slide = slideHolding(body, ids[0]);
  if (slide === undefined) return none(body);
  const members = slide.elements.filter((element) => ids.includes(element.id));
  if (members.length !== ids.length) return none(body);

  const bounds = boundsOf(members.map((member) => member.frame));
  const group: SlideElement = {
    id: mint("element"),
    frame: bounds,
    content: {
      type: "group",
      children: members.map((member) => ({ ...member, frame: relativeTo(bounds, member.frame) }))
    }
  };
  const top = slide.elements.findIndex((element) => element.id === members[members.length - 1].id);
  let anchor: string | null = null;
  for (let index = top - 1; index >= 0; index -= 1) {
    if (!ids.includes(slide.elements[index].id)) {
      anchor = slide.elements[index].id;
      break;
    }
  }

  const removal = withoutElements(body, ids);
  const insertion = withInsertedElements(removal.body, slide.id, [group], anchor);
  return { body: insertion.body, ops: [...removal.ops, ...insertion.ops] };
};

export const withUngrouped = (body: SlideDeckBody, groupId: string): Edit => {
  const slide = slideHolding(body, groupId);
  if (slide === undefined) return none(body);
  const placed = placedById(slide, groupId);
  if (placed === undefined || placed.element.content.type !== "group" || placed.parents.length > 0) return none(body);

  const children = placed.element.content.children.map((child) => ({
    ...child,
    frame: within(placed.frame, child.frame)
  }));
  const anchor = before(slide.elements, groupId);
  const removal = withoutElements(body, [groupId]);
  const insertion = withInsertedElements(removal.body, slide.id, children, anchor);
  return { body: insertion.body, ops: [...removal.ops, ...insertion.ops] };
};

export const withDuplicatedElements = (body: SlideDeckBody, ids: readonly string[]): Edit => {
  const slide = slideHolding(body, ids[0] ?? "");
  if (slide === undefined) return none(body);
  const copies = slide.elements
    .filter((element) => ids.includes(element.id))
    .map((element) => ({
      ...freshElement(element),
      frame: { ...element.frame, x: Math.min(element.frame.x + 0.02, 1 - element.frame.width), y: Math.min(element.frame.y + 0.02, 1 - element.frame.height) }
    }));
  return withInsertedElements(body, slide.id, copies, "last");
};

export const labelOf = (element: SlideElement): string => {
  switch (element.content.type) {
    case "text":
      return element.content.block.display.trim().split("\n")[0] || "Text";
    case "shape":
      return element.content.block?.display.trim() ? `Shape — ${element.content.block.display.trim().split("\n")[0]}` : "Shape";
    case "line":
      return "Line";
    case "image":
      return "Image";
    case "table":
      return "Table";
    case "chart":
      return "Chart";
    case "group":
      return `Group (${element.content.children.length})`;
  }
};
