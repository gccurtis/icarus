# src/lib/features/stages/overview/CreateColumn.svelte — breakdown

Companion to [CreateColumn.svelte](CreateColumn.svelte). The left-hand **Create** column
on the Overview stage: a "Create" eyebrow over a **bordered panel** whose divided rows
are the creatable resource kinds, each an icon-tile-plus-label that creates a blank
resource of that kind. The bordered, divided panel matches the activity feed and the
resource table so the three regions read as one family.

## Script

### Props and the creatable kinds

```svelte
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
```

Takes `kindMeta` (the shared icon/tone/label map) and one callback, `oncreate(kind)` —
Overview creates a resource of that kind and opens it in a new tab. `NEW_KINDS` is the
four offered types; `general` is the upload catch-all, excluded here. `availableKinds` is
the reactive set of kinds Omega can actually create; anything outside it renders disabled.

## Markup

### "Create" header over the bordered, divided panel

```svelte

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
```

The section is `h-full` so it fills its (equal-height) grid cell. Under the "Create"
eyebrow, a `rounded-panel border` container holds the kind rows, split by `divide-y`
into distinct sections. Each row is `flex-1` so the four kinds share the panel height
evenly; an `iconTileClass`-tinted tile reads the kind's color, and the label is just the
kind name (the verb lives in the header). A kind Omega can't yet create (`enabled` is
false) is `disabled`, dimmed to `opacity-50`, carries a `title="Coming soon"` tooltip, and
appends a small "Soon" hint. Hover styling is gated behind the `enabled:`/`group-enabled:`
variants, so only creatable rows fill (`enabled:hover:bg-panel`) and brighten their label.
