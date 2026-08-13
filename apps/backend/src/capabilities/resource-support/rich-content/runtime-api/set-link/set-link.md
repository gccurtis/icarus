# API: `setLink`

Makes a display selection link to one or more targets. A target is either a URL
or another resource, named by kind and ID with an optional locator — Rich
Content stores the reference and does not resolve, validate, or authorize it.

`setLink` replaces rather than adds: existing links inside the selection are
cleared first, so a selection ends up with exactly the targets the caller named.
To clear without replacing, use [`removeLink`](../remove-link/remove-link.md).

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** none — a single conditional update
- **Entry:** [`set-link.ts`](set-link.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `contentId` | `RichContentId` | The object to edit. |
| `expectedVersion` | `number` | Must equal the stored revision that issued the segment IDs. |
| `range` | `DisplayRange` | The selection. Must be non-empty. |
| `targets` | `readonly LinkTarget[]` | At least one target. A URL target needs a non-empty `href`; a resource target needs a non-empty `resourceKind` and `resourceId`. |

## Output

`ContentMutationResult` — the `contentId` and the committed revision.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `invalid-link` | No targets given, an empty `href`, or an empty `resourceKind` or `resourceId`. |
| `content-not-found` | No object exists for `contentId`. |
| `stale-version` | The stored revision differs from `expectedVersion`, or another writer committed first. |
| `invalid-display-range` | A segment ID is unknown or from another revision, an offset is out of range or splits a character, the range is reversed, or the range is empty. |

## Effects

- Clears link marks over the selection, keeping the parts of each outside it.
- Appends one `LinkMark` carrying copies of the validated targets.
- Advances the revision by one.

## Procedure Tree

```text
receive input
  1. validateAndCopyTargets(targets) — before loading anything
     1.1. require at least one target
     1.2. for each: check the required fields and rebuild it field by field,
          carrying locator only when it was supplied
  2. currentContent(store, contentId, expectedVersion)
  3. resolveDisplayRange(current, range)
  4. requireNonEmptyRange(current, resolved)
  5. setLinkMark(current, resolved, targets, ids)
     5.1. removeLinksFromRange — split every overlapping link mark
     5.2. append one new LinkMark over the resolved range
  6. commit(store, current, nextRevision(current, { marks }))
  7. return { contentId, version }
```

Step 1.2 rebuilds each target rather than storing the caller's object. The
caller keeps no reference into stored state, so a later mutation of their object
cannot change what was persisted, and an unexpected extra property cannot ride
into the JSONB column.

## Supporting Procedures

None.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `validateAndCopyTargets` | A stored target is validated and copied, never aliased from the caller. |
| `currentContent` | Refuses to edit a revision the caller did not expect. |
| `resolveDisplayRange`, `requireNonEmptyRange` | Turns versioned handles into a raw range and rejects an empty one. |
| `setLinkMark`, `removeLinksFromRange` | Makes the selection carry exactly the named targets. |
| `nextRevision`, `commit` | Advances the revision by exactly one under a compare-and-swap. |
