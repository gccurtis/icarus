# API: `removeList`

Removes list membership from the lines a selection touches. Like
[`setList`](../set-list/set-list.md) it works on complete logical lines, and
like it, it changes no text: only the marks that made those lines list items.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** none — a single conditional update
- **Entry:** [`remove-list.ts`](remove-list.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `contentId` | `RichContentId` | The object to edit. |
| `expectedVersion` | `number` | Must equal the stored revision that issued the segment IDs. |
| `range` | `DisplayRange` | The selection. Expands to complete lines. |

## Output

`ContentMutationResult` — the `contentId` and the committed revision.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `content-not-found` | No object exists for `contentId`. |
| `stale-version` | The stored revision differs from `expectedVersion`, or another writer committed first. |
| `invalid-display-range` | A segment ID is unknown or from another revision, an offset is out of range or splits a character, or the range is reversed. |

A selection whose lines carry no list marks is not an error; the mutation
commits with an unchanged mark list.

## Effects

- Drops every list-item mark on a selected line.
- Text atoms, style marks, and link marks are untouched. Markers and separators
  were never text, so nothing needs deleting from the content.
- Removing the middle of a list leaves the lines above and below still sharing
  their original `listId`, so an ordered list's numbering continues across the
  gap.
- Advances the revision by one.

## Procedure Tree

```text
receive input
  1. currentContent(store, contentId, expectedVersion)
  2. resolveSelectedLines(current, range)
  3. removeListMarks(current, lines)
     3.1. keep every mark that is not a list item
     3.2. keep a list-item mark whose line is not in the selection
     3.3. drop the rest
  4. commit(store, current, nextRevision(current, { marks }))
  5. return { contentId, version }
```

This is the only mutator besides `display` that takes no ID factory: it creates
nothing, so it allocates no identity.

## Supporting Procedures

None.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `currentContent` | Refuses to edit a revision the caller did not expect. |
| `resolveSelectedLines` | Expands a character selection to the complete lines it touches — the same expansion `setList` uses, so the two are exact inverses over a selection. |
| `removeListMarks` | Drops list marks by line, leaving all other marks alone. |
| `nextRevision`, `commit` | Advances the revision by exactly one under a compare-and-swap. |
