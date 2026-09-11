---
name: icarus-store-change
description: Review, diagnose, or change Icarus capabilities and server persistence, including project ownership, current-schema admission, atomic revisions, Store transactions, and durable recovery contracts.
---

# Icarus Store change

Start with root `AGENTS.md` and the task handoff. Preserve the user's requested
mode: tracing a persistence issue is not permission to mutate data or implement
an unrelated schema redesign.

## Map the intent and authority

Follow the entry under `app/src/lib/capabilities/` into its validation, scope,
decision, and writes. Request scope is defined in
`app/src/lib/runtime/server/scope.server.ts`; inspect the capability's actual use
of it. Build a short account of the resources checked, owning project, tables
read/written, revision relationships, and any external side effects. A client
resource ID can select the target but cannot establish its ownership.

The persistence contract lives in `app/src/lib/model/server/store/types.ts`.
Inspect `transaction.ts`, `commit.server.ts`, and `recover.server.ts` in that
model's `methods/transaction/` directory when changing transaction behavior.
Current row admission lives in `app/src/lib/representation/store/`; domain types
and pure operations live in `app/src/lib/representation/data/`. Read the relevant
admission and type files before changing a stored shape; do not add old-schema
readers or aliases to make stale fixtures pass.

## Preserve the commit boundary

- Store transactions are synchronous and cannot nest. Resolve external I/O
  before the callback, then revalidate the assumptions that matter at commit.
  Keep model-owned I/O outside the Store's synchronous unit; plan any durable
  job or compensating action explicitly when Store and external effects meet.
- Pass the supplied `StoreUnitOfWork` through every participating helper. All
  reads that decide the write and all writes in that intent use the unit's
  isolated view, not a mixture of the live Store and the unit.
- Keep the resource's metadata, revision/change set, leader snapshot, dependent
  rows, and admitted follow-up jobs consistent as one intent where they belong
  to that revision. Validate the whole operation before exposing partial work.
- Distinguish domain rejection from storage failure. A storage exception must
  propagate as a fault; do not hide it inside a broad catch returning a refusal.

The journal is the durable commit decision. Before it, an interrupted intent
must leave the old state intact. After it, recovery finishes the committed new
state; it is not a rollback promise. The interrupted live Store refuses access
until restarted. Do not claim an exception means nothing was committed, and do
not add blind retries for an ambiguously acknowledged write.

## Prove the contract with executable tests

Use a disposable on-disk Store for recovery tests and exercise the real intent,
not only mocks or an assertion that `transaction` was called. Existing examples:

- `app/src/lib/model/server/store/test/non-functional/atomicity.test.ts`
- `app/src/lib/model/server/store/test/non-functional/recovery.test.ts`
- `app/src/lib/capabilities/spreadsheet/test/non-functional/submit-spreadsheet-changes-atomicity.test.ts`
- `app/src/lib/capabilities/spreadsheet/test/non-functional/revision-atomicity.test.ts`
- The owning capability's `test/non-functional/ownership.test.ts`, where present.

Select cases for the affected boundary: valid and invalid input, another
project's target, conditional create/update paths, rollback before the journal,
and recovery after the journal and affected table writes. Assert the meaningful
rows and revision agree together. When changing recovery itself, include an
interruption during recovery and a second restart. Use actual `StoreFailpoint`
names from `types.ts`; never expose a production browser fault-injection API.

Run focused contracts with the root `verify.mjs unit` helper, then architecture
and type checks. Changes to a checker also need its mutation tests under
`app/scripts/test/`. Broaden to affected workflows when behavior crosses the
client boundary. Record exact coverage and untested failure modes in the handoff;
remove baseline debt only when the original invariant is genuinely resolved.
