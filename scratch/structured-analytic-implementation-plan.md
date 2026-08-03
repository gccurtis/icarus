# Structured Analytic Implementation Plan

## Goal

Implement the project-scoped Structured Analytic capability defined in
[`structured-analytic-design/`](structured-analytic-design/summary.md): a saved,
revisioned recipe for one table or chart, and a read-only **pull** that compiles
that recipe to a Formula expression and evaluates it against current project
data.

The work has two halves, and the first is the larger one:

1. **Formula gains relational power** — eight builtins plus quoted names, making
   joins, filtering, grouping, ordering, limiting, and rendering intent
   expressible in the language. Useful to every formula author, independent of
   analytics.
2. **Structured Analytic is a thin capability over that** — model, validation,
   compiler, store, service, wire, endpoints, and the two commands that turn an
   analytic into project data.

**Scope boundary.** This plan does not implement revision propagation in
Structured Data — that is item 17 in
[`0-general-updates.md`](0-general-updates.md) and is independent of this work.

### Definition of done

`analytic.create/update/delete/purge/save/copy` and
`analytic.get/list/check/pull` are operational end to end, wired into startup,
joined to the retention scheduler, covered by three test files, and exercised by
one HTTP smoke flow. `typecheck` is clean and the full suite is green.

## Preconditions and honest constraints

- **Baseline is green. This is clear to start.** Measured 2026-08-02:
  `pnpm typecheck` clean, `pnpm test` **299 pass / 0 fail**, and
  `import("#init/startBackend.js")` resolves the whole composition graph. The
  earlier 31 failures were the retention and Activity-vocabulary refactor
  landing in pieces; they were closed by `0e44375`, `1cbe845`, `63791f0`, and
  `993e0e2`. Nothing about this plan is waiting on anything.
- **The backend boots again.** Slide's deletion (`91165f9`) removed the missing
  `slideService.js` that had made the module graph unloadable, so a live HTTP
  smoke run — which this plan's exit criteria require — is possible for the
  first time.
- **One concurrent workstream shares one file.** The uncommitted Templates
  rework (Phase A of
  [`0-templates-checklist.md`](0-templates-checklist.md)) touches only Templates
  today, but its Phase B and this plan both edit `1-init/startBackend.ts` to add
  a capability. That is a trivial merge, not a dependency — but whichever lands
  second should re-run the suite rather than assume. Their checklist quotes a
  297-test baseline; this plan quotes 299 because the dirty tree already adds
  two.
