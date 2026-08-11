<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { EditorView } from 'prosemirror-view';
  import 'prosemirror-view/style/prosemirror.css';
  import { ChevronDown, Download, Sparkles } from '@lucide/svelte';
  import { Badge, Button, Menu, toast } from '$lib/components';
  import { exportFormats, unbuiltFormatMessage } from '$lib/features/shared/transfer';
  import { isApiError } from '$data/api';
  import { customTypographyCss, defaultPageLayout, exportDocumentMarkdown, downloadMarkdown } from '$data/documents';
  import { documentBarCollaboration, startPresencePolling, stopPresencePolling, currentDocumentId, joinSession, leaveSession, publishPresence, refreshLastEditor } from '$systems/documents/collaboration';
  import { documentEditRelative, documentEditStamp } from '$data/time';
  import { projects } from '$data/projects';
  import { renameResource, resources } from '$data/resources';
  import { renameResourceTab, setPanel } from '$data/workspace';
  import DocumentCollaboratorAvatar from './DocumentCollaboratorAvatar.svelte';
  import { editorSession } from './editor/session';
  import { acquireDocument } from './runtime';

  let {
    projectId,
    title,
    resourceId
  }: { projectId: string; title: string; resourceId?: string } = $props();

  // The stage is a VIEW over the document's runtime: the runtime (see runtime.ts)
  // holds the EditorState and the whole sync loop and outlives this component —
  // tab switches keep content, selection, undo history, and background syncing.
  // Initial-value capture is intentional: WorkSurface keys this component by tab,
  // so an instance's props never change over its life.
  // svelte-ignore state_referenced_locally
  const runtime = acquireDocument(projectId, title, resourceId);
  const info = runtime.info;

  // Sync the current document ID into the presence store so the document
  // bar filters sessions to only users viewing this document.
  $effect(() => {
    const id = $editorSession?.docId ?? '';
    if (id) currentDocumentId.set(id);
  });
  // Debounced publish of the active document to the Omega session endpoint
  // so other clients see this user as present on this document.
  $effect(() => {
    const id = $editorSession?.docId;
    if (id) publishPresence(id);
  });
  // Refresh the "Edited … by" attribution from the newest change's author whenever
  // the document loads or a change lands ($info.updatedAt advances after each flush).
  $effect(() => {
    const id = $editorSession?.docId;
    $info.updatedAt;
    if (id) void refreshLastEditor(id);
  });
  let now = $state(Date.now());
  const resource = $derived(
    $resources.find(
      (candidate) =>
        candidate.kind === 'document' &&
        (resourceId ? candidate.id === resourceId : candidate.name === title)
    ) ?? null
  );
  const currentTitle = $derived(resource?.name ?? title);
  const currentResourceId = $derived(resourceId ?? resource?.id ?? '');
  const projectRole = $derived($projects.find((project) => project.id === projectId)?.role);
  const canRename = $derived(projectRole === 'owner' || projectRole === 'editor');

  // Export the current document (a quick editor-bar action). Import lives in the
  // "All resources" panel, not here, because it creates a NEW document.
  //
  // The menu offers every format from the shared table; only Markdown has a
  // serializer, so the rest say so rather than downloading a placeholder.
  let ioBusy = $state(false);
  async function exportDoc() {
    const id = $editorSession?.docId;
    if (!id || ioBusy) return;
    ioBusy = true;
    try {
      downloadMarkdown(currentTitle, await exportDocumentMarkdown(id));
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Export failed', { tone: 'danger' });
    } finally {
      ioBusy = false;
    }
  }
  const exportItems = $derived(
    exportFormats.map((format) => ({
      label: format.label,
      disabled: ioBusy || !$editorSession,
      onselect: () =>
        format.built
          ? void exportDoc()
          : toast(unbuiltFormatMessage(format), { tone: 'attention' })
    }))
  );
  const editedAt = $derived(
    Math.max(resource?.updatedAt ?? 0, $info.updatedAt ? Date.parse($info.updatedAt) : 0)
  );
  const editedStamp = $derived(documentEditStamp(editedAt));
  const editedRelative = $derived(documentEditRelative(editedAt, now));
  const editedIso = $derived(editedAt > 0 ? new Date(editedAt).toISOString() : undefined);
  const saveLabel = $derived(
    $info.save === 'saved'
      ? 'Saved'
      : $info.save === 'pending'
        ? 'Unsaved changes'
        : $info.save === 'saving'
          ? 'Saving…'
          : "Couldn't save — retrying"
  );
  // The paper frame: the document's canonical width and margins, rendered as ONE
  // continuous sheet that grows with content. The canonical page height serves
  // only as an aesthetic minimum so an empty document still reads as a page.
  const paperFrame = $derived.by(() => {
    const layout = $editorSession?.canonicalPageLayout ?? defaultPageLayout;
    const pointScale = 96 / 72;
    return {
      width: layout.width * pointScale,
      minHeight: layout.height * pointScale,
      marginTop: layout.marginTop * pointScale,
      marginRight: layout.marginRight * pointScale,
      marginBottom: layout.marginBottom * pointScale,
      marginLeft: layout.marginLeft * pointScale
    };
  });

  let editingTitle = $state(false);
  let titleDraft = $state('');
  let renaming = $state(false);
  let titleInput = $state<HTMLInputElement>();
  let host = $state<HTMLDivElement>();
  let scrollEl = $state<HTMLDivElement>();
  let wrapEl = $state<HTMLDivElement>();
  let paperEl = $state<HTMLDivElement>();
  let view: EditorView | null = null;
  let resizeObs: ResizeObserver | null = null;
  let relativeClock: ReturnType<typeof setInterval> | null = null;

  // Right gutter: AI/prompt indicators remain on the right, outside the paper.
  let prompts = $state<{ top: number }[]>([]);

  // Resource catalog renames flow into the long-lived runtime's panel metadata.
  $effect(() => {
    runtime.setTitle(currentTitle);
  });

  // Re-measure the gutters when the document becomes ready (state swapped in).
  $effect(() => {
    if ($info.status === 'ready') {
      requestAnimationFrame(() => {
        updateGutter();
      });
    }
  });

  // --- document name ---------------------------------------------------------

  async function beginTitleEdit() {
    if (!canRename || renaming) return;
    titleDraft = currentTitle;
    editingTitle = true;
    await tick();
    titleInput?.focus();
    titleInput?.select();
  }

  function cancelTitleEdit() {
    editingTitle = false;
    titleDraft = currentTitle;
  }

  async function commitTitle() {
    if (!editingTitle || renaming) return;
    const next = titleDraft.trim();
    if (!next || next === currentTitle) {
      cancelTitleEdit();
      return;
    }
    if (!currentResourceId || !resource) {
      cancelTitleEdit();
      toast('Document metadata is still loading. Try renaming again.', { tone: 'attention' });
      return;
    }
    renaming = true;
    try {
      await renameResource(projectId, currentResourceId, next);
      renameResourceTab(currentResourceId, next);
      editingTitle = false;
    } catch (error) {
      cancelTitleEdit();
      toast(isApiError(error) ? error.message : 'Could not rename the document.', {
        tone: 'danger'
      });
    } finally {
      renaming = false;
    }
  }

  function onTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitleEdit();
    }
  }

  function titleInputWidth(value: string) {
    return `${Math.min(Math.max(value.length + 3, 18), 52)}ch`;
  }

  // --- gutters (outside the page) -------------------------------------------

  // Measure right-side prompt indicators.
  function updateGutter() {
    if (!view || !wrapEl) {
      prompts = [];
      return;
    }
    const wrapTop = wrapEl.getBoundingClientRect().top;
    const promptList: { top: number }[] = [];
    view.state.doc.forEach((node, offset) => {
      if (node.attrs.kind === 'prompt') {
        const dom = view?.nodeDOM(offset);
        if (dom instanceof HTMLElement)
          promptList.push({ top: dom.getBoundingClientRect().top - wrapTop });
      }
    });
    prompts = promptList;
  }

  // Clicking the empty paper (below the text) focuses the editor.
  function onPaperClick(e: MouseEvent) {
    if (e.target === paperEl) view?.focus();
  }

  // Clicking into the work jumps the inspector to Details — the lens follows the
  // click (the AI Agent bar's focus is the counterpart, jumping to `ai`).
  // Section only; the panel's collapsed state is the user's.
  function onPointerDown() {
    setPanel('inspector', { section: 'details' });
  }

  // Flush immediately when the page is being hidden (tab switch, close).
  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      void runtime.flushNow();
      void leaveSession();
    } else {
      void joinSession();
    }
  }

  onMount(() => {
    startPresencePolling(projectId);
    void joinSession();
    relativeClock = setInterval(() => (now = Date.now()), 30000);
    if (host) {
      view = new EditorView(host, {
        state: runtime.state,
        dispatchTransaction: runtime.dispatch,
        // A click in a check-list item's marker zone toggles its checked state.
        handleClickOn: (v, _pos, node, nodePos, event) => {
          if (node.type.name !== 'list_item') return false;
          const list = v.state.doc.resolve(nodePos).parent;
          if (list.type.name !== 'list' || list.attrs.listType !== 'check') return false;
          if ((event as MouseEvent).clientX >= v.coordsAtPos(nodePos + 1).left) return false;
          v.dispatch(v.state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, checked: !node.attrs.checked }));
          return true;
        }
      });
      runtime.attach({
        onState: (s) => view?.updateState(s),
        onDocChanged: () => {
          requestAnimationFrame(updateGutter);
        },
        focus: () => view?.focus()
      });
    }
    resizeObs = new ResizeObserver(() => updateGutter());
    if (wrapEl) resizeObs.observe(wrapEl);
  });
  onDestroy(() => {
    void leaveSession();
    stopPresencePolling();
    currentDocumentId.set('');
    if (relativeClock) clearInterval(relativeClock);
    resizeObs?.disconnect();
    void runtime.flushNow();
    runtime.detach(); // the runtime keeps syncing; the manager disposes it when the tab closes
    view?.destroy();
    view = null;
  });
