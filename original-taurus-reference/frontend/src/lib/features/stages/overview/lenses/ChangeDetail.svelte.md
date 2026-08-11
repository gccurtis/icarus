# `ChangeDetail.svelte`

One change, rendered. Shared by `ActivityLens` (the change for the event you clicked) and by every
expandable row in `ActivityList`, so the two can never disagree about what a change looked like.

## Always a pair

```svelte
<div class="rounded-control border border-danger/25 bg-danger/5 p-2">
  <p class="text-caption font-medium text-danger">Before</p>
  …{change.before || (change.priorUnknown ? 'Not recoverable' : '—')}
</div>
<div class="rounded-control border border-success/25 bg-success/5 p-2">
  <p class="text-caption font-medium text-success">After</p>
```

Both panels render, always. A single "Result" panel — which is what this showed before the prior
text could be reconstructed — does not tell a reader what changed, because there is nothing to
compare against. The before value comes from
[`change-detail.ts`](../../../../systems/documents/change-detail.ts.md), which walks back through
older change sets to recover it.

Three distinct empty cases, deliberately not collapsed into one:

- `—` — nothing was there (an insert, a structural op with no before side).
- `Not recoverable` plus a muted line — a text edit whose prior value lies beyond the lookback
  budget or was pruned. Different from the above, and saying so is the whole reason `priorUnknown`
  exists as a flag rather than being inferred from an empty string.
- The `none` state — no change set corresponds to this event at all, because a rename or a create
  does not edit content.

## `compact`

Suppresses the op-label/scope header line (`Edited text · 1 row`). The activity lens wants it — the
change is the section's subject. A row inside `ActivityList` does not, because the row directly
above already says `edited`, and repeating it turns a tidy disclosure into two lines of chrome.

## Rendering the states

`loading`, `error`, `pruned`, and `none` each get one plain sentence rather than an icon or a
retry affordance. They are all "there is nothing to show you here, and here is why", and an
inspector section is not the place to make that dramatic.
