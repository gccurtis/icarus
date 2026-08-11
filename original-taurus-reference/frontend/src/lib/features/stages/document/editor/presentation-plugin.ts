import type { Node as PmNode } from 'prosemirror-model';
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * Block-presentation decorations: the per-block/per-row styling the runtime's
 * presentation pass computes from Omega truth + optimistic pending edits. This
 * is the surviving half of the old pagination plugin — the document renders as
 * one continuous flow, so there are no page breaks; what remains is real,
 * user-visible presentation: row min-heights (line spacing), horizontal
 * alignment, multi-column widths, and per-block typography/indent CSS.
 */

type BlockPresentation = {
  /** rowId → CSS pixel min-height (standard row height + the row's increase). */
  rowHeights: Record<string, number>;
  /** blockId → non-default horizontal alignment. */
  blockAligns: Record<string, string>;
  /** blockId → column width (%) for multi-block rows. */
  blockWidths: Record<string, string>;
  /** blockId → CSS fragment for effective typography + indent. */
  blockTypography: Record<string, string>;
};

type PresentationPluginState = BlockPresentation & {
  decorations: DecorationSet;
};

export const presentationPluginKey = new PluginKey<PresentationPluginState>('taurus-presentation');

function createDecorations(doc: PmNode, presentation: BlockPresentation): DecorationSet {
  if (
    Object.keys(presentation.rowHeights).length === 0 &&
    Object.keys(presentation.blockAligns).length === 0 &&
    Object.keys(presentation.blockWidths).length === 0 &&
    Object.keys(presentation.blockTypography).length === 0
  ) {
    return DecorationSet.empty;
  }
  const seenRows = new Set<string>();
  const decorations: Decoration[] = [];

  doc.forEach((node, offset) => {
    // Per-block styling (every block, not just row starts): horizontal alignment
    // (text-align), typography/indent CSS, and, for multi-block rows, the column
    // width that lays the blocks out side by side (inline-block + width %).
    const blockId = String(node.attrs.blockId ?? '');
    const blockStyles: string[] = [];
    const align = blockId ? presentation.blockAligns[blockId] : undefined;
    if (align) blockStyles.push(`text-align: ${align}`);
    const typography = blockId ? presentation.blockTypography[blockId] : undefined;
    if (typography) blockStyles.push(typography);
    const width = blockId ? presentation.blockWidths[blockId] : undefined;
    if (width)
      blockStyles.push(
        'display: inline-block',
        `width: ${width}`,
        'vertical-align: top',
        'box-sizing: border-box'
      );
    if (blockStyles.length)
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, { style: blockStyles.join('; ') })
      );
    // Row min-height (line spacing) on the row's first block only.
    const rowId = String(node.attrs.rowId ?? '');
    if (!rowId || seenRows.has(rowId)) return;
    seenRows.add(rowId);
    const rowHeight = presentation.rowHeights[rowId];
    if (rowHeight != null) {
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, {
          class: 'taurus-row-start',
          style: `min-height: ${rowHeight}px`
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

/** Store newly computed block presentation on a transaction without changing content. */
export function setBlockPresentation(
  transaction: Transaction,
  rowHeights: Record<string, number>,
  blockAligns: Record<string, string> = {},
  blockWidths: Record<string, string> = {},
  blockTypography: Record<string, string> = {}
): Transaction {
  return transaction.setMeta(presentationPluginKey, {
    rowHeights,
    blockAligns,
    blockWidths,
    blockTypography
  } satisfies BlockPresentation);
}

/** Render the runtime's block presentation as decorations in one EditorView. */
export function presentationPlugin() {
  return new Plugin<PresentationPluginState>({
    key: presentationPluginKey,
    state: {
      init: () => ({
        rowHeights: {},
        blockAligns: {},
        blockWidths: {},
        blockTypography: {},
        decorations: DecorationSet.empty
      }),
      apply(transaction, value, _, nextState) {
        const presentation =
          (transaction.getMeta(presentationPluginKey) as BlockPresentation | undefined) ?? value;
        if (!transaction.docChanged && presentation === value) return value;
        return {
          rowHeights: presentation.rowHeights,
          blockAligns: presentation.blockAligns,
          blockWidths: presentation.blockWidths,
          blockTypography: presentation.blockTypography,
          decorations: createDecorations(nextState.doc, presentation)
        };
      }
    },
    props: {
      decorations(state) {
        return presentationPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      }
    }
  });
}
