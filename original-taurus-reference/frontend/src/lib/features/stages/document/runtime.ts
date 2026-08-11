import { writable, type Writable } from 'svelte/store';
import { TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, toggleMark as pmToggleMark } from 'prosemirror-commands';
import { standardRowHeight } from '$systems/documents/layout';
import { registerResourceKind, acquire as acquireRuntime } from '$systems/resources/registry';
import {
  effectiveTypography,
  type Block,
  type BlockKind,
  type BlockStyleRef,
  type CustomTypography,
  type Doc,
  type PromptData,
  type SemanticTypography
} from '$data/documents';
import { activeSurface } from '$lib/features/shared/surface';
import { schema } from './editor/schema';
import { nodeKind, omegaToPmDoc } from './editor/bridge';
import { enterList, indentList } from './editor/list-commands';
import { presentationPlugin, setBlockPresentation } from './editor/presentation-plugin';
import { selectionHighlightPlugin } from './editor/selection-highlight';
import {
  editorSession,
  type EditorActions,
  type SelectionInfo
} from './editor/session';
import { createEditorActions, type ActionsHost } from './model/actions';
import { findBlock, OptimisticOverlay } from './model/overlay';
import { PmStateHost, type PmHost, type ViewHooks } from './model/pm-state';
import { SyncEngine, type CaretAnchor, type SyncHost } from './model/sync';
import { documentSurface } from './model/panels';
import {
  computeBlockDecorations,
  computeRowHeights,
  effectiveCustomOf,
  effectiveStyleRefOf,
  projectDocument,
  type PresentationSources
} from './model/presentation';
import { deriveSelection, type InspectionOverride } from './model/selection';

/**
 * The document RUNTIME layer — the client-side object model behind document tabs
 * (docs/archive/plans/2026-07-21-client-runtime-model.md):
 *
 * - A `DocumentRuntime` HOLDS an open document: the ProseMirror EditorState (the
 *   live content — selection and undo history included), the last-synced Omega
 *   snapshot, and the whole sync loop (debounce, flush, conflict reload, prompt
 *   resolve). It is view-independent: it keeps syncing whether or not a stage is
 *   mounted, and it survives tab switches.
 * - The `documents manager` (acquireDocument below + the resource registry's
 *   workspace watcher) owns
 *   the runtimes: one per open document resource, created on first open, provided
 *   to whoever asks (the stage today; scripts/agents later), and DISPOSED when
 *   the resource's tab closes or the project changes — the tab set is the source
 *   of truth for what is open.
 * - The stage is just a VIEW: it attaches (getting state pushes + publishing
 *   rights for the editor session / surface contribution) and detaches on
 *   unmount, leaving the runtime alive.
 */

export type RuntimeInfo = {
  status: 'loading' | 'ready' | 'error';
  errMsg: string;
  save: 'saved' | 'pending' | 'saving' | 'error';
  updatedAt: string;
};

export type { ViewHooks };

/** The runtime surface the editor keymap needs to outdent a block on Backspace. */
export interface IndentHost {
  indentOf(blockId: string): number;
  outdentBlock(blockId: string): void;
}

/** Backspace at the very start of an indented block drops its indent one level
 *  (mirroring Tab/Shift-Tab) instead of merging it into the block above. Returns
 *  false when there is no indent to shed, so the base join-backward still runs. */
function outdentOnBackspace(host: IndentHost): Command {
  return (state, dispatch) => {
    const { selection } = state;
    if (!selection.empty || selection.$from.parentOffset !== 0) return false;
    const blockId = String(selection.$from.parent.attrs.blockId ?? '');
    if (!blockId || host.indentOf(blockId) <= 0) return false;
    if (dispatch) host.outdentBlock(blockId);
    return true;
  };
}

function plugins(host: IndentHost) {
  return [
    history(),
    presentationPlugin(),
    selectionHighlightPlugin(),
    keymap({
      'Mod-z': undo,
      'Shift-Mod-z': redo,
      'Mod-y': redo,
      'Mod-b': pmToggleMark(schema.marks.strong),
      'Mod-i': pmToggleMark(schema.marks.em),
      'Mod-u': pmToggleMark(schema.marks.underline)
    }),
    // List editing (Enter splits/exits items; Tab changes nesting) — tried before
    // the base keymap, and a no-op outside a list.
    keymap({
      Enter: enterList,
      Tab: indentList(1),
      'Shift-Tab': indentList(-1)
    }),
    // Backspace at the start of an indented block outdents it before the base
    // keymap can merge it into the block above.
    keymap({ Backspace: outdentOnBackspace(host) }),
    keymap(baseKeymap)
  ];
}

