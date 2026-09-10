import type { Node as ProseMirrorNode } from "prosemirror-model";

import { BODY_TYPESET, budgetOf, heightOfText, pack, type Typeset } from "$app-views/categories/document-editor/procedures/paginate";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { displayTextOf } from "$app-views/categories/document-editor/procedures/projection-inline";
import { schema } from "$app-views/categories/document-editor/procedures/schema";

export type Metrics = {
  readonly charactersPerLine: number;
  readonly linesPerPage: number;
};

const DIVIDER_LINES = 1;
const IMAGE_LINES = 12;

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
  doc.forEach((page) =>
    page.forEach((row) => {
      if (row.type.spec.group?.split(" ").includes("row") === true) rows.push(row);
    })
  );
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
        doc.children.map((page) =>
          schema.node("page", page.attrs, page.children.map(stampRow))
        )
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
    pages.map((held) => schema.node("page", null, held))
  );
};
