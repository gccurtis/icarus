import type { BlockFormat, HorizontalAlignment } from "$representation/data/types/content/block-format";
import type {
  ContentBlock,
  ImageBlock,
  TableBlock,
  TableCell,
  TableRow,
  TextBlock
} from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { StyleSet } from "$representation/data/types/documents/style-set";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { isBlocks, paginate } from "$app-views/categories/document-editor/procedures/paginate";
import type { Metrics } from "$app-views/categories/document-editor/procedures/projection";
import { resolve, styleSetOf, type Styled, type TextStyle } from "$app-views/categories/document-editor/procedures/styles";

export type { BlockFormat, HorizontalAlignment } from "$representation/data/types/content/block-format";
export type { ContentBlock, ImageBlock, TableBlock } from "$representation/data/types/content/content-block";

export const ALIGNMENTS: readonly { value: HorizontalAlignment; label: string }[] = [
  { value: "start", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "end", label: "Right" },
  { value: "justify", label: "Justify" }
];

export type BlockKind = "text" | "table" | "image" | "pageBreak";

export const BLOCK_KINDS: readonly { value: BlockKind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "table", label: "Table" },
  { value: "image", label: "Image" },
  { value: "pageBreak", label: "Page break" }
];

export const rowHolding = (body: DocumentBody, blockId: string): DocumentRow | undefined =>
  body.rows.find((row) => isBlocks(row) && row.blocks.some((block) => block.id === blockId));

export const blockIn = (body: DocumentBody, blockId: string): ContentBlock | undefined => {
  const row = rowHolding(body, blockId);
  return row !== undefined && isBlocks(row) ? row.blocks.find((block) => block.id === blockId) : undefined;
};

export const resolvedOf = (body: DocumentBody, block: Styled): TextStyle =>
  resolve(styleSetOf(body), block.style, block.format);

export const agree = <T>(values: readonly T[]): { value: T | undefined; mixed: boolean } => {
  const seen = new Set(values.map((value) => JSON.stringify(value ?? null)));
  if (seen.size === 0) return { value: undefined, mixed: false };
  return { value: seen.size === 1 ? values[0] : undefined, mixed: seen.size > 1 };
};

const compact = (format: BlockFormat): BlockFormat | null => {
  const kept = Object.fromEntries(
    Object.entries(format).filter(([, value]) => value !== undefined && value !== null)
  ) as BlockFormat;
  return Object.keys(kept).length === 0 ? null : kept;
};

export const formatOps = (
  block: ContentBlock,
  patch: { readonly [K in keyof BlockFormat]?: BlockFormat[K] | null }
): DocumentOp[] => {
  const was = block.format ?? null;
  const next = compact({ ...(block.format ?? {}), ...(patch as BlockFormat) });
  if (JSON.stringify(was) === JSON.stringify(next)) return [];

  return [{ op: "set", target: "block", path: `${block.id}/format`, value: next, was }];
};

export const placementOf = (
  body: DocumentBody,
  blockId: string,
  metrics: Metrics
): { readonly index: number; readonly of: number; readonly page: number } | undefined => {
  const row = rowHolding(body, blockId);
  if (row === undefined || !isBlocks(row)) return undefined;

  const pages = paginate(body.rows, metrics.charactersPerLine, metrics.linesPerPage, styleSetOf(body));
  const page = pages.findIndex((held) => held.some((candidate) => candidate.id === row.id));

  return {
    index: row.blocks.findIndex((block) => block.id === blockId) + 1,
    of: row.blocks.length,
    page: page + 1
  };
};

export const kindOf = (block: ContentBlock | undefined): BlockKind =>
  block?.type === "table" ? "table" : block?.type === "image" ? "image" : "text";

const emptyText = (): TextBlock => ({
  id: mint("block"),
  type: "text",
  variant: "paragraph",
  atoms: [{ id: mint("atom"), kind: "literal", text: "" }],
  display: "",
  marks: []
});

