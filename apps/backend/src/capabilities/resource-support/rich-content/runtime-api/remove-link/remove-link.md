# API: `removeLink`

Clears links over a display selection. It is
[`setLink`](../set-link/set-link.md) without the replacement step: the same
splitting of overlapping marks, and no new mark afterwards.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** none — a single conditional update
- **Entry:** [`remove-link.ts`](remove-link.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `contentId` | `RichContentId` | The object to edit. |
| `expectedVersion` | `number` | Must equal the stored revision that issued the segment IDs. |
| `range` | `DisplayRange` | The selection. Must be non-empty. |

There is no target list: the method removes whatever links the selection
carries.

## Output

`ContentMutationResult` — the `contentId` and the committed revision.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `content-not-found` | No object exists for `contentId`. |
| `stale-version` | The stored revision differs from `expectedVersion`, or another writer committed first. |
| `invalid-display-range` | A segment ID is unknown or from another revision, an offset is out of range or splits a character, the range is reversed, or the range is empty. |

A selection carrying no links is not an error. The mutation commits, advancing
the revision, with an unchanged mark list.

## Effects

- Every link mark overlapping the selection is replaced by its parts outside the
  selection, each with a fresh mark ID. A mark wholly inside the selection
  disappears.
- Style and list marks are untouched.
- Advances the revision by one.

## Procedure Tree

```text
receive input
  1. currentContent(store, contentId, expectedVersion)
  2. resolveDisplayRange(current, range)
  3. requireNonEmptyRange(current, resolved)
  4. removeLinksFromRange(current, resolved, ids)
     4.1. for each mark:
          || not a link mark, or it does not overlap the selection
             4.1.a.1. keep it as it is
          || it overlaps
             4.1.b.1. compute the overlap
             4.1.b.2. emit markBefore and markAfter, whichever exist
  5. commit(store, current, nextRevision(current, { marks }))
  6. return { contentId, version }
```

## Supporting Procedures

None.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `currentContent` | Refuses to edit a revision the caller did not expect. |
| `resolveDisplayRange`, `requireNonEmptyRange` | Turns versioned handles into a raw range and rejects an empty one. |
| `removeLinksFromRange` | Keeps the parts of each link mark outside the selection — the same procedure `setLink` uses before installing its replacement. |
| `nextRevision`, `commit` | Advances the revision by exactly one under a compare-and-swap. |
