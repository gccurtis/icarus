# Spreadsheet revisions

No tables of its own. This is what [`resourceSnapshots`](revisions.md) and
[`changeSets`](revisions.md) hold for a spreadsheet, which is not what they hold
for a document or a deck.

**A spreadsheet's content is rows, so there is nothing to replay.** The cells in
`sheetCells` *are* the current state — a mutation writes one and it is
immediately what everyone reads. The leader-plus-recent machinery exists to keep
a large body from being rewritten on every keystroke, and a table has no such
problem.

---

## What each table holds

| | a document or a deck | a spreadsheet |
| --- | --- | --- |
| `resourceSnapshots` | the whole body, in `base` and `leader` | only the grid body — rows, columns, format rules, print, styles |
| `role` | `base`, `leader`, `checkpoint` | `leader`, always |
| `changeSets` | the read path — recent sets apply over the leader | a journal: history and undo, never read to render |
| `tier` | `recent` until consolidated, then `historical` | `historical` on write; there is nothing to consolidate |
| current content | leader + recent sets applied | the rows, as they are |

The tables are unchanged. What differs is which of their columns mean anything.

**`part` still applies**, to the grid body rather than to content. A million rows
is roughly thirty-six parts of the `rows` array, and `rowPartCounts` in part 0 is
what makes one findable by ordinal.

---

## What an op addresses

A spreadsheet's ops name ids, the way every other resource's do — the one
exception, a cell addressed as `cells.B7`, is gone with the body that held it.

| target | ops | path |
| --- | --- | --- |
| `cell` | `set` `remove` | the cell's row and column ids |
| `gridRow` | `insert` `remove` `move` | the row id |
| `gridColumn` | `insert` `remove` `move` | the column id |
| `formatRule` | `set` `insert` `remove` | the rule's position |
| `field` | `set` | a body scalar — `frozenRows`, `print`, `styles` |

**`cell` takes no `insert` and no `move`.** A cell has no ordinal position to
insert at: `set` is how one comes into being, and where it sits is which row and
column it names. Moving cells is a row or column operation, or — for a partial
range — a set and a remove.

**A merge is a `set` on a cell.** It writes `mergedTo`, a far corner. There is no
`mergedCells` target, because a merge is not a record kept in step with the cells
beneath it.

**Formatting a region is a `formatRule`**, not a `set` on a range. There is no
`range` target: a region's appearance is a rule in the body, and the cells under
it are untouched.

---

## Concurrency is the transaction's

A document's change set carries `baseRevision` and `touched` so two people
editing one body can be told apart. A spreadsheet needs neither for that: two
people editing different cells write different rows, and Convex serializes them.
Two people editing one cell serialize too, and the second write wins.

Both columns are still written. `touched` is what an undo reads to know what it
will disturb and what a history view renders from; nothing rejects a change set
because of it.

**Structural edits serialize the same way.** Two inserts into one gap each read
the current array and take a midpoint, and the second sees the first — because a
mutation that would have raced has its read set invalidated and re-runs.

---

## Undo is unchanged

Every op is closed under inversion, and that property does not depend on where
the content lives. `was` reverses a set, `values` and `after` reverse a remove,
`wasAfter` reverses a move. An undo is an ordinary change set.

The one thing to size: deleting a row in a wide sheet puts every cell it held
into `ops`, because a remove carries what it removed. At a few hundred bytes each
that is well inside a document, and `ops` is already the unbounded field
[the index](README.md#where-a-row-can-grow) names.

---

## Related

[all tables](README.md) · [spreadsheets](spreadsheets.md) ·
[revisions](revisions.md)
