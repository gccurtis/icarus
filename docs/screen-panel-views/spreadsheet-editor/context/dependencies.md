# Dependencies

| View | What it is for | Sections |
| --- | --- | --- |
| Dependencies | What the current cell reads, what it feeds, and what is broken | *cell* reads · *cell* feeds · Problems |

The audit view. It is derived entirely from the current formulas — there is no
persisted dependency graph, and the panel says so.

## Layout

| 300px |
| --- |
| cell reads |
| cell feeds |
| problems |

*Cell reads* and *cell feeds* are headed by the current address — "G3 reads",
"G3 feeds" — so the panel names what it is describing.

## *cell* reads

The cells the selected formula depends on, each with what it is, so a dependency
on a spill child is visible as such.

**Shows** — *E3* — spill child of E2; *F3* — literal number

**Needs** — parsed references from the selected formula, resolved to their kind.

## *cell* feeds

What depends on the selected cell.

**Shows** — *G6* — `=AVERAGE(G2:G5)`

**Needs** — a reverse scan of formulas referencing this address.

**Open** — a reverse scan over a large sheet is expensive on every selection
change. Either it is bounded, or it is computed once and invalidated.

## Problems

Cells whose formulas cannot resolve, listed for the whole spreadsheet rather than
only the selection — this is where you go to find them.

**Shows** — *D8 · #REF!* — Refers to a deleted range

**Needs** — the evaluation errors from the calculation pass.
