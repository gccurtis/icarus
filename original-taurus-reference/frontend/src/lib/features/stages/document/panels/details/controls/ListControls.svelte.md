# ListControls.svelte

Marker type and ordered-start for a list block, shown in the Block lens when the inspected
block is a list.

## Marker type carries the start along

```svelte
onchange={(event: Event) =>
  $editorSession?.actions.setListType(
    (event.currentTarget as HTMLSelectElement).value,
    block.listStart
  )}
```

`setListType` takes both the marker type and the ordered start, so switching bullet → numbered
→ bullet → numbered has to re-send the existing start or it would silently reset to 1. Reading
it from the block rather than from local state means the value is always whatever the document
currently holds.

## Start-at is conditional

```svelte
{#if block.listType === 'ordered'}
```

Only a numbered list has a start ordinal, so the field appears with the marker type that gives
it meaning rather than sitting disabled. It writes through the same action with `'ordered'`
fixed, since that is the only kind that can reach it.

Values come straight from `block` (an `InspectedBlock`) rather than local draft state — these
are steppers and selects with no partial-input problem, so there is nothing to protect from a
mid-edit overwrite.

## The hint is the rest of the feature

```svelte
<p class="text-caption text-muted">Enter adds an item · Tab nests · click a checkbox to toggle it.</p>
```

Adding items, nesting, and toggling checkboxes are keyboard and click affordances in the editor
itself, not inspector controls. Documenting them here is deliberate: the panel is where a user
looks to find out what a list can do, and leaving them undiscoverable would make the list look
less capable than it is.
