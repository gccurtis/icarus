# Structured Analytic invariants, guarantees, and limits

## The three that everything else rests on

**Compilation is one-way, and the definition stays canonical.** Formula text
does not decompile back into pills, and no attempt is made. The compiled
expression is a derived artifact — never persisted, cheap to re-derive, and
storing it would create a second thing to keep consistent with its only source
of truth. This is why a pull returns the definition alongside the data.

**A pull self-heals a renamed input without advancing `revision`.** It is the
only write a query makes. Healing does not write history, does not touch
`updated_at`, and pins the old input key as `as` so the handle every field
reference points at does not move.

**Revisions in the receipt are read revisions, not propagated ones.** Structured
Data does not yet propagate a revision bump from an entry to the formulas that
depend on it — that is item 17 in
[`0-general-updates.md`](../../../../../../scratch/0-general-updates.md). So a
pull's `sources[].revision` is the revision of the entry it read, and a `check`
comparing those revisions detects a change to a *directly named* input. It does
**not** detect a change one level up: editing a table that a named formula
depends on leaves that formula's revision unchanged, so `check` reports `ok` and
a pull returns different numbers. A client that needs certainty must pull.

## Precondition → outcome

| Preconditions | Guaranteed outcome | Enforced by |
| --- | --- | --- |
| `analytic.create` with a valid, compilable definition | One record at revision 1, no history row | Service ordering; the current row *is* revision 1 |
| A definition that will not compile | Rejected before anything is stored | `compileDefinition` precedes `store.insert` |
| Any caller-supplied `entryId` | Overwritten from the project, and the attempt logged | `captureEntryIds` |
| `analytic.update` at `expectedRevision` | The replaced record is archived at the revision it held, and the row moves to `revision + 1` — one transaction | `update` transaction, CAS in both the guard and the `WHERE` |
| `analytic.update` whose record is not exactly one revision ahead | Refused loudly, nothing written | Explicit gap check inside the transaction |
| A CAS miss on update or delete | `false`, nothing written; the service re-reads to raise not-found versus revision-conflict | Guarded `SELECT` plus `changes === 1` |
| `analytic.delete` | Final snapshot at N, tombstone at N+1, current row gone — atomically, both history rows sharing `deletedAt` | `delete` transaction |
| `analytic.purge` while the analytic is live | `ResourceNotDeletedError`, history untouched | Explicit liveness guard; the shared helper cannot tell |
| Re-using an id whose history survives | `AnalyticIdRetiredError` at insert | `nextRevisionAfterHistory !== 1` |
| A pull where every input resolves | Rows, fields, the definition, and a receipt naming exactly what was read | `observedDependencies` |
| A pull where one input was renamed | Succeeds, reports `renamed`, heals the stored name, leaves `revision` alone | Resolve-then-compile ordering |
| A pull where one input resolves to nothing | `AnalyticPullError("input_not_found")`, naming the input key | `resolveInputs` |
| A pull whose input resolves to a broken formula | `AnalyticPullError("input_unresolved")`, carrying the upstream diagnostic | Resolver issue lookup |
| A chart whose measure is not numeric | `AnalyticPullError("display_unsatisfied")` | Post-evaluation display check |
| `analytic.save` | A formula entry whose body is the compiled source; **cannot fail on data** | Nothing is evaluated |
| `analytic.copy` | A literal table of rows resolved now; fails exactly where a pull would | It *is* a pull |
| `save`/`copy` onto a taken name | `AnalyticNameConflictError`, nothing written | Structured Data's unique index, translated |
| `analytic.check` | Every input's status, with no snapshot and no evaluation | Metadata-only path, pinned by a test |
| Two placements that would produce one column name | Refused at compile, naming both placement ids | `compileToSource` |
| A retention sweep where one purge fails | Every other expired analytic is still purged, and the failure is logged | `purgeExpired` catches per id |

## Limits

Shape limits only — how big a *recipe* may be. Data size is Formula's, enforced
by the evaluator, so nothing here duplicates `formula.max*`.

`maxInputs` 8 · `maxJoinKeys` 8 · `maxPlacements` 32 · `maxFilters` 32 ·
`maxFilterValues` 256 · `maxScalarBytes` 4096 · `maxSorts` 8 ·
`maxTitleBytes` 4096 · `maxDescriptionBytes` 4096 · `maxNameBytes` 256

All configurable under `structuredAnalytic`. Validated at startup by
`validateAnalyticLimits`, which asserts the **complete key set** — a limit built
by omission is silently permissive, because both `bytes > undefined` and
`length > undefined` are `false`.

**There is no per-project catalog cap.** How many analytics a project may hold
is a question about storage entitlement, identical for every capability, and it
belongs to a global resource-quota policy that does not exist yet. Templates
dropped `maxTemplatesPerProject` for the same reason.

## Deliberately not guaranteed

- **`list` is unpaginated.** A project holds tens of analytics. The schema index
  is already in a keyset cursor's tuple order, so adding one later is new code,
  not a migration.
- **A `retargeted` input is not refused.** The name is the selector, so it wins;
  the receipt says the entry changed underneath.
- **`copy` does not preserve exact rationals.** Structured Data's literal cells
  are JSON scalars.
- **Quoted names cannot be created.** The compiler emits backticks for a name
  that is not identifier-safe, but Structured Data still refuses to create one —
  so this is forward-looking. Tracked as item 20.
- **Nothing is typechecked under `test/`.** Every type annotation in this
  capability's tests is decoration. Tracked as item 23.
