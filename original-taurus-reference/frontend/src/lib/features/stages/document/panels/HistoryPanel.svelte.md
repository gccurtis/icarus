# src/lib/features/stages/document/panels/HistoryPanel.svelte — breakdown

Companion to [HistoryPanel.svelte](HistoryPanel.svelte). The document history
panel: loads real paginated change history from Omega, resolves author identity
profiles asynchronously, fetches before/after detail on demand, and supports
targeted undo and redo, each appending a new compensating revision.

## Script — imports, document id, and state

### Pull in the history API, identity resolvers, and declare list + modal state

```svelte
<script lang="ts">
  import { RotateCcw, RotateCw } from '@lucide/svelte';
  import { Badge, Button, IdentityHoverCard, Modal, toast } from '$lib/components';
  import {
    fetchDocumentHistory,
    fetchChangeSetDetail,
    undoChange,
    redoChange,
    type HistoryEntry
  } from '$systems/documents/api';
  import { documentEditRelative } from '$data/time';
  import { resolveFromUserId, getIdentityProfile } from '$data/identity-directory';
  import type { IdentityProfile } from '$data/identity-directory';
  import { editorSession } from '../editor/session';

  const documentId = $derived($editorSession?.docId ?? '');

  let entryProfiles = $state<Record<string, IdentityProfile>>({});

  let entries = $state<HistoryEntry[]>([]);
  let loading = $state(true);
  let error = $state('');
  let selected = $state<HistoryEntry | null>(null);
  let detailOpen = $state(false);
  let detailLoading = $state(false);
  let detailBefore = $state('');
  let detailAfter = $state('');
  let detailError = $state('');

```

Imports the Lucide undo/redo icons, UI components, the history API
(`fetchDocumentHistory`, `fetchChangeSetDetail`, `undoChange`, `redoChange`) and
its `HistoryEntry` type, the relative-time helper, and the identity-directory
resolvers. `documentId` derives from the editor session; `entryProfiles` caches
resolved author profiles, alongside the list state (`entries`, `loading`, `error`)
and the modal-detail state.

## Script — load and reactive effects

### Fetch the first history page and resolve author profiles lazily

```svelte
  async function load() {
    loading = true;
    error = '';
    try {
      const page = await fetchDocumentHistory(documentId);
      entries = page.entries;
    } catch {
      error = 'History could not be loaded.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const id = documentId;
    if (id) void load();
  });

  // Resolve author profiles lazily as entries arrive.
  $effect(() => {
    const current = entries;
    void (async () => {
      for (const entry of current) {
        if (entryProfiles[entry.authorId]) continue;
        const profile = await resolveFromUserId(entry.authorId, entry.authorName);
        entryProfiles = { ...entryProfiles, [entry.authorId]: profile };
      }
    })();
  });

```

`load()` fetches the first history page (20 entries, no cursor), toggling
`loading` and setting `error` on failure. One effect (re)loads whenever the
document id changes; a second reacts to the `entries` array and resolves each
unseen author via `resolveFromUserId` (cache → Omega → fallback), spreading each
profile into `entryProfiles` so Svelte detects the change.

## Script — open a change and fetch its detail

### Open the detail modal and load before/after summaries on demand

```svelte
  async function show(entry: HistoryEntry) {
    selected = entry;
    detailOpen = true;
    if (entry.detailAvailable) {
      detailLoading = true;
      detailError = '';
      detailBefore = '';
      detailAfter = '';
      try {
        const detail = await fetchChangeSetDetail(documentId, entry.id);
        detailBefore = detail.before;
        detailAfter = detail.after;
      } catch {
        detailError = 'Change detail could not be retrieved — it may have been pruned.';
      } finally {
        detailLoading = false;
      }
    } else {
      detailBefore = 'Change detail has been pruned and is no longer available.';
      detailAfter = '';
    }
  }

```

`show()` opens the detail modal for an entry. When `detailAvailable` is true it
fetches the before/after summaries via `fetchChangeSetDetail`, surfacing an
error/pruned message on failure; when detail is unavailable it shows a pruning
notice instead.

**The modal shows a real before/after pair**, via `loadChangeText` from
[`change-detail.ts`](../../../../systems/documents/change-detail.ts.md). Omega
returns only a change set's new text — the prior value is private undo state
(`InverseOps`, `json:"-"`) — so the previous value is recovered by walking back
through the change sets that precede this one:

```ts
const index = entries.findIndex((e) => e.id === entry.id);
const older = index >= 0 ? entries.slice(index + 1).map((e) => e.id) : [];
const detail = await loadChangeText(documentId, entry.id, older);
```

`entries` is newest-first, so everything after the matched index is older. The
panel already holds the history page, so it slices rather than making the lookup
re-read it.

When the walk cannot find a prior value — the atom's origin is older than the
lookback budget, or those change sets were pruned — `detailPriorUnknown` renders
`Not recoverable` plus one muted line. That is deliberately distinct from `—`,
which means there genuinely was nothing before.

The Overview `ActivityLens` renders the same change through the same loader, so
the two surfaces cannot disagree about what a change looked like.

## Script — undo and redo

### Apply a targeted undo or redo, then reload the list

