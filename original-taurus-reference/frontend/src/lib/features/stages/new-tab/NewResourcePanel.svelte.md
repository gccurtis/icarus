# src/lib/features/stages/new-tab/NewResourcePanel.svelte — breakdown

Companion to [NewResourcePanel.svelte](NewResourcePanel.svelte). The **new-resource
panel** used by both the Overview stage and the New-tab launcher: an **AI create**
button on the left, a divider, then the per-type creates, spanning the full width — a
background-free row of clickable surfaces (not a carousel). Emits `oncreate(kind)` and
`onai()` — the parent decides what each does (Overview opens a new tab; the launcher
resolves its tab in place). It's a **background-free, border-free** row of clickable
surfaces (not a carousel).

## Script

### Props and the creatable kinds

```svelte
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
```

Takes `kindMeta` and two callbacks — `oncreate(kind)` for a blank per-type create and
`onai()` to open the Create-with-AI dialog. `NEW_KINDS` is the four creatable types.
`availableKinds` is the reactive set of kinds Omega can actually create; the rest disable.

## Markup

### AI create, divider, and the full-width creates

```svelte

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
```

A **border-free** row with **no background** — the create surfaces sit directly on the
stage. The **AI create** button (intel-toned + bordered,
`shrink-0`) stands out at the left; then a vertical divider; then the per-type create
buttons — each `flex-1` (sharing the width evenly) and transparent, brightening only when
creatable (`enabled:hover:bg-panel`). A kind Omega can't yet create is `disabled`, dimmed
to `opacity-50`, and carries a `title="Coming soon"` tooltip; its hover styling is gated
behind the `enabled:` variants so it stays flat. It's deliberately **not a carousel**: no
scroll; on very narrow widths the create labels `truncate` rather than scroll.
