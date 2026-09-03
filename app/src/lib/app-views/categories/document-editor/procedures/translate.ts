import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { isBlocks } from "$app-views/categories/document-editor/procedures/paginate";
import { soleLiteral } from "$app-views/categories/document-editor/procedures/projection";

const before = <T extends { id: string }>(items: readonly T[], index: number): string | null =>
  index === 0 ? null : items[index - 1].id;

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

const blockOps = (rowId: string, was: DocumentRow, now: DocumentRow): DocumentOp[] => {
  if (!isBlocks(was) || !isBlocks(now)) return [];

  const ops: DocumentOp[] = [];
  const held = new Map(was.blocks.map((block) => [block.id, block]));
  const kept = new Set(now.blocks.map((block) => block.id));

  for (const [index, block] of now.blocks.entries()) {
    const earlier = held.get(block.id);

    if (earlier === undefined) {
      ops.push({
        op: "insert",
        target: "block",
        path: `${rowId}/blocks`,
        ids: [block.id],
        after: before(now.blocks, index),
        values: [block]
      });
      continue;
    }

    const atom = soleLiteral(block);
    const priorAtom = soleLiteral(earlier);
    if (atom === undefined || priorAtom === undefined) continue;
    if (atom.kind !== "literal" || priorAtom.kind !== "literal") continue;

    const edit = textOp(block.id, atom.id, priorAtom.text, atom.text);
    if (edit !== undefined) ops.push(edit);
  }

  for (const [index, block] of was.blocks.entries()) {
    if (kept.has(block.id)) continue;

    ops.push({
      op: "remove",
      target: "block",
      path: `${rowId}/blocks`,
      ids: [block.id],
      after: before(was.blocks, index),
      values: [block]
    });
  }

  return ops;
};

const proportionsOp = (was: DocumentRow, now: DocumentRow): DocumentOp | undefined => {
  if (!isBlocks(was) || !isBlocks(now)) return undefined;

  const earlier = was.proportions ?? null;
  const later = now.proportions ?? null;
  if (JSON.stringify(earlier) === JSON.stringify(later)) return undefined;

  return { op: "set", target: "row", path: `${now.id}/proportions`, value: later, was: earlier };
};

export const translate = (was: DocumentBody, now: DocumentBody): readonly DocumentOp[] => {
  const held = new Map(was.rows.map((row) => [row.id, row]));
  const kept = new Set(now.rows.map((row) => row.id));

  const edits: DocumentOp[] = [];
  const removals: DocumentOp[] = [];
  const insertions: DocumentOp[] = [];
  const moves: DocumentOp[] = [];

  const surviving = {
    was: was.rows.filter((row) => kept.has(row.id)),
    now: now.rows.filter((row) => held.has(row.id))
  };
  const anchoredBefore = new Map(
    surviving.was.map((row, index) => [row.id, before(surviving.was, index)])
  );

  for (const [index, row] of now.rows.entries()) {
    const earlier = held.get(row.id);

    if (earlier === undefined) {
      insertions.push({
        op: "insert",
        target: "row",
        path: "rows",
        ids: [row.id],
        after: before(now.rows, index),
        values: [row]
      });
      continue;
    }

    const proportions = proportionsOp(earlier, row);
    if (proportions !== undefined) edits.push(proportions);

    edits.push(...blockOps(row.id, earlier, row));
  }

  for (const [index, row] of was.rows.entries()) {
    if (kept.has(row.id)) continue;

    removals.push({
      op: "remove",
      target: "row",
      path: "rows",
      ids: [row.id],
      after: before(was.rows, index),
      values: [row]
    });
  }

  for (const [index, row] of surviving.now.entries()) {
    const anchor = before(surviving.now, index);
    const wasAnchor = anchoredBefore.get(row.id) ?? null;
    if (anchor === wasAnchor) continue;

    moves.push({ op: "move", target: "row", path: "rows", id: row.id, after: anchor, wasAfter: wasAnchor });
  }

  return [...edits, ...removals, ...insertions, ...moves];
};
