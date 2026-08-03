# Structured Analytic capability

A saved, revisioned recipe for one table or chart, and a read-only **pull** that
compiles that recipe to a Formula expression and evaluates it against current
project data.

## Status and authority

Implemented and wired into startup: domain model, validation, compiler, SQLite
store, service, wire decoders, and both endpoints. `analytic.create`,
`update`, `delete`, `purge`, `save`, `copy`, `get`, `list`, `pull`, and `check`
all work, and the capability is bound into the retention sweep.

**The live HTTP smoke flow is the one thing not yet run.** Everything below is
covered by unit and integration tests — including a real SQLite store and a real
Formula engine — but no request has travelled the whole path through a running
server. Read "the tests are green" as "each layer upholds its contract", not as
"a user can build a chart".

Design intent lives in
[`scratch/structured-analytic-design/`](../../../../../../scratch/structured-analytic-design/summary.md);
progress in
[`scratch/structured-analytic-implementation-plan.md`](../../../../../../scratch/structured-analytic-implementation-plan.md).
Those describe **intent**, and where they disagree with this package, this
package is what runs.

## The one idea

**The saved definition is sugar. A Formula expression is the semantics.**

A definition holds pills — inputs, joins, shelves, filters, sorts, limit,
display. They exist because they are *manipulable*: swapping a column or
changing an aggregation is a small structured edit, and doing the same by
rewriting formula text is not.

But nothing about that structure defines what the numbers mean. Meaning comes
from one deterministic function, `compile`, and from Formula evaluating what it
produces. There is no second evaluator, no parallel semantics, and nothing to
keep in sync — joins, filtering, grouping, ordering, limiting, and exact
arithmetic are all Formula's.

Compilation is **one-way**. Formula text does not decompile back into pills,
which is precisely why a pull returns the definition alongside the data: a
client cannot recover the pills from the result.

## Reading order

1. [`concepts.md`](concepts.md) — the vocabulary, and why inputs are selected by
   name rather than by id.
2. [`types.md`](types.md) — the model, command and query surface, and what a
   pull returns.
3. [`runtime.md`](runtime.md) — the service, the store, and what each layer owns.
4. [`flows.md`](flows.md) — pull step by step, plus save, copy, and the rename
   repair.
5. [`invariants.md`](invariants.md) — the precondition → outcome table, the
   limits, and the things deliberately not guaranteed.

## What lives where

| Path | Holds |
| --- | --- |
| `domain/model.ts` | The canonical types. No behaviour. |
| `domain/validation.ts` | Structural validation of a definition. No I/O. |
| `domain/compile.ts` | Definition → Formula source. Pure, plus a parse. |
| `domain/errors.ts` | One class per distinguishable failure. No HTTP. |
| `ports/` | What the capability needs from the store, project data, and Structured Data. |
| `persistence/` | The SQLite store and its schema. |
| `application/` | The service: command and query switches, and retention. |
| `wire/` | Strict decoding. Unknown keys are refused, not ignored. |
