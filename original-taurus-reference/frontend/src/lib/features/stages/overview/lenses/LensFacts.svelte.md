# `LensFacts.svelte`

The label/value tail shared by the Overview lenses — a `<dl>` of muted labels against right-aligned,
truncating values.

```svelte
<dl class="space-y-1.5">
  {#each items as item (item.label)}
    <div class="flex items-baseline justify-between gap-3">
      <dt class="shrink-0 text-caption text-muted">{item.label}</dt>
      <dd class="min-w-0 truncate text-right text-caption text-secondary">{item.value}</dd>
    </div>
  {/each}
</dl>
```

It is a deliberate local twin of the document stage's `details/controls/Facts.svelte` rather than a
shared import: **stages never import each other** (the ownership-is-the-tree rule), and promoting a
two-element `<dl>` into `src/lib/components/` would add a library entry that carries no decision.
`components/KeyValue.svelte` is close but renders values in `font-mono tabular-nums`, which suits
numbers and not phrases like "Everyone in the project".

If a third stage needs the same list, that is the point at which it earns a place in the component
library.
