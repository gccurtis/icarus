import type { Node as PmNode } from 'prosemirror-model';
import { isApiError } from '$data/api';
import { withProject } from '$data/project-retry';
import {
  appendChanges,
  createDocument,
  defaultLayoutRules,
  defaultPageLayout,
  getDocument,
  listDocuments,
  type CustomTypography,
  type Doc,
  type LayoutRules,
  type PageLayout,
  type PromptData,
  type Row,
  type StyleRegistry
} from '$data/documents';
import { diffDoc } from '../editor/bridge';
import { findBlock, type OptimisticOverlay } from './overlay';

/**
 * The SYNC ENGINE — server truth and the change pipeline.
 *
 * It owns everything Omega is authoritative about (the document id, revision,
 * row snapshot, metadata, layout, style registry) and the whole loop that keeps
 * that in step with the editor: debounced flush, conflict reload, retry.
 *
 * The ProseMirror side is reached only through `SyncHost`. That boundary is the
 * point: the engine never touches an `EditorState`, and the runtime never
 * hand-rolls a change request.
 */

/** Where the caret was, so a reload can put it back. */
export type CaretAnchor = { blockId: string | null; offset: number };

/** Load/save status the view chrome renders. */
export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

/** The editor-side seam the engine calls back into. */
export interface SyncHost {
  /** The live document, to diff against the snapshot. */
  doc(): PmNode;
  /** Rebuild the editor from a full Omega document (load / reload). */
  replaceState(full: Doc): void;
  /** Stamp server ids onto nodes ProseMirror created (Enter, paste). */
  applyFixups(fixups: Map<number, { blockId: string; rowId: string }>): void;
  captureSelection(): CaretAnchor | null;
  restoreSelection(anchor: CaretAnchor | null): void;
  /** Update the view chrome's status. */
  setInfo(patch: {
    status?: 'loading' | 'ready' | 'error';
    errMsg?: string;
    save?: SaveState;
    updatedAt?: string;
  }): void;
  /** True when the document is dirty (used to settle a no-op flush). */
  savePending(): boolean;
  /** Server truth moved: repaint decorations, push state, republish the session. */
  refreshView(): void;
  /** A load finished: publish the session and the surface contribution. */
  onLoaded(): void;
}

export class SyncEngine {
  // --- server truth ----------------------------------------------------------
  docId = '';
  revision = 0;
  snapshot: Row[] = [];
  meta = { createdAt: '', updatedAt: '', creatorId: '', creatorName: '' };
  pageLayout: PageLayout = { ...defaultPageLayout };
  layoutRules: LayoutRules = { ...defaultLayoutRules };
  styleRegistry: StyleRegistry = { definitions: [], defaults: [] };
  /** Document-wide default typography (lowest cascade level). */
  defaultTypography: CustomTypography | null = null;
  /** Whether layout ops persist; when false they stay a local preview. */
  supportsCanonicalLayout = false;

