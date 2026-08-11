# src/lib/features/stages/document/DocumentStage.svelte — breakdown

Companion to [DocumentStage.svelte](DocumentStage.svelte). The document stage — a VIEW over the long-lived per-document runtime that mounts one continuous ProseMirror editor on a single continuous paper sheet, carries a three-zone document bar (name, save/edit status, Export menu + collaborators), measures a right-hand prompt gutter, and applies the document’s typography and structural CSS.

## Script imports

### Svelte lifecycle, ProseMirror, icons, shared UI, and the document data/collaboration stores

```svelte
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

```

The component opens with its instance script and pulls in Svelte's lifecycle helpers (`onDestroy`, `onMount`, `tick`), ProseMirror's `EditorView` plus its base stylesheet, three Lucide icons, and shared UI (`Badge`, `Button`, `Menu`, `toast`). `exportFormats` and `unbuiltFormatMessage` come from the shared per-kind transfer table — the same list the resource rows and the shell top bar read, so the Export menu here cannot offer a different set. From the data layer it imports the document helpers (`customTypographyCss`, `defaultPageLayout`, Markdown export/download), the whole collaboration/presence surface, the relative-time formatters, and the projects/resources/workspace stores. The sibling `DocumentCollaboratorAvatar`, the `editorSession` store, and `acquireDocument` from the runtime complete the imports.

## Component props

### The three inputs: project id, initial title, and optional resource id

```svelte
  let {
    projectId,
    title,
    resourceId
  }: { projectId: string; title: string; resourceId?: string } = $props();

```

The component takes `projectId`, `title`, and an optional `resourceId` via `$props()`. These are captured once — WorkSurface keys this component by tab, so an instance’s props never change over its life.

## Acquiring the long-lived runtime

### Attach to the per-document runtime that outlives this view

```svelte
  // The stage is a VIEW over the document's runtime: the runtime (see runtime.ts)
  // holds the EditorState and the whole sync loop and outlives this component —
  // tab switches keep content, selection, undo history, and background syncing.
  // Initial-value capture is intentional: WorkSurface keys this component by tab,
  // so an instance's props never change over its life.
  // svelte-ignore state_referenced_locally
  const runtime = acquireDocument(projectId, title, resourceId);
  const info = runtime.info;

```

The stage is a thin VIEW over the document’s runtime. `acquireDocument` returns the shared runtime (see `runtime.ts`) that owns the `EditorState` and the entire sync loop and outlives this component, so tab switches preserve content, selection, undo history, and background syncing. The `state_referenced_locally` lint is silenced because the initial-value capture is intentional. `runtime.info` is grabbed as the reactive status store the rest of the component reads.

## Presence and last-editor effects

### Publish this user's presence and refresh the “Edited by” attribution as the doc changes

```svelte
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
```

Three effects wire the editor session to collaboration. The first mirrors the active `docId` into `currentDocumentId` so the document bar filters presence to users viewing this document. The second debounces a `publishPresence` call so other clients see this user as present. The third re-runs `refreshLastEditor` whenever the document loads or `$info.updatedAt` advances (after each flush), keeping the “Edited … by” attribution pointed at the newest change’s author.

## Resource, title, and role derivations

### Resolve the live resource, its current name/id, and the viewer's project role

```svelte
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

```

`now` is a clock value used later for relative timestamps. `resource` finds the matching document resource by id (or by name as a fallback). `currentTitle` and `currentResourceId` prefer the resource’s live values, and `projectRole`/`canRename` derive whether the viewer — an owner or editor — may rename the document.

## Export

### The editor-bar action and the format menu built on the shared table

```svelte
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
```

`exportDoc` is the real export, guarded by an `ioBusy` flag. It fetches the current document’s Markdown via `exportDocumentMarkdown` and hands it to `downloadMarkdown`, surfacing an API error as a danger toast and always clearing the busy flag. Import lives in the “All resources” panel, not here, because it creates a new document.

