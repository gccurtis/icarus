# API: `applyStyle`

Adds style properties over a display selection. Use it to turn text bold, set a
colour, change a font — bold and italic are properties of one mark kind, not
separate kinds. To take a property away, use
[`removeStyle`](../remove-style/remove-style.md); applying the property with a
falsy value would store a mark saying "not bold" rather than removing the
instruction.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** none — a single conditional update
- **Entry:** [`apply-style.ts`](apply-style.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `contentId` | `RichContentId` | The object to edit. |
| `expectedVersion` | `number` | Must equal the stored revision, and must be the revision that issued the segment IDs below. |
| `range` | `DisplayRange` | Start and end `DisplayPosition`s naming segments from that revision. Must be non-empty. |
| `properties` | `StyleProperties` | At least one known property with a well-typed value. `undefined` values are dropped. |

## Output

`ContentMutationResult` — the `contentId` and the committed revision.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `invalid-style` | No properties given after dropping `undefined`s, an unknown property name, or a value of the wrong type (booleans for the five flags, finite numbers for the four numeric properties, strings for the rest). |
| `content-not-found` | No object exists for `contentId`. |
| `stale-version` | The stored revision differs from `expectedVersion`, or another writer committed first. |
| `invalid-display-range` | A segment ID is unknown or from another revision, an offset is out of range or splits a character, the range is reversed, or the range is empty. |

## Effects

- Appends one `StyleMark` over the resolved raw range. Existing marks are left
  untouched; the projection resolves later marks over earlier ones.
- Advances the revision by one.

## Procedure Tree

```text
receive input
  1. validateStyle(properties) — before loading anything
  2. currentContent(store, contentId, expectedVersion)
  3. resolveDisplayRange(current, range)
  4. requireNonEmptyRange(current, resolved)
  5. addStyleMark(current.marks, resolved, properties, ids)
  6. commit(store, current, nextRevision(current, { marks }))
  7. return { contentId, version }
```

Validation runs first so a malformed request never reaches the database.

The new mark is appended rather than merged with overlapping marks. Resolution
happens at read time: `renderDisplayContent` walks marks in order and applies
each one that contains the segment, so the last mark wins per property. This
keeps `applyStyle` cheap and makes `removeStyle`, which does have to split
marks, the only place where mark arithmetic is needed.

## Supporting Procedures

None. Every step is shared with a neighbouring method.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `validateStyle` | Only known properties with well-typed values reach storage. |
| `currentContent` | Refuses to edit a revision the caller did not expect. |
| `resolveDisplayRange` | Turns versioned segment handles into a private raw range. |
| `requireNonEmptyRange` | An inline mark over an empty selection would be unreachable and invisible. |
| `addStyleMark` | Allocates the mark ID and appends the mark. |
| `nextRevision`, `commit` | Advances the revision by exactly one under a compare-and-swap. |