export class DocumentRuntime implements SyncHost, IndentHost, PmHost, ActionsHost {
  readonly key: string;
  readonly projectId: string;
  title: string;
  /** The canonical Omega document id this tab references (empty for legacy name-keyed tabs). */
  readonly resourceId: string;
  /** Load/save status for the view chrome. */
  readonly info: Writable<RuntimeInfo> = writable({ status: 'loading', errMsg: '', save: 'saved', updatedAt: '' });

  /**
   * The live ProseMirror state, the transaction pipeline, and the attached
   * view's hooks (see model/pm-state.ts). Everything that reads or writes the
   * document goes through it, so the runtime holds one collaborator here rather
   * than a state field, a dispatch function, and a hooks slot.
   */
  private readonly pm: PmStateHost;
  /**
   * Every optimistic edit shown before Omega confirms it — row heights, block
   * styles, style refs, custom typography — plus the direct-op queue. A layer
   * OVER the snapshot, never a mutation of it (see model/overlay.ts, catalog B2).
   */
  private readonly overlay = new OptimisticOverlay();
  /**
   * Server truth and the change pipeline: the document id, revision, row
   * snapshot, metadata, layout, style registry, and the debounced flush /
   * conflict reload / retry loop (see model/sync.ts). The runtime reads through
   * it rather than holding a second copy.
   */
  private readonly sync: SyncEngine;
  /** rowId → modelled height in CSS pixels, from the last presentation pass. */
  private rowHeightsPx = new Map<string, number>();
  private presentationSignature = '';
  /** A prompt resolve is in flight — published in the session as progress. */
  resolving = false;
  private inspection: InspectionOverride | null = null;
  private cur: RuntimeInfo = { status: 'loading', errMsg: '', save: 'saved', updatedAt: '' };

  /** The inspector's command table (see model/actions.ts). */
  readonly actions: EditorActions;

  constructor(projectId: string, title: string, resourceId: string, key: string) {
    this.projectId = projectId;
    this.title = title;
    this.resourceId = resourceId;
    this.key = key;
    this.sync = new SyncEngine(this, this.overlay, projectId, resourceId);
    this.pm = new PmStateHost(this, schema.node('doc', null, [schema.node('paragraph')]), plugins(this));
    // Built here rather than as a field initializer: it captures `pm`/`sync`,
    // which do not exist until the two lines above have run.
    this.actions = createEditorActions({ host: this, pm: this.pm, sync: this.sync, overlay: this.overlay });
    void this.load();
  }

  setInfo(patch: Partial<RuntimeInfo>) {
    this.cur = { ...this.cur, ...patch };
    this.info.set(this.cur);
  }

  /** Fold a canonical resource rename into runtime metadata and panel state. */
  setTitle(title: string) {
    if (this.title === title) return;
    this.title = title;
    this.pm.refreshSession();
  }

  // --- the view seam ---------------------------------------------------------
  //
  // `state` and `dispatch` are what DocumentStage hands to its EditorView. They
  // stay on the runtime deliberately: the stage is a view of a document, not of
  // the runtime's internal model split.

  /** The live ProseMirror state — the single source of editing truth. */
  get state(): EditorState {
    return this.pm.state;
  }

  /** Every ProseMirror transaction flows through here (the view's dispatch). */
  get dispatch(): (tr: Transaction) => void {
    return this.pm.dispatch;
  }

  /** A stage attached: push state, and take over the session/surface stores. */
  attach(hooks: ViewHooks) {
    this.pm.attach(hooks);
    if (this.cur.status === 'ready') {
      this.updateSession();
      this.publishSurface();
    }
  }

  /** The stage unmounted: keep syncing in the background, release the stores. */
  detach() {
    if (!this.pm.detach()) return;
    editorSession.set(null);
    activeSurface.set(null);
  }

