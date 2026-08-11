import { EditorState, type Plugin, type Selection, type Transaction } from 'prosemirror-state';
import type { Node as PmNode } from 'prosemirror-model';

/**
 * The PM STATE HOST — the live ProseMirror state and the view attached to it.
 *
 * It owns three things the rest of the runtime kept reaching for separately:
 * the `EditorState`, the `dispatch` pipeline every transaction flows through,
 * and the attached view's hooks. Holding them together is the point — the order
 * of reactions inside `dispatch` is load-bearing and now lives in exactly one
 * place, and callers that used to touch `state` + `dispatch` + `hooks` touch one
 * collaborator instead.
 *
 * It knows nothing about documents, Omega, or the inspector. The runtime half of
 * each reaction is reached only through `PmHost`, so the compiler checks the
 * boundary the same way `SyncHost` does for the sync engine.
 */

/** What an attached view provides: state pushes, doc-change notice, focus. */
export type ViewHooks = {
  onState: (state: EditorState) => void;
  onDocChanged?: () => void;
  focus?: () => void;
};

/**
 * The runtime-side seam: the reactions a transaction triggers, declared in the
 * order `dispatch` runs them. Each is a runtime concern this class cannot own.
 */
export interface PmHost {
  /** A plain selection change released a pinned gutter inspection. */
  clearInspection(): void;
  /** The document changed: recompute the presentation decorations. */
  refreshPresentation(): void;
  /** Republish the `editorSession` the shell panels render from. */
  updateSession(): void;
  /** A user edit landed: mark the document dirty and schedule a flush. */
  scheduleSave(): void;
}

export class PmStateHost {
  private editorState: EditorState;
  private hooks: ViewHooks | null = null;
  private viewAttached = false;

  constructor(
    private readonly host: PmHost,
    doc: PmNode,
    plugins: Plugin[]
  ) {
    this.editorState = EditorState.create({ doc, plugins });
  }

  // --- reading the state -----------------------------------------------------

  get state(): EditorState {
    return this.editorState;
  }

  get doc(): PmNode {
    return this.editorState.doc;
  }

  get selection(): Selection {
    return this.editorState.selection;
  }

  /** A fresh transaction off the current state (each access is a new one). */
  get tr(): Transaction {
    return this.editorState.tr;
  }

  /** Whether a view is currently attached — governs what gets published. */
  get attached(): boolean {
    return this.viewAttached;
  }

  // --- the view seam ---------------------------------------------------------

  /** A stage attached: hold its hooks and push the current state at it. */
  attach(hooks: ViewHooks) {
    this.hooks = hooks;
    this.viewAttached = true;
    this.pushState();
  }

  /**
   * The stage unmounted. Returns whether a view was actually attached, so the
   * runtime knows whether it still owns the stores it publishes to — releasing
   * them unconditionally would clear a *different* tab's session.
   */
  detach(): boolean {
    this.hooks = null;
    if (!this.viewAttached) return false;
    this.viewAttached = false;
    return true;
  }

  /** Hand the current state to the view (a no-op while detached). */
  pushState() {
    this.hooks?.onState(this.editorState);
  }

  /** Tell the view the document changed (it re-measures the gutter). */
  notifyDocChanged() {
    this.hooks?.onDocChanged?.();
  }

  /** Return focus to the editor after an inspector action. */
  focus() {
    this.hooks?.focus?.();
  }

  /** Republish the session — only meaningful while a view is attached. */
  refreshSession() {
    if (this.viewAttached) this.host.updateSession();
  }

  // --- the transaction pipeline ----------------------------------------------

  /**
   * Every ProseMirror transaction flows through here — the view's
   * `dispatchTransaction` and every runtime action alike.
   *
   * The order is load-bearing. Presentation is recomputed BEFORE the state is
   * pushed, so the decorations the view paints always match the document that
   * produced them; that call re-enters through `applySilently`, which is why it
   * must not go back through `dispatch`. The session is republished after the
   * view has the state, and the save is scheduled last so a failure earlier in
   * the chain cannot mark a document dirty that was never repainted.
   */
  dispatch = (tr: Transaction) => {
    // A transaction that set the selection on purpose (gutter click, inspector
    // focus) carries `taurus:keep-inspection`; anything else moving the caret
    // means the user navigated away from the pinned target.
    if (tr.selectionSet && !tr.getMeta('taurus:keep-inspection')) this.host.clearInspection();
    this.editorState = this.editorState.apply(tr);
    if (tr.docChanged) this.host.refreshPresentation();
    this.pushState();
    this.refreshSession();
    if (tr.docChanged) {
      this.notifyDocChanged();
      // `taurus:sync` marks a transaction the runtime made FROM server truth
      // (fixups, decorations, a restored caret). Scheduling a flush for one of
      // those would echo the server's own change back at it.
      if (!tr.getMeta('taurus:sync')) this.host.scheduleSave();
    }
  };

  /**
   * Apply a transaction without running the pipeline. Only for transactions the
   * pipeline itself produces — the presentation decorations, which are applied
   * mid-`dispatch` and would recurse forever if they re-entered it.
   */
  applySilently(tr: Transaction) {
    this.editorState = this.editorState.apply(tr);
  }

  /**
   * Rebuild the state around a new document, keeping the plugin set (and
   * therefore discarding the undo history, which is what a load/reload wants).
   */
  replaceDoc(doc: PmNode) {
    this.editorState = EditorState.create({ doc, plugins: this.editorState.plugins });
  }
}
