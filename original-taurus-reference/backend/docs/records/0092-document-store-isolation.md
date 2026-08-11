# Document store isolation (in-memory store returns independent loads)

Part 1 of the concurrency/execution-model work (orientation:
[`docs/orientation/job-model-and-concurrency.md`](../orientation/job-model-and-concurrency.md);
plan: [`docs/superpowers/plans/2026-07-26-document-concurrency-and-job-model.md`](../superpowers/plans/2026-07-26-document-concurrency-and-job-model.md)).
It closes the pre-existing data race flagged in record 0091 at its root.

## The defect

`document.MemoryStore.DocumentByID`/`DocumentsByProject` returned the stored
`Document` **by value**, which copies the `Base.Rows` slice *header* but shares
its backing array with the stored copy. Two concurrent `SubmitChanges`
goroutines then shared those rows, and `normalizeStoredBase(&doc.Base, …)`
(service.go) **writes** them in place while another goroutine clones them
(`cloneBase`) → a data race under `go test -race`.

The SQLite store is immune — it rebuilds an independent `Base` from bytes on
every load — so this was a lying test double, and production was never affected
(`MemoryStore` has no non-test callers). The fix makes the in-memory store match
SQLite: each load is an independent copy.

## What changed

- **`cloneStoredBase(Base) Base`** in `clone.go` — `cloneBase` plus the
  `Template` (which `cloneBase` leaves shared). This is the canonical "make an
  independent copy for handing out on load" helper.
- **`DocumentByID` / `DocumentsByProject`** now set `d.Base = cloneStoredBase(d.Base)`
  before returning, under the existing lock. A caller that mutates a loaded
  document can no longer alter stored state or race a concurrent load.
- **`TestMoveOperationsPreserveIdentityAndUndo`** corrected: it had asserted an
  undo restores to the raw `Create` input, which only held because the aliasing
  leak mutated the test's own `doc.Base` through shared memory. Undo restores to
  how the document *reads back* (row tracks normalized on load), so the test now
  baselines against a read-back captured right after `Create`.

## Verification

- New `store_isolation_test.go`: mutate a loaded `Base`, load again, assert the
  second read is unchanged. Fails before the fix (leaks "MUTATED"), passes after.
- `go test -race -run Concurrent ./core/capability/document/` — **0 races, 5/5
  runs** (was 4–6 races/run).
- Full `go test ./core/capability/document/` green; companions at zero drift.

## Settled

- The in-memory store hands out independent loads, matching SQLite. ✓
- The race from record 0091 is fixed at its root (shared read + in-place write). ✓
- Stopping the in-place write on the read path (`normalizeStoredBase`) is the
  next step — Part 2 of the plan.
