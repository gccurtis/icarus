# Structured Analytic Implementation Plan

## Goal

Implement the project-scoped Structured Analytic capability defined in
[`structured-analytic-design/`](structured-analytic-design/summary.md): a saved,
revisioned recipe for one table or chart, and a read-only **pull** that compiles
that recipe to a Formula expression and evaluates it against current project
data.

The work has two halves, and the first is the larger one:

1. **Formula gains relational power** — seven builtins that make joins,
   grouping, ordering, limiting, and rendering intent expressible in the
   language. Useful to every formula author, independent of analytics.
2. **Structured Analytic is a thin capability over that** — model, validation,
   compiler, store, service, wire, endpoints.

**Scope boundary.** This plan does not implement saving an analytic as project
data (copy or link, per
[`derived-tables.md`](structured-analytic-design/derived-tables.md)) or revision
propagation in Structured Data (per
[`supplementary-changes.md`](structured-analytic-design/supplementary-changes.md)).

### Definition of done

`analytic.create/update/delete/purge` and `analytic.get/list/check/pull` are
operational end to end, wired into startup, joined to the retention scheduler,
covered by three test files, and exercised by one HTTP smoke flow. `typecheck`
is clean and the full suite is green.

## Preconditions and honest constraints

- **The working tree is mid-refactor.** As last measured, `tsc --noEmit` is
  clean but 31 test assertions fail across Templates, Document, Investigation,
  and Connector — largely the resource-history/retention work. This capability
  conforms to that retention model, so it should not start until that work
  settles and the suite is green; otherwise "did I break it" is unanswerable.
- **One compilation detail needs verifying before Phase 1** — whether Formula's
  `.{…}` condition-query grammar covers the full filter vocabulary (six
  comparisons, `in`, `contains` with case sensitivity, `isNull`/`isNotNull`). If
  it does not, add a `WHERE` builtin and the count becomes eight. Check this
  first; it changes Phase 1's shape.
- **Do not build on the projection-plus-filter pipe form.** Formula's own docs
  record that the parser does not preserve projection fields there. Compilation
  avoids it deliberately.
- **Structured Data needs no change.** `list()` already returns rows without
  evaluating anything.

## Settled architecture

- **The definition is sugar; a Formula expression is the semantics.**
  Compilation is one-way, the definition stays canonical, and the expression is
  never persisted.
- **No second evaluator.** Joins, filters, grouping, sorting, limiting, and
  exact arithmetic are Formula's.
- Layered capability shape with a `wire/` package.
- Two endpoints: `POST /structured-analytics/command` (serial),
  `POST /structured-analytics/query` (concurrent).
- Inputs selected by **name**, with `entryId` recorded best-effort for rename
  repair. Every wire-serializable kind is a valid input via `ASTABLE`.
- Receipts carry **revisions, not digests**, built from the evaluation's
  `observedDependencies`.
- Current-state table plus the shared resource-history table; delete archives and
  removes; purge after delete; retention bound into `ResourceRetentionScheduler`.
- A pull may write exactly one thing: a renamed input's cached name, as a single
  revision-conditioned `UPDATE` that never advances `revision`.

---

## Phase 1 — Formula relational builtins