  // --- the PmHost seam (what the transaction pipeline calls back into) --------
  //
  // The state, the dispatch order, and the view hooks live in model/pm-state.ts.
  // These four are the runtime reactions it fires, in the order it fires them.

  /** A plain selection change released the pinned gutter inspection. */
  clearInspection() {
    this.inspection = null;
  }

  /** A user edit landed: mark the document dirty and schedule a flush. */
  scheduleSave() {
    this.setInfo({ save: 'pending' });
    this.sync.scheduleFlush();
  }

  replaceState(full: Doc) {
    this.inspection = null;
    this.pm.replaceDoc(omegaToPmDoc(full));
    this.refreshPresentation(true);
    this.pm.pushState();
    this.pm.notifyDocChanged();
  }

  /** The document truth a presentation pass reads (see model/presentation.ts). */
  private presentationSources(): PresentationSources {
    return {
      doc: this.pm.doc,
      snapshot: this.sync.snapshot,
      overlay: this.overlay,
      layoutRules: this.sync.layoutRules,
      styleRegistry: this.sync.styleRegistry
    };
  }

  /** The ONE presentation pass: recompute per-row/per-block presentation from
   *  server truth + optimistic pending edits, and store it as decorations. */
  refreshPresentation(force = false) {
    const sources = this.presentationSources();
    const rowHeightsPx = computeRowHeights(sources);
    const signature = JSON.stringify([...rowHeightsPx.entries()]);
    if (!force && signature === this.presentationSignature) return;
    this.presentationSignature = signature;
    // Retained so updateSession publishes the SAME heights that are painted.
    this.rowHeightsPx = rowHeightsPx;
    const presentation = computeBlockDecorations(sources, rowHeightsPx);
    const transaction = setBlockPresentation(
      this.pm.tr,
      Object.fromEntries(presentation.rowHeightsPx),
      presentation.blockAligns,
      presentation.blockWidths,
      presentation.blockTypography
    );
    transaction.setMeta('taurus:sync', true);
    transaction.setMeta('addToHistory', false);
    // Applied OUTSIDE the pipeline: this runs mid-dispatch, and re-entering
    // dispatch here would recurse (see PmStateHost.applySilently).
    this.pm.applySilently(transaction);
  }

  // --- the SyncHost seam (what the SyncEngine calls back into) ----------------
  //
  // Server truth and the change pipeline live in model/sync.ts. Everything below
  // is the editor half the engine cannot reach on its own: the live document, the
  // state rebuild, the caret, and the view refresh.

  /** Reload the document from Omega (also the view's "Try again"). */
  load() {
    return this.sync.load(this.title);
  }

  /** Flush immediately (tab hide, teardown, before a resolve). */
  flushNow() {
    return this.sync.flushNow();
  }

  doc() {
    return this.pm.doc;
  }

  savePending() {
    return this.cur.save === 'pending';
  }

  /** Server truth moved: repaint, push state to the view, republish the session. */
  refreshView() {
    this.refreshPresentation(true);
    this.pm.pushState();
    this.pm.refreshSession();
  }

  /** A load finished: publish the session and this surface's panel sections. */
  onLoaded() {
    if (this.pm.attached) {
      this.updateSession();
      this.publishSurface();
    }
  }

  // Stamp server ids onto nodes ProseMirror created (Enter, paste) — outside
  // the undo history, and flagged so dispatch doesn't re-schedule a flush.
  applyFixups(fixups: Map<number, { blockId: string; rowId: string }>) {
    const tr = this.pm.tr;
    this.pm.doc.forEach((node, offset, index) => {
      const f = fixups.get(index);
      if (f) tr.setNodeMarkup(offset, undefined, { ...node.attrs, ...f });
    });
    tr.setMeta('taurus:sync', true);
    tr.setMeta('addToHistory', false);
    this.pm.dispatch(tr);
  }

  captureSelection(): CaretAnchor | null {
    const from = this.pm.selection.$from;
    if (from.depth < 1) return null;
    const node = from.node(1);
    return { blockId: (node.attrs.blockId as string | null) ?? null, offset: from.parentOffset };
  }

