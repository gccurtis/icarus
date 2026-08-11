# `ResourcesLens.svelte`

The lens for the checkbox set — what you have selected, summarised.

```svelte
<p class="text-body-sm font-medium text-primary">
  {selected.length} {selected.length === 1 ? 'resource' : 'resources'} selected
</p>
```

Below that: a kind breakdown (icon, label, count), the newest and oldest update times in the set, and
how many of them are access-restricted.

## Read-only on purpose

This lens offers no actions. Download and Import for the selected set are already in the table header
a few pixels away, and repeating them here would be a second copy of a control rather than new
information — the style spec's "few things visible, right things visible". The copy points at the
header instead ("Use the table header to download or clear the set") so the lens is not a dead end.

## Why the set has a lens at all

Selecting several resources and being shown nothing was the gap: the table said "3 selected" and the
inspector said "nothing selected", which reads as the app disagreeing with itself. A summary is the
honest thing to put there, and it answers the question a multi-selection actually raises — *what did
I just select?* — before you act on it.

Counts come from `kindBreakdown`/`updatedSpan` in `lens-helpers.ts`; the `span` guard means an empty
set renders the header alone rather than an "Invalid Date" row.