</script>

<svelte:document onvisibilitychange={onVisibility} />

<!--
  Page metaphor: the stage surround is the darker canvas; the document is a
  floating "paper" (work surface + border + shadow) with its own page margins.
  A quiet three-zone bar carries the editable name, centered relative edit/save
  metadata, and viewer hover cards. The page itself starts clean (no opinionated
  giant title). Gutters live OUTSIDE the page: block anchors on the left,
  AI/prompt indicators on the right. pb-40 clears the AI Agent dock.
-->
<div
  bind:this={scrollEl}
  class="document-scroll h-full overflow-auto bg-canvas"
>
  <!-- Thin document bar: seamless name | centered status | viewer hover cards -->
  <div class="sticky top-0 z-10 grid h-9 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-work/85 px-4 backdrop-blur">
    <div class="w-full min-w-0 max-w-[52ch] justify-self-start">
      {#if editingTitle}
        <input
          bind:this={titleInput}
          bind:value={titleDraft}
          onkeydown={onTitleKeydown}
          onblur={() => void commitTitle()}
          disabled={renaming}
          aria-label="Rename document"
          style:width={titleInputWidth(titleDraft)}
          class="dur-micro -ml-1 h-7 max-w-full border-0 border-b border-transparent bg-transparent px-1 text-body-sm font-medium text-primary outline-none transition-colors focus:border-border"
        />
      {:else}
        <button
          type="button"
          ondblclick={() => void beginTitleEdit()}
          onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault();
              void beginTitleEdit();
            }
          }}
          aria-label={`Document name: ${currentTitle}. Double-click to rename`}
          aria-disabled={!canRename}
          title={canRename ? 'Double-click to rename' : 'View-only access'}
          class="dur-micro -ml-1 block max-w-full truncate rounded-control px-1 text-left text-body-sm font-medium text-primary transition-colors hover:bg-panel/60 aria-disabled:cursor-default aria-disabled:hover:bg-transparent"
        >
          {currentTitle}
        </button>
      {/if}
    </div>
    <!-- Save state first: it is the volatile, reassurance-carrying half, so it
         reads before the slower-moving edit attribution. -->
    <div class="flex items-center gap-1.5 justify-self-center whitespace-nowrap text-caption text-muted">
      <p class="text-caption text-muted" aria-live="polite">{saveLabel}</p>
      <span aria-hidden="true">·</span>
      <p>
        Edited
        <time datetime={editedIso} title={editedStamp}>{editedRelative}</time>
        by {$documentBarCollaboration.lastEditor.name}
      </p>
    </div>
    <div class="flex items-center gap-2 justify-self-end">
      <Menu
        items={exportItems}
        align="end"
        label="Export"
        triggerClass="dur-micro flex h-7 items-center gap-1 rounded-control border border-border px-2 text-caption text-secondary transition-colors hover:bg-panel hover:text-primary"
      >
        {#snippet trigger()}
          <Download class="size-3.5" />
          Export
          <ChevronDown class="size-3" />
        {/snippet}
      </Menu>
      <div
        class="flex -space-x-1.5"
        aria-label="People with this document open"
      >
        {#each $documentBarCollaboration.openUsers as user (user.id)}
          <DocumentCollaboratorAvatar collaborator={user} />
        {/each}
      </div>
    </div>
  </div>

  <div class="px-12 py-10 pb-40">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={wrapEl}
      onpointerdown={onPointerDown}
      class="relative mx-auto"
      style:width={`${paperFrame.width}px`}
      style:min-height={`${paperFrame.minHeight}px`}
      style:--page-width={`${paperFrame.width}px`}
      style:--margin-top={`${paperFrame.marginTop}px`}
      style:--margin-right={`${paperFrame.marginRight}px`}
      style:--margin-bottom={`${paperFrame.marginBottom}px`}
      style:--margin-left={`${paperFrame.marginLeft}px`}
    >
      <!-- One continuous paper sheet; it grows with the document's content. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        bind:this={paperEl}
        onclick={onPaperClick}
        class="doc-paper relative"
        style:min-height={`${paperFrame.minHeight}px`}
      >
        {#if $info.status === 'loading'}
          <div class="document-placeholder relative z-[1] space-y-3">
            <div class="h-4 w-2/3 animate-pulse rounded bg-panel"></div>
            <div class="h-4 w-full animate-pulse rounded bg-panel"></div>
            <div class="h-4 w-5/6 animate-pulse rounded bg-panel"></div>
          </div>
        {:else if $info.status === 'error'}
          <div class="document-placeholder relative z-[1] rounded-panel border border-border bg-panel/40 p-4">
            <p class="text-body-sm text-secondary">{$info.errMsg}</p>
            <Button variant="secondary" class="mt-3" onclick={() => void runtime.load()}>Try again</Button>
          </div>
        {/if}
        <div
          bind:this={host}
          class="doc-editor"
          style={customTypographyCss($editorSession?.defaultTypography)}
          hidden={$info.status !== 'ready'}
        ></div>
      </div>

      <!-- Right gutter: symbols for special blocks (AI/prompt) -->
      {#each prompts as p, i (i)}
        <div
          class="absolute -right-10 flex size-6 items-center justify-center text-intel"
          style="top: {p.top}px"
          title="AI block (prompt)"
        >
          <Sparkles class="size-4" />
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .document-scroll {
    scrollbar-width: none;
  }

  .document-scroll::-webkit-scrollbar {
    display: none;
  }

  /* The single continuous sheet — the page look without page fitting. */
  .doc-paper {
    width: var(--page-width);
    border: 1px solid var(--color-border);
    border-radius: 2px;
    background: var(--color-work);
    box-shadow: var(--shadow-panel);
  }

  .document-placeholder {
    margin: var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left);
  }

  /* The writing surface: calm, nondescript blocks — just text with rhythm. */
  .doc-editor {
    min-height: inherit;
  }

  .doc-editor :global(.ProseMirror) {
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    width: var(--page-width);
    min-height: inherit;
    padding: var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left);
    outline: none;
    caret-color: var(--color-action);
    color: var(--color-primary);
  }

  .doc-editor :global(.taurus-row-start) {
    box-sizing: border-box;
  }

  /* Hold the selection highlight while the editor is blurred (inspector open). */
  .doc-editor :global(.taurus-selection-hold) {
    background-color: var(--color-selection);
  }
  .doc-editor :global(.ProseMirror p) {
    margin: 0;
    line-height: 1.75;
  }
  .doc-editor :global(.ProseMirror h1),
  .doc-editor :global(.ProseMirror h2),
  .doc-editor :global(.ProseMirror h3),
  .doc-editor :global(.ProseMirror h4),
  .doc-editor :global(.ProseMirror h5),
  .doc-editor :global(.ProseMirror h6) {
    font-weight: 600;
    line-height: 1.3;
    margin: 0;
  }
  .doc-editor :global(.ProseMirror h1) {
    font-size: 1.875rem;
  }
  .doc-editor :global(.ProseMirror h2) {
    font-size: 1.5rem;
  }
  .doc-editor :global(.ProseMirror h3) {
    font-size: 1.25rem;
  }
  .doc-editor :global(.ProseMirror h4) {
    font-size: 1.125rem;
  }
  .doc-editor :global(.ProseMirror h5) {
    font-size: 1rem;
  }
  .doc-editor :global(.ProseMirror h6) {
    font-size: 0.875rem;
  }
  .doc-editor :global(.ProseMirror a) {
    color: var(--color-action);
    text-decoration: underline;
  }
  .doc-editor :global(.ProseMirror code) {
    font-family: var(--font-mono, monospace);
    font-size: 0.875em;
    background: var(--color-panel);
    border-radius: 4px;
    padding: 0.1em 0.3em;
  }
  /* Structural block kinds: callout is a highlighted box; code/divider get their
     own nodes; list/image render as a read-only placeholder (block_leaf). */
  .doc-editor :global(.ProseMirror [data-kind='callout']) {
    border: 1px solid var(--color-border);
    background: var(--color-panel);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }
  .doc-editor :global(.ProseMirror .block-leaf) {
    border: 1px dashed var(--color-border-strong);
    border-radius: 6px;
    padding: 0.4rem 0.7rem;
    color: var(--color-muted);
    font-size: 0.8125rem;
    user-select: none;
  }
  /* Flat list: items carry a data-level (nesting) and, for checklists, data-checked. */
  .doc-editor :global(.ProseMirror .doc-list) {
    list-style: none;
    margin: 0.3rem 0;
    padding: 0;
    counter-reset: doc-list-item;
  }
  .doc-editor :global(.ProseMirror .doc-list li) {
    position: relative;
    padding-left: 1.5em;
  }
  .doc-editor :global(.ProseMirror .doc-list li[data-level='1']) { margin-left: 1.5em; }
  .doc-editor :global(.ProseMirror .doc-list li[data-level='2']) { margin-left: 3em; }
  .doc-editor :global(.ProseMirror .doc-list li[data-level='3']) { margin-left: 4.5em; }
  .doc-editor :global(.ProseMirror .doc-list li[data-level='4']) { margin-left: 6em; }
  .doc-editor :global(.ProseMirror .doc-list li[data-level='5']) { margin-left: 7.5em; }
  .doc-editor :global(.ProseMirror .doc-list li[data-level='6']) { margin-left: 9em; }
  .doc-editor :global(.ProseMirror .doc-list li[data-level='7']) { margin-left: 10.5em; }
  .doc-editor :global(.ProseMirror .doc-list li[data-level='8']) { margin-left: 12em; }
  .doc-editor :global(.ProseMirror .doc-list[data-list-type='bullet'] li::before) {
    content: '•';
    position: absolute;
    left: 0.35em;
    color: var(--color-secondary);
  }
  .doc-editor :global(.ProseMirror .doc-list[data-list-type='ordered'] li) {
    counter-increment: doc-list-item;
  }
  .doc-editor :global(.ProseMirror .doc-list[data-list-type='ordered'] li::before) {
    content: counter(doc-list-item) '.';
    position: absolute;
    left: 0;
    color: var(--color-secondary);
  }
  .doc-editor :global(.ProseMirror .doc-list[data-list-type='check'] li::before) {
    content: '☐';
    position: absolute;
    left: 0.1em;
    cursor: pointer;
    color: var(--color-secondary);
  }
  .doc-editor :global(.ProseMirror .doc-list[data-list-type='check'] li[data-checked='true']::before) {
    content: '☑';
    color: var(--color-action);
  }
  .doc-editor :global(.ProseMirror .doc-list[data-list-type='check'] li[data-checked='true']) {
    color: var(--color-muted);
    text-decoration: line-through;
  }
  .doc-editor :global(.ProseMirror pre) {
    font-family: var(--font-mono, monospace);
    font-size: 0.875em;
    background: var(--color-panel);
    border-radius: 6px;
    padding: 0.6rem 0.8rem;
    white-space: pre;
    overflow-x: auto;
  }
  .doc-editor :global(.ProseMirror hr) {
    border: none;
    border-top: 1px solid var(--color-border-strong);
    margin: 0.5rem 0;
  }
  /* A block selected from the gutter anchor. */
  .doc-editor :global(.ProseMirror-selectednode) {
    outline: 2px solid color-mix(in srgb, var(--color-action) 55%, transparent);
    outline-offset: 4px;
    border-radius: 2px;
  }
</style>
