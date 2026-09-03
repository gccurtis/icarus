<script lang="ts">
  import { baseKeymap } from "prosemirror-commands";
  import { history, redo, undo } from "prosemirror-history";
  import { keymap } from "prosemirror-keymap";
  import { EditorState, TextSelection, type Transaction } from "prosemirror-state";
  import { EditorView } from "prosemirror-view";

  import { read } from "$capabilities/store/index.remote";
  import { mergeRow, splitRow } from "$app-views/categories/document-editor/procedures/editing";
  import {
    DEFAULT_PAGE_SETUP,
    clampZoom,
    fitZoom,
    gutterOf,
    layoutMetrics
  } from "$app-views/categories/document-editor/procedures/page-setup";
  import {
    anchorAt,
    bodyOf,
    docOf,
    positionOf,
    repaginate,
    stampIds,
    type DocumentBody,
    type Metrics
  } from "$app-views/categories/document-editor/procedures/projection";
  import { translate } from "$app-views/categories/document-editor/procedures/translate";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime, SyncState } from "$model/client/workspace-state";

  const LAYOUT = "document-editor.layout";

  const SYNC_LABEL: Record<SyncState, string> = {
    loading: "Loading",
    saved: "Saved",
    saving: "Saving",
    rebasing: "Rebasing",
    "needs-review": "Needs review",
    offline: "Offline",
    error: "Not saved"
  };

  const view = workspaceState();

  const documentId = $derived(view.active.resourceId);

  const documentTitle = $derived.by(() => {
    if (documentId === undefined) return undefined;

    const answer = read({ path: `documents.${documentId}.title` });
    if (!answer.ready) return undefined;

    const found = answer.current;
    return found?.kind === "field" && typeof found.value === "string" ? found.value : undefined;
  });

  let runtime = $state<DocumentRuntime | undefined>(undefined);
  let host = $state<HTMLDivElement>();
  let surface = $state<HTMLDivElement>();
  let available = $state(0);

  let editor: EditorView | undefined;
  let sent: DocumentBody | undefined;
  let painted: DocumentBody | undefined;
  let metrics: Metrics = layoutMetrics(DEFAULT_PAGE_SETUP);

  const plugins = [
    keymap({ Enter: splitRow, Backspace: mergeRow }),
    history(),
    keymap({ "Mod-z": undo, "Shift-Mod-z": redo, "Mod-y": redo }),
    keymap(baseKeymap)
  ];

  const lay = (state: EditorState): EditorState => {
    const next = repaginate(stampIds(state.doc), metrics);
    if (next.eq(state.doc)) return state;

    const anchor = anchorAt(state.selection.$from);
    const transform = state.tr
      .setMeta("addToHistory", false)
      .setMeta(LAYOUT, true)
      .replaceWith(0, state.doc.content.size, next.content);

    const at = anchor === undefined ? undefined : positionOf(transform.doc, anchor);
    if (at !== undefined) transform.setSelection(TextSelection.create(transform.doc, at));

    return state.apply(transform);
  };

  const emit = (state: EditorState): void => {
    if (sent === undefined || runtime === undefined) return;

    const body = bodyOf(state.doc, sent);
    const ops = translate(sent, body);
    sent = body;

    if (ops.length > 0) runtime.apply(ops);
  };

  const dispatch = (transaction: Transaction): void => {
    if (editor === undefined) return;

    const next = lay(editor.state.apply(transaction));
    editor.updateState(next);

    if (!transaction.docChanged) return;
    if (transaction.getMeta(LAYOUT) === true) return;

    emit(next);
  };

  const paint = (body: DocumentBody): void => {
    if (host === undefined) return;

    metrics = layoutMetrics(body.pageSetup ?? DEFAULT_PAGE_SETUP);

    const state = EditorState.create({ doc: docOf(body, metrics), plugins });
    sent = bodyOf(state.doc, body);

    if (editor === undefined) {
      editor = new EditorView(host, { state, dispatchTransaction: dispatch });
      return;
    }

    editor.updateState(state);
  };

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  $effect(() => {
    const body = runtime?.body;
    if (host === undefined || body === undefined || body === painted) return;

    painted = body;

    if (sent !== undefined && translate(sent, body).length === 0) {
      sent = body;
      return;
    }

    paint(body);
  });

  $effect(() => () => {
    editor?.destroy();
    editor = undefined;
  });

  $effect(() => {
    const element = surface;
    if (element === undefined) return;

    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      available = element.clientWidth / (rem > 0 ? rem : 16);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();

    return () => observer.disconnect();
  });

  const WHEEL_NOTCH = 120;
  const PERCENT_PER_NOTCH = 2;

  const setup = $derived(runtime?.body?.pageSetup ?? DEFAULT_PAGE_SETUP);

  const fit = $derived(
    available === 0 ? undefined : fitZoom(available, layoutMetrics(setup).pageWidth)
  );

  const layout = $derived(layoutMetrics(setup, view.zoom ?? fit));
  const gutter = $derived(gutterOf(available, layout.drawn.width));

  const pinch = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();

    const by = (event.deltaY / WHEEL_NOTCH) * PERCENT_PER_NOTCH;
    view.setZoom(clampZoom(layout.zoom - by));
  };

  const pageStyle = $derived(
    `zoom: ${layout.zoom / 100}; ` +
      `--page-width: ${layout.pageWidth}rem; --page-height: ${layout.pageHeight}rem; ` +
      `--margin-top: ${layout.marginPercent.top}%; --margin-right: ${layout.marginPercent.right}%; ` +
      `--margin-bottom: ${layout.marginPercent.bottom}%; --margin-left: ${layout.marginPercent.left}%`
  );
