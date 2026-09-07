import type { BlockFormat } from "$representation/data/types/content/block-format";
import type {
  Atom,
  ContentBlock,
  TextBlock
} from "$representation/data/types/content/content-block";
import { endAt } from "$representation/data/behavior/content/positions";
import type {
  ElementContent,
  ElementPaint,
  Frame,
  SlideDeckBody,
  SlideElement
} from "$representation/data/types/slide-decks/body";

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const reserveIdentifiers = (value: unknown, identifiers: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const nested of value) reserveIdentifiers(nested, identifiers);
    return;
  }
  if (!isFields(value)) return;
  if (typeof value.id === "string") identifiers.add(value.id);
  for (const nested of Object.values(value)) reserveIdentifiers(nested, identifiers);
};

const identifierMint = (body: unknown) => {
  const identifiers = new Set<string>();
  reserveIdentifiers(body, identifiers);

  return (suggested: string): string => {
    const stem = suggested.slice(0, 460) || "normalized-slide-node";
    let candidate = stem;
    let suffix = 2;
    while (identifiers.has(candidate)) {
      candidate = `${stem}-${suffix}`;
      suffix += 1;
    }
    identifiers.add(candidate);
    return candidate;
  };
};

const paintOf = (format: unknown): ElementPaint | undefined => {
  if (!isFields(format)) return undefined;
  const paint: Fields = {};
  if (format.background !== undefined) paint.fill = format.background;
  if (format.border !== undefined) {
    if (isFields(format.border)) {
      const { style, ...stroke } = format.border;
      paint.stroke = { ...stroke, ...(style === undefined ? {} : { dash: style }) };
    } else {
      paint.stroke = format.border;
    }
  }
  return Object.keys(paint).length === 0 ? undefined : (paint as ElementPaint);
};

const contentFormatOf = (format: unknown): Fields | undefined => {
  if (!isFields(format)) return undefined;
  const { background: _background, border: _border, ...contentFormat } = format;
  return Object.keys(contentFormat).length === 0 ? undefined : contentFormat;
};

const normalizedMark = (value: unknown, atoms: readonly Atom[]): unknown => {
  if (!isFields(value)) return value;
  if (typeof value.from !== "number" || typeof value.to !== "number") return value;
  return {
    ...value,
    from: endAt(atoms, value.from, "from"),
    to: endAt(atoms, value.to, "to")
  };
};

const normalizedBlock = (value: unknown): unknown => {
  if (!isFields(value)) return value;

  if (
    (value.type === "text" || value.type === "prompt") &&
    Array.isArray(value.atoms) &&
    Array.isArray(value.marks)
  ) {
    const atoms = value.atoms as Atom[];
    return { ...value, marks: value.marks.map((mark) => normalizedMark(mark, atoms)) };
  }

  if (value.type === "image" && isFields(value.caption)) {
    return { ...value, caption: normalizedBlock(value.caption) };
  }

  if (value.type === "table" && Array.isArray(value.rows)) {
    return {
      ...value,
      rows: value.rows.map((row) =>
        !isFields(row) || !Array.isArray(row.cells)
          ? row
          : {
              ...row,
              cells: row.cells.map((cell) =>
                !isFields(cell) || !Array.isArray(cell.blocks)
                  ? cell
                  : { ...cell, blocks: cell.blocks.map(normalizedBlock) }
              )
            }
      )
    };
  }

  return value;
};

const formatted = (
  block: unknown,
  format: unknown,
  includePadding = true
): ContentBlock => {
  const normalized = normalizedBlock(block);
  if (!isFields(normalized)) return normalized as ContentBlock;
  const inherited = contentFormatOf(format);
  if (inherited === undefined) return normalized as ContentBlock;
  if (!includePadding) delete inherited.padding;
  if (Object.keys(inherited).length === 0) return normalized as ContentBlock;
  const own = isFields(normalized.format) ? normalized.format : {};
  return { ...normalized, format: { ...inherited, ...own } } as ContentBlock;
};

const contentOf = (block: ContentBlock): ElementContent => {
  switch (block.type) {
    case "text":
    case "formula":
    case "prompt":
    case "image":
      return { type: block.type, block } as ElementContent;
    case "table":
      return { type: "table", block };
  }
};

const emptyShapeBlock = (id: string, format: Fields): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [],
  display: "",
  marks: [],
  format: format as BlockFormat
});

const numeric = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const ratioOf = (body: Fields): number => {
  if (typeof body.aspectRatio !== "string") return 16 / 9;
  const [width, height] = body.aspectRatio.split(":").map(Number);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? width / height
    : 16 / 9;
};

