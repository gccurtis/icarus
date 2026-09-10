# Derived-output integration reference

This development view is the served, as-built record for rebasing
`work/derived-output-architecture` from protected head `7211f1c` onto `main` at
`06708d9`. The clean replay completed at `f003ab5`; five focused implementation
commits through `964b411` repair the resulting architecture rather than changing
main.

The suite is served at
`/demo/<project>/reference/derived-output-rebase`. It uses project semantic
tokens and the shared Mermaid component, so Helios and Selene are both part of
the browser proof.

## What actually happened

- The source had 41 unique commits and main had 18 from merge base `8ba102e`.
- Rebase stopped seven times. Those stops produced 27 conflict occurrences
  across 26 unique paths.
- The former source head remains recoverable as
  `backup/derived-output-architecture-pre-rebase-7211f1c`.
- The first compile exposed 18 diagnostics in seven files. They reduced to four
  current-schema repairs; typecheck now reports zero errors and zero warnings.
- Architecture lint reports 90 of 90 checks clean with zero findings. Exactly
  28 stale records were removed, taking the source baseline from 285 to 257;
  no exception was added.
- The script suite passes 168 of 168 tests. Vitest passes 1,474 assertions in
  168 files, with two files and two assertions intentionally skipped.
- The production Node-adapter build succeeds and `git diff --check` is empty.
- Chromium is the only browser target. It collected all 91 scenarios: 87 passed
  and the four scenarios that spend real embedding and intelligence calls were
  explicitly skipped.

## Architecture delivered after replay

Authored state and semantic intent now commit together. Document saves,
slide-deck saves, material spreadsheet changes, project resource creation and
template instantiation stage the relevant revision/snapshot/metadata rows and
semantic outbox rows in one Store transaction. No embedding or intelligence
provider runs inside that transaction.

Both semantic lanes use one durable queue protocol. A worker atomically claims
a row with an owner token and a five-minute lease. Only that token can settle
the job. Expired claims are recoverable, retries stop after three attempts,
newer revisions supersede old work, and Derived Output or Research Chat fails
closed while required newer work is unresolved or terminally failed.

Process-local operation state is cohesive and explicit. `OperationFlights` is
constructed on `ServerModel`, owns Derived Output shared promises and Research
Chat controllers/stopping/deadlines, and aborts everything during server
shutdown. Capabilities no longer hide mutable registries on `globalThis` or in
lazy module state. The architecture checker now detects those patterns and has
mutation tests for them.

The current representation is the only representation. Stored `generating`
states, semantic `resourceTitle`, defaulted definition revisions, missing
material `scopeRefs`, empty legacy Prompt Blocks, deleted document typography,
slide normalization and collaboration anchors, and old production reference
routes are not read back through fallbacks.

## Pages

- `Readiness` records topology, protected heads and the completed decision.
- `Replay map` records the seven actual conflict stops and all 41 commits.
- `Runtime` diagrams atomic outbox writes, lease recovery, freshness and
  ServerModel-owned flights.
- `Proof` retains the initial diagnostic ledgers beside the executed green
  results, baseline deletion ledger and current-schema boundary.
- `Runbook` preserves the commands, rollback points and definition of done.

## Source organization

- `procedures/audit.ts` owns immutable identities and executed headline counts.
- `procedures/commits.ts` owns the complete source replay order.
- `procedures/conflicts.ts` owns the resolution and proof for every actual stop.
- `procedures/architecture.ts` owns the atomic entries, queue rules, lifetimes
  and current-schema absence contract.
- `procedures/findings.ts` owns the initial diagnosis and final gate matrix.
- `procedures/runbook.ts` owns the repeatable operation and acceptance gates.
- `procedures/diagrams.ts` owns Mermaid source only.
- Page components compose those records. `reference.css` uses only project
  tokens and adds no hard-coded light or dark palette.

## Updating the record

Do not edit a headline count alone. Repeat the corresponding command, update the
underlying ledger, and then update `audit.ts`. A page may say a gate is green
only after that gate has executed against the resulting tree. If main moves,
the conflict map must be recertified from the protected source before another
rebase.
