# A cell in error

| Selecting | What it is | Sections |
| --- | --- | --- |
| A cell whose formula cannot resolve | What broke, the formula as written, and how to repair it | Problem · Formula · Actions |

An error is a repair job, not a failure to report. The lens is built around
fixing it.

## Layout

| 300px |
| --- |
| problem |
| problem |
| formula |
| actions |

## Problem

The error and what it means, in words.

**Shows** — `#REF!` — "This formula refers to a range that no longer exists."

The formula is kept exactly as written so it can be repaired rather than guessed
at, and the section says so.

**Needs** — the evaluation error and a human-readable explanation per error kind.

## Formula

The expression as stored, including the broken reference.

**Shows** — `=SUM(#REF!)`

**Needs** — the stored formula, unmodified by the error.

## Actions

**Pick a new range** starts a range selection that rewrites the broken reference.
**Clear cell** removes it.

**Open** — "pick a new range" has to know *which* reference in a multi-reference
formula it is replacing. With one broken reference this is obvious; with two it
is not.
