# A spill child

| Selecting | What it is | Sections |
| --- | --- | --- |
| A cell filled by a formula somewhere else | Where the value came from, and why you cannot type here | Spill · Origin formula · Behavior |

A spill child looks like a cell with a value in it and behaves like a read-only
projection. The lens exists to explain the difference the first time someone
tries to type into one.

## Layout

| 300px |
| --- |
| spill |
| origin formula |
| behavior |

## Spill

**Shows** — `Origin · E2`, `Occupied · E2:E5`, `Status · Read-only child`

**Needs** — the spill origin address and the occupied range.

## Origin formula

The formula that produced the whole range, so the fix is one click from the
symptom.

**Shows** — `=avoidedMinutes(costModel)`

**Needs** — the origin cell's formula.

## Behavior

A write into the occupied range fails visibly and names the origin.

Stated here because a silent failure, or a spill that quietly stops spilling, is
the worst outcome and the easiest one to build by accident.

**Needs** — a defined write-collision behaviour in the calculation engine.
