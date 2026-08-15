# API: `removeLink`

Removes any link covering a display selection.

## Classification

- **Effect:** mutator
- **Transaction:** none — one compare-and-swap
- **Entry:** [`remove-link.ts`](remove-link.ts)
- **Browser-reachable:** yes, via [`remove-link.remote.ts`](remove-link.remote.ts) — a `command`

## Signature

```ts
export const removeLink = async (
  scope: Scope,
  input: RemoveLinkInput
): Promise<ContentMutationResult>;
```

## A partly-selected link is split, not deleted

Unlinking the middle of a linked phrase leaves the two ends linked. The mark
becomes the part before the selection and the part after, each with a new id.

That is the same split [`removeStyle`](../remove-style/remove-style.md)
performs, which is why `markBefore` and `markAfter` live in `shared/`.

## No properties to name

Where `removeStyle` takes a list of properties, this takes none: a link is one
thing, and there is no half of it to keep.

## Failures

| Error code | Cause |
| --- | --- |
| `content-not-found` | no content object has that id |
| `stale-version` | the content moved under the caller |
| `invalid-display-range` | the selection is stale, invalid, splits a character, is reversed, or is empty |

Removing a link where there is none is not a failure. The selection simply
carries no link mark afterwards, which is what it already did.

## Procedure Tree

```text
removeLink(scope, input)
├── record("removeLink", { contentId, expectedVersion })    ../shared/record.ts
├── projectDatabase(scope.projectId)                        $model/server/index.server
├── currentContent(database, contentId, expectedVersion)    ../shared/revisions.ts
├── resolveDisplayRange(current, input.range)               ../shared/display-range.ts
├── requireNonEmptyRange(current, range)                    ../shared/display-range.ts
├── removeLinksFromRange(current, range)                    ../shared/link.ts
│   ├── rangesOverlap / intersectRanges                     ../shared/ranges.ts
│   └── markBefore / markAfter                              ../shared/mark-pieces.ts
├── nextRevision(current, { marks })                        ../shared/revisions.ts
└── commit(database, current, candidate)                    ../shared/revisions.ts
```

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `link` | the removal `setLink` also performs before appending |
| `mark-pieces` | the same split `removeStyle` performs |
| `display-range` | every position a browser sends is checked in one place |
| `revisions` | the revision gate and the compare-and-swap |
