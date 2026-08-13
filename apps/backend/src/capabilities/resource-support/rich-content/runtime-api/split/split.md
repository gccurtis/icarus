# API: `split`

Divides one content object into two independent ones at a display position.
This is the operation behind pressing Enter when the result should be two
separately-owned content objects rather than a new line inside one.

It is not an in-place update. The source is destroyed and two new version-1
objects are created, because ownership of both results has to be explicit: a
consumer holding the old `RichContentId` must be forced to record which of the
two it now refers to, not silently keep pointing at one of them.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** PG transaction — one conditional delete plus two inserts
- **Entry:** [`split.ts`](split.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `contentId` | `RichContentId` | The object to consume. |
| `expectedVersion` | `number` | Must equal the stored revision that issued the segment ID. |
| `at` | `DisplayPosition` | Where to divide, as a segment and an offset within it. |

## Output

`SplitContentResult` — `{ left, right }`, each a `ContentMutationResult` naming
a new content ID at version 1. The source ID no longer resolves; a later
`display` on it fails `content-not-found`.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `content-not-found` | No object exists for `contentId`. |
| `stale-version` | The stored revision differs from `expectedVersion`, or the conditional delete matched nothing because another writer committed first. |
| `invalid-display-range` | The segment ID is unknown or from another revision, or the offset is out of range or splits a character. |
| `atom-not-found` | The resolved position names an atom that is not a text atom. |
| `invalid-atom-range` | The resolved offset is not an integer within the target atom. |

## Effects

- Deletes the source row and inserts two rows, atomically.
- Allocates two content IDs, one atom ID per copied atom plus two for the
  divided one, and one mark ID per copied mark piece.
- Drops all list-item marks: both results start ungrouped.

## Procedure Tree

```text
receive input
  1. currentContent(store, contentId, expectedVersion)
  2. resolveDisplayPosition(current, at)
  3. ids.contentId() twice — left, then right
  4. splitRawContent(current, at, leftId, rightId, ids)
     4.1. locate the target text atom and validate the offset
     4.2. copy atoms before it into the left object, after it into the right,
          each with a fresh ID
     4.3. divide the target atom into two new text atoms, one per side
          || the position is offset 0 and a line break precedes the atom
             4.3.a.1. consume that line break, so the left result gains no
                      trailing empty line
          || the position is at the atom's end and a line break follows
             4.3.b.1. consume that line break, so the right result gains no
                      leading empty line
     4.4. for each style and link mark:
          || it starts before the split offset
             4.4.a.1. copy it to the left, ending at the split if it crosses
          || it ends after the split offset
             4.4.b.1. copy it to the right, starting at the split if it crosses
     4.5. skip every list-item mark
  5. store.replaceOneWithTwo({ id, expectedVersion: current.version },
                             left, right)
     || the conditional delete matched no row
        5.a.1. roll back and throwCommitConflict — stale-version
  6. return { left: resultOf(left), right: resultOf(right) }
```

Step 4.3's line-break consumption is what makes splitting at an existing line
boundary produce two clean objects. Without it, splitting `"first\nsecond"`
before `second` would leave the left object with a trailing empty line.

Step 4.2 regenerates every atom and mark ID because the results are new objects
that own their copied state, not continuations of the source. Any display handle
a consumer held is invalid afterwards, which the destroyed content ID already
makes obvious.

## Supporting Procedures

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `splitRawContent` | Builds the two version-1 objects from the source and the raw position. | [split-raw-content.ts](split-raw-content.ts) |

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `currentContent` | Refuses to consume a revision the caller did not expect. |
| `resolveDisplayPosition` | Turns a versioned segment handle into a private atom position. |
| `numericRange`, `rawOffset` (via `splitRawContent`) | Decides which side of the split each mark falls on, by absolute offset rather than atom identity. |
| `resultOf` | Reports each result as identity and revision only. |
| `throwCommitConflict` | Reports a lost race as `stale-version`, exactly as an in-place commit would. |
