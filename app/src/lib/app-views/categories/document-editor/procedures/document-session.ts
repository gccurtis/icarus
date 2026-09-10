import { untrack } from "svelte";
import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import type { Mark as ProseMirrorMark } from "prosemirror-model";
import { EditorState, type Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import type { DocumentHeld } from "$app-views/categories/document-editor/content/document.state.svelte";
import {
  ANNOTATIONS,
  annotationsPlugin,
  spansOf,
  stacked,
  type Annotations,
  type PinState
} from "$app-views/categories/document-editor/procedures/annotations";
import { mergeRow, splitRow } from "$app-views/categories/document-editor/procedures/editing";
import { heldSelection } from "$app-views/categories/document-editor/procedures/highlight";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { atomAt, signalOf, worthSending } from "$app-views/categories/document-editor/procedures/inspecting";
import { editorPointerGestures } from "$app-views/categories/document-editor/procedures/links";
import { multiSelection, secondarySpans } from "$app-views/categories/document-editor/procedures/multi-selection";
import { PAGE_NUMBERS, pageNumbersOf, pageNumbersPlugin } from "$app-views/categories/document-editor/procedures/page-numbers";
import { layoutMetrics, DEFAULT_PAGE_SETUP } from "$app-views/categories/document-editor/procedures/page-setup";
import { bodyOf, docOf, repaginate, stampIds, type DocumentBody, type Metrics } from "$app-views/categories/document-editor/procedures/projection";
import { promptBlocksIn } from "$app-views/categories/document-editor/procedures/prompt-blocks";
import { restoreSelection, selectionBookmark } from "$app-views/categories/document-editor/procedures/selection-bookmark";
import { schema } from "$app-views/categories/document-editor/procedures/schema";
import { translate } from "$app-views/categories/document-editor/procedures/translate";
import type {
  DocumentRuntime,
  PendingMarks,
  WorkspaceStateModel
} from "$model/client/workspace-state";

const LAYOUT = "document-editor.layout";

const STYLE_MARK: Record<string, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikethrough: "strike",
  code: "code"
};

export type DocumentSession = {
  editor: EditorView | undefined;
  sent: DocumentBody | undefined;
  painted: DocumentBody | undefined;
  metrics: Metrics;
  appliedThreadKey: string;
};

export type DocumentSessionContext = {
  readonly view: WorkspaceStateModel;
  readonly runtime: DocumentRuntime | undefined;
  readonly held: DocumentHeld;
  readonly session: DocumentSession;
  readonly annotations: () => Annotations;
  readonly threadKey: () => string;
};

export type DocumentCommands = {
  readonly place: () => void;
  readonly paint: (body: DocumentBody) => void;
  readonly extraRanges: (state: EditorState) => readonly { readonly id: string; readonly at: string }[];
  readonly storedMarksOf: (pending: PendingMarks) => ProseMirrorMark[];
};

export const createDocumentSession = (): DocumentSession => ({
  editor: undefined,
  sent: undefined,
  painted: undefined,
  metrics: layoutMetrics(DEFAULT_PAGE_SETUP),
  appliedThreadKey: ""
});

