import type { Node as ProseMirrorNode, ResolvedPos } from "prosemirror-model";

import type { Atom, ContentBlock, TextAtom } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import {
  budgetOf,
  isBlocks,
  linesOfText,
  pack,
  paginate,
  shares,
  type BlocksRow
} from "$app-views/categories/document-editor/procedures/paginate";
import { schema } from "$app-views/categories/document-editor/procedures/schema";

export type Metrics = {
  readonly charactersPerLine: number;
  readonly linesPerPage: number;
};

export type { DocumentBody } from "$representation/data/types/documents/body";

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

/**
 * What the editor can draw: a text block whose whole content is one literal atom.
 * Everything else a document may hold — an image, a formula, a divider, a page
 * break — is carried through `bodyOf` untouched instead.
 */
const drawable = (block: ContentBlock): boolean => soleLiteral(block) !== undefined;

const drawableRow = (row: DocumentRow): row is BlocksRow =>
  isBlocks(row) && row.blocks.some(drawable);

const blockNode = (block: ContentBlock, share: number): ProseMirrorNode => {
  const atom = soleLiteral(block);
  if (atom === undefined) throw new Error(`Block ${block.id} is not display text.`);

  return schema.node(
    "text_block",
    { blockId: block.id, atomId: atom.id, share },
    atom.text.length === 0 ? undefined : schema.text(atom.text)
  );
};

const rowNode = (row: BlocksRow): ProseMirrorNode => {
  const share = shares(row);

  return schema.node(
    "blocks_row",
    { rowId: row.id, proportions: row.proportions ?? null },
    row.blocks
      .map((block, index) => ({ block, share: share[index] }))
      .filter(({ block }) => drawable(block))
      .map(({ block, share: held }) => blockNode(block, held))
  );
};

export const docOf = (body: DocumentBody, metrics: Metrics): ProseMirrorNode => {
  const drawn = body.rows.filter(drawableRow);
  const rows = drawn.length === 0 ? [emptyRow() as BlocksRow] : drawn;
  const pages = paginate(rows, metrics.charactersPerLine, metrics.linesPerPage);

  return schema.node(
    "doc",
    null,
    pages.map((held) =>
      schema.node("page", null, held.map((row) => rowNode(row as BlocksRow)))
    )
  );
};

const linesOfRowNode = (row: ProseMirrorNode, charactersPerLine: number): number => {
  let tallest = 1;
  row.forEach((block) => {
    const lines = linesOfText(
      block.textContent,
      budgetOf(block.attrs.share as number, charactersPerLine)
    );
    tallest = Math.max(tallest, lines);
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
    : node.attrs.blockId === null || node.attrs.atomId === null;

const stampBlock = (block: ProseMirrorNode): ProseMirrorNode =>
  schema.node(
    "text_block",
    {
      ...block.attrs,
      blockId: block.attrs.blockId ?? mint("block"),
      atomId: block.attrs.atomId ?? mint("atom")
    },
    block.content
  );

const stampRow = (row: ProseMirrorNode): ProseMirrorNode =>
  schema.node(
    "blocks_row",
    { ...row.attrs, rowId: row.attrs.rowId ?? mint("row") },
    row.children.map(stampBlock)
  );

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
    () => false,
    metrics.linesPerPage
  );

  return schema.node(
    "doc",
    null,
    pages.map((held) => schema.node("page", null, [...held]))
  );
};

const blockOf = (
  node: ProseMirrorNode,
  before: ReadonlyMap<string, ContentBlock>
): ContentBlock => {
  const id = node.attrs.blockId as string;
  const atomId = node.attrs.atomId as string;
  const text = node.textContent;
  const atoms: Atom[] = [{ id: atomId, kind: "literal", text }];
  const held = before.get(id);

  if (held?.type === "text") return { ...held, atoms, display: text };

  return { id, type: "text", variant: "paragraph", atoms, display: text, marks: [] };
};

/**
 * What was left out of the drawing, and where to put it back.
 *
 * `after` is the id of the nearest thing before it that *was* drawn, so an
 * undrawn row returns to the same place in the order however much was typed
 * around it. A `null` anchor belongs at the head; an anchor that has since been
 * deleted puts it at the end, because a position relative to nothing is the one
 * case with no right answer.
 */
type Held<T> = { readonly item: T; readonly after: string | null };

const heldAmong = <T extends { readonly id: string }>(
  all: readonly T[],
  drawn: (item: T) => boolean
): readonly Held<T>[] => {
  const held: Held<T>[] = [];
  let after: string | null = null;

  for (const item of all) {
    if (drawn(item)) {
      after = item.id;
      continue;
    }
    held.push({ item, after });
  }

  return held;
};

const putBack = <T extends { readonly id: string }>(
  drawn: readonly T[],
  held: readonly Held<T>[]
): T[] => {
  const all = [...drawn];

  const runs = new Map<string | null, T[]>();
  for (const { item, after } of held) {
    const run = runs.get(after) ?? [];
    run.push(item);
    runs.set(after, run);
  }

  for (const [after, run] of runs) {
    if (after === null) {
      all.splice(0, 0, ...run);
      continue;
    }

    const at = all.findIndex((candidate) => candidate.id === after);
    all.splice(at === -1 ? all.length : at + 1, 0, ...run);
  }

  return all;
};

const rowOf = (
  node: ProseMirrorNode,
  rowsBefore: ReadonlyMap<string, DocumentRow>,
  blocksBefore: ReadonlyMap<string, ContentBlock>
): DocumentRow => {
  const id = node.attrs.rowId as string;

  const drawn: ContentBlock[] = [];
  node.forEach((child) => drawn.push(blockOf(child, blocksBefore)));

  const before = rowsBefore.get(id);
  const blocks =
    before !== undefined && isBlocks(before)
      ? putBack(drawn, heldAmong(before.blocks, drawable))
      : drawn;

  const proportions = node.attrs.proportions as number[] | null;
  return { id, kind: "blocks", blocks, ...(proportions === null ? {} : { proportions }) };
};

export type Anchor = { readonly blockId: string; readonly offset: number };

export const anchorAt = ($from: ResolvedPos): Anchor | undefined => {
  const block = $from.parent;
  if (block.type.name !== "text_block" || typeof block.attrs.blockId !== "string") {
    return undefined;
  }

  return { blockId: block.attrs.blockId, offset: $from.parentOffset };
};

export const positionOf = (doc: ProseMirrorNode, anchor: Anchor): number | undefined => {
  let found: number | undefined;

  doc.descendants((node, at) => {
    if (node.type.name !== "text_block") return;
    if (node.attrs.blockId !== anchor.blockId) return;

    found = at + 1 + Math.min(anchor.offset, node.content.size);
  });

  return found;
};

export const bodyOf = (doc: ProseMirrorNode, previous: DocumentBody): DocumentBody => {
  const rowsBefore = new Map(previous.rows.map((row) => [row.id, row]));
  const blocksBefore = new Map<string, ContentBlock>();
  for (const row of previous.rows) {
    if (!isBlocks(row)) continue;
    for (const block of row.blocks) blocksBefore.set(block.id, block);
  }

  const drawn = rowNodesOf(doc).map((row) => rowOf(row, rowsBefore, blocksBefore));

  return { ...previous, rows: putBack(drawn, heldAmong(previous.rows, drawableRow)) };
};
