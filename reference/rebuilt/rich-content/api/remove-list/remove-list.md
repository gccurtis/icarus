# API: `removeList`

Stops the lines a display selection touches being list items.

## Classification

- **Effect:** mutator
- **Transaction:** none — one compare-and-swap
- **Entry:** [`remove-list.ts`](remove-list.ts)
- **Browser-reachable:** yes, via [`remove-list.remote.ts`](remove-list.remote.ts) — a `command`

## Signature

```ts
export const removeList = async (
  scope: Scope,
  input: RemoveListInput
): Promise<ContentMutationResult>;
```

## Removing the middle of a list

The lines above and below keep their marks, and both still carry the same
`listId` — so `render-display` numbers them as one continuing sequence rather
than two lists.

That is the right answer: they *are* one list with a gap in it, and restarting
the second half at the start value would be a renumbering nobody asked for.

## Lines, not a range

Same widening as [`setList`](../set-list/set-list.md), and the same rule about a
selection ending at the start of a line not including it.

## Failures

| Error code | Cause |
| --- | --- |
| `content-not-found` | no content object has that id |
| `stale-version` | the content moved under the caller |
| `invalid-display-range` | the selection is stale, invalid, splits a character, or is reversed |

Removing a list where there is none is not a failure.

## Procedure Tree

```text
removeList(scope, input)
├── record("removeList", { contentId, expectedVersion })   ../shared/record.ts
├── projectDatabase(scope.projectId)                       $model/server/index.server
├── currentContent(database, contentId, expectedVersion)   ../shared/revisions.ts
├── resolveSelectedLines(current, input.range)             ../shared/display-range.ts
│   └── rawLines(content)                                  ../shared/raw-lines.ts
├── removeListMarks(current, lines)                        ../shared/list.ts
├── nextRevision(current, { marks })                       ../shared/revisions.ts
└── commit(database, current, candidate)                   ../shared/revisions.ts
```

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `list` | the membership rule `setList` also applies |
| `raw-lines` | a line is derived from atom order, in one place |
| `display-range` | every position a browser sends is checked in one place |
| `revisions` | the revision gate and the compare-and-swap |