export const createDocumentCommands = (context: DocumentSessionContext): DocumentCommands => {
  const undo = () => {
    context.runtime?.undo();
    return true;
  };
  const redo = () => {
    context.runtime?.redo();
    return true;
  };

  const plugins = [
    heldSelection(),
    multiSelection(),
    editorPointerGestures(),
    pageNumbersPlugin(() => pageNumbersOf(context.runtime?.body)),
    annotationsPlugin(() => untrack(context.annotations)),
    keymap({ Enter: splitRow, Backspace: mergeRow }),
    keymap({ "Mod-z": undo, "Shift-Mod-z": redo, "Mod-y": redo }),
    keymap(baseKeymap)
  ];

  const lay = (state: EditorState): EditorState => {
    const next = repaginate(stampIds(state.doc), context.session.metrics);
    if (next.eq(state.doc)) return state;
    const bookmark = selectionBookmark(state);
    const transform = state.tr
      .setMeta("addToHistory", false)
      .setMeta(LAYOUT, true)
      .replaceWith(0, state.doc.content.size, next.content);
    return restoreSelection(state.apply(transform), bookmark);
  };

  const emit = (state: EditorState): void => {
    const sent = context.session.sent;
    const runtime = context.runtime;
    if (sent === undefined || runtime === undefined) return;
    const body = bodyOf(state.doc, sent);
    const ops = translate(sent, body);
    context.session.sent = body;
    if (ops.length === 0) return;

    try {
      runtime.apply(ops);
      context.held.editorError = undefined;
    } catch (error) {
      context.held.editorError = error instanceof Error ? error.message : String(error);
    }
  };

  const extraRanges = (state: EditorState) =>
    secondarySpans(state.selection).flatMap(([from, to]) => {
      const id = atomAt(state.doc.resolve(from));
      const at = atomAt(state.doc.resolve(to));
      return id === undefined || at === undefined ? [] : [{ id, at }];
    });

  const signal = (state: EditorState): void => {
    const found = signalOf(state, extraRanges(state));
    if (found === undefined || !worthSending(found, context.view.inspected, context.view.selection)) return;
    context.view.inspect(found.key, found.selection);
  };

  const place = (): void => {
    const frame = context.held.pageFrame;
    const editor = context.session.editor;
    if (editor === undefined || frame === undefined) return;

    const held = ANNOTATIONS.getState(editor.state);
    const origin = frame.getBoundingClientRect();
    const placed = held === undefined
      ? []
      : spansOf(editor.state.doc, held).map((span) => {
          const state: PinState = span.current ? "current" : "open";
          return { id: span.id, top: editor.coordsAtPos(span.from).top - origin.top, state };
        });
    const promptIds = new Set(promptBlocksIn(context.runtime?.body).map((block) => block.id));
    context.held.pins = {
      comments: stacked(placed),
      prompts: Array.from(
        frame.querySelectorAll<HTMLElement>('.document-block[data-kind="prompt"][data-block]')
      ).flatMap((element) => {
        const id = element.dataset.block;
        return id === undefined || !promptIds.has(id)
          ? []
          : [{ id, top: element.getBoundingClientRect().top - origin.top }];
      })
    };
  };

  const dispatch = (transaction: Transaction): void => {
    const editor = context.session.editor;
    if (editor === undefined) return;
    const next = lay(editor.state.apply(transaction));
    editor.updateState(next);
    place();
    if (transaction.getMeta(LAYOUT) === true) return;
    signal(next);
    if (transaction.docChanged) emit(next);
  };

  const paint = (body: DocumentBody): void => {
    const host = context.held.host;
    if (host === undefined) return;
    context.session.metrics = layoutMetrics(body.pageSetup ?? DEFAULT_PAGE_SETUP);
    const editor = context.session.editor;
    const bookmark = editor === undefined ? undefined : selectionBookmark(editor.state);
    const state = restoreSelection(
      EditorState.create({ doc: docOf(body, context.session.metrics), plugins }),
      bookmark
    );
    context.session.sent = bodyOf(state.doc, body);
    if (editor === undefined) {
      context.session.editor = new EditorView(host, { state, dispatchTransaction: dispatch });
    } else {
      editor.updateState(state);
    }
    context.session.appliedThreadKey = context.threadKey();
  };

  const storedMarksOf = (pending: PendingMarks): ProseMirrorMark[] => {
    const marks: ProseMirrorMark[] = [];
    const id = mint("mark");
    for (const style of pending.style ?? []) {
      marks.push(schema.marks[STYLE_MARK[style]].create({ markId: id }));
    }
    if (pending.color !== undefined || pending.background !== undefined) {
      marks.push(schema.marks.colour.create({
        markId: mint("mark"),
        color: pending.color ?? null,
        background: pending.background ?? null
      }));
    }
    return marks;
  };

  return { place, paint, extraRanges, storedMarksOf };
};