`exportItems` turns the shared `exportFormats` list into the `Menu`'s items. Every format is offered — the menu is where a user finds out what is possible — but only a `built` one runs `exportDoc`; the rest raise `unbuiltFormatMessage` as an attention toast instead of writing a fake file, and each already carries "— soon" in the label it took from the table. The `disabled` flag is the same guard the old single Export button wore, applied per item: nothing is selectable while an export is in flight or before the editor session resolves.

## Edit timestamp and save label

### Derive the “edited” timestamp trio and the save-status label

```svelte
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
```

`editedAt` takes the later of the resource’s `updatedAt` and the document’s parsed `updatedAt`. From it come the tooltip `editedStamp`, the human `editedRelative` (recomputed against `now`), and the machine-readable `editedIso`. `saveLabel` maps `$info.save` to “Saved”, “Unsaved changes”, “Saving…”, or a retry message.

## The paper frame

### The document's canonical width and margins, as one continuous sheet

```svelte
  // The paper frame: the document's canonical width and margins, rendered as ONE
  // continuous sheet that grows with content. The canonical page height serves
  // only as an aesthetic minimum so an empty document still reads as a page.
  const paperFrame = $derived.by(() => {
    const layout = $editorSession?.canonicalPageLayout ?? defaultPageLayout;
    const pointScale = 96 / 72;
    return {
      width: layout.width * pointScale,
      minHeight: layout.height * pointScale,
      ...
    };
  });
```

`paperFrame` scales the session's canonical layout (or the default) from points to CSS pixels
(96/72): the paper's width, its four margins, and the canonical page *height* repurposed as an
aesthetic minimum so an empty document still reads as a sheet. There is no page count, sheet
stack, or gap any more — pagination was removed in workstream B, and the paper is one
continuous surface that grows with the document's content.

## Element refs and view handles

### Title-edit state, bound DOM nodes, and the imperative view/observer handles

```svelte
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

```

This block declares the component’s mutable handles: title-edit flags (`editingTitle`, `titleDraft`, `renaming`), the bound DOM elements (`titleInput`, `host`, `scrollEl`, `wrapEl`, `paperEl`), the imperative ProseMirror `view`, a `ResizeObserver`, and the relative-time interval. `prompts` holds the measured top offsets for the right-gutter AI/prompt indicators.

## Title-sync and re-measure effects

### Push renames into the runtime and re-measure gutters once the doc is ready

```svelte
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

```

One effect forwards the current title into the long-lived runtime’s panel metadata so catalog renames propagate. The second schedules a `requestAnimationFrame` to re-measure the prompt gutter once the document’s state is swapped in and `$info.status` is `ready`.

## Document name — begin, cancel, commit

### Enter, abandon, and persist an inline rename of the document

```svelte
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

```

`beginTitleEdit` seeds the draft and focuses/selects the input (owner or editor only). `cancelTitleEdit` restores the draft and exits. `commitTitle` trims the draft, no-ops on an empty or unchanged name, guards against missing resource metadata (with a toast), and otherwise calls `renameResource` and `renameResourceTab`, rolling back and toasting on failure. The `renaming` flag serializes these against re-entry.

## Title input keyboard and sizing

### Enter/Escape handling and the auto-fit input width

```svelte
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

```

`onTitleKeydown` commits on Enter and cancels on Escape, each preventing the default. `titleInputWidth` returns a `ch`-based width clamped between 18 and 52 so the rename input grows with its content without overflowing the bar.

## Gutter — measuring prompt indicators

### Walk the doc for prompt blocks and record their vertical offsets

```svelte
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

```

Under the “gutters (outside the page)” heading, `updateGutter` measures the right-hand prompt indicators. With no view or wrapper it clears `prompts`; otherwise it walks the top-level document nodes and, for each `prompt` block, reads that DOM node’s top relative to the wrapper — producing the offset list the markup renders as sparkle icons.

## Click, focus, and visibility handlers

### Paper-click focus, inspector focus on pointer-down, and flush-on-hide

```svelte
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

```

