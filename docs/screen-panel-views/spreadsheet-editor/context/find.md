# Find

| View | What it is for | Sections |
| --- | --- | --- |
| Find | Search across this spreadsheet | Scope chips · Results |

## Layout

| 300px |
| --- |
| search |
| scope chips |
| results |
| results |
| results |

## Scope chips

What to search: everything, formulas only, or values only. A grid holds two
layers of text and searching both at once is usually the wrong answer.

**Shows** — `Everything` · `Formulas` · `Values`

**Needs** — the search to run over stored formulas and over evaluated values as
two distinct passes.

## Results

Each hit as an address plus what matched, with a marker for which layer it came
from.

**Shows**

- G3 — `=IF(E3=0,"",F3*1000000/E3)` — fx
- G4 — `=IF(E4=0,"",F4*1000000/E4)` — fx
- B14 — "cost per avoided minute" — text

**Needs** — per-hit address, matched content and layer.

**Open** — replacing inside a formula is a different operation from replacing
inside text, and one of them can break a model. Whether replace exists here at
all is unsettled.

## Panel furniture

The query field in the header.
