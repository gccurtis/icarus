# Spreadsheets

A workbook's name and who touched it last. Not its sheets — those are a body, and
bodies live in [revisions](../revisions/overview.md).

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | one project's workbooks |
| `create` | mutation | starts one, returning its id |
| `rename` | mutation | gives one a different name |
| `remove` | mutation | deletes one |

Registered in
[`src/convex/capabilities/spreadsheets.ts`](../../../convex/capabilities/spreadsheets.ts).

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `spreadsheets` | one row per workbook: title, template origin, attribution, and when it last changed |

## Nothing about the grid is on the row

Not the sheet list, not the extent, not the styles. Everything a person edits is
in the body, where an edit is a change set and an undo can reach it — and a
workbook is the resource where that matters most mechanically, because a single
edit is one cell and a Convex patch would rewrite every other cell with it.

Adding a sheet, renaming a sheet, and setting a cell are therefore all
`revisions.submit`, and none of them appear in this capability's surface.

## Cells are the case the machinery had to be generalized for

A cell is keyed by its A1 address and carries no id, because its identity *is*
its position. Two things followed from building that against the change-set
machinery, and both were generalizations rather than special cases:

- **`insert` and `remove` had to work on a keyed collection**, where the path
  names the entry rather than the collection it sits in. A style set is the same
  shape, so nothing about this is spreadsheet-specific.
- **`touched` had to keep the path below the deepest id.** Stopping at the id
  collapsed every cell in a sheet onto the sheet, which would have made two
  people working in different corners of one sheet contend on every write — the
  opposite of what a sparse cell map is for.

Neither is a branch on resource type. See
[`revisions/test/unit/resource-types.test.ts`](../revisions/test/unit/resource-types.test.ts).

## Capability Invariants

- **A refusal is "not found", never "forbidden".**
- **Attribution is built from the scope**, never accepted as an argument.
- **Every mutation records its activity in the same transaction**, and `remove`
  reads the title first so the entry can still say what was deleted.
- **A title is trimmed and never empty.**
- **The row and the body are created and destroyed together.**
- **No sheet id is minted here.** A new workbook has no sheets: a sheet carries
  an id, and an id invented by the server is an identity the workbook's id space
  would have to honour.

## Related

[spreadsheet](../../../../../docs/data-models/general-resources/spreadsheet.md) —
the model this implements ·
[general resources in Convex](../../../../../docs/storage/general-resources.md) —
why the row holds no body
