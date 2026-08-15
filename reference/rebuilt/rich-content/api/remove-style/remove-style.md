# API: `removeStyle`

Removes named style properties across a display selection.

## Classification

- **Effect:** mutator
- **Transaction:** none — one compare-and-swap
- **Entry:** [`remove-style.ts`](remove-style.ts)
- **Browser-reachable:** yes, via [`remove-style.remote.ts`](remove-style.remote.ts) — a `command`

## Signature

```ts
export const removeStyle = async (
  scope: Scope,
  input: RemoveStyleInput
): Promise<ContentMutationResult>;
```

## Named properties, not "clear all"

A range usually carries styles from more than one decision. Clearing everything
would discard the ones the caller did not ask about, and there would be no way to
express "un-bold this" without also losing its colour.

## Marks are split, not deleted

Each affected mark becomes up to three: the part before the selection, the part
inside it with those properties dropped, and the part after. A style extending
past the selection therefore survives outside it.

A mark whose properties are *all* removed disappears rather than lingering as an
empty one — an empty style mark has no effect and would accumulate with every
edit.

Each piece gets a **new id**, because it is a different mark covering a different
range; reusing the id would make two marks indistinguishable in a stored row.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-style` | no properties named, or one that is not a style property |
| `content-not-found` | no content object has that id |
| `stale-version` | the content moved under the caller |
| `invalid-display-range` | the selection is stale, invalid, splits a character, is reversed, or is empty |

## Procedure Tree

```text
removeStyle(scope, input)
├── record("removeStyle", { contentId, expectedVersion })     ../shared/record.ts
├── projectDatabase(scope.projectId)                          $model/server/index.server
├── currentContent(database, contentId, expectedVersion)      ../shared/revisions.ts
├── resolveDisplayRange(current, input.range)                 ../shared/display-range.ts
├── requireNonEmptyRange(current, range)                      ../shared/display-range.ts
├── removeStyleProperties(current, range, input.properties)   ../shared/style.ts
│   ├── rangesOverlap / intersectRanges                       ../shared/ranges.ts
│   └── markBefore / markAfter                                ../shared/mark-pieces.ts
├── nextRevision(current, { marks })                          ../shared/revisions.ts
└── commit(database, current, candidate)                      ../shared/revisions.ts
```

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `style` | the property vocabulary this and `applyStyle` must share |
| `mark-pieces` | the same split `removeLink` performs |
| `display-range` | every position a browser sends is checked in one place |
| `revisions` | the revision gate and the compare-and-swap |
