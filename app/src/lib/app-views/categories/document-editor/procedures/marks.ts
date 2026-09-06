import type {
  ContentBlock,
  Mark,
  MarkLink,
  MarkStyle
} from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { Selection } from "$representation/data/types/workspace/tab";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
import {
  endAt,
  isStyled,
  linearOf,
  sortedStyles
} from "$app-views/categories/document-editor/procedures/projection";
import type { Styled } from "$app-views/categories/document-editor/procedures/styles";

export type Range = { readonly blockId: string; readonly from: number; readonly to: number };

export type { MarkLink, MarkStyle } from "$representation/data/types/content/content-block";

export const STYLES: readonly { value: MarkStyle; label: string }[] = [
  { value: "bold", label: "Bold" },
  { value: "italic", label: "Italic" },
  { value: "underline", label: "Underline" },
  { value: "strikethrough", label: "Strikethrough" }
];

export const blocksOf = (body: DocumentBody): Styled[] => {
  const held: Styled[] = [];
  const rows = [
    ...(body.header?.rows ?? []),
    ...body.rows,
    ...(body.footer?.rows ?? [])
  ];
  for (const row of rows) {
    if (row.kind !== "blocks") continue;
    for (const block of row.blocks) if (isStyled(block)) held.push(block);
  }
  return held;
};

export const blockOf = (body: DocumentBody, blockId: string): Styled | undefined =>
  blocksOf(body).find((block) => block.id === blockId);

export const anyBlockOf = (body: DocumentBody, blockId: string): ContentBlock | undefined => {
  const rows = [
    ...(body.header?.rows ?? []),
    ...(body.header?.firstPageRows ?? []),
    ...body.rows,
    ...(body.footer?.rows ?? []),
    ...(body.footer?.firstPageRows ?? [])
  ];
  for (const row of rows) {
    if (row.kind !== "blocks") continue;
    const found = row.blocks.find((block) => block.id === blockId);
    if (found !== undefined) return found;
  }
  return undefined;
};

const linear = (body: DocumentBody, address: string): { blockId: string; at: number } | undefined => {
  const found = addressOf(address);
  if (found === undefined) return undefined;

  const block = blockOf(body, found.blockId);
  if (block === undefined) return undefined;

  return { blockId: found.blockId, at: linearOf(block.atoms, { atom: found.atomId, offset: found.offset }) };
};

const rangeBetween = (body: DocumentBody, id: string, at: string): Range[] => {
  const start = linear(body, id);
  const end = linear(body, at);
  if (start === undefined || end === undefined) return [];

  if (start.blockId === end.blockId) {
    return [{ blockId: start.blockId, from: Math.min(start.at, end.at), to: Math.max(start.at, end.at) }];
  }

  const blocks = blocksOf(body);
  const a = blocks.findIndex((block) => block.id === start.blockId);
  const b = blocks.findIndex((block) => block.id === end.blockId);
  if (a === -1 || b === -1) return [];

  const [first, last] = a <= b ? [a, b] : [b, a];
  const head = a <= b ? start : end;
  const tail = a <= b ? end : start;

  return blocks.slice(first, last + 1).map((block, index) => ({
    blockId: block.id,
    from: index === 0 ? head.at : 0,
    to: index === last - first ? tail.at : block.display.length
  }));
};

export const rangesOf = (body: DocumentBody | undefined, selection: Selection | undefined): Range[] => {
  if (body === undefined || selection === undefined) return [];

  const ranges: Range[] = [];
  const pairs = [
    { id: selection.id, at: selection.at ?? selection.id },
    ...(selection.ranges ?? [])
  ];

  for (const pair of pairs) ranges.push(...rangeBetween(body, pair.id, pair.at));

  return ranges.filter((range) => range.from < range.to);
};

export const blocksIn = (body: DocumentBody | undefined, selection: Selection | undefined): Styled[] => {
  if (body === undefined || selection === undefined) return [];

  const ids = new Set<string>();
  const start = addressOf(selection.id);
  if (start !== undefined) ids.add(start.blockId);

  for (const range of rangesOf(body, selection)) ids.add(range.blockId);
  for (const pair of selection.ranges ?? []) {
    const found = addressOf(pair.id);
    if (found !== undefined) ids.add(found.blockId);
  }

  return [...ids].map((id) => blockOf(body, id)).filter((block): block is Styled => block !== undefined);
};

