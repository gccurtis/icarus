<script lang="ts">
  import MessageSquare from "@lucide/svelte/icons/message-square";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";

  import { createDocumentState } from "$app-views/categories/document-editor/content/document.state.svelte";
  import {
    type Annotations,
    type Pin
  } from "$app-views/categories/document-editor/procedures/annotations";
  import { anchoredOf } from "$app-views/categories/document-editor/procedures/comment-anchors";
  import {
    commentsQuery,
    threadsIn,
    threadsOf
  } from "$app-views/categories/document-editor/procedures/comments";
  import {
    createDocumentCommands,
    createDocumentSession,
    type DocumentSessionContext
  } from "$app-views/categories/document-editor/procedures/document-session";
  import { mountsDocumentSurface } from "$app-views/categories/document-editor/procedures/effects/mounts-document-surface.svelte";
  import { syncsDocumentSession } from "$app-views/categories/document-editor/procedures/effects/syncs-document-session.svelte";
  import { pageNumbersOf } from "$app-views/categories/document-editor/procedures/page-numbers";
  import {
    DEFAULT_PAGE_SETUP,
    clampZoom,
    fitZoom,
    guttersOf,
    layoutMetrics
  } from "$app-views/categories/document-editor/procedures/page-setup";
  import { promptBlocksIn } from "$app-views/categories/document-editor/procedures/prompt-blocks";
  import {
    resourceName,
    resourceIndex
  } from "$app-views/categories/document-editor/procedures/resource-index";
  import { resourceTemplate } from "$app-views/categories/document-editor/procedures/template-resources";
  import { workspaceState, type SyncState } from "$model/client/workspace-state";

  const SYNC_LABEL: Record<SyncState, string> = {
    loading: "Loading",
    saved: "Saved",
    saving: "Saving",
    rebasing: "Rebasing",
    "needs-review": "Needs review",
    offline: "Offline",
    error: "Not saved"
  };

  const WHEEL_NOTCH = 120;
  const PERCENT_PER_NOTCH = 2;

  const view = workspaceState();
  const held = createDocumentState();
  const session = createDocumentSession();
  const documentId = view.active.resourceId;
  const resources = resourceIndex();
  const template = documentId === undefined ? undefined : resourceTemplate(documentId);
  const runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);

  const documentTitle = $derived.by(() => {
    if (documentId === undefined) return undefined;
    return resourceName(resources, documentId, template?.current);
  });

  const comments = commentsQuery();
  const threads = $derived(
    documentId === undefined ? [] : threadsOf(threadsIn(comments), documentId)
  );
  const current = $derived(
    view.inspected === "document-editor.comment" ? view.selection?.id : undefined
  );
  const threadKey = $derived(
    JSON.stringify(
      threads.map((thread) => [thread._id, thread.within ?? null, thread.resolution ?? null])
    )
  );
  const annotations = $derived<Annotations>({
    anchored: runtime?.body === undefined ? [] : anchoredOf(threads, runtime.body),
    current
  });
  const hasGutterLane = $derived(
    annotations.anchored.length > 0 || promptBlocksIn(runtime?.body).length > 0
  );

  const context = {
    view,
    runtime,
    held,
    session,
    annotations: () => annotations,
    threadKey: () => threadKey
  } satisfies DocumentSessionContext;
  const commands = createDocumentCommands(context);

  syncsDocumentSession({ ...context, commands, current: () => current });
  mountsDocumentSurface({
    ...context,
    commands,
    hasGutterLane: () => hasGutterLane,
    zoom: () => view.zoom ?? undefined
  });

  const setup = $derived(runtime?.body?.pageSetup ?? DEFAULT_PAGE_SETUP);
  const fit = $derived(
    held.available === 0
      ? undefined
      : fitZoom(held.available, layoutMetrics(setup).pageWidth, hasGutterLane)
  );
  const layout = $derived(layoutMetrics(setup, view.zoom ?? fit));
  const gutters = $derived(guttersOf(held.available, layout.drawn.width, hasGutterLane));
  const pageNumbers = $derived(pageNumbersOf(runtime?.body));

  const pinch = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const by = (event.deltaY / WHEEL_NOTCH) * PERCENT_PER_NOTCH;
    view.setZoom(clampZoom(layout.zoom - by));
  };

  const openThread = (pin: Pin) => {
    const id = pin.ids.includes(current ?? "") && pin.ids.length > 1
      ? pin.ids[(pin.ids.indexOf(current ?? "") + 1) % pin.ids.length]
      : pin.ids[0];
    view.inspect("document-editor.comment", { kind: "comment", id });
  };

  const openPrompt = (id: string) => {
    if (
      view.inspected === "document-editor.prompt-block" &&
      view.selection?.kind === "prompt" &&
      view.selection.id === id
    ) return;
    view.inspect("document-editor.prompt-block", { kind: "prompt", id });
  };

  const pinTitle = (pin: Pin): string =>
    pin.count > 1
      ? `${pin.count} comment threads here`
      : pin.state === "current"
        ? "This thread is open in the inspector"
        : "Open the thread";

  const pageNumberEdge = (distance: number | undefined): string =>
    `${((distance ?? 0.4) / layout.paper.width) * 100}%`;

  const pageStyle = $derived(
    `zoom: ${layout.zoom / 100}; ` +
      `--page-number-edge: ${pageNumberEdge(pageNumbers.placement?.distanceFromEdge)}; ` +
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

  {#if held.editorError}
    <div class="editor-error" role="alert">
      <span>{held.editorError}</span>
      <button type="button" onclick={() => (held.editorError = undefined)}>Dismiss</button>
    </div>
  {/if}

  <div class="well">
    <div bind:this={held.surface} class="canvas bg-surface-pasteboard" onwheel={pinch}>
      <div
        class="pasteboard"
        style="--gutter-leading: {gutters.leading}rem; --gutter-trailing: {gutters.trailing}rem"
      >
        <div bind:this={held.pageFrame} class="page-frame" style="--page-drawn: {layout.drawn.width}rem">
          <div bind:this={held.host} class="editor" aria-label="Document editor" style={pageStyle}></div>
          {#if held.pins.comments.length > 0 || held.pins.prompts.length > 0}
            <div class="lane" aria-label="Document gutter">
              {#each held.pins.prompts as prompt (prompt.id)}
                <button
                  type="button"
                  class:current={view.inspected === "document-editor.prompt-block" && view.selection?.id === prompt.id}
                  class="prompt-pin"
                  data-prompt-block={prompt.id}
                  style="top: {prompt.top}px"
                  title="Edit Prompt Block"
                  aria-label="Edit Prompt Block"
                  onmousedown={(event) => event.stopPropagation()}
                  onclick={() => openPrompt(prompt.id)}
                >✦</button>
              {/each}
              {#each held.pins.comments as pin, index (`${pin.ids.join("|")}@${pin.top}:${index}`)}
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
    padding: calc(var(--token-spacing-unit) * 10) var(--gutter-trailing)
      calc(var(--token-spacing-unit) * 10) var(--gutter-leading);
  }

  .page-frame {
    position: relative;
    width: var(--page-drawn);
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
    left: calc(100% + 0.375rem);
    width: 1.5rem;
    pointer-events: none;
  }

  .pin,
  .prompt-pin {
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

  .pin.current,
  .prompt-pin.current {
    border-color: var(--token-color-active-border);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .prompt-pin {
    color: var(--token-color-intelligence-text);
    font-size: 0.75rem;
    line-height: 1;
  }

  .prompt-pin:hover,
  .prompt-pin:focus-visible {
    border-color: var(--token-color-intelligence-border);
    background: var(--token-color-intelligence-surface);
    outline: none;
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

  .editor :global(.document-page-number-band) {
    position: absolute;
    right: var(--margin-right);
    left: var(--margin-left);
    display: flex;
    align-items: baseline;
    color: var(--token-ink-muted);
    font-size: 12px;
    line-height: 16px;
    pointer-events: none;
    user-select: none;
  }

  .editor :global(.document-page-number-band[data-edge="top"]) {
    top: var(--page-number-edge);
  }

  .editor :global(.document-page-number-band[data-edge="bottom"]) {
    bottom: var(--page-number-edge);
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

  .editor :global(.document-formula-unbound) {
    outline: 1px dashed var(--token-border-strong);
    outline-offset: 1px;
  }

  /* A template's own hole, waiting for whoever places the template to fill it. */
  .editor :global(.document-template-atom) {
    padding: 0 0.15em;
    border-radius: var(--token-radius-control);
    background-color: var(--token-color-accent-1-surface);
    color: var(--token-color-accent-1-text);
    font-family: var(--token-font-mono);
    font-size: 0.9em;
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
