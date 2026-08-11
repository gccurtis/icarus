<script lang="ts">
  import { cn } from '$lib/utils';
  import { iconTileClass } from '$data/projects';
  import { resources } from '$data/resources';
  import { relativeTime } from '$data/time';
  import { kindMeta } from '$lib/features/shared/kinds';
  import { kindBreakdown, updatedSpan } from '../lens-helpers';
  import LensFacts from './LensFacts.svelte';

  let { resourceIds }: { resourceIds: string[] } = $props();

  const selected = $derived($resources.filter((r) => resourceIds.includes(r.id)));
  const breakdown = $derived(kindBreakdown(selected, (k) => kindMeta[k].label));
  const span = $derived(updatedSpan(selected));
  const restricted = $derived(selected.filter((r) => !r.access.projectWide).length);
</script>

<!-- The bulk set's lens. Read-only by design: the actions for this set (Download,
     Import) are already in the table header a few pixels away, and repeating them
     here would be the second copy of a control rather than new information. -->
<div class="space-y-4">
  <div>
    <p class="text-body-sm font-medium text-primary">
      {selected.length}
      {selected.length === 1 ? 'resource' : 'resources'} selected
    </p>
    <p class="text-caption text-muted">Use the table header to download or clear the set.</p>
  </div>

  {#if breakdown.length}
    <ul class="space-y-1.5">
      {#each breakdown as row (row.kind)}
        {@const meta = kindMeta[row.kind]}
        {@const Icon = meta.icon}
        <li class="flex items-center gap-2.5">
          <span class={cn('flex size-6 shrink-0 items-center justify-center rounded-control', iconTileClass(meta.tone))}>
            <Icon class="size-3" />
          </span>
          <span class="min-w-0 flex-1 truncate text-caption text-secondary">{meta.label}</span>
          <span class="shrink-0 text-caption tabular-nums text-muted">{row.count}</span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if span}
    <LensFacts
      items={[
        { label: 'Most recent', value: relativeTime(span.newest) },
        { label: 'Oldest', value: relativeTime(span.oldest) },
        {
          label: 'Access',
          value: restricted === 0 ? 'All project-wide' : `${restricted} restricted`
        }
      ]}
    />
  {/if}
</div>