type Placed = { readonly mark: Mark; readonly from: number; readonly to: number };

const placed = (block: Styled): Placed[] =>
  block.marks.map((mark) => ({
    mark,
    from: linearOf(block.atoms, mark.from),
    to: linearOf(block.atoms, mark.to)
  }));

const coverage = (block: Styled, range: Range, keep: (mark: Mark) => boolean): number => {
  const spans = placed(block)
    .filter((held) => keep(held.mark))
    .map((held) => [Math.max(held.from, range.from), Math.min(held.to, range.to)] as const)
    .filter(([from, to]) => from < to)
    .sort((a, b) => a[0] - b[0]);

  let covered = 0;
  let at = range.from;
  for (const [from, to] of spans) {
    const start = Math.max(from, at);
    if (to > start) covered += to - start;
    at = Math.max(at, to);
  }

  return covered;
};

export type Coverage = { readonly on: boolean; readonly mixed: boolean };

export const coverageOf = (
  body: DocumentBody,
  ranges: readonly Range[],
  keep: (mark: Mark) => boolean
): Coverage => {
  let full = 0;
  let some = 0;
  let total = 0;

  for (const range of ranges) {
    const block = blockOf(body, range.blockId);
    if (block === undefined) continue;

    total += 1;
    const covered = coverage(block, range, keep);
    if (covered >= range.to - range.from) full += 1;
    else if (covered > 0) some += 1;
  }

  if (total === 0) return { on: false, mixed: false };
  return { on: full === total, mixed: full !== total && full + some > 0 };
};

export const stylesOn = (
  body: DocumentBody,
  ranges: readonly Range[]
): { on: MarkStyle[]; mixed: MarkStyle[] } => {
  const on: MarkStyle[] = [];
  const mixed: MarkStyle[] = [];

  for (const { value } of STYLES) {
    const held = coverageOf(body, ranges, (mark) => mark.style?.includes(value) === true);
    if (held.on) on.push(value);
    else if (held.mixed) mixed.push(value);
  }

  return { on, mixed };
};

const insertMark = (block: Styled, mark: Mark): DocumentOp => ({
  op: "insert",
  target: "mark",
  path: `${block.id}/marks`,
  ids: [mark.id],
  after: block.marks.at(-1)?.id ?? null,
  values: [mark]
});

/**
 * Mark editing is authored as a batch. Every insertion/removal anchor must be
 * computed against the list produced by the operations before it, not the
 * original list—otherwise replacing the last colour or link points at an id
 * that the same batch has already removed.
 */
const reanchor = (body: DocumentBody, ops: readonly DocumentOp[]): DocumentOp[] => {
  const order = new Map<string, string[]>();

  return ops.map((op) => {
    if ((op.op !== "insert" && op.op !== "remove") || op.target !== "mark") return op;
    const [blockId, field] = op.path.split("/");
    if (field !== "marks") return op;

    let ids = order.get(blockId);
    if (ids === undefined) {
      ids = [...(blockOf(body, blockId)?.marks.map((mark) => mark.id) ?? [])];
      order.set(blockId, ids);
    }

    if (op.op === "insert") {
      const anchored = { ...op, after: ids.at(-1) ?? null };
      ids.push(...op.ids);
      return anchored;
    }

    const first = ids.indexOf(op.ids[0]);
    const anchored = { ...op, after: first <= 0 ? null : ids[first - 1] };
    const going = new Set(op.ids);
    order.set(
      blockId,
      ids.filter((id) => !going.has(id))
    );
    return anchored;
  });
};

const removeMark = (block: Styled, mark: Mark): DocumentOp => {
  const index = block.marks.findIndex((held) => held.id === mark.id);
  return {
    op: "remove",
    target: "mark",
    path: `${block.id}/marks`,
    ids: [mark.id],
    after: index <= 0 ? null : block.marks[index - 1].id,
    values: [mark]
  };
};