`onPaperClick` focuses the editor when the empty paper (not the text) is clicked. `onPointerDown` jumps the inspector to its Details section — the lens follows the click — without touching the panel’s collapsed state. `onVisibility` flushes pending changes and leaves the session when the page is hidden, and rejoins when it returns.

## Mount — editor, runtime wiring, observers

### Start presence, build the EditorView, attach the runtime, and observe resize

```svelte
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
```

On mount the component starts presence polling, joins the session, and starts the 30s relative-time clock. It constructs the ProseMirror `EditorView` over the runtime’s state and dispatch, with a `handleClickOn` that toggles a check-list item when its marker zone is clicked. It then `attach`es to the runtime — forwarding state updates, re-measuring the gutter on doc changes, and exposing focus — and observes the wrapper for resizes.

## Teardown

### Leave the session, stop timers/observers, flush, and detach without disposing the runtime

```svelte
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
```

On destroy the component leaves the session, stops presence polling, clears `currentDocumentId`, cancels the clock, disconnects the observer, and flushes once more. It `detach`es from the runtime — which keeps syncing, since the manager disposes it only when the tab closes — and finally destroys the `EditorView`.

## Closing the script; document visibility listener

### End the script block and bind the page-visibility handler

```svelte
</script>

<svelte:document onvisibilitychange={onVisibility} />

```

The `</script>` closes the instance logic, and `<svelte:document>` registers `onVisibility` on the document’s `visibilitychange` event — the top-level bridge between the script and the markup that follows.

## Scroll surround and the page metaphor

### The outer scroll container that carries the canvas and drives paging

```svelte
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
```

A comment records the page metaphor — a darker canvas surround, a floating “paper” work surface with its own margins, a quiet three-zone bar, and gutters living outside the page. The outer `<div class="document-scroll">` binds `scrollEl` and fills the height with the canvas background.

## Document bar — editable name

### The left zone: inline rename input or the double-click-to-rename button

```svelte
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
```

The sticky three-column bar opens here. Its left zone shows either the rename `<input>` (bound to `titleDraft`, committing on blur/Enter and cancelling on Escape, auto-sized) while `editingTitle`, or a truncating button that starts a rename on double-click or Enter/F2 and reflects view-only access through `aria-disabled`.

## Document bar — save and edit status

### The center zone: the save state, then the relative “Edited … by” line

```svelte
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
```

The center zone reads “Saved · Edited just now by Ada”: the polite-live `saveLabel` first, a middot separator, then the “Edited” line with a `<time>` element carrying the ISO datetime and stamp tooltip, the relative label, and the last editor’s name.

The two halves used to sit the other way round. Save state leads now because it is the volatile half and the one a typing user is actually watching — “did that land?” is answered at the start of the line, where the eye already is, instead of after an attribution phrase that changes far more slowly.

## Document bar — export and collaborators

### The right zone: the Export format menu and open-user avatars

```svelte
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

```

The right zone holds the Export `Menu` and an overlapping stack of `DocumentCollaboratorAvatar`s — one per user with the document open — then closes the bar row.

Export was a single button that exported as Markdown without saying so; it is now an end-aligned `Menu` fed by `exportItems`, keeping the same bordered pill as its trigger and adding a `ChevronDown` so it reads as a menu rather than an action. The busy/no-session guard moved from the button's `disabled` attribute onto each item, so the trigger stays available and the disabled state shows where the choice is made.

## Page wrapper and geometry variables

### The centered wrapper that publishes page dimensions as CSS variables

```svelte
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
      ...
    >
```

Below the bar, a padded region (with `pb-40` clearing the AI Agent dock) holds the centered `wrapEl`. It forwards pointer-downs to the inspector and binds the `paperFrame` measurements — width, the aesthetic minimum height, and the four margins — to CSS custom properties that the styles and children read.

## The paper

### One clickable continuous sheet

```svelte
      <!-- One continuous paper sheet; it grows with the document's content. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        bind:this={paperEl}
        onclick={onPaperClick}
        class="doc-paper relative"
        style:min-height={`${paperFrame.minHeight}px`}
      >
```

