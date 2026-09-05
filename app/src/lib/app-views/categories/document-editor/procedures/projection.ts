import type {
  Mark as ProseMirrorMark,
  Node as ProseMirrorNode,
  ResolvedPos
} from "prosemirror-model";

import type {
  Atom,
  ContentBlock,
  Mark,
  MarkEnd,
  MarkLink,
  MarkStyle,
  TextAtom
} from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { StyleSet } from "$representation/data/types/documents/style-set";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import {
  BODY_TYPESET,
  budgetOf,
  heightOfText,
  isBlocks,
  pack,
  paginate,
  shares,
  type Typeset
} from "$app-views/categories/document-editor/procedures/paginate";
import { schema } from "$app-views/categories/document-editor/procedures/schema";
import {
  BODY_FONT_SIZE,
  BODY_LINE_HEIGHT,
  inlineStyleOf,
  resolve,
  styleSetOf,
  type Styled
} from "$app-views/categories/document-editor/procedures/styles";

export type Metrics = {
  readonly charactersPerLine: number;
  readonly linesPerPage: number;
};

export type { DocumentBody } from "$representation/data/types/documents/body";

const DIVIDER_LINES = 1;
const IMAGE_LINES = 12;

export const isStyled = (block: ContentBlock): block is Styled =>
  block.type === "text" || block.type === "prompt";

export const soleLiteral = (block: ContentBlock): TextAtom | undefined => {
  if (block.type !== "text") return undefined;

  const [only, ...rest] = block.atoms;
  return rest.length === 0 && only?.kind === "literal" ? only : undefined;
};

export const emptyRow = (): DocumentRow => ({
  id: mint("row"),
  kind: "blocks",
  blocks: [
    {
      id: mint("block"),
      type: "text",
      variant: "paragraph",
      atoms: [{ id: mint("atom"), kind: "literal", text: "" }],
      display: "",
      marks: []
    }
  ]
});

export const displayOfAtom = (atom: Atom): string =>
  atom.kind === "literal" ? atom.text : atom.lastResolvedDisplay;

export type Segment = { readonly atom: Atom; readonly start: number; readonly end: number };

export const segmentsOf = (atoms: readonly Atom[]): readonly Segment[] => {
  const segments: Segment[] = [];
  let at = 0;

  for (const atom of atoms) {
    const length = displayOfAtom(atom).length;
    segments.push({ atom, start: at, end: at + length });
    at += length;
  }

  return segments;
};

export const linearOf = (atoms: readonly Atom[], end: MarkEnd): number => {
  const segments = segmentsOf(atoms);
  const held = segments.find((segment) => segment.atom.id === end.atom);
  if (held === undefined) return 0;

  return held.start + Math.min(Math.max(end.offset, 0), held.end - held.start);
};

export const endAt = (atoms: readonly Atom[], linear: number, bias: "from" | "to"): MarkEnd => {
  const segments = segmentsOf(atoms);
  if (segments.length === 0) return { atom: "", offset: 0 };

  const candidates =
    bias === "from"
      ? segments.filter((segment) => linear < segment.end)
      : segments.filter((segment) => linear > segment.start);

  const held =
    bias === "from"
      ? (candidates[0] ?? segments[segments.length - 1])
      : (candidates[candidates.length - 1] ?? segments[0]);

  return { atom: held.atom.id, offset: Math.min(Math.max(linear - held.start, 0), held.end - held.start) };
};

const STYLE_MARK: Record<MarkStyle, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikethrough: "strike",
  code: "code"
};

const MARK_STYLE: Record<string, MarkStyle> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strikethrough",
  code: "code"
};

const STYLE_ORDER: readonly MarkStyle[] = ["bold", "italic", "underline", "strikethrough", "code"];

export const sortedStyles = (styles: readonly MarkStyle[]): MarkStyle[] =>
  [...new Set(styles)].sort((a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b));

const proseMarksOf = (mark: Mark): ProseMirrorMark[] => {
  const marks: ProseMirrorMark[] = [];

  for (const style of mark.style ?? []) {
    marks.push(schema.marks[STYLE_MARK[style]].create({ markId: mark.id }));
  }
  if (mark.link !== undefined) marks.push(schema.marks.link.create({ markId: mark.id, link: mark.link }));
  if (mark.color !== undefined || mark.background !== undefined) {
    marks.push(
      schema.marks.colour.create({
        markId: mark.id,
        color: mark.color ?? null,
        background: mark.background ?? null
      })
    );
  }

  return marks;
};