  // --- pipeline bookkeeping --------------------------------------------------
  private loading = false;
  private inflight = false;
  private queued = false;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly host: SyncHost,
    private readonly overlay: OptimisticOverlay,
    private readonly projectId: string,
    private readonly resourceId: string
  ) {}

  /** Fetch the document (by id, else by name), seed truth, and go ready. */
  async load(title: string) {
    if (this.loading) return;
    this.loading = true;
    this.host.setInfo({ status: 'loading', errMsg: '' });
    try {
      // Documents are scoped to the session's selected project; `withProject`
      // recovers from a stale session cell (409) by selecting this project and
      // retrying once.
      let full: Doc;
      if (this.resourceId) {
        // Real resource: the tab carries the canonical Omega document id, so load
        // it directly — the binding is by id, not by name.
        full = await withProject(this.projectId, () => getDocument(this.resourceId));
      } else {
        // Legacy tab with no resource id: fall back to the name-keyed binding —
        // match an Omega document by name, creating one if none exists.
        const docs = await withProject(this.projectId, () => listDocuments());
        const found = docs.find((d) => d.name === title);
        full = found
          ? await getDocument(found.id)
          : await createDocument(title, [
              { blocks: [{ kind: 'text', atoms: [{ kind: 'text', text: '' }] }] }
            ]);
      }
      this.adopt(full);
      this.overlay.clear();
      this.host.replaceState(full);
      this.host.setInfo({ status: 'ready', updatedAt: full.updatedAt });
      this.host.onLoaded();
    } catch (e) {
      this.host.setInfo({
        status: 'error',
        errMsg: isApiError(e) ? e.message : 'Could not load the document.'
      });
    } finally {
      this.loading = false;
    }
  }

  /** Take a full document as the new server truth (without touching the editor). */
  private adopt(full: Doc) {
    this.docId = full.id;
    this.revision = full.revision;
    this.snapshot = full.base.rows;
    this.meta = {
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
      creatorId: full.creatorId,
      creatorName: full.creatorName
    };
    this.pageLayout = { ...full.base.pageLayout };
    this.layoutRules = { ...full.base.layoutRules };
    this.supportsCanonicalLayout = full.clientCapabilities.canonicalLayout;
    this.styleRegistry = full.base.styleRegistry;
    this.defaultTypography = full.base.defaultTypography ?? null;
  }

  scheduleFlush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), 700);
  }

  /** Flush immediately (tab hide, teardown, before a resolve). */
  flushNow() {
    clearTimeout(this.flushTimer);
    return this.flush();
  }

  async flush() {
    if (!this.docId) return;
    if (this.inflight) {
      this.queued = true;
      return;
    }
    // ORDER IS LOAD-BEARING: inspector-queued "extra" ops (set_prompt, the style
    // ops, alignment/indent) are sent AHEAD of the differ's ops. A style
    // definition must exist before the op that references it, and a block op must
    // land before content edits that could re-key the block. `pendingOps()` hands
    // back a COPY so an action firing while this append is in flight cannot be
    // stripped by the reference-equality cleanup in `settle`. (Catalog B3.)
    const extras = this.overlay.pendingOps();
    const { ops: diffOps, nextRows, fixups } = diffDoc(this.snapshot, this.host.doc());
    if (fixups.size > 0) this.host.applyFixups(fixups);
    const ops = [...extras, ...diffOps];
    if (ops.length === 0) {
      if (this.host.savePending()) this.host.setInfo({ save: 'saved' });
      return;
    }
    this.inflight = true;
    this.host.setInfo({ save: 'saving' });
    try {
      // `withProject` matters here, and its absence was a real bug. Omega's
      // requireProject gate answers **409 with the same status as a revision
      // conflict** when the session's project cell is unset — and it answers
      // before the handler runs, so no ops were applied. Without this wrapper the
      // catch below read that as "the server document moved", discarded the
      // queued extras and reloaded: unsaved edits thrown away and the user's
      // selection collapsed, for a condition that is fully recoverable by
      // selecting the project and retrying. Every other project-scoped call
      // already went through this; the write path was the one that did not.
      const changeSet = await withProject(this.projectId, () =>
        appendChanges(this.docId, this.revision, ops)
      );
      // Fold the extras' effects into the predicted snapshot (set_prompt touches
      // block data, which the differ doesn't model).
      for (const op of extras) {
        if (op.op === 'set_prompt' && op.blockId) {
          const b = findBlock(nextRows, op.blockId);
          if (b)
            b.data = {
              ...(b.data as PromptData | undefined),
              instruction: op.setText ?? '',
              resolvedAt: undefined
            };
        } else if (op.op === 'set_page_layout' && op.pageLayout) {
          this.pageLayout = { ...op.pageLayout };
        }
        // set_block_line_height needs no folding: line height is a per-block
        // property, while the local row decorations are driven by the overlay's
        // row heights — the server truth lands on the next reload.
      }
      this.overlay.settle(extras);
      // The differ carries each block's PREVIOUS style forward (`{ ...previousBlock }`),
      // so the overlay's block styles must be folded in explicitly or the new
      // snapshot would silently revert an optimistic alignment/indent. This is the
      // step that used to happen by accident, via mutating the snapshot in place.
      this.snapshot = this.overlay.applyTo(nextRows);
      this.revision = changeSet.seq;
      this.host.refreshView();
      this.meta = { ...this.meta, updatedAt: changeSet.createdAt };
      this.host.setInfo({ save: 'saved', updatedAt: changeSet.createdAt });
    } catch (e) {
      if (isApiError(e) && e.status === 409) {
        // A 409 that survived `withProject`'s select-and-retry is the real one:
        // our ops no longer match the server document. Reload truth, re-edit.
        this.overlay.settle(extras);
        await this.reload();
      } else {
        this.host.setInfo({ save: 'error' });
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => void this.flush(), 4000);
      }
    } finally {
      this.inflight = false;
      if (this.queued) {
        this.queued = false;
        void this.flush();
      }
    }
  }

  /** Rebuild from server truth, keeping the cursor in the same block when it survives. */
  async reload() {
    if (!this.docId) return;
    const anchor = this.host.captureSelection();
    // Same gate as `load` and `flush`: a reload can fire on a session whose
    // project cell has gone stale, and a bare 409 here would surface as an
    // unexplained failure rather than recovering.
    const full = await withProject(this.projectId, () => getDocument(this.docId));
    // Keep the id/creator metadata already held; adopt everything else.
    this.adopt(full);
    this.overlay.clear();
    this.host.replaceState(full);
    this.host.restoreSelection(anchor);
    this.host.setInfo({ save: 'saved', updatedAt: full.updatedAt });
  }

  /** Stop the timers and make a final best-effort flush. */
  dispose() {
    clearTimeout(this.flushTimer);
    clearTimeout(this.retryTimer);
    void this.flush();
  }
}