The `paperEl` **is** the paper now: one continuous surface carrying the sheet visuals (border,
work background, panel shadow) directly, growing with the document's content. The old
absolutely-positioned page-sheet layer and its windowed `renderedPages` loop are gone with
pagination. Clicking the empty paper (via `onPaperClick`) focuses the editor.

## Loading/error states and the editor host

### Skeleton and error placeholders, then the ProseMirror mount point

```svelte
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

```

While loading, a skeleton of pulsing bars shows; on error, a panel shows `$info.errMsg` with a “Try again” button that re-runs `runtime.load()`. The `host` div is the ProseMirror mount point — it carries the session’s default typography as an inline style and stays `hidden` until the status is `ready`.

## Right gutter and closing tags

### Sparkle indicators for prompt blocks, then close the wrapper and scroll

```svelte
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

```

Outside the paper, the right gutter renders a `Sparkles` icon at each measured prompt offset to mark AI/prompt blocks. The wrapper, the padded region, and the scroll container then close.

## Styles — canvas, paper, sheets, placeholder

### Hide the scrollbar and size the paper, sheets, and placeholder margins

```svelte
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

```

The style block opens by hiding the scrollbar cross-browser, then gives `.doc-paper` the sheet
visuals directly — page width, border, radius, work background, and panel shadow (these lived
on the per-page `.doc-page-sheet` when pagination existed) — and insets the loading/error
placeholder by the page margins.

## Styles — editor surface and ProseMirror root

### The writing surface fill and the padded, page-width ProseMirror element

```svelte
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

```

`.doc-editor` inherits the paper’s min-height, and the global `.ProseMirror` rule sits above the paper background (relative, z-index 1), fills the page width, pads by the page margins, removes the outline, and sets the caret and text colors.

## Styles — the row-start seam

### The row-start marker box

```svelte
  .doc-editor :global(.taurus-row-start) {
    box-sizing: border-box;
  }

```

`.taurus-row-start` normalizes box-sizing for the presentation plugin's row min-height
decoration (line spacing). The `.taurus-page-break` spacer left with pagination — no widget
emits it any more.

## Styles — paragraphs and heading scale

### Paragraph rhythm and the shared plus per-level heading sizes

```svelte
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
```

Paragraphs get zero margin and a 1.75 line-height. The six heading levels share weight 600, a tight line-height, and no margin, then each level receives its own font size from 1.875rem (h1) down to 0.875rem (h6).

## Styles — links and inline code

### Underlined action-colored links and chip-styled inline code

```svelte
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
```

Links render in the action color with an underline; inline `code` uses the mono font at 0.875em on a panel background with a small radius and padding.

## Styles — callouts and leaf placeholders

### The highlighted callout box and the dashed read-only block placeholder

```svelte
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
```

A comment notes the structural block kinds. `[data-kind='callout']` is a bordered, panel-filled box; `.block-leaf` — used for list/image blocks rendered read-only — is a dashed, muted, unselectable placeholder.

## Styles — list container and nesting

### The flat list reset, item padding, and the eight indent levels

```svelte
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
```

The flat `.doc-list` clears list styling, sets vertical rhythm, and resets the ordered counter; items are relative with room for a marker. Each `data-level` from 1 to 8 adds a proportional left margin, giving nesting without nested lists.

## Styles — bullet, ordered, and check markers

### The ::before markers for each list type and the checked-item treatment

```svelte
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
```

Bullets render a `•`, ordered items increment and print the `doc-list-item` counter, and checklist items show a clickable `☐` that becomes `☑` and strikes through in a muted color when `data-checked` is true — all drawn as absolutely positioned `::before` markers.

## Styles — code blocks, rules, selection

### Preformatted code, horizontal rules, and the gutter-selected outline

```svelte
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
```

`pre` blocks use the mono font on a panel background with horizontal scroll; `hr` is a single strong-border top rule; and `.ProseMirror-selectednode` — a block selected from the gutter anchor — draws a soft action-colored outline. The closing `</style>` ends the file.