const setMark = (mark: Mark, field: keyof Mark, value: unknown): DocumentOp => ({
  op: "set",
  target: "mark",
  path: `${mark.id}/${field}`,
  value: value ?? null,
  was: mark[field] ?? null
});

const bare = (mark: Mark): boolean =>
  (mark.style === undefined || mark.style.length === 0) &&
  mark.link === undefined &&
  mark.color === undefined &&
  mark.background === undefined;

const withEnds = (block: Styled, mark: Mark, from: number, to: number): Mark => ({
  ...mark,
  from: endAt(block.atoms, from, "from"),
  to: endAt(block.atoms, to, "to")
});

const clearField = (
  block: Styled,
  range: Range,
  matches: (mark: Mark) => boolean,
  stripped: (mark: Mark) => Mark
): DocumentOp[] => {
  const ops: DocumentOp[] = [];

  for (const held of placed(block)) {
    if (!matches(held.mark)) continue;
    if (held.to <= range.from || held.from >= range.to) continue;

    const inside = held.from >= range.from && held.to <= range.to;

    if (inside) {
      const remaining = stripped(held.mark);
      if (bare(remaining)) {
        ops.push(removeMark(block, held.mark));
        continue;
      }
      for (const field of ["style", "link", "color", "background"] as const) {
        if (JSON.stringify(remaining[field] ?? null) !== JSON.stringify(held.mark[field] ?? null)) {
          ops.push(setMark(held.mark, field, remaining[field]));
        }
      }
      continue;
    }

    const leftover = stripped(held.mark);
    const overlapFrom = Math.max(held.from, range.from);
    const overlapTo = Math.min(held.to, range.to);

    if (held.from < range.from) {
      ops.push(setMark(held.mark, "to", endAt(block.atoms, range.from, "to")));
    } else {
      ops.push(setMark(held.mark, "from", endAt(block.atoms, range.to, "from")));
    }

    if (held.from < range.from && held.to > range.to) {
      ops.push(insertMark(block, withEnds(block, { ...held.mark, id: mint("mark") }, range.to, held.to)));
    }

    if (!bare(leftover)) {
      ops.push(insertMark(block, withEnds(block, { ...leftover, id: mint("mark") }, overlapFrom, overlapTo)));
    }
  }

  return ops;
};

const stripStyle = (style: MarkStyle) => (mark: Mark): Mark => {
  const rest = (mark.style ?? []).filter((held) => held !== style);
  const { style: gone, ...without } = mark;
  void gone;
  return rest.length === 0 ? without : { ...without, style: rest };
};

export const styleOps = (
  body: DocumentBody,
  ranges: readonly Range[],
  style: MarkStyle,
  on: boolean
): DocumentOp[] => {
  const ops: DocumentOp[] = [];

  for (const range of ranges) {
    const block = blockOf(body, range.blockId);
    if (block === undefined) continue;

    if (on) {
      ops.push(
        insertMark(block, {
          id: mint("mark"),
          from: endAt(block.atoms, range.from, "from"),
          to: endAt(block.atoms, range.to, "to"),
          style: sortedStyles([style])
        })
      );
      continue;
    }

    ops.push(
      ...clearField(block, range, (mark) => mark.style?.includes(style) === true, stripStyle(style))
    );
  }

  return reanchor(body, ops);
};

const stripColour = (mark: Mark): Mark => {
  const { color, background, ...without } = mark;
  void color;
  void background;
  return without;
};

export const colourOps = (
  body: DocumentBody,
  ranges: readonly Range[],
  colour: { readonly color?: string; readonly background?: string }
): DocumentOp[] => {
  const ops: DocumentOp[] = [];
  const clearing = colour.color === undefined && colour.background === undefined;

  for (const range of ranges) {
    const block = blockOf(body, range.blockId);
    if (block === undefined) continue;

    ops.push(
      ...clearField(
        block,
        range,
        (mark) => mark.color !== undefined || mark.background !== undefined,
        stripColour
      )
    );

    if (clearing) continue;

    ops.push(
      insertMark(block, {
        id: mint("mark"),
        from: endAt(block.atoms, range.from, "from"),
        to: endAt(block.atoms, range.to, "to"),
        ...(colour.color === undefined ? {} : { color: colour.color }),
        ...(colour.background === undefined ? {} : { background: colour.background })
      })
    );
  }

  return reanchor(body, ops);
};

