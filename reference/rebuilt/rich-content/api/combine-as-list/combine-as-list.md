# API: `combineAsList`

Folds several content objects into one list, in caller order.

## Classification

- **Effect:** mutator
- **Transaction:** **yes** — many deletes and one insert, atomic
- **Entry:** [`combine-as-list.ts`](combine-as-list.ts)
- **Browser-reachable:** yes, via [`combine-as-list.remote.ts`](combine-as-list.remote.ts) — a `command`

## Signature

```ts
export const combineAsList = async (
  scope: Scope,
  input: CombineAsListInput
): Promise<ContentMutationResult>;
```

## Every source is destroyed

All of the input ids **stop existing** and one new version-1 object replaces
them, which is why this reports a single result. A view holding any of them has
to drop all of them.

## Why it is a transaction, and why every revision is checked

Each source is deleted at the revision the caller expected. If any one of them
moved, the whole combine rolls back.

That is stronger than it looks: combining a stale subset would **silently discard
whatever the other writer had added** to the source that moved, and the caller
would see a successful result. Refusing the whole operation is the only answer
that does not lose someone's work.

## Duplicates are refused before anything is read

The same object twice would be deleted once and counted twice, and the second
delete would fail the revision check — reporting `stale-version` for something
that has nothing to do with concurrency. `invalid-list-source` says what is
actually wrong.

## Each source must already be one logical line

A multi-line source would become several list items from one input, and which of
them the caller meant is not recoverable. It is refused, and the caller runs
[`split`](../split/split.md) first.

## Inline formatting survives

The copy is **atom-based, not text-based**: every style and link mark is remapped
onto the copied atoms rather than lost to a string concatenation. A source's own
list membership does not survive, because it is becoming an item in *this* list
and carrying the old one would put it in two.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-list-presentation` | a separator or marker containing a line break, an empty marker, or a non-integer start |
| `invalid-list-source` | no items, duplicate items, or a source that is not one logical line |
| `content-not-found` | one of the ids names no content object |
| `stale-version` | any source moved under the caller, before or during the commit |

## Procedure Tree

```text
combineAsList(scope, input)
├── record("combineAsList", { itemCount, kind })            ../shared/record.ts
├── validateListPresentation(input.presentation)            ../shared/list.ts
├── reject an empty or duplicated item set as invalid-list-source
├── projectDatabase(scope.projectId)                        $model/server/index.server
├── currentContent(database, id, expectedVersion) per item  ../shared/revisions.ts
├── contentId()                                             ../shared/ids.ts
├── combineRawContentAsList(sources, id, presentation)      combine-raw-content.ts
│   ├── rawLines / lineRange                                ../shared/raw-lines.ts
│   ├── copyListPresentation(presentation)                  ../shared/list.ts
│   └── atomId() / markId() / listId()                      ../shared/ids.ts
├── replaceManyWithOne(database, originals, combined)       ../shared/revisions.ts
├── throwCommitConflict(id) when the transaction rolled back  ../shared/revisions.ts
└── resultOf(combined)                                      ../shared/revisions.ts
```

## Supporting Procedures

| Procedure | Responsibility | File |
| --- | --- | --- |
| `combineRawContentAsList` | copies every source's atoms into one object and remaps its marks | [combine-raw-content.ts](combine-raw-content.ts) |

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `revisions` | the revision gate per source, and the transaction that must not be split |
| `list` | the presentation rules `setList` also applies |
| `raw-lines` | the one-line check, and each item's range |
| `ids` | a new object and all its atoms and marks need identity |
