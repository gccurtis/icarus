<script lang="ts">
  import { untrack } from "svelte";
  import { baseKeymap } from "prosemirror-commands";
  import { keymap } from "prosemirror-keymap";
  import { EditorState, TextSelection, type Transaction } from "prosemirror-state";
  import { EditorView } from "prosemirror-view";

  import MessageSquare from "@lucide/svelte/icons/message-square";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";

  import {
    ANNOTATIONS,
    annotationsPlugin,
    sameAnnotations,
    spansOf,
    stacked,
    type Annotations,
    type Pin,
    type PinState
  } from "$app-views/categories/document-editor/procedures/annotations";
  import {
    anchoredOf,
    threadsOf
  } from "$app-views/categories/document-editor/procedures/comments";
  import { mergeRow, splitRow } from "$app-views/categories/document-editor/procedures/editing";
  import {
    FURNITURE,
    furnitureOf,
    furniturePlugin,
    sameFurniture
  } from "$app-views/categories/document-editor/procedures/furniture";
  import { heldSelection } from "$app-views/categories/document-editor/procedures/highlight";
  import { mint } from "$app-views/categories/document-editor/procedures/ids";
  import { editorPointerGestures } from "$app-views/categories/document-editor/procedures/links";
  import {
    multiSelection,
    secondarySpans
  } from "$app-views/categories/document-editor/procedures/multi-selection";
  import {
    restoreSelection,
    selectionBookmark
  } from "$app-views/categories/document-editor/procedures/selection-bookmark";
  import {
    atomAt,
    positionOfAddress,
    signalOf,
    worthSending
  } from "$app-views/categories/document-editor/procedures/inspecting";
  import {
    DEFAULT_PAGE_SETUP,
    clampZoom,
    fitZoom,
    guttersOf,
    layoutMetrics
  } from "$app-views/categories/document-editor/procedures/page-setup";
  import {
    bodyOf,
    docOf,
    repaginate,
    stampIds,
    type DocumentBody,
    type Metrics
  } from "$app-views/categories/document-editor/procedures/projection";
  import { schema } from "$app-views/categories/document-editor/procedures/schema";
  import { translate } from "$app-views/categories/document-editor/procedures/translate";
  import { rowsOf, tableQuery } from "$app-views/categories/document-editor/procedures/store";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime, PendingMarks, SyncState } from "$model/client/workspace-state";

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

  const STYLE_MARK: Record<string, string> = {
    bold: "bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "strike",
    code: "code"
  };

  const view = workspaceState();

  const documentId = $derived(view.active.resourceId);
  const documentsQuery = tableQuery("documents");

  const documentTitle = $derived.by(() => {
    if (documentId === undefined) return undefined;
    return rowsOf(documentsQuery, "documents").find((document) => document._id === documentId)?.title;
  });

  let runtime = $state<DocumentRuntime | undefined>(undefined);
  let host = $state<HTMLDivElement>();
  let surface = $state<HTMLDivElement>();
  let pasteboard = $state<HTMLDivElement>();
  let available = $state(0);
  let pins = $state<Pin[]>([]);
  let appliedThreadKey = "";

  const threadsQuery = tableQuery("commentThreads");

  const threads = $derived(
    documentId === undefined ? [] : threadsOf(rowsOf(threadsQuery, "commentThreads"), documentId)
  );
  const current = $derived(view.inspected === "general.comment" ? view.selection?.id : undefined);
  const threadKey = $derived(
    JSON.stringify(
      threads.map((thread) => [thread._id, thread.within ?? null, thread.resolution ?? null])
    )
  );
  const annotations = $derived<Annotations>({
    anchored: runtime?.body === undefined ? [] : anchoredOf(threads, runtime.body),
    current
  });

  let editor: EditorView | undefined;
  let sent: DocumentBody | undefined;
  let painted: DocumentBody | undefined;
  let metrics: Metrics = layoutMetrics(DEFAULT_PAGE_SETUP);
  let editorError = $state<string | undefined>(undefined);

  const undo = () => {
    runtime?.undo();
    return true;
  };

  const redo = () => {
    runtime?.redo();
    return true;
  };

  const plugins = [
    heldSelection(),
    multiSelection(),
    editorPointerGestures(),
    furniturePlugin(() => furnitureOf(runtime?.body)),
    annotationsPlugin(() => untrack(() => annotations)),
    keymap({ Enter: splitRow, Backspace: mergeRow }),
    keymap({ "Mod-z": undo, "Shift-Mod-z": redo, "Mod-y": redo }),
    keymap(baseKeymap)
  ];

  const lay = (state: EditorState): EditorState => {
    const next = repaginate(stampIds(state.doc), metrics);
    if (next.eq(state.doc)) return state;

    const bookmark = selectionBookmark(state);
    const transform = state.tr
      .setMeta("addToHistory", false)
      .setMeta(LAYOUT, true)
      .replaceWith(0, state.doc.content.size, next.content);

    return restoreSelection(state.apply(transform), bookmark);
  };

  const emit = (state: EditorState): void => {
    if (sent === undefined || runtime === undefined) return;

    const body = bodyOf(state.doc, sent);
    const ops = translate(sent, body);
    sent = body;

    if (ops.length === 0) return;

    try {
      runtime.apply(ops);
      editorError = undefined;
    } catch (error) {
      editorError = error instanceof Error ? error.message : String(error);
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
    if (found === undefined) return;
    if (!worthSending(found, view.inspected, view.selection)) return;

    view.inspect(found.key, found.selection);
  };

  const place = (): void => {
    const board = pasteboard;
    if (editor === undefined || board === undefined) return;

    const held = ANNOTATIONS.getState(editor.state);
    if (held === undefined) {
      pins = [];
      return;
    }

    const origin = board.getBoundingClientRect();
    const placed = spansOf(editor.state.doc, held).map((span) => {
      const state: PinState = span.current ? "current" : "open";
      return { id: span.id, top: editor!.coordsAtPos(span.from).top - origin.top, state };
    });

    pins = stacked(placed);
  };

  const dispatch = (transaction: Transaction): void => {
    if (editor === undefined) return;

    const next = lay(editor.state.apply(transaction));
    editor.updateState(next);
    place();

    if (transaction.getMeta(LAYOUT) === true) return;

    signal(next);

    if (transaction.docChanged) emit(next);
  };

  const paint = (body: DocumentBody): void => {
    if (host === undefined) return;

    metrics = layoutMetrics(body.pageSetup ?? DEFAULT_PAGE_SETUP);

    const bookmark = editor === undefined ? undefined : selectionBookmark(editor.state);
    const state = restoreSelection(
      EditorState.create({ doc: docOf(body, metrics), plugins }),
      bookmark
    );
    sent = bodyOf(state.doc, body);

    if (editor === undefined) {
      editor = new EditorView(host, { state, dispatchTransaction: dispatch });
      appliedThreadKey = threadKey;
      return;
    }

    editor.updateState(state);
    appliedThreadKey = threadKey;
  };

  const storedMarksOf = (pending: PendingMarks) => {
    const marks = [];
    const id = mint("mark");

    for (const style of pending.style ?? []) {
      marks.push(schema.marks[STYLE_MARK[style]].create({ markId: id }));
    }
    if (pending.color !== undefined || pending.background !== undefined) {
      marks.push(
        schema.marks.colour.create({
          markId: mint("mark"),
          color: pending.color ?? null,
          background: pending.background ?? null
        })
      );
    }

    return marks;
  };

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  $effect(() => {
    const body = runtime?.body;
    if (host === undefined || body === undefined || body === painted) return;

    painted = body;

    const projectionSettingsChanged =
      sent !== undefined &&
      (JSON.stringify(sent.pageSetup ?? null) !== JSON.stringify(body.pageSetup ?? null) ||
        JSON.stringify(sent.styles ?? null) !== JSON.stringify(body.styles ?? null));

    if (sent !== undefined && translate(sent, body).length === 0 && !projectionSettingsChanged) {
      sent = body;
      return;
    }

    paint(body);
  });

  $effect(() => {
    const spec = furnitureOf(runtime?.body);
    if (editor === undefined) return;
    if (sameFurniture(FURNITURE.getState(editor.state), spec)) return;

    editor.dispatch(
      editor.state.tr.setMeta(FURNITURE, spec).setMeta("addToHistory", false).setMeta(LAYOUT, true)
    );
  });

  $effect(() => {
    const source = threadKey;
    const selected = current;
    const body = runtime?.body;
    if (editor === undefined || body === undefined) return;

    const held = ANNOTATIONS.getState(editor.state);
    const next = source !== appliedThreadKey
      ? { anchored: anchoredOf(threads, body), current: selected }
      : { anchored: held?.anchored ?? [], current: selected };
    appliedThreadKey = source;
    if (sameAnnotations(ANNOTATIONS.getState(editor.state), next)) return;

    editor.dispatch(
      editor.state.tr.setMeta(ANNOTATIONS, next).setMeta("addToHistory", false).setMeta(LAYOUT, true)
    );
  });

  $effect(() => {
    void view.zoom;
    void available;
    void runtime?.body;
    const frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    const pending = runtime?.pendingMarks;
    if (pending === undefined || editor === undefined || runtime === undefined) return;

    editor.dispatch(
      editor.state.tr.setStoredMarks(storedMarksOf(pending)).setMeta("addToHistory", false)
    );
    editor.focus();
    runtime.pendingMarks = undefined;
  });

  $effect(() => {
    const held = view.selection;
    const key = view.inspected;
    const body = untrack(() => runtime?.body);
    if (editor === undefined || held === undefined || body === undefined) return;
    if (typeof key !== "string" || !key.startsWith("document-editor.")) return;
    if (held.kind !== "text-selection" && held.kind !== "next-letter" && held.kind !== "empty-line") return;

    const mine = signalOf(editor.state);
    if (
      mine !== undefined &&
      mine.selection.id === held.id &&
      (mine.selection.at ?? mine.selection.id) === (held.at ?? held.id)
    ) {
      return;
    }

    const from = positionOfAddress(editor.state.doc, body, held.id);
    const to = held.at === undefined ? from : positionOfAddress(editor.state.doc, body, held.at);
    if (from === undefined) return;

    editor.dispatch(
      editor.state.tr
        .setSelection(TextSelection.create(editor.state.doc, from, to ?? from))
        .setMeta("addToHistory", false)
        .scrollIntoView()
    );
    editor.focus();
  });

  $effect(() => {
    const target = runtime?.scrollTo;
    if (target === undefined || host === undefined || runtime === undefined) return;

    const element = host.querySelector(`[data-block="${target}"]`);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    runtime.scrollTo = undefined;
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
  const gutters = $derived(guttersOf(available, layout.drawn.width));

  $effect(() => {
    const element = surface;
    if (element === undefined) return;

    const beside = (event: MouseEvent) => {
      const target = event.target;
      if (host !== undefined && target instanceof Node && host.contains(target)) return;

      view.clear();
    };

    element.addEventListener("mousedown", beside);
    return () => element.removeEventListener("mousedown", beside);
  });

  const pinch = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();

    const by = (event.deltaY / WHEEL_NOTCH) * PERCENT_PER_NOTCH;
    view.setZoom(clampZoom(layout.zoom - by));
  };

  const furnitureEdge = (distance: number | undefined): string =>
    `${((distance ?? 0.4) / layout.paper.width) * 100}%`;

  const openThread = (pin: Pin) => {
    const id = pin.ids.includes(current ?? "") && pin.ids.length > 1
      ? pin.ids[(pin.ids.indexOf(current ?? "") + 1) % pin.ids.length]
      : pin.ids[0];
    view.inspect("general.comment", { kind: "comment", id });
  };

  const pinTitle = (pin: Pin): string =>
    pin.count > 1 ? `${pin.count} comment threads here` : pin.state === "current" ? "This thread is open in the inspector" : "Open the thread";

  const pageStyle = $derived(
    `zoom: ${layout.zoom / 100}; ` +
      `--furniture-top: ${furnitureEdge(runtime?.body?.header?.distanceFromEdge)}; ` +
      `--furniture-bottom: ${furnitureEdge(runtime?.body?.footer?.distanceFromEdge)}; ` +
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

  {#if editorError}
    <div class="editor-error" role="alert">
      <span>{editorError}</span>
      <button type="button" onclick={() => (editorError = undefined)}>Dismiss</button>
    </div>
  {/if}

  <div class="well">
    <div bind:this={surface} class="canvas bg-surface-pasteboard" onwheel={pinch}>
      <div
        bind:this={pasteboard}
        class="pasteboard"
        style="--gutter-leading: {gutters.leading}rem; --gutter-trailing: {gutters.trailing}rem"
      >
        <div bind:this={host} class="editor" aria-label="Document editor" style={pageStyle}></div>
        {#if pins.length > 0}
          <div class="lane" style="--page-drawn: {layout.drawn.width}rem" aria-label="Comment threads">
            {#each pins as pin, index (`${pin.ids.join("|")}@${pin.top}:${index}`)}
              <button
                type="button"
                class="pin {pin.state}"
                data-threads={pin.ids.join(" ")}
                style="top: {pin.top}px"
                title={pinTitle(pin)}
                onclick={() => openThread(pin)}
              >
                {#if pin.count > 1}
                  <MessagesSquare size={14} aria-hidden="true" />
                  <span class="count">{pin.count}</span>
                {:else}
                  <MessageSquare size={14} aria-hidden="true" />
                {/if}
              </button>
            {/each}
          </div>
        {/if}
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
    position: relative;
    display: flex;
    width: max-content;
    min-width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    flex-direction: column;
    align-items: center;
    padding: calc(var(--token-spacing-unit) * 10) var(--gutter-trailing)
      calc(var(--token-spacing-unit) * 10) var(--gutter-leading);
  }

  .editor {
    width: var(--page-width);
  }

  .editor :global(.ProseMirror) {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 8);
    outline: none;
    white-space: pre-wrap;
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

  .lane {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--gutter-leading) + var(--page-drawn) + 0.375rem);
    width: 1.5rem;
    pointer-events: none;
  }

  .pin {
    position: absolute;
    left: 0;
    display: flex;
    width: 1.5rem;
    height: 1.5rem;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--token-border-subtle);
    border-radius: 999px;
    background: var(--token-surface-elevated);
    color: var(--token-ink-muted);
    cursor: pointer;
    pointer-events: auto;
    transform: translateY(-0.25rem);
  }

  .pin:hover {
    color: var(--token-ink-primary);
    border-color: var(--token-border-strong);
  }

  .pin.current {
    border-color: var(--token-color-active-border);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .pin.stack {
    color: var(--token-ink-secondary);
  }

  .pin .count {
    position: absolute;
    right: -0.25rem;
    bottom: -0.25rem;
    min-width: 0.875rem;
    padding: 0 0.2rem;
    border-radius: 999px;
    background: var(--token-ink-secondary);
    color: var(--token-surface-elevated);
    font-size: 9px;
    line-height: 0.875rem;
    text-align: center;
  }

  .editor :global(.comment-anchor) {
    background: color-mix(in srgb, var(--token-color-attention-fill) 18%, transparent);
    box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--token-color-attention-fill) 55%, transparent);
  }

  .editor :global(.comment-current) {
    background: color-mix(in srgb, var(--token-color-attention-fill) 34%, transparent);
  }

  .editor :global(.comment-collapsed) {
    display: inline-block;
    width: 0;
    height: 1em;
    border-inline-start: 2px solid var(--token-color-attention-fill);
    vertical-align: text-bottom;
  }

  .editor :global(.document-furniture) {
    position: absolute;
    right: var(--margin-right);
    left: var(--margin-left);
    display: flex;
    align-items: baseline;
    gap: calc(var(--token-spacing-unit) * 3);
    color: var(--token-ink-muted);
    font-size: 12px;
    line-height: 16px;
    white-space: pre-wrap;
    pointer-events: none;
    user-select: none;
  }

  .editor :global(.document-furniture-editable) {
    z-index: 2;
    min-height: 1.25rem;
    pointer-events: auto;
    user-select: text;
  }

  .editor :global(.document-furniture-editable:focus-within) {
    box-shadow: 0 1px 0 var(--token-color-active-border);
  }

  .editor :global(.document-furniture-editable .document-row) {
    min-width: 0;
    flex: 1;
  }

  .editor :global(.document-furniture-editable .document-block) {
    min-height: 1rem;
    flex: 1;
  }

  .editor :global(.document-header) {
    top: var(--furniture-top);
  }

  .editor :global(.document-footer) {
    bottom: var(--furniture-bottom);
  }

  .editor :global(.document-furniture-text) {
    min-width: 0;
    flex: 1;
  }

  .editor :global(.document-page-number) {
    font-variant-numeric: tabular-nums;
  }

  .editor :global(.document-page-number[data-position="start"]) {
    order: -1;
  }

  .editor :global(.document-page-number[data-position="center"]) {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .editor :global(.document-page-number[data-position="end"]) {
    margin-inline-start: auto;
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
    margin: 0;
    overflow-wrap: break-word;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body);
    line-height: var(--token-text-body-leading);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .editor :global(.document-heading) {
    color: var(--token-ink-primary);
  }

  .editor :global(.document-code) {
    border-radius: var(--token-radius-control);
    background-color: var(--token-surface-panel);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .editor :global(.document-list) {
    display: list-item;
    margin-left: calc(var(--token-spacing-unit) * 5);
  }

  .editor :global(.document-list[data-list="ordered"]) {
    list-style-type: decimal;
  }

  .editor :global(.document-list[data-list="bullet"]) {
    list-style-type: disc;
  }

  .editor :global(.document-list[data-list="todo"]) {
    list-style-type: square;
  }

  .editor :global(.document-image),
  .editor :global(.document-table),
  .editor :global(.document-formula-block) {
    display: flex;
    min-height: calc(var(--token-spacing-unit) * 16);
    align-items: center;
    justify-content: center;
    margin: 0 0 calc(var(--token-spacing-unit) * 4);
    border: 1px dashed var(--token-border-strong);
    border-radius: var(--token-radius-control);
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  .editor :global(.document-divider) {
    width: 100%;
    margin: calc(var(--token-spacing-unit) * 4) 0;
    border: 0;
    border-top: 1px solid var(--token-border-strong);
  }

  .editor :global(.document-page-break) {
    display: flex;
    justify-content: center;
    margin: calc(var(--token-spacing-unit) * 2) 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .editor :global(.document-page-break::before),
  .editor :global(.document-page-break::after) {
    flex: 1;
    align-self: center;
    border-top: 1px dashed var(--token-border-subtle);
    content: "";
    margin: 0 calc(var(--token-spacing-unit) * 3);
  }

  .editor :global(.document-formula) {
    border-radius: 2px;
    background-color: var(--token-color-active-surface);
    color: var(--token-color-active-text);
    padding: 0 2px;
  }

  .editor :global(.document-formula-stale),
  .editor :global(.document-formula-computing) {
    opacity: 0.7;
  }

  .editor :global(.document-formula-error) {
    background-color: var(--token-color-danger-surface);
    color: var(--token-color-danger-text);
  }

  .editor :global(.document-underline) {
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  .editor :global(.document-strike) {
    text-decoration: line-through;
  }

  .editor :global(.document-code) {
    font-family: var(--token-font-mono);
  }

  .editor :global(code.document-mark) {
    border-radius: 2px;
    background-color: var(--token-surface-panel);
    font-family: var(--token-font-mono);
    font-size: 0.92em;
    padding: 0 0.2em;
  }

  .editor :global(.document-image.ProseMirror-selectednode),
  .editor :global(.document-table.ProseMirror-selectednode),
  .editor :global(.document-formula-block.ProseMirror-selectednode) {
    outline: 2px solid var(--token-color-active-border);
  }

  .editor :global(.held-selection),
  .editor :global(.multi-range) {
    background-color: var(--token-surface-selection);
  }

  .editor-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 3);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 4);
    border-bottom: 1px solid var(--token-color-danger-border);
    background: var(--token-color-danger-surface);
    color: var(--token-color-danger-text);
    font-size: var(--token-text-caption);
  }

  .editor-error button {
    min-height: 24px;
    text-decoration: underline;
  }
</style>