const stripLink = (mark: Mark): Mark => {
  const { link, ...without } = mark;
  void link;
  return without;
};

export const linkOps = (
  body: DocumentBody,
  ranges: readonly Range[],
  link: MarkLink | undefined
): DocumentOp[] => {
  const ops: DocumentOp[] = [];

  for (const range of ranges) {
    const block = blockOf(body, range.blockId);
    if (block === undefined) continue;

    ops.push(...clearField(block, range, (mark) => mark.link !== undefined, stripLink));

    if (link === undefined) continue;

    ops.push(
      insertMark(block, {
        id: mint("mark"),
        from: endAt(block.atoms, range.from, "from"),
        to: endAt(block.atoms, range.to, "to"),
        link,
        // These are ordinary, editable mark fields—not presentation baked
        // into the link node. Removing or restyling either works exactly like
        // it does for any other selected text.
        style: ["underline"],
        color: "var(--token-color-interactive-text)"
      })
    );
  }

  return reanchor(body, ops);
};

/** Edit the metadata of one link occurrence without rebuilding its styling. */
export const updateLinkOps = (placed: PlacedLink, link: MarkLink): DocumentOp[] => {
  if (JSON.stringify(placed.mark.link) === JSON.stringify(link)) return [];
  return [setMark(placed.mark, "link", link)];
};

export const colourOn = (
  body: DocumentBody,
  ranges: readonly Range[]
): { color?: string; background?: string; mixed: boolean } => {
  const colors = new Set<string | undefined>();
  const backgrounds = new Set<string | undefined>();

  for (const range of ranges) {
    const block = blockOf(body, range.blockId);
    if (block === undefined) continue;

    const covering = placed(block).filter(
      (held) => held.from <= range.from && held.to >= range.to
    );
    colors.add(covering.find((held) => held.mark.color !== undefined)?.mark.color);
    backgrounds.add(covering.find((held) => held.mark.background !== undefined)?.mark.background);
  }

  return {
    color: colors.size === 1 ? [...colors][0] : undefined,
    background: backgrounds.size === 1 ? [...backgrounds][0] : undefined,
    mixed: colors.size > 1 || backgrounds.size > 1
  };
};

export type PlacedLink = {
  readonly blockId: string;
  readonly mark: Mark;
  readonly from: number;
  readonly to: number;
};

export const linksOn = (body: DocumentBody, ranges: readonly Range[]): PlacedLink[] => {
  const links: PlacedLink[] = [];

  for (const range of ranges) {
    const block = blockOf(body, range.blockId);
    if (block === undefined) continue;

    for (const held of placed(block)) {
      if (held.mark.link === undefined) continue;
      if (held.to <= range.from || held.from >= range.to) continue;
      if (links.some((known) => known.mark.id === held.mark.id)) continue;
      links.push({ blockId: block.id, mark: held.mark, from: held.from, to: held.to });
    }
  }

  return links;
};

export const stylesAt = (body: DocumentBody, blockId: string, at: number): MarkStyle[] => {
  const block = blockOf(body, blockId);
  if (block === undefined) return [];

  const held = new Set<MarkStyle>();
  for (const span of placed(block)) {
    if (span.from >= at || span.to < at) continue;
    for (const style of span.mark.style ?? []) held.add(style);
  }

  return sortedStyles([...held]);
};

export const colourAt = (
  body: DocumentBody,
  blockId: string,
  at: number
): { color?: string; background?: string } => {
  const block = blockOf(body, blockId);
  if (block === undefined) return {};

  const found: { color?: string; background?: string } = {};
  for (const span of placed(block)) {
    if (span.from >= at || span.to < at) continue;
    if (span.mark.color !== undefined) found.color = span.mark.color;
    if (span.mark.background !== undefined) found.background = span.mark.background;
  }

  return found;
};
