import type { Node as ProseMirrorNode } from "prosemirror-model";

import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { DocumentBody, DocumentRow } from "$representation/data/types/documents/body";
import type { StyleSet } from "$representation/data/types/documents/style-set";
import { isBlocks, paginate, shares } from "$app-views/categories/document-editor/procedures/paginate";
import { emptyRow, isStyled } from "$app-views/categories/document-editor/procedures/projection-blocks";
import { inlineOf } from "$app-views/categories/document-editor/procedures/projection-inline";
import type { Metrics } from "$app-views/categories/document-editor/procedures/projection-pagination";
import { schema } from "$app-views/categories/document-editor/procedures/schema";
import {
  BODY_FONT_SIZE,
  BODY_LINE_HEIGHT,
  inlineStyleOf,
  resolve,
  styleSetOf,
  type Styled
} from "$app-views/categories/document-editor/procedures/styles";

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

const typeable = (row: DocumentRow): boolean => isBlocks(row) && row.blocks.some(isStyled);

export const docOf = (body: DocumentBody, metrics: Metrics): ProseMirrorNode => {
  const styles = styleSetOf(body);
  const rows = body.rows.some(typeable) ? body.rows : [...body.rows, emptyRow()];
  const pages = paginate(rows, metrics.charactersPerLine, metrics.linesPerPage, styles);

  return schema.node(
    "doc",
    null,
    pages.map((held) => schema.node("page", null, held.map((row) => rowNode(row, styles))))
  );
};
