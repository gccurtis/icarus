<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import type { ActivityEvent } from '$data/projects';
  import { relativeTime } from '$data/time';
  import { getIdentityProfile } from '$data/identity-directory';
  import { fetchDocumentHistory, type HistoryEntry } from '$systems/documents/api';
  import {
    HISTORY_DEPTH,
    findChangeEntry,
    loadChangeDetail,
    type EventChange
  } from '../change-lookup';
  import ChangeDetail from './ChangeDetail.svelte';

  let {
    events,
    /** Set when the events belong to a document — the only kind with change detail.
     *  When null the rows are plain text rather than expandable. */
    documentId = null
  }: { events: ActivityEvent[]; documentId?: string | null } = $props();

  let openId = $state<string | null>(null);
  let changes = $state<Record<string, EventChange>>({});
  // History is read ONCE for the whole list, on the first expansion, and reused for
  // every later one. Fetching per row would re-read the same 50 entries each time;
  // fetching up front would pay for a panel the user may never expand.
  let entries = $state<HistoryEntry[] | null>(null);

  // A different document (or a fresh list) invalidates everything cached here.
  $effect(() => {
    documentId;
    openId = null;
    changes = {};
    entries = null;
  });

  async function toggle(event: ActivityEvent) {
    if (openId === event.id) {
      openId = null;
      return;
    }
    openId = event.id;
    if (!documentId || changes[event.id]) return;
    changes = { ...changes, [event.id]: { state: 'loading' } };
    try {
      const loaded = entries ?? (await fetchDocumentHistory(documentId, HISTORY_DEPTH)).entries;
      entries = loaded;
      const entry = findChangeEntry(loaded, event);
      const result: EventChange = entry
        ? await loadChangeDetail(documentId, entry, loaded)
        : { state: 'none' };
      changes = { ...changes, [event.id]: result };
    } catch {
      changes = { ...changes, [event.id]: { state: 'error' } };
    }
  }
</script>

<!-- Bordered and height-capped so a busy document clips visibly instead of pushing
     the rest of the lens off the panel. The border is what makes the clipping read
     as deliberate rather than as content that ran out. -->
<div class="max-h-56 overflow-y-auto rounded-control border border-border">
  <ol class="divide-y divide-border">
    {#each events as ev (ev.id)}
      {@const open = openId === ev.id}
      <li>
        {#if documentId}
          <button
            type="button"
            onclick={() => toggle(ev)}
            aria-expanded={open}
            class={cn(
              'dur-micro flex w-full items-start gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-panel/60',
              open && 'bg-panel/60'
            )}
          >
            <ChevronDown
              class={cn('dur-small mt-0.5 size-3 shrink-0 text-muted transition-transform', !open && '-rotate-90')}
            />
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="min-w-0 truncate text-caption text-secondary">{ev.action}</span>
                <span class="shrink-0 text-caption text-muted">{relativeTime(ev.occurredAt)}</span>
              </span>
              <span class="block truncate text-caption text-muted">
                {getIdentityProfile(ev.actor.name).name}
              </span>
            </span>
          </button>
          {#if open}
            <div class="px-2 pb-2 pl-6">
              <ChangeDetail change={changes[ev.id] ?? { state: 'loading' }} compact />
            </div>
          {/if}
        {:else}
          <div class="px-2 py-1.5">
            <div class="flex items-baseline justify-between gap-2">
              <span class="min-w-0 truncate text-caption text-secondary">{ev.action}</span>
              <span class="shrink-0 text-caption text-muted">{relativeTime(ev.occurredAt)}</span>
            </div>
            <p class="truncate text-caption text-muted">{getIdentityProfile(ev.actor.name).name}</p>
          </div>
        {/if}
      </li>
    {/each}
  </ol>
</div>