const childFrames = (
  count: number,
  frame: unknown,
  format: unknown,
  ratio: number
): Frame[] => {
  const heldFrame = isFields(frame) ? frame : {};
  const heldFormat = isFields(format) ? format : {};
  const padding = isFields(heldFormat.padding) ? heldFormat.padding : {};
  const width = Math.max(1, numeric(heldFrame.width) * 720 * ratio);
  const height = Math.max(1, numeric(heldFrame.height) * 720);
  const insetX = Math.min(0.2, Math.max(0, numeric(padding.x) / width));
  const insetY = Math.min(0.2, Math.max(0, numeric(padding.y) / height));
  const gap = Math.min(0.025, 0.15 / Math.max(1, count));
  const available = Math.max(0.001 * count, 1 - insetY * 2 - gap * (count - 1));
  const childHeight = available / count;

  return Array.from({ length: count }, (_, index) => ({
    x: insetX,
    y: insetY + index * (childHeight + gap),
    width: Math.max(0.001, 1 - insetX * 2),
    height: Math.max(0.001, childHeight)
  }));
};

const normalizedElement = (
  value: unknown,
  mint: (suggested: string) => string,
  ratio: number
): SlideElement => {
  if (!isFields(value)) return value as SlideElement;

  if (isFields(value.content)) {
    if (value.content.type !== "group" || !Array.isArray(value.content.children)) {
      return {
        ...value,
        ...(isFields(value.content.block)
          ? { content: { ...value.content, block: normalizedBlock(value.content.block) } }
          : {})
      } as SlideElement;
    }
    return {
      ...value,
      content: {
        ...value.content,
        children: value.content.children.map((child) => normalizedElement(child, mint, ratio))
      }
    } as SlideElement;
  }

  if (!Array.isArray(value.blocks)) return value as SlideElement;

  const { blocks, format, ...element } = value;
  const paint = paintOf(format);
  const base = {
    ...element,
    ...(paint === undefined ? {} : { paint: { ...paint, ...(isFields(element.paint) ? element.paint : {}) } })
  };
  const elementId = typeof value.id === "string" ? value.id : "legacy-slide-element";

  if (blocks.length === 0) {
    const contentFormat = contentFormatOf(format);
    return {
      ...base,
      content: {
        type: "shape",
        shape: "rectangle",
        ...(contentFormat === undefined
          ? {}
          : { block: emptyShapeBlock(mint(`${elementId}-empty-block`), contentFormat) })
      }
    } as SlideElement;
  }

  if (blocks.length === 1) {
    return {
      ...base,
      content: contentOf(formatted(blocks[0], format))
    } as SlideElement;
  }

  const frames = childFrames(blocks.length, value.frame, format, ratio);
  const children = blocks.map((block, index) => ({
    id: mint(`${elementId}-content-${index + 1}`),
    frame: frames[index],
    ...(value.overflow === undefined ? {} : { overflow: value.overflow }),
    content: contentOf(formatted(block, format, false))
  })) as SlideElement[];

  if (paint !== undefined) {
    children.unshift({
      id: mint(`${elementId}-background`),
      frame: { x: 0, y: 0, width: 1, height: 1 },
      paint,
      locked: true,
      content: { type: "shape", shape: "rectangle" }
    });
  }

  return {
    ...element,
    content: { type: "group", children }
  } as SlideElement;
};

/**
 * Brings the pre-editor `blocks[]` slide shape to the editor's explicit element
 * content model. The migration is pure and deterministic so read boundaries,
 * template admission, and one-time seed migrations all agree.
 */
export const normalizeSlideDeckBody = (value: unknown): SlideDeckBody => {
  if (!isFields(value)) return value as SlideDeckBody;
  const mint = identifierMint(value);
  const ratio = ratioOf(value);

  return {
    ...value,
    layouts: Array.isArray(value.layouts)
      ? value.layouts.map((candidate) => {
          if (!isFields(candidate)) return candidate;
          return {
            ...candidate,
            id:
              typeof candidate.id === "string"
                ? candidate.id
                : mint(`layout-${typeof candidate.key === "string" ? candidate.key : "legacy"}`),
            locked: Array.isArray(candidate.locked)
              ? candidate.locked.map((element) => normalizedElement(element, mint, ratio))
              : candidate.locked
          };
        })
      : value.layouts,
    slides: Array.isArray(value.slides)
      ? value.slides.map((candidate) => {
          if (!isFields(candidate)) return candidate;
          return {
            ...candidate,
            notes: Array.isArray(candidate.notes)
              ? candidate.notes.map(normalizedBlock)
              : candidate.notes,
            elements: Array.isArray(candidate.elements)
              ? candidate.elements.map((element) => normalizedElement(element, mint, ratio))
              : candidate.elements
          };
        })
      : value.slides
  } as SlideDeckBody;
};

/** Every persisted editor deck has a canvas, even when its template is intentionally blank. */
export const ensureSlideDeckReady = (body: SlideDeckBody): SlideDeckBody => {
  if (body.slides.length > 0) return body;
  const mint = identifierMint(body);
  return {
    ...body,
    slides: [{ id: mint("slide-1"), elements: [], notes: [] }]
  };
};