- **The filter-grammar question is settled.** `.{…}` supports exactly
  `= != < <= > >=` (`ConditionOperator` in `ast.ts`) and requires identifier
  field names (`parseFieldCondition`). It cannot express `contains` or
  `isNull`/`isNotNull`. A `WHERE` builtin is therefore in scope, and it removes
  the need for any column-name mangling — see
  [`compilation.md`](structured-analytic-design/compilation.md#research-findings-that-shaped-this).
- **Formula has no quoted-name syntax.** `parsePrimary` builds a `NameNode` only
  from an identifier, so a Structured Data entry named `Q3 Orders` is
  unreferenceable from any formula today. Adding one is in Phase 1; without it
  an analytic could only name identifier-safe entries.
- **Do not build on the projection-plus-filter pipe form.** Formula's own docs
  record that the parser does not preserve projection fields there. Compilation
  avoids it deliberately.
- **Structured Data needs no change.** `list()` already returns rows without
  evaluating anything, and `declare` already accepts formula-backed and literal
  entries.

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

✅ **DONE 2026-08-02.** All eight builtins, backtick-quoted names, and the
display annotation shipped in `0-platform/formula/`, with 76 tests in
`test/capabilities/formula-relational.test.ts`. Full suite green.

Both design questions resolved during implementation:

- **(a) The join's intermediate bound** is enforced by `JOIN` itself, checked
  *during* accumulation after each left row's matches are appended rather than
  once at the end — so a runaway product fails before it is materialised. It
  reuses the existing `maxRows` / `maxFields` / `maxCells` limits and the
  existing `limit_exceeded` diagnostic; no new limit or code was needed.
- **(b) Options-as-records parse cleanly.** `parsePrimary` already handles
  `{key: expr}` as an ordinary primary expression (`parser.ts:607`), record keys
  must be identifiers or the six usable keywords, and none of the option names
  collide with `KEYWORDS` (only TRUE/FALSE/NULL/IF/LAMBDA/FUNCTION). No fallback
  to positional arguments was required.

Two implementation decisions worth knowing, neither in the original spec:

- **Unknown option keys are rejected**, not ignored, mirroring the `exactKeys`
  rule the capability wire decoders use. A typo is a `type_error`, not silence.
- **`BUILTIN_IMPLEMENTATION_VERSION` bumped `@1` → `@2`.** Builtin function
  values carry it in their identity digest, so the bump re-digests them once.
  Nothing persists a function value, so this is a cache refresh, not a break.

---

`0-platform/formula/builtins.ts`, plus `value.ts` and `wire.ts` for the display
annotation. Specs in
[`compilation.md`](structured-analytic-design/compilation.md#new-formula-builtins).

| Builtin | Signature |
| --- | --- |
| `ASTABLE` | `(value, name)` — table/record unchanged, list renamed, scalar to 1 × 1, function rejected |
| `JOIN` | `(left, right, { kind, on, leftAs, rightAs })` |
| `WHERE` | `(table, { all, any })` — all ten filter operators, string field names |
| `GROUP` | `(table, { keys, aggregates })` |
| `AGGREGATE` | `(table, { aggregates })` — `GROUP` with no keys |
| `SORT` | `(table, [{ field, direction }])` |
| `LIMIT` | `(table, n)` |
| `DISPLAY` | `(table, kind)` — table carrying rendering intent |

Plus **backtick-quoted names**: a lexer token and one `parsePrimary` branch
producing the same `NameNode`, so `` `Q3 Orders`.region `` works. No binder,
resolver, or normalization change.

Add each builtin to `BUILTIN_NAMES` and `callBuiltin`'s switch; they follow the
existing `BuiltinResult` / `fail(diagnostic)` convention, so no user-facing
throwing.

**Options are records with per-key defaults** — no nullable types, no positional
variants. Each builtin defines its own default for every optional key, so
`JOIN(a, b, { on: [...] })` is legal and `kind` defaults to `"inner"`.

The semantics that need dedicated tests because they are easy to get subtly
wrong:

- **null never matches null** in a join key;
- left join with no match emits nulls for every right field;
- many-to-many preserves left row order then right source order;
- `WHERE` null rules — null passes `equals`/`notEquals`/`in`, fails ordering and
  `contains`; `contains` honours `caseSensitive`; no cross-kind coercion;
- `count` ignores nulls; `sum`/`average` are exact rationals; `min`/`max` are
  kind-strict; every aggregate yields null over an empty group;
- sorts are stable, kind-strict, null last;
- `DISPLAY` round-trips through `toWire`/`fromWire` and stays consumable as an
  ordinary table;
- every optional options key can be omitted and takes its default.

Also in this phase: **bound the intermediate join result.** `JOIN` must enforce
a row limit itself rather than relying on the evaluator's output-side
`maxRows`/`maxCells`, because a join multiplies rows faster than anything
Formula does today.

Exit: `formula-relational.test.ts` green; `typecheck` clean; no capability code
written yet. **These builtins are useful on their own — this phase is shippable
independently.**

---

## Phase 2 — Domain model and validation

✅ **DONE 2026-08-02.** `domain/{model,errors,validation}.ts` plus 62 tests in
`structured-analytic-domain.test.ts`. Typecheck clean, full suite 466 pass.

Three things landed differently from the plan as written, all deliberate:

- **The shape limits are configuration now, not in Phase 8.** A limit that lives
  only as a constant is not a limit anyone can tune, so the
  `structuredAnalytic` section, its parser, its defaults, and its `etc/README.md`
  table shipped with the rules that use them. Phase 8 keeps only the aliases and
  the startup wiring.
- **`maxAnalyticsPerProject` is gone.** A per-project catalog cap contradicts the
  removal of `maxTemplatesPerProject` earlier the same day, which deferred
  catalog size to a global resource-quota policy. A test asserts it stays absent.
- **`maxTitleBytes` and `maxDescriptionBytes` are separate.** They were sharing
  one bound, so tightening a title silently tightened a description.

**Logging is part of every phase from here, not a documentation step.** Validation
takes an optional `Logger`, emits a debug event carrying the definition's *shape*
on acceptance and a warn naming the rule that fired on rejection, and exports
`describeDefinition` so the service logs the same shape on every command. The
rule the rest of the capability follows: **log counts, enums, ids, and durations;
never names, titles, field names, filter values, or rows.** A test enforces it by
scanning the serialized log for content that must not appear.

---

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
inputs   → ASTABLE(<name>, "<inputKey>")     one per input, backtick-quoted
                                             when the name is not identifier-safe
joins    → left-deep JOIN chain in saved order
filters  → WHERE(…, { all: [...] })
shelves  → GROUP / AGGREGATE when any placement aggregates, else projection
sorts    → SORT([...])
limit    → LIMIT(n)
display  → DISPLAY(…, "<kind>")
```

**Column names are readable, not mangled.** `JOIN` qualifies output fields as
`<inputKey>.<field>` and `GROUP` names aggregates with `as`, both as plain
strings inside record literals. Nothing needs to be a Formula identifier,
because `WHERE` took the last place that required one. The final table's fields
are the placement labels — the same names the pull reports — so a saved
analytic has usable columns with no rename step.

Tests are **golden expression text** — a one-input analytic, an inner join, a
left join, a chained join, a filtered-and-grouped pipeline, a sorted-and-limited
one, and one input whose name needs quoting. Asserting source text makes any
change to the emitted shape visible in review, which is what keeps compiler
drift honest.

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

## Phase 5 — Project data ports and adapters

`ports/projectData.ts`: `snapshot()` and `metadata()`.
`ports/structuredDataWriter.ts`: `declareFormula()` and `declareTable()`.

`1-init/create/structured-analytic.ts` implements both over
`FormulaNameResolver` and `StructuredDataService`. The read side is roughly ten
lines — value fetching and normalization are the evaluator's job now. The write
side maps a taken display name onto 409 `name_conflict`.

`resolverIssueForName` turns a missing binding into a precise 422, distinguishing
"broken formula upstream" from "no such name".

---

## Phase 6 — Application service

`application/structuredAnalyticService.ts`: total `command`/`query` switches,
plus `pruneHistory` and `purgeExpired`.

- **create** — validate, **compile** (a definition that will not compile is
  rejected before storage), best-effort `metadata()` for `entryId` capture,
  insert at revision 1. No catalog-size check; that limit is gone.
  **Overwrite any caller-supplied `entryId`** — it is server-captured
  bookkeeping, and honouring a client's value lets a caller retarget an input to
  an entry its name never referred to, which the first pull would then self-heal
  into the stored name. Same on update.
- **update** — validate, compile, CAS, typed error on `false` after a re-read.
- **delete / purge** — CAS and the not-deleted rule.
- **check** — `metadata()` only; repairs renamed names; no resolution, no data.
- **pull** — capture revision → compile → `snapshot()` → resolve inputs by name,
  falling back to `entryId` → repair renamed names → `formula.evaluate` →
  display data checks → assemble the receipt from `observedDependencies` →
  return rows **and the captured definition**.
- **save** — compile, then `declareFormula` with the compiled source. No
  evaluation, so it cannot fail on data.
- **copy** — run a full pull, then `declareTable` with the resolved rows.

Attribution from `config.userId`. Logs carry counts, durations, and identifiers
only — never titles, names, field names, filter values, or rows.

---

## Phase 7 — Wire and endpoints

`wire/` decoders with `exactKeys` rejection and byte limits, called from
`4-job-wiring/structured-analytic/registerStructuredAnalyticEndpoints.ts`.

Two routes, the documented error ladder, `commandStatus` returning 201 only for
`analytic.created`, and Formula `limit_exceeded` / type diagnostics mapping to
422 `analytic_pull_invalid`.

Map `AnalyticConfigurationError` nowhere — it is a startup fault, and reaching
job wiring at all would mean the process should not have booted. Purge maps the
shared `ResourceNotDeletedError` to 409 `not_deleted`, exactly as the ten
existing mappers do; this capability has no private twin.

**Bound the request body.** There is no global cap — every existing limit is a
per-capability field limit — and the rejected-payload log record writes the
*unvalidated* payload verbatim. Until a body cap exists, an oversized malformed
request is written to disk in full. Either cap the body here or make the
rejection record truncate; capping is the better answer, because the same hole
is open on every other capability's decoder.

---

## Phase 8 — Startup and aliases

The configuration half of this phase **landed early, in Phase 2** — the
`structuredAnalytic` section, its parser, its defaults, and its `etc/README.md`
table all exist. What remains:

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

Smoke flow: declare two small Structured Data tables → create an analytic
joining them → `analytic.pull` and assert fields, rows, display, definition, and
receipt → `analytic.save` under a name, then read that name back through
Structured Data and confirm it resolves → append a row to a source and confirm
the saved name's value moves → `analytic.copy` and confirm that one does *not*
move → rename a source → pull again and assert `renamed` with a successful
result → delete → purge.

Exit criteria: `pnpm typecheck` clean; `pnpm test` green with no pre-existing
failures reintroduced; smoke flow passes against a running server.

---

## Explicitly out of scope

Calculated and computed inputs, nested-field traversal, unions, pivots, windows,
non-equality joins, full and cross joins, multi-series and composite displays,
color/size encodings, renderer styling, pull-result persistence, provenance
tracking or automatic republication of saved entries, revision propagation,
decompilation of a formula back into pills, and any background sweep or
presence-driven refresh.
