# API: `split`

Divides one content object into two, at a display position.

## Classification

- **Effect:** mutator
- **Transaction:** **yes** — one delete and two inserts, atomic
- **Entry:** [`split.ts`](split.ts)
- **Browser-reachable:** yes, via [`split.remote.ts`](split.remote.ts) — a `command`

## Signature

```ts
export const split = async (
  scope: Scope,
  input: SplitContentInput
): Promise<SplitContentResult>;
```

## The source is destroyed

This is not a copy. The original id **stops existing**, and two new version-1
objects take its place — which is why the result names both, and why a view
holding the old id has to replace it rather than add to it.

## Why it is a transaction

Both intermediate states are wrong:

- the original deleted with no replacements — the content has vanished
- two replacements alongside an original that still exists — the content is
  duplicated

A reader must see one state or the other and never a moment between, so the
delete and both inserts are one transaction. A concurrent write to the source
means the revision-gated delete matches no row, and the whole thing rolls back as
`stale-version`.

## Fresh identity, and dropped lists

Both results own **new atom and mark ids**. Neither inherits the source's
identity, and reusing ids would let a handle from the original address a position
in one of them.

**List-item marks are dropped**, so both results start ungrouped. A list spanning
the split would have to belong to one side or be duplicated into both, and
neither is what anyone means by splitting.

A style or link mark straddling the split point is cut at the boundary and
appears on both sides, so a bold phrase stays bold either side of the cut.

## Splitting at a line boundary consumes the break

The break existed to separate two lines that are now in two different objects.
Keeping it would give one of them a stray empty line.

## Failures

| Error code | Cause |
| --- | --- |
| `content-not-found` | no content object has that id |
| `stale-version` | the content moved under the caller, before or during the commit |
| `atom-not-found` | the split position names an atom this content does not have |
| `invalid-atom-range` | the split offset is not an integer or is out of bounds |
| `invalid-display-range` | the position is stale, invalid, or splits a character |

## Procedure Tree

```text
split(scope, input)
├── record("split", { contentId, expectedVersion })         ../shared/record.ts
├── projectDatabase(scope.projectId)                        $model/server/index.server
├── currentContent(database, contentId, expectedVersion)    ../shared/revisions.ts
├── resolveDisplayPosition(current, input.at)               ../shared/display-range.ts
├── contentId() twice                                       ../shared/ids.ts
├── splitRawContent(current, at, leftId, rightId)           split-raw-content.ts
│   ├── rawOffset / numericRange                            ../shared/ranges.ts
│   ├── atomId() / markId() for every copy                  ../shared/ids.ts
│   └── drop list-item marks; cut straddling marks
├── replaceOneWithTwo(database, original, left, right)      ../shared/revisions.ts
├── throwCommitConflict(id) when the transaction rolled back  ../shared/revisions.ts
└── resultOf(left), resultOf(right)                         ../shared/revisions.ts
```

## Supporting Procedures

| Procedure | Responsibility | File |
| --- | --- | --- |
| `splitRawContent` | builds the two version-1 objects, remapping every atom and mark | [split-raw-content.ts](split-raw-content.ts) |

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `revisions` | the revision gate, and the transaction that must not be split |
| `display-range` | the position a browser sends is checked in one place |
| `ranges` | the split offset and every mark interval are compared one way |
| `ids` | two new objects and all their atoms and marks need identity |
