# ActivityFilterDialog.svelte

Builds an [`ActivityFilter`](activity-filter.ts.md): one person, and any set of resources — named
individually or a whole kind at once. Rendered by the context rail's History lens and by the Overview
stage's Activity box, so the two cannot drift.

## Why a dialog and not a row of dropdowns

A person is a bounded list, so it *is* a `Select`. Resources are not: a project can hold hundreds,
and there is no dropdown that makes picking one out of three hundred pleasant. They need a search
field, groups, and checkboxes — which is a panel's worth of controls, which is a dialog. That
asymmetry is the entire reason this is a modal rather than a popover.

## Draft state, so Cancel cancels

```svelte
let draft = $state<ActivityFilter>({ ...EMPTY_FILTER });
$effect(() => {
  if (open) {
    draft = { actorIds: [...filter.actorIds], resourceIds: [...filter.resourceIds], kinds: [...filter.kinds] };
    query = '';
  }
});
```

Edits go to a copy that is re-seeded from the live filter each time the dialog opens, and only
`Apply` calls `onapply`. Arrays are copied element-wise rather than by reference, or "Cancel" would
still have mutated the caller's filter.

## "All" is a kind, not a bulk tick

```svelte
function toggleKind(kind: ResourceKind) {
  const has = draft.kinds.includes(kind);
  draft = {
    ...draft,
    kinds: has ? … : [...draft.kinds, kind],
    resourceIds: has ? draft.resourceIds : draft.resourceIds.filter((id) => resources.find((r) => r.id === id)?.kind !== kind)
  };
}
```

The per-group **All** control adds the *kind* to the filter rather than ticking every resource id in
it. That difference is visible later: a document created after the filter was built still matches
"all documents", where a snapshot of ids would silently miss it.

Selecting a kind also **drops** any individually-named resource of that kind. They are redundant
under the kind, and leaving them would be invisible state the user cannot see or clear — the rail
would show two chips for one intent. Their rows render checked-and-disabled while the kind is on, so
the redundancy is legible rather than mysterious.

## Composition, stated where it is chosen

```svelte
<p class="text-caption text-muted">
  A person narrows to their events; resources and whole kinds combine — “this document or any deck”.
</p>
```

The AND/OR rule is the one thing about this dialog a user cannot infer from the controls, so it is
written under them rather than left to be discovered.

## Small mechanics worth knowing

`Checkbox` is itself a `<label>`, so rows pass their text as its children instead of wrapping it in a
second label (nested labels are invalid and break click-to-toggle). "Anyone" is the empty-string
option of the person `Select`, so clearing that dimension is a normal choice rather than an extra
control. `Clear all` is disabled unless the draft is active, and the footer keeps `Cancel` and
`Apply` distinct — a dialog that applied on close would make "Cancel" a lie.
