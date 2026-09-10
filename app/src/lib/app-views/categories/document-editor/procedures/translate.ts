import { applyOps } from "$representation/data/behavior/documents/apply-ops";
import type { ContentBlock, Mark } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { isBlocks } from "$app-views/categories/document-editor/procedures/paginate";
import { isStyled } from "$app-views/categories/document-editor/procedures/projection-blocks";
import { sortedStyles } from "$app-views/categories/document-editor/procedures/projection-inline";
import type { Styled } from "$app-views/categories/document-editor/procedures/styles";

const before = <T extends { id: string }>(items: readonly T[], index: number): string | null =>
  index === 0 ? null : items[index - 1].id;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const textOp = (
  blockId: string,
  atomId: string,
  was: string,
  now: string
): DocumentOp | undefined => {
  if (was === now) return undefined;

  const shortest = Math.min(was.length, now.length);

  let at = 0;
  while (at < shortest && was[at] === now[at]) at += 1;

  let tail = 0;
  while (tail < shortest - at && was[was.length - 1 - tail] === now[now.length - 1 - tail]) {
    tail += 1;
  }

  return {
    op: "text",
    target: "atom",
    path: `${blockId}/atoms/${atomId}`,
    at,
    insert: now.slice(at, now.length - tail),
    remove: was.slice(at, was.length - tail)
  };
};

const atomOps = (was: Styled, now: Styled): DocumentOp[] => {
  const ops: DocumentOp[] = [];
  const held = new Map(was.atoms.map((atom) => [atom.id, atom]));
  const kept = new Set(now.atoms.map((atom) => atom.id));

  for (const [index, atom] of now.atoms.entries()) {
    const earlier = held.get(atom.id);

    if (earlier === undefined) {
      ops.push({
        op: "insert",
        target: "atom",
        path: `${now.id}/atoms`,
        ids: [atom.id],
        after: before(now.atoms, index),
        values: [atom]
      });
      continue;
    }

    if (atom.kind === "literal" && earlier.kind === "literal") {
      const edit = textOp(now.id, atom.id, earlier.text, atom.text);
      if (edit !== undefined) ops.push(edit);
    }
  }

  for (const [index, atom] of was.atoms.entries()) {
    if (kept.has(atom.id)) continue;

    ops.push({
      op: "remove",
      target: "atom",
      path: `${now.id}/atoms`,
      ids: [atom.id],
      after: before(was.atoms, index),
      values: [atom]
    });
  }

  return ops;
};

const FIELDS = [
  "variant",
  "level",
  "listStyle",
  "checked",
  "language",
  "style",
  "format",
  "state",
  "error"
] as const;

const fieldOps = (was: Styled, now: Styled): DocumentOp[] => {
  const ops: DocumentOp[] = [];
  const earlier = was as unknown as Record<string, unknown>;
  const later = now as unknown as Record<string, unknown>;

  for (const field of FIELDS) {
    if (same(earlier[field], later[field])) continue;
    ops.push({
      op: "set",
      target: "block",
      path: `${now.id}/${field}`,
      value: later[field] ?? null,
      was: earlier[field] ?? null
    });
  }

  return ops;
};

const MARK_FIELDS = ["from", "to", "style", "link", "color", "background"] as const;

const normalized = (mark: Mark): Mark =>
  mark.style === undefined ? mark : { ...mark, style: sortedStyles(mark.style) };

const markOps = (was: Styled, now: Styled): DocumentOp[] => {
  const ops: DocumentOp[] = [];
  const held = new Map(was.marks.map((mark) => [mark.id, normalized(mark)]));
  const kept = new Set(now.marks.map((mark) => mark.id));

  for (const [index, raw] of now.marks.entries()) {
    const mark = normalized(raw);
    const earlier = held.get(mark.id);

    if (earlier === undefined) {
      ops.push({
        op: "insert",
        target: "mark",
        path: `${now.id}/marks`,
        ids: [mark.id],
        after: before(now.marks, index),
        values: [mark]
      });
      continue;
    }

    for (const field of MARK_FIELDS) {
      if (same(earlier[field], mark[field])) continue;
      ops.push({
        op: "set",
        target: "mark",
        path: `${mark.id}/${field}`,
        value: mark[field] ?? null,
        was: earlier[field] ?? null
      });
    }
  }

  for (const [index, mark] of was.marks.entries()) {
    if (kept.has(mark.id)) continue;

    ops.push({
      op: "remove",
      target: "mark",
      path: `${now.id}/marks`,
      ids: [mark.id],
      after: before(was.marks, index),
      values: [normalized(mark)]
    });
  }

  return ops;
};

const blockList = (rowId: string, op: "insert" | "remove", blocks: readonly ContentBlock[], index: number): DocumentOp => ({
  op,
  target: "block",
  path: `${rowId}/blocks`,
  ids: [blocks[index].id],
  after: before(blocks, index),
  values: [blocks[index]]
});