type Span = { readonly from: number; readonly to: number; readonly marks: readonly ProseMirrorMark[] };

const formulaNode = (atom: Extract<Atom, { kind: "formula" }>, marks: readonly ProseMirrorMark[]) =>
  schema.node(
    "formula_atom",
    {
      atomId: atom.id,
      expression: atom.expression,
      resolved: atom.lastResolvedDisplay,
      state: atom.state,
      error: atom.error ?? null,
      formulaId: atom.formulaId ?? null,
      value: atom.lastResolvedValue
    },
    undefined,
    [...marks]
  );

const inlineOf = (block: Styled): ProseMirrorNode[] => {
  const segments = segmentsOf(block.atoms);
  const spans: Span[] = block.marks
    .map((mark) => ({
      from: linearOf(block.atoms, mark.from),
      to: linearOf(block.atoms, mark.to),
      marks: proseMarksOf(mark)
    }))
    .filter((span) => span.from < span.to && span.marks.length > 0);

  const covering = (a: number, b: number): ProseMirrorMark[] =>
    spans.filter((span) => span.from <= a && span.to >= b).flatMap((span) => [...span.marks]);

  const nodes: ProseMirrorNode[] = [];

  for (const segment of segments) {
    if (segment.atom.kind === "formula") {
      nodes.push(formulaNode(segment.atom, covering(segment.start, segment.end)));
      continue;
    }

    const cuts = new Set<number>([segment.start, segment.end]);
    for (const span of spans) {
      if (span.from > segment.start && span.from < segment.end) cuts.add(span.from);
      if (span.to > segment.start && span.to < segment.end) cuts.add(span.to);
    }

    const points = [...cuts].sort((a, b) => a - b);
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const text = segment.atom.text.slice(a - segment.start, b - segment.start);
      if (text.length === 0) continue;

      nodes.push(schema.text(text, covering(a, b)));
    }
  }

  return nodes;
};

const literalIds = (block: Styled): string[] =>
  block.atoms.filter((atom) => atom.kind === "literal").map((atom) => atom.id);

const textBlockNode = (block: Styled, share: number, styles: StyleSet): ProseMirrorNode => {
  const style = resolve(styles, block.style, block.format);
  const text = block.type === "text" ? block : undefined;

  return schema.node(
    "text_block",
    {
      blockId: block.id,
      kind: block.type,
      variant: text?.variant ?? "paragraph",
      level: text?.level ?? null,
      listStyle: text?.listStyle ?? null,
      checked: text?.checked ?? null,
      language: text?.language ?? null,
      styleKey: block.style ?? null,
      format: block.format ?? null,
      atomIds: literalIds(block),
      presentation: inlineStyleOf(style),
      fontSize: style.fontSize ?? BODY_FONT_SIZE,
      lineHeight: style.lineHeight ?? BODY_LINE_HEIGHT,
      spaceBefore: style.spaceBefore ?? 0,
      spaceAfter: style.spaceAfter ?? 0,
      share
    },
    inlineOf(block)
  );
};

const ATOM_NODE: Record<"image" | "table" | "formula", string> = {
  image: "image_block",
  table: "table_block",
  formula: "formula_block"
};

const blockNode = (block: ContentBlock, share: number, styles: StyleSet): ProseMirrorNode =>
  isStyled(block)
    ? textBlockNode(block, share, styles)
    : schema.node(ATOM_NODE[block.type], { blockId: block.id, share, block });

const rowNode = (row: DocumentRow, styles: StyleSet): ProseMirrorNode => {
  if (row.kind === "divider") {
    return schema.node("divider", {
      rowId: row.id,
      color: row.color ?? null,
      width: row.width ?? null,
      style: row.style ?? null
    });
  }
  if (row.kind === "pageBreak") return schema.node("page_break", { rowId: row.id });

  const share = shares(row);
  return schema.node(
    "blocks_row",
    { rowId: row.id, proportions: row.proportions ?? null },
    row.blocks.map((block, index) => blockNode(block, share[index], styles))
  );
};

const typeable = (row: DocumentRow): boolean =>
  isBlocks(row) && row.blocks.some((block) => block.type === "text");

export const docOf = (body: DocumentBody, metrics: Metrics): ProseMirrorNode => {
  const styles = styleSetOf(body);
  const rows = body.rows.some(typeable) ? body.rows : [...body.rows, emptyRow()];
  const pages = paginate(rows, metrics.charactersPerLine, metrics.linesPerPage, styles);

  return schema.node(
    "doc",
    null,
    pages.map((held) =>
      schema.node(
        "page",
        null,
        held.map((row) => rowNode(row, styles))
      )
    )
  );
};

