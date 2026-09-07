# spreadsheet

A spreadsheet's grid and its cells, and the change sets that move them.

Two procedures. `readSpreadsheet` hands back the leader snapshot for one sheet,
a revision and the whole `SpreadsheetBody`, together with every populated cell
the sheet has, or nothing for a sheet never written to. `submitSpreadsheetChanges`
takes a change set and either accepts it, returning the revision it became, or
refuses it.

**Approval is application.** A change set is accepted when it was authored
against the revision the leader is actually at and every op in it resolves
against the sheet there. An op naming a row that is gone, a rule that is not
there, or a style the body does not hold is refused, so a caller that keeps its
buffer on a rejection loses nothing.

**The body and the cells are written apart.** The applier produces the next grid
and the next cells as one value; the grid goes to the leader snapshot and each
cell whose row changed, appeared or vanished is written to `sheetCells` on its
own, carrying its row's sort key. Nothing partial is written: the whole result is
computed before any row is touched.

**A refusal is an answer, not a throw.** `accepted: false` with `stale` or
`unresolved` and the revision the leader is actually at. Only a genuine fault
throws.
