import { NodeSelection, TextSelection, type Transaction } from 'prosemirror-state';
import type { Mark as PmMark, Node as PmNode } from 'prosemirror-model';
import { toggleMark as pmToggleMark } from 'prosemirror-commands';
import { toast } from '$lib/components';
import { isApiError } from '$data/api';
import { standardRowHeight } from '$systems/documents/layout';
import { safeHref } from '$systems/documents/sanitize';
import { renameResource } from '$data/resources';
import { renameResourceTab } from '$data/workspace';
import {
  getJob,
  newUnitId,
  resolvePromptBlock,
  customTypographyEmpty,
  headingLevel,
  typographyStyleId,
  typographyStyleDefinition,
  type Block,
  type BlockKind,
  type CustomTypography,
  type MarkKind,
  type Row,
  type SemanticTypography
} from '$data/documents';
import { schema } from '../editor/schema';
import { nodeKind } from '../editor/bridge';
import type {
  EditorActions,
  InspectedBlock,
  SearchOptions,
  SearchResult,
  SelectionInfo
} from '../editor/session';
import { findBlock, type OptimisticOverlay } from './overlay';
import type { PmStateHost } from './pm-state';
import { effectiveCustomOf } from './presentation';
import { findText } from './search';
import { blockPositionOf, type InspectionOverride } from './selection';
import type { SyncEngine } from './sync';

/**
 * The EDITOR ACTIONS — the table of ~25 commands the inspector calls.
 *
 * Two write paths run through here, and every action is one or the other:
 *
 * - **Differ-backed** (block kind, text type, insert element, marks, links,
 *   quote, columns): dispatch a ProseMirror transaction and let `diffDoc`
 *   discover the change on the next flush. Nothing is queued by hand.
 * - **Overlay-backed** (alignment, indent, line spacing, the typography
 *   cascade): patch the overlay, queue the matching `ChangeOp` as an "extra",
 *   then `host.commitOverlayEdit()`. These change nothing the differ can see,
 *   so they drive the sync cycle themselves.
 *
 * The three collaborators are passed in whole; everything else the actions need
 * from the runtime is the nine-member `ActionsHost` below.
 */

/**
 * What the actions need from `DocumentRuntime` itself — the state and side
 * effects that are neither ProseMirror, nor server truth, nor the overlay.
 * `DocumentRuntime implements ActionsHost`, so the compiler checks the boundary.
 */
export interface ActionsHost {
  readonly projectId: string;
  readonly resourceId: string;
  /** The document's current name (a rename compares against it first). */
  readonly title: string;
  /** Fold a completed rename back into runtime metadata and panel state. */
  setTitle(title: string): void;
  /** A prompt resolve is in flight — published in the session as progress. */
  resolving: boolean;
  /** The current selection, honouring a pinned gutter inspection. */
  selection(): SelectionInfo;
  /** Pin (or release) the inspected target. */
  setInspection(override: InspectionOverride | null): void;
  /** Mark the document dirty without scheduling a flush (the caller flushes). */
  markDirty(): void;
  /** Publish an overlay-only edit: repaint, push state, flush, republish. */
  commitOverlayEdit(): void;
}

/** The collaborators the actions drive directly. */
export type ActionDeps = {
  host: ActionsHost;
  pm: PmStateHost;
  sync: SyncEngine;
  overlay: OptimisticOverlay;
};

/**
 * Convert one block node at `pos` to a text-type sub-kind, in place. Text types
 * keep the same node size, so a batch conversion can walk high-to-low and leave
 * earlier positions valid.
 */