export const displayTextOf = (node: ProseMirrorNode): string => {
  let text = "";
  node.forEach((child) => {
    text += child.type.name === "formula_atom" ? String(child.attrs.resolved) : child.text ?? "";
  });
  return text;
};

const typesetOf = (node: ProseMirrorNode): Typeset => ({
  fontSize: (node.attrs.fontSize as number) ?? BODY_TYPESET.fontSize,
  lineHeight: (node.attrs.lineHeight as number) ?? BODY_TYPESET.lineHeight,
  spaceBefore: (node.attrs.spaceBefore as number) ?? 0,
  spaceAfter: (node.attrs.spaceAfter as number) ?? 0
});

const linesOfBlockNode = (block: ProseMirrorNode, charactersPerLine: number): number => {
  const budget = budgetOf(block.attrs.share as number, charactersPerLine);

  switch (block.type.name) {
    case "text_block":
      return heightOfText(displayTextOf(block), budget, typesetOf(block));
    case "image_block":
      return IMAGE_LINES;
    case "table_block": {
      const held = block.attrs.block as { rows?: unknown[] } | null;
      return Math.max(1, held?.rows?.length ?? 1);
    }
    default:
      return 1;
  }
};

const linesOfRowNode = (row: ProseMirrorNode, charactersPerLine: number): number => {
  if (row.type.name === "divider") return DIVIDER_LINES;
  if (row.type.name === "page_break") return 0;

  let tallest = 1;
  row.forEach((block) => {
    tallest = Math.max(tallest, linesOfBlockNode(block, charactersPerLine));
  });

  return tallest;
};

export const rowNodesOf = (doc: ProseMirrorNode): readonly ProseMirrorNode[] => {
  const rows: ProseMirrorNode[] = [];
  doc.forEach((page) => page.forEach((row) => rows.push(row)));
  return rows;
};

const unnamed = (node: ProseMirrorNode): boolean =>
  node.type.name === "blocks_row"
    ? node.attrs.rowId === null || node.children.some(unnamed)
    : node.attrs.rowId === null && node.attrs.blockId === null;

const stampBlock = (block: ProseMirrorNode): ProseMirrorNode =>
  block.attrs.blockId === null
    ? block.type.create({ ...block.attrs, blockId: mint("block") }, block.content, block.marks)
    : block;

const stampRow = (row: ProseMirrorNode): ProseMirrorNode => {
  if (row.type.name !== "blocks_row") {
    return row.attrs.rowId === null
      ? row.type.create({ ...row.attrs, rowId: mint("row") })
      : row;
  }

  return schema.node(
    "blocks_row",
    { ...row.attrs, rowId: row.attrs.rowId ?? mint("row") },
    row.children.map(stampBlock)
  );
};

export const stampIds = (doc: ProseMirrorNode): ProseMirrorNode =>
  rowNodesOf(doc).some(unnamed)
    ? schema.node(
        "doc",
        null,
        doc.children.map((page) => schema.node("page", page.attrs, page.children.map(stampRow)))
      )
    : doc;

export const repaginate = (doc: ProseMirrorNode, metrics: Metrics): ProseMirrorNode => {
  const pages = pack(
    rowNodesOf(doc),
    (row) => linesOfRowNode(row, metrics.charactersPerLine),
    (row) => row.type.name === "page_break",
    metrics.linesPerPage
  );

  return schema.node(
    "doc",
    null,
    pages.map((held) => schema.node("page", null, [...held]))
  );
};

const strip = <T extends object>(held: T): T =>
  Object.fromEntries(Object.entries(held).filter(([, value]) => value !== undefined)) as T;

type Walked = {
  readonly atoms: Atom[];
  readonly display: string;
};

const atomsOf = (node: ProseMirrorNode): Walked => {
  const ids = node.attrs.atomIds as string[];
  const atoms: Atom[] = [];
  let run = "";
  let index = 0;

  const flush = () => {
    atoms.push({ id: ids[index] ?? mint("atom"), kind: "literal", text: run });
    index += 1;
    run = "";
  };

  node.forEach((child) => {
    if (child.type.name !== "formula_atom") {
      run += child.text ?? "";
      return;
    }

    if (run.length > 0) flush();
    atoms.push({
      id: child.attrs.atomId as string,
      kind: "formula",
      expression: child.attrs.expression as string,
      ...(child.attrs.formulaId === null ? {} : { formulaId: child.attrs.formulaId }),
      lastResolvedValue: child.attrs.value ?? { kind: "empty" },
      lastResolvedDisplay: child.attrs.resolved as string,
      state: child.attrs.state,
      ...(child.attrs.error === null ? {} : { error: child.attrs.error as string })
    });
  });

  if (run.length > 0 || atoms.length === 0) flush();

  return { atoms, display: atoms.map(displayOfAtom).join("") };
};

