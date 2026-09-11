import { untrack } from "svelte";
import { TextSelection } from "prosemirror-state";

import { ANNOTATIONS, sameAnnotations } from "$app-views/categories/document-editor/procedures/annotations";
import type {
  DocumentCommands,
  DocumentSessionContext
} from "$app-views/categories/document-editor/procedures/document-session";
import {
  positionOfAddress,
  sameSelection,
  signalOf
} from "$app-views/categories/document-editor/procedures/inspecting";
import { MultiSelection } from "$app-views/categories/document-editor/procedures/multi-selection";
import {
  PAGE_NUMBERS,
  pageNumbersOf,
  samePageNumbers
} from "$app-views/categories/document-editor/procedures/page-numbers";
import { translate } from "$app-views/categories/document-editor/procedures/translate";

export type DocumentSyncContext = DocumentSessionContext & {
  readonly commands: DocumentCommands;
  readonly current: () => string | undefined;
};

/** Keeps the editor projection synchronized with its exact live document runtime. */
export const syncsDocumentSession = (context: DocumentSyncContext): void => {
  $effect(() => {
    const body = context.runtime?.body;
    if (context.held.host === undefined || body === undefined || body === context.session.painted) return;
    context.session.painted = body;

    const sent = context.session.sent;
    const projectionSettingsChanged =
      sent !== undefined &&
      (JSON.stringify(sent.pageSetup ?? null) !== JSON.stringify(body.pageSetup ?? null) ||
        JSON.stringify(sent.styles ?? null) !== JSON.stringify(body.styles ?? null));

    if (sent !== undefined && translate(sent, body).length === 0 && !projectionSettingsChanged) {
      context.session.sent = body;
      return;
    }
    context.commands.paint(body);
  });

  $effect(() => {
    const spec = pageNumbersOf(context.runtime?.body);
    const editor = context.session.editor;
    if (editor === undefined || samePageNumbers(PAGE_NUMBERS.getState(editor.state), spec)) return;
    editor.dispatch(
      editor.state.tr.setMeta(PAGE_NUMBERS, spec).setMeta("addToHistory", false).setMeta("document-editor.layout", true)
    );
  });

  $effect(() => {
    const source = context.threadKey();
    const selected = context.current();
    const body = context.runtime?.body;
    const editor = context.session.editor;
    if (editor === undefined || body === undefined) return;

    const held = ANNOTATIONS.getState(editor.state);
    const next = source !== context.session.appliedThreadKey
      ? { anchored: context.annotations().anchored, current: selected }
      : { anchored: held?.anchored ?? [], current: selected };
    context.session.appliedThreadKey = source;
    if (sameAnnotations(ANNOTATIONS.getState(editor.state), next)) return;
    editor.dispatch(
      editor.state.tr.setMeta(ANNOTATIONS, next).setMeta("addToHistory", false).setMeta("document-editor.layout", true)
    );
  });

  $effect(() => {
    const pending = context.runtime?.pendingMarks;
    const editor = context.session.editor;
    if (pending === undefined || editor === undefined || context.runtime === undefined) return;
    editor.dispatch(
      editor.state.tr.setStoredMarks(context.commands.storedMarksOf(pending)).setMeta("addToHistory", false)
    );
    editor.focus();
    context.runtime.pendingMarks = undefined;
  });

  $effect(() => {
    const held = context.view.selection;
    const key = context.view.inspected;
    const body = untrack(() => context.runtime?.body);
    const editor = context.session.editor;
    if (editor === undefined || held === undefined || body === undefined) return;
    if (typeof key !== "string" || !key.startsWith("document-editor.")) return;
    if (held.kind !== "text-selection" && held.kind !== "next-letter" && held.kind !== "empty-line") return;

    const mine = signalOf(editor.state, context.commands.extraRanges(editor.state));
    if (mine !== undefined && sameSelection(mine.selection, held)) return;
    const from = positionOfAddress(editor.state.doc, body, held.id);
    const to = held.at === undefined ? from : positionOfAddress(editor.state.doc, body, held.at);
    if (from === undefined) return;
    const extra = (held.ranges ?? []).flatMap((range) => {
      const start = positionOfAddress(editor.state.doc, body, range.id);
      const end = positionOfAddress(editor.state.doc, body, range.at);
      return start === undefined || end === undefined ? [] : [[start, end] as const];
    });
    const nextSelection = extra.length === 0
      ? TextSelection.create(editor.state.doc, from, to ?? from)
      : MultiSelection.create(editor.state.doc, [[from, to ?? from], ...extra], from, to ?? from);
    editor.dispatch(
      editor.state.tr.setSelection(nextSelection).setMeta("addToHistory", false).scrollIntoView()
    );
    editor.focus();
  });

  $effect(() => {
    const target = context.runtime?.scrollTo;
    if (target === undefined || context.held.host === undefined || context.runtime === undefined) return;
    context.held.host.querySelector(`[data-block="${target}"]`)?.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    if (context.view.selection?.kind === "text-selection") {
      context.session.editor?.focus();
    }
    context.runtime.scrollTo = undefined;
  });
};