const cell = (): TableCell => ({ id: mint("block"), blocks: [emptyText()] });

const tableRow = (columns: number): TableRow => ({
  id: mint("row"),
  cells: Array.from({ length: columns }, cell)
});

export const emptyTable = (rows = 3, columns = 3): TableBlock => ({
  id: mint("block"),
  type: "table",
  rows: Array.from({ length: rows }, () => tableRow(columns)),
  headerRows: 1
});

export const emptyImage = (): ImageBlock => ({ id: mint("block"), type: "image", alt: "" });

const before = (items: readonly { id: string }[], index: number): string | null =>
  index <= 0 ? null : items[index - 1].id;

export const blockTypeOps = (body: DocumentBody, blockId: string, kind: BlockKind): DocumentOp[] => {
  const row = rowHolding(body, blockId);
  if (row === undefined || !isBlocks(row)) return [];

  const index = row.blocks.findIndex((block) => block.id === blockId);
  const held = row.blocks[index];
  if (kindOf(held) === kind) return [];

  if (kind === "pageBreak") {
    const at = body.rows.findIndex((candidate) => candidate.id === row.id);
    const brk: DocumentRow = { id: mint("row"), kind: "pageBreak" };
    return [
      { op: "remove", target: "row", path: "rows", ids: [row.id], after: before(body.rows, at), values: [row] },
      { op: "insert", target: "row", path: "rows", ids: [brk.id], after: before(body.rows, at), values: [brk] }
    ];
  }

  const next: ContentBlock =
    kind === "table" ? emptyTable() : kind === "image" ? emptyImage() : emptyText();

  return [
    { op: "remove", target: "block", path: `${row.id}/blocks`, ids: [held.id], after: before(row.blocks, index), values: [held] },
    { op: "insert", target: "block", path: `${row.id}/blocks`, ids: [next.id], after: before(row.blocks, index), values: [next] }
  ];
};

export const tableShapeOps = (
  block: TableBlock,
  shape: { readonly rows?: number; readonly columns?: number; readonly headerRows?: number }
): DocumentOp[] => {
  const ops: DocumentOp[] = [];
  const columns = shape.columns ?? (block.rows[0]?.cells.length ?? 1);
  const count = shape.rows ?? block.rows.length;

  const rows: TableRow[] = Array.from({ length: Math.max(1, count) }, (_, index) => {
    const held = block.rows[index];
    if (held === undefined) return tableRow(Math.max(1, columns));
    const cells = Array.from({ length: Math.max(1, columns) }, (__, column) => held.cells[column] ?? cell());
    return { ...held, cells };
  });

  if (JSON.stringify(rows) !== JSON.stringify(block.rows)) {
    ops.push({ op: "set", target: "block", path: `${block.id}/rows`, value: rows, was: block.rows });
  }
  if (shape.headerRows !== undefined && shape.headerRows !== block.headerRows) {
    ops.push({
      op: "set",
      target: "block",
      path: `${block.id}/headerRows`,
      value: Math.max(0, Math.min(shape.headerRows, rows.length)),
      was: block.headerRows
    });
  }

  return ops;
};

export const imageOps = (
  block: ImageBlock,
  patch: { readonly alt?: string; readonly url?: string | null }
): DocumentOp[] => {
  const ops: DocumentOp[] = [];

  if (patch.alt !== undefined && patch.alt !== block.alt) {
    ops.push({ op: "set", target: "block", path: `${block.id}/alt`, value: patch.alt, was: block.alt });
  }
  if (patch.url !== undefined) {
    const was = block.source ?? null;
    const value = patch.url === null || patch.url.length === 0 ? null : { kind: "url", url: patch.url };
    if (JSON.stringify(was) !== JSON.stringify(value)) {
      ops.push({ op: "set", target: "block", path: `${block.id}/source`, value, was });
    }
  }

  return ops;
};

export const stylesOf = (body: DocumentBody): StyleSet => styleSetOf(body);
