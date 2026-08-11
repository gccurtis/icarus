<script lang="ts">
  import { RotateCcw, RotateCw } from '@lucide/svelte';
  import { Badge, Button, IdentityHoverCard, Modal, toast } from '$lib/components';
  import { cn } from '$lib/utils';
  import {
    fetchDocumentHistory,
    undoChange,
    redoChange,
    type HistoryEntry
  } from '$systems/documents/api';
  import { loadChangeText } from '$systems/documents/change-detail';
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
  let detailPriorUnknown = $state(false);
  let detailError = $state('');

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

  async function show(entry: HistoryEntry) {
    selected = entry;
    detailOpen = true;
    if (entry.detailAvailable) {
      detailLoading = true;
      detailError = '';
      detailBefore = '';
      detailAfter = '';
      try {
        // Everything after this entry in the newest-first list is older, and is
        // what the prior-text reconstruction walks — Omega returns only the new
        // text, so a before/after pair has to be recovered from predecessors.
        const index = entries.findIndex((e) => e.id === entry.id);
        const older = index >= 0 ? entries.slice(index + 1).map((e) => e.id) : [];
        const detail = await loadChangeText(documentId, entry.id, older);
        detailBefore = detail.before;
        detailAfter = detail.after;
        detailPriorUnknown = detail.priorUnknown;
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
        <!-- A real before/after pair. Omega returns only the new text (the prior
             value is private undo state), so `loadChangeText` recovers it from the
             preceding change sets — the same path the Overview activity lens uses,
             so the two surfaces cannot disagree about what a change looked like. -->
        <div class="grid gap-2 sm:grid-cols-2">
          <section class="rounded-control border border-danger/25 bg-danger/5 p-3">
            <p class="text-caption font-medium text-danger">Before</p>
            <p class="mt-2 whitespace-pre-wrap text-body-sm text-secondary">
              {detailBefore || (detailPriorUnknown ? 'Not recoverable' : '—')}
            </p>
          </section>
          <section class="rounded-control border border-success/25 bg-success/5 p-3">
            <p class="text-caption font-medium text-success">After</p>
            <p class="mt-2 whitespace-pre-wrap text-body-sm text-secondary">{detailAfter || '—'}</p>
          </section>
        </div>
        {#if detailPriorUnknown}
          <p class="text-caption text-muted">
            The earlier text is older than the retained history, so it can’t be shown.
          </p>
        {/if}
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
