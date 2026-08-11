# Facts.svelte

The read-only label/value list at the tail of most inspector lenses — words, characters,
lines, block counts.

## A definition list, optionally divided

```svelte
<dl class={cn('space-y-1.5', divided && 'border-t border-border pt-3')}>
  {#each items as item (item.label)}
    <div class="flex items-baseline justify-between gap-3">
      <dt class="shrink-0 text-caption text-muted">{item.label}</dt>
      <dd class="truncate text-caption text-secondary">{item.value}</dd>
    </div>
  {/each}
</dl>
```

A real `<dl>`/`<dt>`/`<dd>` rather than styled divs, so the pairs are announced as
label/value and the list is addressable in tests. Values arrive pre-formatted as strings —
the lens owns the counting (it knows whether it is summing one block or many), and this
component only lays them out.

`divided` adds the top rule that separates the facts from the controls above. It sits on the
`<dl>` itself rather than a wrapper so callers do not have to add a nesting level for what is
purely a border. The label column is `shrink-0` and the value `truncate`, so a long value
gives way rather than pushing the label out of the narrow panel.
