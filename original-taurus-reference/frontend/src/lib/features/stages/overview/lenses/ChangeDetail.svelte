<script lang="ts">
  import type { EventChange } from '../change-lookup';

  // One change, rendered. Shared by the activity lens (which shows the change for
  // the event you clicked) and by every expandable row in ActivityList, so the two
  // can never disagree about what a change looked like.
  let { change, compact = false }: { change: EventChange; compact?: boolean } = $props();
</script>

{#if change.state === 'loading'}
  <p class="text-caption text-muted">Loading the change…</p>
{:else if change.state === 'error'}
  <p class="text-caption text-danger">The change could not be loaded.</p>
{:else if change.state === 'pruned'}
  <p class="text-caption leading-relaxed text-muted">
    This change has been pruned, so its content is no longer available.
  </p>
{:else if change.state === 'none'}
  <p class="text-caption leading-relaxed text-muted">
    No stored change matches this event — it did not edit content, or its detail has been pruned.
  </p>
{:else}
  <div class="space-y-1.5">
    {#if !compact}
      <div class="flex items-baseline justify-between gap-2">
        <p class="min-w-0 truncate text-body-sm text-primary">{change.entry.action}</p>
        <span class="shrink-0 text-caption text-muted">{change.entry.scope}</span>
      </div>
    {/if}
    <!-- Before/after as a pair, always, because a result on its own does not tell a
         reader what changed. The prior value is reconstructed from the change sets
         preceding this one (see systems/documents/change-detail.ts) — Omega returns
         only the new text. -->
    <div class="rounded-control border border-danger/25 bg-danger/5 p-2">
      <p class="text-caption font-medium text-danger">Before</p>
      <p class="mt-1 whitespace-pre-wrap break-words text-caption text-secondary">
        {change.before || (change.priorUnknown ? 'Not recoverable' : '—')}
      </p>
    </div>
    <div class="rounded-control border border-success/25 bg-success/5 p-2">
      <p class="text-caption font-medium text-success">After</p>
      <p class="mt-1 whitespace-pre-wrap break-words text-caption text-secondary">
        {change.after || '—'}
      </p>
    </div>
    {#if change.priorUnknown}
      <!-- Only when the walk actually failed: the atom's origin is older than the
           lookback budget, or those change sets were pruned. -->
      <p class="text-caption text-muted">
        The earlier text is older than the retained history, so it can’t be shown.
      </p>
    {/if}
  </div>
{/if}
