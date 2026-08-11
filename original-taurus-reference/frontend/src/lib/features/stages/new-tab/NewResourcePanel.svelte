<script lang="ts">
  import type { Component } from 'svelte';
  import { Sparkles } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import { type Tone } from '$lib/components';
  import { iconTileClass } from '$data/projects';
  import { availableKinds, type ResourceKind } from '$data/resources';

  type KindMeta = Record<ResourceKind, { icon: Component; tone: Tone; label: string }>;

  let {
    kindMeta,
    oncreate,
    onai
  }: { kindMeta: KindMeta; oncreate: (kind: ResourceKind) => void; onai: () => void } = $props();

  // The creatable kinds (general is the import/upload catch-all, not offered here).
  const NEW_KINDS: ResourceKind[] = ['document', 'spreadsheet', 'slides', 'chat'];
</script>

<!-- Background-free, border-free row of clickable create surfaces (no scroll): AI create, a divider, then per-type creates. -->
<div class="flex w-full items-stretch gap-1">
  <button
    onclick={onai}
    class="dur-small flex shrink-0 items-center gap-2 rounded-control border border-intel/25 bg-intel/10 px-3 py-2 text-body-sm font-medium text-intel transition-colors hover:bg-intel/20"
  >
    <Sparkles class="size-4" /> AI create
  </button>

  <div class="ml-2 mr-1 w-px shrink-0 self-stretch bg-border"></div>

  {#each NEW_KINDS as k (k)}
    {@const meta = kindMeta[k]}
    {@const Icon = meta.icon}
    {@const enabled = $availableKinds.includes(k)}
    <button
      onclick={() => oncreate(k)}
      disabled={!enabled}
      title={enabled ? undefined : 'Coming soon'}
      class="dur-small flex min-w-0 flex-1 items-center justify-center gap-2 rounded-control px-2 py-2 text-body-sm font-medium text-secondary transition-colors enabled:hover:bg-panel enabled:hover:text-primary disabled:opacity-50"
    >
      <span class={cn('flex size-6 shrink-0 items-center justify-center rounded-control', iconTileClass(meta.tone))}>
        <Icon class="size-3.5" />
      </span>
      <span class="truncate">New {meta.label.toLowerCase()}</span>
    </button>
  {/each}
</div>