type Gathered = {
  ranges: Map<string, { from: number; to: number }>;
  link?: MarkLink;
  color?: string;
  background?: string;
  first: number;
};

const gather = (node: ProseMirrorNode): Map<string, Gathered> => {
  const held = new Map<string, Gathered>();
  let at = 0;

  node.forEach((child) => {
    const length = child.type.name === "formula_atom" ? String(child.attrs.resolved).length : (child.text?.length ?? 0);
    const from = at;
    const to = at + length;
    at = to;

    for (const mark of child.marks) {
      const id = mark.attrs.markId as string | null;
      if (id === null) continue;

      const entry: Gathered = held.get(id) ?? { ranges: new Map(), first: from };
      const range = entry.ranges.get(mark.type.name) ?? { from, to };
      range.from = Math.min(range.from, from);
      range.to = Math.max(range.to, to);
      entry.ranges.set(mark.type.name, range);

      if (mark.type.name === "link") entry.link = mark.attrs.link as MarkLink;
      if (mark.type.name === "colour") {
        if (mark.attrs.color !== null) entry.color = mark.attrs.color as string;
        if (mark.attrs.background !== null) entry.background = mark.attrs.background as string;
      }

      held.set(id, entry);
    }
  });

  return held;
};

const markFrom = (
  id: string,
  types: readonly string[],
  range: { from: number; to: number },
  entry: Gathered,
  atoms: readonly Atom[]
): Mark => {
  const styles = sortedStyles(types.filter((type) => type in MARK_STYLE).map((type) => MARK_STYLE[type]));
  const carriesLink = types.includes("link");
  const carriesColour = types.includes("colour");

  return strip({
    id,
    from: endAt(atoms, range.from, "from"),
    to: endAt(atoms, range.to, "to"),
    style: styles.length > 0 ? styles : undefined,
    link: carriesLink ? entry.link : undefined,
    color: carriesColour ? entry.color : undefined,
    background: carriesColour ? entry.background : undefined
  });
};

const marksOf = (node: ProseMirrorNode, atoms: readonly Atom[]): Mark[] => {
  const marks: Mark[] = [];
  const gathered = [...gather(node).entries()].sort((a, b) => a[1].first - b[1].first);

  for (const [id, entry] of gathered) {
    const groups = new Map<string, string[]>();
    for (const [type, range] of entry.ranges) {
      const key = `${range.from}:${range.to}`;
      groups.set(key, [...(groups.get(key) ?? []), type]);
    }

    let index = 0;
    for (const [key, types] of groups) {
      const [from, to] = key.split(":").map(Number);
      marks.push(markFrom(index === 0 ? id : mint("mark"), types, { from, to }, entry, atoms));
      index += 1;
    }
  }

  return marks;
};

const blockOf = (
  node: ProseMirrorNode,
  before: ReadonlyMap<string, ContentBlock>
): ContentBlock => {
  const id = node.attrs.blockId as string;

  if (node.type.name !== "text_block") {
    const held = (node.attrs.block ?? before.get(id)) as ContentBlock;
    return { ...held, id };
  }

  const { atoms, display } = atomsOf(node);
  const marks = marksOf(node, atoms);
  const earlier = before.get(id);
  const base = earlier !== undefined && isStyled(earlier) ? earlier : undefined;
  const format = (node.attrs.format as Styled["format"] | null) ?? undefined;
  const style = (node.attrs.styleKey as string | null) ?? undefined;

  if (node.attrs.kind === "prompt") {
    const prompt = base?.type === "prompt" ? base : { id, type: "prompt" as const, state: "idle" as const };
    return strip({ ...prompt, id, atoms, display, marks, style, format });
  }

  const text = base?.type === "text" ? base : undefined;
  return strip({
    ...text,
    id,
    type: "text" as const,
    variant: node.attrs.variant as Styled extends { variant: infer V } ? V : never,
    level: (node.attrs.level as number | null) ?? undefined,
    listStyle: (node.attrs.listStyle as "bullet" | "ordered" | "todo" | null) ?? undefined,
    checked: (node.attrs.checked as boolean | null) ?? undefined,
    language: (node.attrs.language as string | null) ?? undefined,
    style,
    atoms,
    display,
    marks,
    format
  });
};

