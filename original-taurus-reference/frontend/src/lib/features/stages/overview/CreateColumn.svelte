<script lang="ts">
  import type { Component } from 'svelte';
  import { cn } from '$lib/utils';
  import { type Tone } from '$lib/components';
  import { iconTileClass } from '$data/projects';
  import { availableKinds, type ResourceKind } from '$data/resources';

  type KindMeta = Record<ResourceKind, { icon: Component; tone: Tone; label: string }>;

  let { kindMeta, oncreate }: { kindMeta: KindMeta; oncreate: (kind: ResourceKind) => void } = $props();

  // The creatable kinds, top to bottom (general is the upload catch-all, not offered).
  // A kind Omega can't create yet renders disabled with a "Soon" hint.
  const NEW_KINDS: ResourceKind[] = ['document', 'spreadsheet', 'slides', 'chat'];
</script>

<section class="flex h-full flex-col">
  <p class="mb-2 text-label uppercase tracking-wide text-muted">Create</p>
  <!-- Bordered panel; each kind is a divided section, matching the activity + table style. -->
  <div class="flex flex-1 flex-col divide-y divide-border overflow-hidden rounded-panel border border-border">
    {#each NEW_KINDS as k (k)}
      {@const meta = kindMeta[k]}
      {@const Icon = meta.icon}
      {@const enabled = $availableKinds.includes(k)}
      <button
        onclick={() => oncreate(k)}
        disabled={!enabled}
        title={enabled ? undefined : 'Coming soon'}
        class="dur-small group flex flex-1 items-center gap-3 px-3 text-left transition-colors enabled:hover:bg-panel disabled:opacity-50"
      >
        <span class={cn('flex size-7 shrink-0 items-center justify-center rounded-control', iconTileClass(meta.tone))}>
          <Icon class="size-3.5" />
        </span>
        <span class="min-w-0 flex-1 truncate text-body-sm font-medium text-secondary transition-colors group-enabled:group-hover:text-primary">
          {meta.label}
        </span>
        {#if !enabled}<span class="shrink-0 pr-1 text-caption text-muted">Soon</span>{/if}
      </button>
    {/each}
  </div>
</section>