```svelte
  async function undoSelected() {
    if (!selected) return;
    try {
      await undoChange(documentId, selected.id);
      toast('Change undone. A new compensating revision was created.', { tone: 'success' });
      detailOpen = false;
      void load();
    } catch (e) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: string }).message) : 'Could not undo the change.';
      toast(msg, { tone: 'danger' });
    }
  }

  async function redoSelected() {
    if (!selected) return;
    try {
      await redoChange(documentId, selected.id);
      toast('Change redone. A new compensating revision was created.', { tone: 'success' });
      detailOpen = false;
      void load();
    } catch (e) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: string }).message) : 'Could not redo the change.';
      toast(msg, { tone: 'danger' });
    }
  }
</script>

```

`undoSelected` and `redoSelected` call the respective change-set endpoint, toast
success, close the modal, and reload the history — extracting the thrown message
into a danger toast on failure. Both append a new compensating revision rather
than rewriting existing history.

## Markup — activity list

### Loading / error / empty states and the ordered list of changes

```svelte
<div class="space-y-3">
  <div class="flex items-center justify-between">
    <p class="text-caption text-muted">Document activity</p>
  </div>

  {#if loading}
    <p class="text-caption text-muted">Loading history…</p>
  {:else if error}
    <p class="text-caption text-danger">{error}</p>
  {:else if entries.length === 0}
    <p class="text-caption text-muted">No activity yet for this document.</p>
  {:else}
    <ol class="space-y-1.5">
      {#each entries as entry (entry.id)}
        {@const actorProfile = entryProfiles[entry.authorId] ?? getIdentityProfile(entry.authorName)}
        <li
          class="dur-micro rounded-control border border-transparent transition-colors hover:border-border hover:bg-panel"
        >
          <button
            type="button"
            class="w-full px-2.5 pt-2 pb-1 text-left"
            onclick={() => show(entry)}
            aria-label={`View change: ${entry.action}`}
          >
            <span class="block text-body-sm font-medium text-primary">{entry.action}</span>
            <span class="mt-0.5 block truncate text-caption text-secondary">{entry.scope}</span>
          </button>
          <div class="flex items-center justify-between gap-2 px-2 pb-2 text-caption text-muted">
            <IdentityHoverCard profile={actorProfile} showName portalled class="min-w-0 flex-1" />
            <span class="shrink-0">{documentEditRelative(entry.occurredAt)}</span>
          </div>
        </li>
      {/each}
    </ol>
  {/if}

  <p class="border-t border-border pt-3 text-caption leading-relaxed text-muted">
    Select a change to inspect the exact before/after detail and targeted undo action.
  </p>
</div>

```

The activity list renders loading / error / empty / populated states. Each entry
shows its action and scope, an `IdentityHoverCard` with the resolved (or fallback)
profile using `portalled` to escape overflow, and a relative timestamp; a footer
note explains the inspect/undo interaction.

## Markup — change detail modal

### Author, scope, before/after grid, and the undo/redo footer

```svelte
<Modal bind:open={detailOpen} title="Change detail" size="md">
  {#if selected}
    {@const selectedActor = entryProfiles[selected.authorId] ?? getIdentityProfile(selected.authorName)}
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <IdentityHoverCard profile={selectedActor} size="sm" showName portalled />
        <div>
          <p class="text-body-sm font-medium text-primary">{selected.action}</p>
          <p class="text-caption text-muted">{documentEditRelative(selected.occurredAt)}</p>
        </div>
      </div>

      <div>
        <p class="text-caption text-muted">Scope</p>
        <p class="mt-1 text-body-sm text-primary">{selected.scope}</p>
      </div>

      {#if detailLoading}
        <p class="text-caption text-muted">Loading change detail…</p>
      {:else if detailError}
        <p class="text-caption text-danger">{detailError}</p>
      {:else}
        <div class="grid gap-2 sm:grid-cols-2">
          <section class="rounded-control border border-danger/25 bg-danger/5 p-3">
            <p class="text-caption font-medium text-danger">Before</p>
            <p class="mt-2 whitespace-pre-wrap text-body-sm text-secondary">{detailBefore}</p>
          </section>
          <section class="rounded-control border border-success/25 bg-success/5 p-3">
            <p class="text-caption font-medium text-success">After</p>
            <p class="mt-2 whitespace-pre-wrap text-body-sm text-secondary">{detailAfter || 'No after content available.'}</p>
          </section>
        </div>
      {/if}

      <p class="text-caption leading-relaxed text-muted">
        Undo will append a new inverse operation; it will not rewrite existing history.
      </p>
    </div>
  {/if}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (detailOpen = false)}>Close</Button>
    {#if selected?.canRedo}
      <Button variant="secondary" disabled={detailLoading} onclick={redoSelected}>
        <RotateCw class="size-4" />
        Redo this change
      </Button>
    {:else}
      <Button variant="secondary" disabled={!selected?.canUndo || detailLoading} onclick={undoSelected}>
        <RotateCcw class="size-4" />
        Undo this change
      </Button>
    {/if}
  {/snippet}
</Modal>
```

The change-detail modal shows the author hover card, action, timestamp, scope, and
a before/after comparison grid with semantic danger/success coloring, plus a note
that undo appends rather than rewrites. The footer offers Redo when `canRedo`,
otherwise Undo (disabled unless `canUndo`), both gated while detail loads.
