# API: `removeStyle`

Removes named style properties over a display selection, leaving every other
property intact. It names properties rather than marks, because a caller holds
display segments and has never seen a mark.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** none — a single conditional update
- **Entry:** [`remove-style.ts`](remove-style.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `contentId` | `RichContentId` | The object to edit. |
| `expectedVersion` | `number` | Must equal the stored revision that issued the segment IDs. |
| `range` | `DisplayRange` | The selection. Must be non-empty. |
| `properties` | `readonly (keyof StyleProperties)[]` | The property names to remove. Must be non-empty and all known. |

## Output

`ContentMutationResult` — the `contentId` and the committed revision.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `content-not-found` | No object exists for `contentId`. |
| `stale-version` | The stored revision differs from `expectedVersion`, or another writer committed first. |
| `invalid-display-range` | A segment ID is unknown or from another revision, an offset is out of range or splits a character, the range is reversed, or the range is empty. |
| `invalid-style` | The property list is empty or names a property that does not exist. |

Note the ordering difference from `applyStyle`: this method loads and resolves
the range *before* validating the property list, because the property check
happens inside `removeStyleProperties`.

## Effects

- Rewrites the mark list: every style mark overlapping the selection is replaced
  by up to three marks — the part before, the overlapping part with the named
  properties dropped, and the part after — each with a fresh mark ID. A mark
  left with no properties is dropped entirely.
- Marks that do not overlap, and non-style marks, are carried over unchanged.
- Advances the revision by one.

## Procedure Tree

```text
receive input
  1. currentContent(store, contentId, expectedVersion)
  2. resolveDisplayRange(current, range)
  3. requireNonEmptyRange(current, resolved)
  4. removeStyleProperties(current, resolved, properties, ids)
     4.1. reject an empty or unknown property list
     4.2. for each mark:
          || not a style mark, or it does not overlap the selection
             4.2.a.1. keep it as it is
          || it overlaps
             4.2.b.1. compute the overlap
             4.2.b.2. emit markBefore, if any text precedes the overlap
             4.2.b.3. emit the overlap carrying the surviving properties,
                      unless none survive
             4.2.b.4. emit markAfter, if any text follows the overlap
  5. commit(store, current, nextRevision(current, { marks }))
  6. return { contentId, version }
```

Splitting rather than deleting is what makes partial removal correct: a bold
mark spanning a whole line, with bold removed from its middle word, must leave
the two flanking runs bold.

## Supporting Procedures

None.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `currentContent` | Refuses to edit a revision the caller did not expect. |
| `resolveDisplayRange`, `requireNonEmptyRange` | Turns versioned handles into a raw range and rejects an empty one. |
| `removeStyleProperties` | Splits overlapping marks and drops only the named properties. |
| `markBefore`, `markAfter` (via `removeStyleProperties`) | Keeps the parts of a mark outside the selection. |
| `nextRevision`, `commit` | Advances the revision by exactly one under a compare-and-swap. |