  restoreSelection(sel: CaretAnchor | null) {
    if (!sel?.blockId) return;
    let pos: number | null = null;
    this.pm.doc.forEach((node, offset) => {
      if (pos == null && node.attrs.blockId === sel.blockId)
        pos = offset + 1 + Math.min(sel.offset, node.content.size);
    });
    if (pos != null) {
      const tr = this.pm.tr.setSelection(TextSelection.create(this.pm.doc, pos));
      tr.setMeta('taurus:sync', true);
      this.pm.dispatch(tr);
      this.pm.focus();
    }
  }

  dispose() {
    this.sync.dispose();
    this.detach();
  }

  // --- the session (what the shell panels see) -------------------------------

  /** A block's effective style — the overlay's pending patch over server truth. */
  private effectiveStyle(blockId: string): Block['style'] | undefined {
    return this.overlay.styleOf(blockId, findBlock(this.sync.snapshot, blockId)?.style);
  }

  /** Current general indent (0–16) of a block — the `IndentHost` surface the
   *  Backspace keymap reads. Resolves through the overlay, so an indent that has
   *  not yet been confirmed by Omega still counts. */
  indentOf(blockId: string): number {
    return this.effectiveStyle(blockId)?.indent ?? 0;
  }

  /** Drop a block's indent one level; the Backspace keymap's outdent effect. */
  outdentBlock(blockId: string): void {
    this.actions.setBlockIndent([blockId], this.indentOf(blockId) - 1);
  }

  // The style cascade resolvers live in model/presentation.ts; these bind them
  // to this runtime's overlay + snapshot.
  private effectiveStyleRef(blockId: string): BlockStyleRef | null {
    return effectiveStyleRefOf(this.overlay, this.sync.snapshot, blockId);
  }

  private effectiveCustom(blockId: string): CustomTypography | null {
    return effectiveCustomOf(this.overlay, this.sync.snapshot, blockId);
  }

  // Thin wrapper over the pure SelectionModel: it reports when a pinned
  // inspection has gone stale rather than mutating the runtime itself.
  private deriveSelection(): SelectionInfo {
    const { selection, clearInspection } = deriveSelection(this.pm.state, this.inspection);
    if (clearInspection) this.inspection = null;
    return selection;
  }

  // Publish the session the panels render from. Cheap — runs per transaction.
  updateSession() {
    if (!this.sync.docId || this.cur.status === 'error') {
      editorSession.set(null);
      return;
    }
    const doc = this.pm.doc;
    const { outline, rowKeys, blocks, words, chars } = projectDocument(doc);
    // Modelled heights come straight from the presentation pass — the session and
    // the decorations read the SAME map, so the inspector can never disagree with
    // what is painted.
    const rowHeights = Object.fromEntries(
      rowKeys.map((rowKey) => [
        rowKey,
        this.rowHeightsPx.get(rowKey) ?? (standardRowHeight(this.sync.layoutRules) * 96) / 72
      ])
    );
    // Per-block maps for the Details panel: server truth (snapshot) overlaid with
    // any optimistic pending change, keyed by the block ids present in the doc.
    const snapshotStyles = new Map<string, Block['style']>();
    const snapshotKinds = new Map<string, BlockKind>();
    // Prompt blocks' resolved data (instruction/status/evidence/output) for the inspector.
    const blockPrompts: Record<string, PromptData> = {};
    for (const row of this.sync.snapshot)
      for (const block of row.blocks) {
        snapshotStyles.set(block.id, block.style);
        snapshotKinds.set(block.id, block.kind);
        if (block.kind === 'prompt' && block.data) blockPrompts[block.id] = block.data as PromptData;
      }
    const blockAligns: Record<string, Block['style']> = {};
    // Each block's effective semantic typography, for the inspector's control.
    const blockTypographies: Record<string, SemanticTypography> = {};
    // Each block's effective custom typography (real fonts), for the inspector.
    const blockCustomTypography: Record<string, CustomTypography> = {};
    doc.forEach((node) => {
      const blockId = node.attrs.blockId as string | null;
      if (!blockId) return;
      const style = this.overlay.styleOf(blockId, snapshotStyles.get(blockId));
      if (style) blockAligns[blockId] = style;
      const kind = snapshotKinds.get(blockId) ?? (nodeKind(node) as BlockKind);
      blockTypographies[blockId] = effectiveTypography(
        kind,
        this.effectiveStyleRef(blockId),
        this.sync.styleRegistry
      );
      const custom = this.effectiveCustom(blockId);
      if (custom) blockCustomTypography[blockId] = custom;
    });
    editorSession.set({
      docId: this.sync.docId,
      name: this.title,
      creatorId: this.sync.meta.creatorId,
      creatorName: this.sync.meta.creatorName,
      createdAt: this.sync.meta.createdAt,
      updatedAt: this.sync.meta.updatedAt,
      rows: rowKeys.length,
      rowHeights,
      blockAligns,
      supportsCanonicalLayout: this.sync.supportsCanonicalLayout,
      styleRegistry: this.sync.styleRegistry,
      blockTypographies,
      blockCustomTypography,
      defaultTypography: this.sync.defaultTypography ?? {},
      canonicalPageLayout: this.sync.pageLayout,
      layoutRules: this.sync.layoutRules,
      blocks,
      words,
      chars,
      outline,
      selection: this.deriveSelection(),
      blockPrompts,
      resolving: this.resolving,
      actions: this.actions
    });
  }