`0-platform/formula/builtins.ts`, plus `value.ts` and `wire.ts` for the display
annotation. Specs in
[`compilation.md`](structured-analytic-design/compilation.md#new-formula-builtins).

| Builtin | Signature |
| --- | --- |
| `ASTABLE` | `(value, name)` — table/record unchanged, list renamed, scalar to 1 × 1, function rejected |
| `JOIN` | `(left, right, { kind, on, leftAs, rightAs })` |
| `GROUP` | `(table, { keys, aggregates })` |
| `AGGREGATE` | `(table, { aggregates })` — `GROUP` with no keys |
| `SORT` | `(table, [{ field, direction }])` |
| `LIMIT` | `(table, n)` |
| `DISPLAY` | `(table, kind)` — table carrying rendering intent |

Add each name to `BUILTIN_NAMES` and `callBuiltin`'s switch; they follow the
existing `BuiltinResult` / `fail(diagnostic)` convention, so no user-facing
throwing.

The semantics that need dedicated tests because they are easy to get subtly
wrong:

- **null never matches null** in a join key;
- left join with no match emits nulls for every right field;
- many-to-many preserves left row order then right source order;
- `count` ignores nulls; `sum`/`average` are exact rationals; `min`/`max` are
  kind-strict; every aggregate yields null over an empty group;
- sorts are stable, kind-strict, null last;
- `DISPLAY` round-trips through `toWire`/`fromWire` and stays consumable as an
  ordinary table.

Also in this phase: **bound the intermediate join result.** `JOIN` must enforce
a row limit itself rather than relying on the evaluator's output-side
`maxRows`/`maxCells`, because a join multiplies rows faster than anything
Formula does today.

Exit: `formula-relational.test.ts` green; `typecheck` clean; no capability code
written yet. **These builtins are useful on their own — this phase is shippable
independently.**

---

## Phase 2 — Domain model and validation

`domain/model.ts` — `StructuredAnalytic`, `AnalyticDefinition`, `AnalyticInput`,
`AnalyticFieldRef`, `AnalyticFieldPlacement`, `AnalyticJoin`, `AnalyticFilter`,
`AnalyticSort`, `AnalyticDisplay`, `AnalyticScalar`, commands, queries,
`AnalyticPull`, `AnalyticCheck`, `AnalyticSourceRead`.

`domain/errors.ts` — one class per failure mode.

`domain/validation.ts` — structural only, no data:

- nonempty inputs; unique input keys (`as ?? name`, normalized); name lengths;
- ordered join shape: `joins[i]` introduces `inputs[i+1]`, `left` already
  introduced, every input introduced exactly once, nonempty `on`;
- field references name declared input keys;
- placement IDs unique across Rows and Columns; valid aggregation enums;
- sorts target declared placement IDs;
- filter operator/value shapes; `in` nonempty;
- positive integer `limit`;
- the structural display contract (counts and aggregation flags only);
- the shape limits from config.

Exit: a test per rule, each with a valid and an invalid literal.

---

## Phase 3 — The compiler

`domain/compile.ts` — pure. Definition in; `FormulaExpression` plus a column map
out.

```text
inputs   → ASTABLE(<name>, "<inputKey>")     one per input
joins    → left-deep JOIN chain in saved order
filters  → .{ c3 = "closed", … }             ANDed condition query
shelves  → GROUP / AGGREGATE when any placement aggregates, else projection
sorts    → SORT([...])
limit    → LIMIT(n)
display  → DISPLAY(…, "<kind>")
```

Column names are generated identifiers `c1..cn` with a compiler-held map from
`{ input, field }`, because Formula identifiers are `[A-Za-z_][A-Za-z0-9_]*`
while display names and field names are arbitrary strings.

Tests are **golden expression text** — a one-input analytic, an inner join, a
left join, a chained join, a filtered-and-grouped pipeline, a sorted-and-limited
one. Asserting source text makes any change to the emitted shape visible in
review, which is the property that keeps compiler drift honest.

---

## Phase 4 — Store port and SQLite adapter

`ports/structuredAnalyticStore.ts` and the adapter. Synchronous, matching
Templates and Structured Data.

- `sta_<prefix>_analytics` + the shared history table via
  `initializeResourceHistorySchema`; the standard four pragmas.
- `insert` at revision 1, no history row.
- `update`: one transaction — CAS guard `SELECT`, `insertHistorySnapshot` of the
  *previous* revision, `UPDATE … revision + 1`.
- `delete`: one transaction — CAS guard, snapshot of current,
  `insertHistoryDeletion` at `revision + 1`, `DELETE`.
- `purge` via `purgeResourceHistory`, refusing while current state exists.
- `pruneHistory`, `expiredDeleted`, `latestSnapshot`.
- `repairInputNames(id, expectedRevision, definitionJson)` — one
  revision-conditioned `UPDATE` that does **not** advance `revision`.

Tests against a temporary SQLite path: CAS success and staleness, history
accumulation, delete-then-purge, purge-before-delete refusal, prune retaining
current resources, and the repair losing cleanly to a concurrent edit.

---

## Phase 5 — Project data port and adapter

`ports/projectData.ts`: `snapshot()` and `metadata()`.

`1-init/create/structured-analytic.ts` implements it over `FormulaNameResolver`
and `StructuredDataService.list()`. Roughly ten lines — value fetching and
normalization are the evaluator's job now.

`resolverIssueForName` turns a missing binding into a precise 422, distinguishing
"broken formula upstream" from "no such name".

---

## Phase 6 — Application service

`application/structuredAnalyticService.ts`: total `command`/`query` switches,
plus `pruneHistory` and `purgeExpired`.

- **create** — validate, **compile** (a definition that will not compile is
  rejected before storage), best-effort `metadata()` for `entryId` capture,
  `countLive()` limit, insert at revision 1.
- **update** — validate, compile, CAS, typed error on `false` after a re-read.
- **delete / purge** — CAS and the not-deleted rule.
- **check** — `metadata()` only; repairs renamed names; no resolution, no data.
- **pull** — capture revision → compile → `snapshot()` → resolve inputs by name,
  falling back to `entryId` → repair renamed names → `formula.evaluate` →
  display data checks → map `c1..cn` back to result fields → assemble the
  receipt from `observedDependencies`.

Attribution from `config.userId`. Logs carry counts, durations, and identifiers
only — never titles, names, field names, filter values, or rows.

---

## Phase 7 — Wire and endpoints

`wire/` decoders with `exactKeys` rejection and byte limits, called from
`4-job-wiring/structured-analytic/registerStructuredAnalyticEndpoints.ts`.

Two routes, the documented error ladder, `commandStatus` returning 201 only for
`analytic.created`, and Formula `limit_exceeded` / type diagnostics mapping to
422 `analytic_pull_invalid`.

---

## Phase 8 — Configuration, startup, aliases

- `structuredAnalytic` section in `etc/configuration.yaml`,
  `StructuredAnalyticConfig` + `DEFAULT_CONFIG` + parser in
  `loadBackendConfig.ts`, a row in `etc/README.md`. Shape limits only — data
  limits stay in `config.formula`.
- `#structured-analytic` and `#structured-analytic/*` in `package.json` imports
  and `tsconfig.json` paths.
- `startBackend.ts`: construct after `formula` and `formulaResolver`, add
  `structuredAnalyticReady`, register endpoints, and add
  `bindResourceRetentionPort("structured-analytic", structuredAnalytic)`.

---

## Phase 9 — Documentation

The standard six-file in-tree `docs/` package, plus a Formula docs update for
the seven new builtins — they are language features and belong in
`0-platform/formula/docs/`.

`invariants.md` must state plainly: compilation is one-way and the definition
stays canonical; a pull self-heals a renamed name without advancing `revision`;
and the revision-propagation gap and its consequence for `check`.

---

## Phase 10 — Tests and verification

Three files per
[`file-architecture.md`](structured-analytic-design/file-architecture.md#tests):
`formula-relational.test.ts` (the largest — the semantics live there),
`structured-analytic.test.ts`, `structured-analytic-wiring.test.ts`.

Smoke flow: declare two small Structured Data tables → save an analytic joining
them → `analytic.pull` and assert fields, rows, display, and receipt → rename one
source → pull again and assert `renamed` with a successful result → delete →
purge.

Exit criteria: `pnpm typecheck` clean; `pnpm test` green with no pre-existing
failures reintroduced; smoke flow passes against a running server.

---

## Explicitly out of scope

Calculated and computed inputs, nested-field traversal, unions, pivots, windows,
non-equality joins, full and cross joins, multi-series and composite displays,
color/size encodings, renderer styling, result persistence, copy or link to
Structured Data, revision propagation, decompilation of a formula back into
pills, and any background sweep or presence-driven refresh.