const rowOf = (
  node: ProseMirrorNode,
  blocksBefore: ReadonlyMap<string, ContentBlock>
): DocumentRow => {
  const id = node.attrs.rowId as string;

  if (node.type.name === "divider") {
    return strip({
      id,
      kind: "divider" as const,
      color: (node.attrs.color as string | null) ?? undefined,
      width: (node.attrs.width as number | null) ?? undefined,
      style: (node.attrs.style as "solid" | "dashed" | "dotted" | null) ?? undefined
    });
  }
  if (node.type.name === "page_break") return { id, kind: "pageBreak" };

  const blocks: ContentBlock[] = [];
  node.forEach((child) => blocks.push(blockOf(child, blocksBefore)));

  const proportions = node.attrs.proportions as number[] | null;
  return { id, kind: "blocks", blocks, ...(proportions === null ? {} : { proportions }) };
};

export const bodyOf = (doc: ProseMirrorNode, previous: DocumentBody): DocumentBody => {
  const blocksBefore = new Map<string, ContentBlock>();
  for (const row of previous.rows) {
    if (!isBlocks(row)) continue;
    for (const block of row.blocks) blocksBefore.set(block.id, block);
  }

  return { ...previous, rows: rowNodesOf(doc).map((row) => rowOf(row, blocksBefore)) };
};

export const displayOffsetOf = (block: ProseMirrorNode, offset: number): number => {
  let pm = 0;
  let display = 0;

  for (let index = 0; index < block.childCount && pm < offset; index += 1) {
    const child = block.child(index);
    if (child.type.name === "formula_atom") {
      pm += 1;
      display += String(child.attrs.resolved).length;
      continue;
    }

    const length = child.text?.length ?? 0;
    const taken = Math.min(length, offset - pm);
    pm += taken;
    display += taken;
  }

  return display;
};

export const proseOffsetOf = (block: ProseMirrorNode, display: number): number => {
  let pm = 0;
  let seen = 0;

  for (let index = 0; index < block.childCount && seen < display; index += 1) {
    const child = block.child(index);
    if (child.type.name === "formula_atom") {
      const length = String(child.attrs.resolved).length;
      if (seen + length > display) break;
      seen += length;
      pm += 1;
      continue;
    }

    const length = child.text?.length ?? 0;
    const taken = Math.min(length, display - seen);
    seen += taken;
    pm += taken;
  }

  return pm;
};

export type Anchor = { readonly blockId: string; readonly offset: number };

export const anchorAt = ($from: ResolvedPos): Anchor | undefined => {
  const block = $from.parent;
  if (block.type.name !== "text_block" || typeof block.attrs.blockId !== "string") {
    return undefined;
  }

  return { blockId: block.attrs.blockId, offset: displayOffsetOf(block, $from.parentOffset) };
};

export const positionOf = (doc: ProseMirrorNode, anchor: Anchor): number | undefined => {
  let found: number | undefined;

  doc.descendants((node, at) => {
    if (found !== undefined) return false;
    if (node.type.name !== "text_block") return;
    if (node.attrs.blockId !== anchor.blockId) return;

    found = at + 1 + proseOffsetOf(node, anchor.offset);
    return false;
  });

  return found;
};

export type AtomAddress = { readonly blockId: string; readonly atomId: string; readonly offset: number };

export const addressAt = ($at: ResolvedPos): AtomAddress | undefined => {
  const block = $at.parent;
  if (block.type.name !== "text_block" || typeof block.attrs.blockId !== "string") {
    return undefined;
  }

  const { atoms } = atomsOf(block);
  const end = endAt(atoms, displayOffsetOf(block, $at.parentOffset), "from");

  return { blockId: block.attrs.blockId, atomId: end.atom, offset: end.offset };
};

export const withFreshMarkIds = (nodes: readonly ProseMirrorNode[]): ProseMirrorNode[] => {
  const fresh = new Map<string, string>();
  const renamed = (mark: ProseMirrorMark): ProseMirrorMark => {
    const id = mark.attrs.markId as string | null;
    if (id === null) return mark;

    const next = fresh.get(id) ?? mint("mark");
    fresh.set(id, next);
    return mark.type.create({ ...mark.attrs, markId: next });
  };

  return nodes.map((node) => node.mark(node.marks.map(renamed)));
};