  // Contribute this surface's panel sections to the shell rails (see model/panels.ts).
  private publishSurface() {
    activeSurface.set(documentSurface(this.sync.docId, this.title));
  }

  /**
   * Commit an optimistic edit that lives in the OVERLAY rather than in the
   * ProseMirror document — alignment, indent, line spacing, the style cascade.
   *
   * These edits change nothing the differ can see, so they have to drive the
   * whole cycle by hand: repaint the decorations, push the state to the view,
   * mark the document dirty and schedule a flush, then republish the session.
   * Seven actions repeated this exact sequence; the plan's §3 called it out as
   * "one repeated optimistic-cache idiom at ~9 sites". Naming it means an
   * action states WHAT it did and this states what that always implies.
   *
   * The flush is conditional on `supportsCanonicalLayout`: without it the ops
   * would be rejected, so the edit stays a local preview and the document is
   * never marked dirty (the inspector says so — see CanonicalLayoutNotice).
   */
  commitOverlayEdit() {
    this.refreshPresentation(true);
    this.pm.pushState();
    if (this.sync.supportsCanonicalLayout) this.scheduleSave();
    this.pm.refreshSession();
  }

  // --- the ActionsHost seam (what the inspector's actions call back into) -----
  //
  // The ~25 actions live in model/actions.ts. These are the four things they
  // need from the runtime that are neither ProseMirror, server truth, nor the
  // overlay — the rest of the interface is `projectId`/`resourceId`/`title`/
  // `resolving`/`setTitle`/`commitOverlayEdit`, already declared above.

  /** The current selection, honouring a pinned gutter inspection. */
  selection(): SelectionInfo {
    return this.deriveSelection();
  }

  /** Pin (or release) the inspected target. */
  setInspection(override: InspectionOverride | null) {
    this.inspection = override;
  }

  /** Mark the document dirty without scheduling a flush (the caller flushes). */
  markDirty() {
    this.setInfo({ save: 'pending' });
  }
}

// --- the documents manager ---------------------------------------------------

// Register the document runtime factory with the resource registry so siblings
// (Quarterback, panels) can query the active document runtime without importing
// the document stage directly.
registerResourceKind('document', (projectId, resourceId, title, key) =>
  new DocumentRuntime(projectId, title, resourceId, key)
);

// Runtimes are keyed by resource id when the tab carries one, else by name
// (legacy tabs persisted before resources were id-keyed may lack an id). The
// registry handles disposal — this function is a convenience wrapper.
const keyFor = (projectId: string, title: string, resourceId?: string) =>
  `${projectId}:${resourceId ?? `name:${title}`}`;

/** Get (or create) the runtime for an open document resource. */
export function acquireDocument(projectId: string, title: string, resourceId?: string): DocumentRuntime {
  const key = keyFor(projectId, title, resourceId);
  // The registry's key uses `projectId:resourceId`. For legacy tabs without
  // a resourceId, we manage the runtime manually (the registry won't find it
  // via active() since those tabs lack a resourceId). Once all tabs carry
  // resourceIds, this branch can be removed.
  const rt = acquireRuntime('document', projectId, resourceId || key, title);
  return rt as DocumentRuntime;
}