</script>

<div class="document-editor">
  <header class="title-bar bg-surface-panel border-border-subtle flex items-center gap-3 border-b">
    <h1 class="text-body-sm text-ink-primary m-0 min-w-0 flex-1 truncate font-medium">
      {documentTitle ?? "Loading document..."}
    </h1>
    {#if runtime}
      <span class="text-caption text-ink-muted shrink-0">{SYNC_LABEL[runtime.sync]}</span>
    {/if}
  </header>

  <div class="well">
    <div bind:this={surface} class="canvas bg-surface-pasteboard" onwheel={pinch}>
      <div class="pasteboard" style="--gutter: {gutter}rem">
        <div bind:this={host} class="editor" aria-label="Document editor" style={pageStyle}></div>
      </div>
    </div>
    <div class="recess" aria-hidden="true"></div>
  </div>
</div>

<style>
  .document-editor {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .title-bar {
    flex-shrink: 0;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 4);
  }

  .well {
    position: relative;
    display: flex;
    min-height: 0;
    flex: 1;
  }

  .recess {
    position: absolute;
    z-index: 1;
    inset: 0;
    box-shadow:
      inset 0 9px 10px -9px var(--token-shadow-occlusion),
      inset 10px 0 10px -10px var(--token-shadow-occlusion),
      inset -10px 0 10px -10px var(--token-shadow-occlusion);
    pointer-events: none;
  }

  .canvas {
    min-height: 0;
    flex: 1;
    overflow: auto;
    scrollbar-color: transparent transparent;
    scrollbar-width: thin;
  }

  .canvas:hover {
    scrollbar-color: color-mix(in srgb, var(--token-border-strong) 55%, transparent) transparent;
  }

  .canvas::-webkit-scrollbar {
    width: calc(var(--token-spacing-unit) * 1.5);
    height: calc(var(--token-spacing-unit) * 1.5);
  }

  .canvas::-webkit-scrollbar-thumb {
    border-radius: var(--token-radius-control);
    background-color: transparent;
    transition: background-color var(--token-motion-small) var(--token-ease-standard);
  }

  .canvas:hover::-webkit-scrollbar-thumb {
    background-color: color-mix(in srgb, var(--token-border-strong) 55%, transparent);
  }

  .canvas::-webkit-scrollbar-track {
    background: transparent;
  }

  .pasteboard {
    display: flex;
    width: max-content;
    min-width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    flex-direction: column;
    align-items: center;
    padding: calc(var(--token-spacing-unit) * 10) var(--gutter);
  }

  .editor {
    width: var(--page-width);
  }

  .editor :global(.ProseMirror) {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 8);
    outline: none;
  }

  .editor :global(.document-page) {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    height: var(--page-height);
    margin: 0;
    padding: var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left);
    border: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-elevated);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--token-ink-primary) 12%, transparent);
  }

  .editor :global(.document-row) {
    display: flex;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 4);
  }

  .editor :global(.document-block) {
    min-width: 0;
    flex-grow: 0;
    flex-shrink: 1;
    margin: 0 0 calc(var(--token-spacing-unit) * 4);
    overflow-wrap: break-word;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body);
    line-height: var(--token-text-body-leading);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .editor :global(.ProseMirror-selectednode) {
    outline: 2px solid var(--token-color-active-border);
  }
</style>