function convertBlockAt(tr: Transaction, pos: number, subKind: string): Transaction {
  const node = tr.doc.nodeAt(pos);
  if (!node) return tr;
  const base = { blockId: node.attrs.blockId, rowId: node.attrs.rowId };
  // A heading sub-kind → heading node (level); body / custom → text paragraph.
  const level = headingLevel(subKind);
  return level
    ? tr.setNodeMarkup(pos, schema.nodes.heading, { ...base, level })
    : tr.setNodeMarkup(pos, schema.nodes.paragraph, { ...base, kind: 'text', subKind });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createEditorActions({ host, pm, sync, overlay }: ActionDeps): EditorActions {
  // --- shared reads ----------------------------------------------------------

  /** The block the single-block actions target. */
  const targetBlock = (): InspectedBlock | null => {
    const sel = host.selection();
    return sel.mode === 'block' || sel.mode === 'new-block' ? sel.block : null;
  };

  // Only selected text has a concrete inline range. New Text uses stored marks
  // at the caret instead; blocks and rows deliberately expose layout only.
  const targetRanges = (): { from: number; to: number }[] =>
    host.selection().mode === 'run' ? [{ from: pm.selection.from, to: pm.selection.to }] : [];

  const blockPosition = (blockId: string): number | null => blockPositionOf(pm.doc, blockId);

  /** A block's effective style — the overlay's pending patch over server truth. */
  const effectiveStyle = (blockId: string): Block['style'] | undefined =>
    overlay.styleOf(blockId, findBlock(sync.snapshot, blockId)?.style);

  const effectiveCustom = (blockId: string): CustomTypography | null =>
    effectiveCustomOf(overlay, sync.snapshot, blockId);

  // Queue a put_style_definition for a typography token unless one is already
  // pending. Called before the op that references the style so it applies first
  // within the changeset (put is idempotent — re-putting an existing def is safe).
  const queueStyleDefinition = (typography: SemanticTypography): void => {
    const styleId = typographyStyleId(typography);
    if (overlay.has((op) => op.op === 'put_style_definition' && op.style?.id === styleId)) return;
    overlay.queue({ op: 'put_style_definition', style: typographyStyleDefinition(typography) });
  };

  // --- the action table ------------------------------------------------------

  return {
    renameDocument: async (name: string) => {
      const next = name.trim();
      if (!next || next === host.title) return;
      if (!host.resourceId) throw new Error('Document metadata is still loading.');
      await renameResource(host.projectId, host.resourceId, next);
      renameResourceTab(host.resourceId, next);
      host.setTitle(next);
    },
    searchText: (query: string, options: SearchOptions) => findText(pm.doc, query, options),
    focusSearchResult: (result: SearchResult) => {
      if (result.from < 1 || result.to > pm.doc.content.size) return;
      pm.dispatch(
        pm.tr
          .setSelection(TextSelection.create(pm.doc, result.from, result.to))
          .scrollIntoView()
      );
      pm.focus();
    },
    replaceSearchResults: (results: SearchResult[], replacement: string) => {
      const unique = [...new Map(results.map((result) => [result.id, result])).values()].sort(
        (a, b) => b.from - a.from
      );
      let tr = pm.tr;
      let replaced = 0;
      for (const result of unique) {
        if (result.from < 1 || result.to > tr.doc.content.size || result.from > result.to) continue;
        tr = tr.insertText(replacement, result.from, result.to);
        replaced += 1;
      }
      if (replaced) pm.dispatch(tr.scrollIntoView());
      return replaced;
    },
    // Narrow inspection to one block and mirror the target with a real ProseMirror
    // NodeSelection on the page. No caller since RowLens was deleted (UX1), but it
    // stays: EditorActions is a frozen contract (editor/session.ts).
    inspectBlock: (blockId: string) => {
      const pos = blockPosition(blockId);
      if (pos == null) return;
      host.setInspection({ mode: 'block', blockIds: [blockId] });
      const tr = pm.tr.setSelection(NodeSelection.create(pm.doc, pos));
      tr.setMeta('taurus:keep-inspection', true);
      pm.dispatch(tr.scrollIntoView());
      pm.focus();
    },
    // Change the target block's kind. A real edit: the differ picks it up as a
    // set_block op on the next flush (including into/out of `prompt`).
    setBlockKind: (kind: BlockKind) => {
      const t = targetBlock();
      if (!t) return;
      const node = pm.doc.nodeAt(t.pos);
      if (!node) return;
      const base = { blockId: node.attrs.blockId, rowId: node.attrs.rowId };
      const tr = kind.startsWith('heading_')
        ? pm.tr.setNodeMarkup(t.pos, schema.nodes.heading, {
            ...base,
            level: Number(kind.slice('heading_'.length)) || 1
          })
        : pm.tr.setNodeMarkup(t.pos, schema.nodes.paragraph, { ...base, kind });
      tr.setMeta('taurus:keep-inspection', true);
      pm.dispatch(tr);
      pm.focus();
    },
    // Convert every block the current selection touches to a text-type kind.
    // Whole-line: one set_block per touched block (no split-at-bounds).
    setTextType: (subKind: string) => {
      const sel = pm.selection;
      const positions: number[] = [];
      // Convert only the text-kind blocks the selection touches (headings + body
      // paragraphs); code / callout / etc. keep their kind.
      pm.doc.forEach((node, offset) => {
        if (offset < sel.to && offset + node.nodeSize > sel.from && nodeKind(node) === 'text')
          positions.push(offset);
      });
      if (positions.length === 0) return;
      let tr = pm.tr;
      // High-to-low so earlier positions stay valid (text types keep node size).
      for (const pos of positions.reverse()) tr = convertBlockAt(tr, pos, subKind);
      tr.setMeta('taurus:keep-inspection', true);
      pm.dispatch(tr);
      pm.focus();
    },
    // Insert an element block (divider / code / callout / prompt) at the current
    // line — replace it if empty, else insert on a new line after it. A fresh
    // node (null blockId) lets the differ emit insert_block with the right kind.
    insertElement: (kind: BlockKind) => {
      const sel = pm.selection;
      if (sel.$from.depth < 1) return;
      const pos = sel.$from.before(1);
      const cur = pm.doc.nodeAt(pos);
      if (!cur) return;
      const empty = cur.isTextblock && cur.textContent.length === 0;
      const build = (): PmNode => {
        if (kind === 'divider') return schema.node('divider');
        if (kind === 'code') return schema.node('code_block', null, []);
        if (kind === 'list') return schema.node('list', null, [schema.node('list_item')]);
        // callout / prompt reuse the paragraph node with a kind attr.
        return schema.node('paragraph', { kind }, []);
      };
      const node = build();
      let tr = pm.tr;
      if (kind === 'divider') {
        // A leaf: drop it in and leave a paragraph to type in.
        const trailing = schema.node('paragraph');
        if (empty) tr = tr.replaceWith(pos, pos + cur.nodeSize, [node, trailing]);
        else tr = tr.insert(pos + cur.nodeSize, [node, trailing]);
        const caret = (empty ? pos : pos + cur.nodeSize) + node.nodeSize + 1;
        tr = tr.setSelection(TextSelection.create(tr.doc, caret));
      } else if (kind === 'list') {
        // A list is a block with items; replace an empty line, else insert after —
        // caret lands inside the first item (list open +1, list_item open +1).
        const base = empty ? pos : pos + cur.nodeSize;
        if (empty) tr = tr.replaceWith(pos, pos + cur.nodeSize, node);
        else tr = tr.insert(pos + cur.nodeSize, node);
        tr = tr.setSelection(TextSelection.create(tr.doc, base + 2));
      } else if (empty) {
        tr = tr.setNodeMarkup(pos, node.type, node.attrs);
        tr = tr.setSelection(TextSelection.create(tr.doc, pos + 1));
      } else {
        tr = tr.insert(pos + cur.nodeSize, node);
        tr = tr.setSelection(TextSelection.create(tr.doc, pos + cur.nodeSize + 1));
      }
      tr.setMeta('taurus:keep-inspection', true);
      pm.dispatch(tr.scrollIntoView());
      pm.focus();
    },
    // Change the inspected list block's marker type / ordered start. Retypes the PM
    // list node; the differ emits set_block_data with the full payload on flush.
    setListType: (listType: string, start?: number) => {
      const t = targetBlock();
      if (!t?.blockId) return;
      const pos = blockPosition(t.blockId);
      if (pos == null) return;
      const node = pm.doc.nodeAt(pos);
      if (!node || node.type.name !== 'list') return;
      const tr = pm.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        listType,
        start: start ?? node.attrs.start
      });
      tr.setMeta('taurus:keep-inspection', true);
      pm.dispatch(tr);
      pm.focus();
    },
    setRowHeight: (rowKeys: string[], heightPx: number) => {
      const requestedPoints = Math.max(1, Math.round((heightPx * 72) / 96));
      const base = standardRowHeight(sync.layoutRules);
      const heightIncrease = Math.min(
        sync.layoutRules.maxHeightIncrease,
        Math.max(0, requestedPoints - base)
      );
      for (const rowId of rowKeys) {
        const row = sync.snapshot.find((r) => r.id === rowId);
        if (!row) continue;
        overlay.setRowHeight(rowId, heightIncrease);
        if (!sync.supportsCanonicalLayout) continue;
        // Omega's set_block_line_height is per-block; emit one op per block
        // in the row so every block in the row gets the same line spacing.
        for (const block of row.blocks) {
          overlay.replace(
            (op) => op.op === 'set_block_line_height' && op.blockId === block.id,
            { op: 'set_block_line_height', blockId: block.id, lineHeight: heightIncrease }
          );
        }
      }
      host.commitOverlayEdit();
    },
    // Toggle a mark over selected text, or persist it at the caret for the text
    // typed next. Range edits sync through the normal mark reconciliation.
    toggleMark: (kind: MarkKind) => {
      const type = {
        bold: schema.marks.strong,
        italic: schema.marks.em,
        underline: schema.marks.underline,
        strike: schema.marks.strike,
        code: schema.marks.code,
        link: schema.marks.link,
        font: schema.marks.font,
        fg: schema.marks.fg,
        bg: schema.marks.bg
      }[kind];
      if (!type) return;
      if (host.selection().mode === 'new-text') {
        pmToggleMark(type)(pm.state, (tr) => {
          tr.setMeta('taurus:keep-inspection', true);
          pm.dispatch(tr);
        });
        pm.focus();
        return;
      }
      const ranges = targetRanges();
      if (!ranges.length) return;
      const remove = ranges.some(({ from, to }) => pm.doc.rangeHasMark(from, to, type));
      let tr = pm.tr;
      for (const { from, to } of ranges)
        tr = remove ? tr.removeMark(from, to, type) : tr.addMark(from, to, type.create());
      tr.setMeta('taurus:keep-inspection', true);
      pm.dispatch(tr);
      pm.focus();
    },
    // Apply (or clear) a link over selected text, or store it at the caret for
    // the text typed next.
    setLink: (rawHref: string | null) => {
      // Validate at the WRITE boundary as well as the render boundary: Omega
      // accepts any non-empty href (verified — catalog S1/S4), so an unsafe value
      // typed here would be stored and served to every reader.
      const href = rawHref === null ? null : safeHref(rawHref);
      if (rawHref?.trim() && !href) {
        toast('That link was not applied — only http, https and mailto links are allowed.', {
          tone: 'attention'
        });
        return;
      }
      if (host.selection().mode === 'new-text') {
        const active = pm.state.storedMarks ?? pm.selection.$from.marks();
        const marks = active.filter((mark) => mark.type !== schema.marks.link);
        if (href) marks.push(schema.marks.link.create({ href }));
        const tr = pm.tr.setStoredMarks(marks);
        tr.setMeta('taurus:keep-inspection', true);
        pm.dispatch(tr);
        pm.focus();
        return;
      }
      const ranges = targetRanges();
      if (!ranges.length) return;
      let tr = pm.tr;
      for (const { from, to } of ranges)
        tr = href
          ? tr.addMark(from, to, schema.marks.link.create({ href }))
          : tr.removeMark(from, to, schema.marks.link);
      tr.setMeta('taurus:keep-inspection', true);
      pm.dispatch(tr);
      pm.focus();
    },
    // Apply/clear an inline typography mark. `font` merges family/size with any
    // existing font mark; `fg`/`bg` set a color. New-text/new-block store the mark
    // for the next-typed text; a selection applies it over the range.
    setInlineStyle: (kind: 'font' | 'fg' | 'bg', attrs: Record<string, string> | null) => {
      const type = { font: schema.marks.font, fg: schema.marks.fg, bg: schema.marks.bg }[kind];
      const fontMark = (existing: PmMark | undefined): PmMark | null => {
        const merged = { ...(existing?.attrs ?? {}), ...(attrs ?? {}) };
        const family = String(merged.family ?? '').trim();
        const size = String(merged.size ?? '').trim();
        return family || size ? type.create({ family, size }) : null;
      };
      const colorMark = (): PmMark | null => {
        const value = String(attrs?.value ?? '').trim();
        return value ? type.create({ value }) : null;
      };
      const mode = host.selection().mode;
      if (mode === 'new-text' || mode === 'new-block') {
        const active = pm.state.storedMarks ?? pm.selection.$from.marks();
        const kept = active.filter((m) => m.type !== type);
        const next = kind === 'font' ? fontMark(active.find((m) => m.type === type)) : colorMark();
        const tr = pm.tr.setStoredMarks(next ? [...kept, next] : kept);
        tr.setMeta('taurus:keep-inspection', true);
        pm.dispatch(tr);
        pm.focus();
        return;
      }
      const ranges = targetRanges();
      if (!ranges.length) return;
      let tr = pm.tr;
      for (const { from, to } of ranges) {
        let existing: PmMark | undefined;
        if (kind === 'font')
          pm.doc.nodesBetween(from, to, (node) => {
            const found = node.marks.find((m) => m.type === type);
            if (found && !existing) existing = found;
          });
        const next = kind === 'font' ? fontMark(existing) : colorMark();
        tr = tr.removeMark(from, to, type);
        if (next) tr = tr.addMark(from, to, next);
      }
      tr.setMeta('taurus:keep-inspection', true);
      pm.dispatch(tr);
      pm.focus();
    },
    // "Quote" wraps the selected text in quotation marks — literally quote
    // characters on both sides, not a quote-block kind. It is a plain text edit,
    // so it flows to Omega through the ordinary text-diff ops (no new op type).
    quoteSelection: () => {
      const { from, to, empty } = pm.selection;
      let tr = pm.tr;
      if (empty) {
        tr = tr.insertText('""', from);
        tr = tr.setSelection(TextSelection.create(tr.doc, from + 1));
      } else {
        // Insert the closing quote first so the opening insert doesn't shift it.
        tr = tr.insertText('"', to).insertText('"', from);
        tr = tr.setSelection(TextSelection.create(tr.doc, from + 1, to + 1));
      }
      tr.setMeta('taurus:keep-inspection', true);
      pm.dispatch(tr);
      pm.focus();
    },
    // Set horizontal/vertical alignment on the inspected block(s). Maps 1:1 to
    // Omega's set_block_alignment op — the horizontalAlign/verticalAlign enums are
    // identical — so the value round-trips through the changeset pipeline.
    setBlockAlignment: (blockIds, patch) => {
      let changed = false;
      for (const blockId of blockIds) {
        if (!blockId) continue;
        const current = effectiveStyle(blockId);
        if (!current) continue;
        // Patch the overlay, never the snapshot — see model/overlay.ts (B2).
        overlay.patchBlockStyle(blockId, current, patch);
        changed = true;
        if (!sync.supportsCanonicalLayout) continue;
        overlay.replace(
          (op) => op.op === 'set_block_alignment' && op.blockId === blockId,
          { op: 'set_block_alignment', blockId, ...patch }
        );
      }
      if (!changed) return;
      host.commitOverlayEdit();
    },
    // Set the general indent level (0–16) on the inspected block(s). Mirrors
    // set_block_alignment: optimistic snapshot + set_block_indent op.
    setBlockIndent: (blockIds: string[], indent: number) => {
      const clamped = Math.max(0, Math.min(16, Math.round(indent)));
      let changed = false;
      for (const blockId of blockIds) {
        if (!blockId) continue;
        const current = effectiveStyle(blockId);
        if (!current) continue;
        // Patch the overlay, never the snapshot — see model/overlay.ts (B2).
        overlay.patchBlockStyle(blockId, current, { indent: clamped });
        changed = true;
        if (!sync.supportsCanonicalLayout) continue;
        overlay.replace(
          (op) => op.op === 'set_block_indent' && op.blockId === blockId,
          { op: 'set_block_indent', blockId, indent: clamped }
        );
      }
      if (!changed) return;
      host.commitOverlayEdit();
    },
    // Set the document default style for a block kind to a typography token: seed
    // the token's style definition (idempotent) then point the kind's default at
    // it (put_style_definition + set_style_default). Drives the LayoutPanel.
    setBlockKindTypography: (kind: BlockKind, typography: SemanticTypography) => {
      const styleId = typographyStyleId(typography);
      // Optimistic local registry: ensure the definition, replace the kind default.
      const definitions = [...(sync.styleRegistry.definitions ?? [])];
      if (!definitions.some((d) => d.id === styleId)) definitions.push(typographyStyleDefinition(typography));
      const defaults = (sync.styleRegistry.defaults ?? []).filter((d) => d.blockKind !== kind);
      defaults.push({ blockKind: kind, styleId });
      sync.styleRegistry = { definitions, defaults };
      if (sync.supportsCanonicalLayout) {
        queueStyleDefinition(typography);
        overlay.replace(
          (op) => op.op === 'set_style_default' && op.defaultBlockKind === kind,
          { op: 'set_style_default', defaultBlockKind: kind, styleId }
        );
      }
      host.commitOverlayEdit();
    },
    // Assign a typography token to specific block(s) as an explicit style
    // reference: seed the token's definition then assign_block_style. Drives the
    // Details (inspector) panel's typography control.
    setBlockTypography: (blockIds: string[], typography: SemanticTypography) => {
      const styleId = typographyStyleId(typography);
      let changed = false;
      // Seed the definition first so the assign op that follows resolves it.
      if (sync.supportsCanonicalLayout) queueStyleDefinition(typography);
      const definitions = [...(sync.styleRegistry.definitions ?? [])];
      if (!definitions.some((d) => d.id === styleId)) {
        definitions.push(typographyStyleDefinition(typography));
        sync.styleRegistry = { ...sync.styleRegistry, definitions };
      }
      for (const blockId of blockIds) {
        if (!blockId) continue;
        if (!findBlock(sync.snapshot, blockId)) continue;
        overlay.setStyleRef(blockId, { styleId });
        changed = true;
        if (!sync.supportsCanonicalLayout) continue;
        overlay.replace(
          (op) => op.op === 'assign_block_style' && op.blockId === blockId,
          { op: 'assign_block_style', blockId, styleRef: { styleId } }
        );
      }
      if (!changed) return;
      host.commitOverlayEdit();
    },
    // Set real (free-form) font family/size/color on the given block(s) — merges
    // the patch over each block's current custom typography and emits
    // set_block_custom_typography (Omega stores it verbatim; empty clears it).
    setBlockCustomTypography: (blockIds: string[], patch: Partial<CustomTypography>) => {
      let changed = false;
      for (const blockId of blockIds) {
        if (!blockId) continue;
        if (!findBlock(sync.snapshot, blockId)) continue;
        const merged: CustomTypography = { ...(effectiveCustom(blockId) ?? {}), ...patch };
        // Drop blank fields so an empty value truly clears (Omega nils empty).
        for (const key of ['fontFamily', 'fontSize', 'fg', 'bg'] as const)
          if (!merged[key]?.trim()) delete merged[key];
        overlay.setCustom(blockId, merged);
        changed = true;
        if (!sync.supportsCanonicalLayout) continue;
        overlay.replace((op) => op.op === 'set_block_custom_typography' && op.blockId === blockId, {
          op: 'set_block_custom_typography',
          blockId,
          customTypography: customTypographyEmpty(merged) ? null : merged
        });
      }
      if (!changed) return;
      host.commitOverlayEdit();
    },
    // Set the document-wide default typography (Base level). Merges the patch,
    // drops blank fields, and emits set_default_typography (null clears the field).
    setDefaultTypography: (patch: Partial<CustomTypography>) => {
      const merged: CustomTypography = { ...(sync.defaultTypography ?? {}), ...patch };
      for (const key of ['fontFamily', 'fontSize', 'fg', 'bg'] as const)
        if (!merged[key]?.trim()) delete merged[key];
      sync.defaultTypography = customTypographyEmpty(merged) ? null : merged;
      if (sync.supportsCanonicalLayout) {
        overlay.replace((op) => op.op === 'set_default_typography', {
          op: 'set_default_typography',
          customTypography: sync.defaultTypography
        });
        host.markDirty();
        sync.scheduleFlush();
      }
      pm.pushState();
      pm.refreshSession();
    },
    // Add a new empty block as a column in the given block's row. Columns are
    // just multiple blocks sharing a row — Omega already models this (insert_block
    // + Row.tracks). We splice the block into the snapshot and queue insert_block,
    // then insert a PM node carrying the SAME block id so the next diff treats it
    // as already-existing in this row (a fresh node would be force-assigned its own
    // row by the differ's rowFor). Widths default to equal; unequal widths are a
    // later step via set_row_tracks.
    addColumn: (afterBlockId, side) => {
      let targetRow: Row | undefined;
      let blockIndex = -1;
      for (const row of sync.snapshot) {
        const idx = row.blocks.findIndex((b) => b.id === afterBlockId);
        if (idx >= 0) {
          targetRow = row;
          blockIndex = idx;
          break;
        }
      }
      if (!targetRow || blockIndex < 0) return;
      let refPos = -1;
      let refSize = 0;
      pm.doc.forEach((node, offset) => {
        if (node.attrs.blockId === afterBlockId) {
          refPos = offset;
          refSize = node.nodeSize;
        }
      });
      if (refPos < 0) return;
      const newBlock: Block = {
        id: newUnitId(),
        kind: 'text',
        style: { horizontalAlign: 'left', verticalAlign: 'top' },
        atoms: [{ id: newUnitId(), kind: 'text', text: '' }]
      };
      const insertIndex = side === 'left' ? blockIndex : blockIndex + 1;
      targetRow.blocks.splice(insertIndex, 0, newBlock);
      const afterBlock = insertIndex > 0 ? targetRow.blocks[insertIndex - 1].id : '';
      overlay.queue({ op: 'insert_block', rowId: targetRow.id, afterBlock, block: newBlock });
      const node = schema.node('paragraph', {
        blockId: newBlock.id,
        rowId: targetRow.id,
        kind: 'text'
      });
      const insertPos = side === 'left' ? refPos : refPos + refSize;
      const tr = pm.tr.insert(insertPos, node);
      tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
      // A normal (non-sync) tx: dispatch flags the doc pending, schedules the
      // flush, and refreshes the presentation so the new column renders immediately.
      pm.dispatch(tr);
    },
    // Save the prompt instruction: queued as a set_prompt op ahead of the next
    // append (the instruction lives in block data, which the differ can't see).
    setPrompt: (instruction: string) => {
      const t = targetBlock();
      if (!t?.blockId) return;
      overlay.queue({ op: 'set_prompt', blockId: t.blockId, setText: instruction });
      host.markDirty();
      void sync.flushNow();
    },
    // Resolve the prompt block: flush edits, enqueue the job, poll, reload truth.
    resolvePrompt: (mode = '') => {
      const t = targetBlock();
      if (!t?.blockId || !sync.docId || host.resolving) return;
      const blockId = t.blockId;
      host.resolving = true;
      pm.refreshSession();
      void (async () => {
        try {
          await sync.flushNow();
          const { jobId } = await resolvePromptBlock(sync.docId, blockId, mode);
          for (let i = 0; ; i++) {
            await sleep(1000);
            const job = await getJob(jobId);
            if (job.status === 'done') {
              await sync.reload();
              break;
            }
            if (job.status === 'failed') {
              toast(job.error ? `Resolve failed: ${job.error}` : 'Resolve failed', { tone: 'danger' });
              break;
            }
            if (i >= 120) {
              toast('Resolve is taking too long — check back shortly', { tone: 'attention' });
              break;
            }
          }
        } catch (e) {
          toast(isApiError(e) ? e.message : 'Could not resolve the prompt block', { tone: 'danger' });
        } finally {
          host.resolving = false;
          pm.refreshSession();
        }
      })();
    },
    // Outline click: put the caret at the heading and scroll it into view.
    focusHeading: (blockId: string) => {
      let pos: number | null = null;
      pm.doc.forEach((node, offset) => {
        if (pos == null && node.attrs.blockId === blockId) pos = offset + 1;
      });
      if (pos != null) {
        pm.dispatch(
          pm.tr.setSelection(TextSelection.create(pm.doc, pos)).scrollIntoView()
        );
        pm.focus();
      }
    }
  };
}