const blockOps = (rowId: string, was: DocumentRow, now: DocumentRow): DocumentOp[] => {
  if (!isBlocks(was) || !isBlocks(now)) return [];

  const ops: DocumentOp[] = [];
  const held = new Map(was.blocks.map((block) => [block.id, block]));

  for (const [index, block] of now.blocks.entries()) {
    const earlier = held.get(block.id);

    if (earlier === undefined) {
      ops.push(blockList(rowId, "insert", now.blocks, index));
      continue;
    }

    if (earlier.type !== block.type) {
      ops.push({ ...blockList(rowId, "remove", was.blocks, was.blocks.indexOf(earlier)) });
      ops.push(blockList(rowId, "insert", now.blocks, index));
      continue;
    }

    if (!isStyled(block) || !isStyled(earlier)) continue;

    ops.push(...atomOps(earlier, block), ...fieldOps(earlier, block));
  }

  const kept = new Set(now.blocks.map((block) => block.id));
  for (const [index, block] of was.blocks.entries()) {
    if (kept.has(block.id)) continue;
    ops.push(blockList(rowId, "remove", was.blocks, index));
  }

  return ops;
};

const proportionsOp = (was: DocumentRow, now: DocumentRow): DocumentOp | undefined => {
  if (!isBlocks(was) || !isBlocks(now)) return undefined;

  const earlier = was.proportions ?? null;
  const later = now.proportions ?? null;
  if (same(earlier, later)) return undefined;

  return { op: "set", target: "row", path: `${now.id}/proportions`, value: later, was: earlier };
};

const styledBlocks = (rows: readonly DocumentRow[]): Map<string, Styled> => {
  const held = new Map<string, Styled>();
  for (const row of rows) {
    if (!isBlocks(row)) continue;
    for (const block of row.blocks) if (isStyled(block)) held.set(block.id, block);
  }
  return held;
};

const shiftedBy = (was: DocumentBody, edits: readonly DocumentOp[]): DocumentBody => {
  if (edits.length === 0) return was;
  try {
    return applyOps(was, edits);
  } catch {
    return was;
  }
};

const translateRows = (was: DocumentBody, now: DocumentBody): readonly DocumentOp[] => {
  const wasRows = was.rows;
  const nowRows = now.rows;
  const held = new Map(wasRows.map((row) => [row.id, row]));
  const kept = new Set(nowRows.map((row) => row.id));

  const edits: DocumentOp[] = [];
  const removals: DocumentOp[] = [];
  const insertions: DocumentOp[] = [];
  const moves: DocumentOp[] = [];

  const surviving = {
    was: wasRows.filter((row) => kept.has(row.id)),
    now: nowRows.filter((row) => held.has(row.id))
  };
  const anchoredBefore = new Map(
    surviving.was.map((row, index) => [row.id, before(surviving.was, index)])
  );

  for (const [index, row] of nowRows.entries()) {
    const earlier = held.get(row.id);

    if (earlier === undefined) {
      insertions.push({
        op: "insert",
        target: "row",
        path: "rows",
        ids: [row.id],
        after: before(nowRows, index),
        values: [row]
      });
      continue;
    }

    if (earlier.kind !== row.kind) {
      removals.push({
        op: "remove",
        target: "row",
        path: "rows",
        ids: [row.id],
        after: before(wasRows, wasRows.indexOf(earlier)),
        values: [earlier]
      });
      insertions.push({
        op: "insert",
        target: "row",
        path: "rows",
        ids: [row.id],
        after: before(nowRows, index),
        values: [row]
      });
      continue;
    }

    const proportions = proportionsOp(earlier, row);
    if (proportions !== undefined) edits.push(proportions);

    edits.push(...blockOps(row.id, earlier, row));
  }

  for (const [index, row] of wasRows.entries()) {
    if (kept.has(row.id)) continue;

    removals.push({
      op: "remove",
      target: "row",
      path: "rows",
      ids: [row.id],
      after: before(wasRows, index),
      values: [row]
    });
  }

  for (const [index, row] of surviving.now.entries()) {
    const anchor = before(surviving.now, index);
    const wasAnchor = anchoredBefore.get(row.id) ?? null;
    if (anchor === wasAnchor) continue;
    if (held.get(row.id)?.kind !== row.kind) continue;

    moves.push({ op: "move", target: "row", path: "rows", id: row.id, after: anchor, wasAfter: wasAnchor });
  }

  const shifted = styledBlocks(shiftedBy(was, edits).rows);
  const marks: DocumentOp[] = [];
  for (const [id, block] of styledBlocks(nowRows)) {
    const earlier = shifted.get(id);
    if (earlier === undefined) continue;
    marks.push(...markOps(earlier, block));
  }

  return [...edits, ...marks, ...removals, ...insertions, ...moves];
};

export const translate = (was: DocumentBody, now: DocumentBody): readonly DocumentOp[] =>
  translateRows(was, now);
