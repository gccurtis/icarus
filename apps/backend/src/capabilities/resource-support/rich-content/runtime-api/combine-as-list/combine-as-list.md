# API: `combineAsList`

Consumes several independent content objects, in the order the caller gives, and
creates one object whose lines are the sources as list items.

Like [`split`](../split/split.md), it destroys what it consumes. Every source ID
stops resolving and one new version-1 object takes their place, so no consumer
is left holding an ID that silently now means part of something else.

Each source becomes exactly one list item, so each must contain exactly one
logical line. A multiline source must be separated with `split` first.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** PG transaction — one conditional delete per source plus one insert
- **Entry:** [`combine-as-list.ts`](combine-as-list.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `items` | `readonly ContentRevision[]` | The sources, in the order they should appear. Non-empty, with unique content IDs, each carrying its own `expectedVersion`. |
| `presentation` | `ListPresentation` | Unordered with a marker string, or ordered with a starting integer. Both carry a separator. |

## Output

`ContentMutationResult` — the new `contentId` at version 1.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `invalid-list-presentation` | The separator contains a newline; an unordered marker is empty or contains a newline; an ordered start is not a safe integer. |
| `invalid-list-source` | `items` is empty, or names the same content ID twice, or a source contains more than one logical line. |
| `content-not-found` | A source ID does not resolve. |
| `stale-version` | A source's stored revision differs from its `expectedVersion`, or a conditional delete matched nothing because another writer committed first. |

## Effects

- Deletes every source row and inserts one replacement row, atomically. If any
  delete matches nothing, every deletion rolls back and no row is inserted.
- Allocates one content ID, one list ID, one atom ID per copied atom plus one
  per inter-item line break, and one mark ID per copied mark and per list item.
- Drops each source's own list-item marks; the new list's marks replace them.

## Procedure Tree

```text
receive input
  1. validateListPresentation(presentation)
  2. reject an empty item list, or duplicate content IDs
  3. load every source concurrently through currentContent, each gated on its
     own expectedVersion
  4. ids.contentId()
  5. combineRawContentAsList(sources, id, presentation, ids)
     5.1. allocate one shared list ID
     5.2. for each source, in caller order:
          5.2.1. require exactly one logical line
          || not the first source
             5.2.a.1. append a LineBreakAtom to separate the items
          5.2.2. copy its atoms with fresh IDs, recording the mapping
          5.2.3. copy its style and link marks onto the copied atoms
          5.2.4. skip its list-item marks
          5.2.5. add one ListItemMark over the item's line, sharing the list ID
  6. store.replaceManyWithOne(sources at their expected revisions, combined)
     || any conditional delete matched no row
        6.a.1. roll back every deletion and throwCommitConflict — stale-version
  7. return resultOf(combined)
```

Steps 1–2 run before anything is loaded, so a malformed request never reads the
database.

Step 5.2.2 copies **atoms**, not display text. That is why a bold word or a link
inside a source survives becoming a list item: nothing is ever flattened to a
string and re-parsed. The current model has text and line-break atoms; a future
atom kind joins by defining how it is copied.

Step 6 uses one predicate per source inside a single transaction. Losing the
race on the last of five sources leaves all five intact, which the store's tests
cover directly.

## Supporting Procedures

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `combineRawContentAsList` | Builds the version-1 replacement from the loaded sources. | [combine-raw-content.ts](combine-raw-content.ts) |

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `validateListPresentation` | The same presentation rules `setList` enforces. |
| `currentContent` | Refuses to consume any source at a revision the caller did not expect. |
| `rawLines`, `lineRange` (via `combineRawContentAsList`) | Enforces one logical line per source and spans each list mark over its whole item. |
| `copyListPresentation` | Stores a copy of the caller's presentation, not a reference to it. |
| `resultOf`, `throwCommitConflict` | Reports the result, and a lost race, exactly as every other mutation does. |
