import type { Node as PmNode } from 'prosemirror-model';
import {
  customTypographyCss,
  defaultTypographyForKind,
  effectiveTypography,
  typographyCss,
  type Block,
  type BlockKind,
  type BlockStyleRef,
  type CustomTypography,
  type LayoutRules,
  type Row,
  type StyleRegistry
} from '$data/documents';
import { layoutPoint, standardRowHeight } from '$systems/documents/layout';
import { nodeKind } from '../editor/bridge';
import type { OutlineItem } from '../editor/session';
import { findBlock, type OptimisticOverlay } from './overlay';

/**
 * The PRESENTATION PASS — one walk of the document producing everything the view
 * needs to render but that is not part of the editable content.
 *
 * There used to be two walks per transaction: one building decorations, another
 * rebuilding the session with overlapping per-block work (catalog **P-1**).
 * Workstream B collapsed them; workstream C names the result. The row-height map
 * computed here is the same object the session publishes, so the inspector can
 * never disagree with what is painted.
 */

/** The block decorations the presentation plugin renders. */
export type BlockPresentation = {
  /** rowId → CSS pixel min-height (line spacing). */
  rowHeightsPx: Map<string, number>;
  /** blockId → non-default horizontal alignment. */
  blockAligns: Record<string, string>;
  /** blockId → column width (%) for multi-block rows. */
  blockWidths: Record<string, string>;
  /** blockId → CSS fragment for effective typography + indent. */
  blockTypography: Record<string, string>;
};

/** The document truth a presentation pass reads. */
export type PresentationSources = {
  doc: PmNode;
  snapshot: Row[];
  overlay: OptimisticOverlay;
  layoutRules: LayoutRules;
  styleRegistry: StyleRegistry;
};

/** A block's effective style reference: pending assignment over server truth. */
export function effectiveStyleRefOf(
  overlay: OptimisticOverlay,
  snapshot: Row[],
  blockId: string
): BlockStyleRef | null {
  return overlay.styleRefOf(blockId, findBlock(snapshot, blockId)?.styleRef ?? null);
}

/** A block's effective custom typography (real fonts): pending over server truth. */
export function effectiveCustomOf(
  overlay: OptimisticOverlay,
  snapshot: Row[],
  blockId: string
): CustomTypography | null {
  return overlay.customOf(
    blockId,
    effectiveStyleRefOf(overlay, snapshot, blockId)?.overrides?.custom ?? null
  );
}

/** Row height in CSS pixels for every row the document contains, in order. */
export function computeRowHeights(sources: PresentationSources): Map<string, number> {
  const { doc, snapshot, overlay, layoutRules } = sources;
  const rows = new Map(snapshot.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const rowHeightsPx = new Map<string, number>();
  doc.forEach((node) => {
    const rowId = String(node.attrs.rowId ?? '');
    if (!rowId || seen.has(rowId)) return;
    seen.add(rowId);
    const row = rows.get(rowId);
    const increase = overlay.rowHeightOf(rowId, row?.style.heightIncrease ?? 0);
    const points = layoutPoint(
      standardRowHeight(layoutRules) + increase,
      `height for row ${rowId}`
    );
    rowHeightsPx.set(rowId, (points * 96) / 72);
  });
  return rowHeightsPx;
}

/**
 * The block decorations, given the row heights the caller already computed
 * (it needs them separately to compare against the last pass's signature).
 */
export function computeBlockDecorations(
  sources: PresentationSources,
  rowHeightsPx: Map<string, number>
): BlockPresentation {
  const { doc, snapshot, overlay, styleRegistry } = sources;

  // Server-truth style and kind by block id, read once for the walks below.
  const serverStyles = new Map<string, Block['style']>();
  const blockKindById = new Map<string, BlockKind>();
  for (const row of snapshot)
    for (const block of row.blocks) {
      serverStyles.set(block.id, block.style);
      blockKindById.set(block.id, block.kind);
    }

  // Column widths: a row with 2+ blocks splits its content width among them by
  // track weight (equal when a row has no tracks). Drives the inline-block
  // width decorations that lay the blocks out side by side.
  const blockWidths: Record<string, string> = {};
  for (const row of snapshot) {
    if (row.blocks.length < 2) continue;
    const weightOf = (id: string) => row.tracks?.find((t) => t.blockId === id)?.weight ?? 1;
    const total = row.blocks.reduce((sum, block) => sum + weightOf(block.id), 0) || row.blocks.length;
    for (const block of row.blocks)
      blockWidths[block.id] = `${((weightOf(block.id) / total) * 100).toFixed(4)}%`;
  }

  const blockAligns: Record<string, string> = {};
  const blockTypography: Record<string, string> = {};
  doc.forEach((node) => {
    const blockId = node.attrs.blockId as string | null;
    if (!blockId) return;
    const style = overlay.styleOf(blockId, serverStyles.get(blockId));
    // Non-default horizontal alignment, for text-align decorations.
    if (style?.horizontalAlign && style.horizontalAlign !== 'left')
      blockAligns[blockId] = style.horizontalAlign;
    // Effective semantic typography (override → assigned style → kind default →
    // convention). Decorate only when it differs from the kind's conventional
    // typography, so unstyled blocks keep their base CSS.
    const kind = blockKindById.get(blockId) ?? (nodeKind(node) as BlockKind);
    const typography = effectiveTypography(
      kind,
      effectiveStyleRefOf(overlay, snapshot, blockId),
      styleRegistry
    );
    const parts: string[] = [];
    if (typography !== defaultTypographyForKind(kind)) parts.push(typographyCss(typography));
    // Custom typography (real fonts) layers on top, overriding font/size/color.
    const customCss = customTypographyCss(effectiveCustomOf(overlay, snapshot, blockId));
    if (customCss) parts.push(customCss);
    // General block indent renders as left padding (1.5em per level).
    const indent = style?.indent ?? 0;
    if (indent > 0) parts.push(`padding-left: ${(indent * 1.5).toFixed(2)}em`);
    if (parts.length) blockTypography[blockId] = parts.join('; ');
  });

  return { rowHeightsPx, blockAligns, blockWidths, blockTypography };
}

/** Per-block session projections: the maps the inspector reads. */
export type SessionProjection = {
  outline: OutlineItem[];
  /** Row keys in document order — `rowId`, or a synthetic key for a new block. */
  rowKeys: string[];
  blocks: number;
  words: number;
  chars: number;
};

/** Document-level counts, the heading outline, and the ordered row keys. */
export function projectDocument(doc: PmNode): SessionProjection {
  const spaced = doc.textBetween(0, doc.content.size, ' ');
  const outline: OutlineItem[] = [];
  const rowKeys: string[] = [];
  const seenRows = new Set<string>();
  doc.forEach((node, offset) => {
    const rowId = node.attrs.rowId as string | null;
    const blockId = node.attrs.blockId as string | null;
    const rowKey = rowId ?? `block:${blockId ?? offset}`;
    if (!seenRows.has(rowKey)) {
      seenRows.add(rowKey);
      rowKeys.push(rowKey);
    }
    if (node.type.name === 'heading')
      outline.push({
        blockId: (node.attrs.blockId as string | null) ?? '',
        level: node.attrs.level as number,
        text: node.textContent
      });
  });
  return {
    outline,
    rowKeys,
    blocks: doc.childCount,
    words: (spaced.match(/\S+/g) ?? []).length,
    chars: doc.textContent.length
  };
}
