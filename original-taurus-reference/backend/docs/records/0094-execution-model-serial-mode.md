# Execution model: a serial dispatch mode for document writes

Part 3 of the concurrency/execution-model work (spec:
[`docs/superpowers/specs/2026-07-26-execution-model-design.md`](../superpowers/specs/2026-07-26-execution-model-design.md);
plan: [`docs/superpowers/plans/2026-07-26-document-concurrency-and-job-model.md`](../superpowers/plans/2026-07-26-document-concurrency-and-job-model.md)).
It formalizes how requests are dispatched and gives document writes a per-document
serial lane.

## What changed

The transport layer already had a central, declarative dispatcher: `operationSync`
(operation → sync/async) read by `dispatchScoped`, which either runs a handler
inline or enqueues a job. This adds a **third execution mode** and wires document
writes onto it.

- **`core/platform/dispatch.KeyedMutex`** (new leaf package, no capability
  imports) — a set of mutexes addressed by string key: same key serializes,
  different keys never contend. Reference-counted so a long-lived process does
  not leak an entry per key. This is the one genuinely new primitive.
- **`dispatchSerial`** execution mode — run the handler inline and answer
  synchronously, but first acquire a per-key lock derived from the request
  (`adaptSerialScoped`). The per-op key functions live in a second table,
  `operationSerialKey`, next to `operationSync`; `dispatchScoped` panics at
  startup if a serial op lacks a key function or a key function names a
  non-serial op, so the two tables cannot silently disagree.
- **Document writes are serial by document id.** `documents.append_changes`,
  `documents.undo`, and `documents.redo` are classified `dispatchSerial` with
  `serialKeyByParam("documentID")`. Concurrent edits to one document within a
  process serialize; edits to different documents run in parallel.

## Why the optimistic append still stands

The per-key lock is **in-process only** — it cannot serialize two app instances,
or a request against a job worker, writing the same document. Cross-process
correctness for document writes therefore still comes from the store's atomic,
revision-checked append (`AppendChangeSet(expectedRevision)`), which is unchanged.
The serial lane is a **contention optimization** layered on top: it keeps
same-document read-modify-append from interleaving within a process (fewer wasted
conflict/rebase cycles), without a global bottleneck. It is not a replacement for
the revision check, and can be removed without affecting correctness.

## Verification

- `dispatch.KeyedMutex` unit tests: same key serializes (max one holder),
  different keys run concurrently (barrier), entries released after use;
  `-race` clean.
- `adaptSerialScoped` tests: same key serializes, different keys concurrent.
- `TestDocumentWritesAreSerialByDocumentID`: the three write ops are classified
  `dispatchSerial` and keyed by the `documentID` param.
- The full `core/transport` suite (which drives append/undo/redo through the
  wired serial path end-to-end) passes under `-race`.

## What is deliberately not here

- No cross-instance/distributed locking (the revision check covers correctness).
- Fast synchronous work is **not** routed through the job pool (that would cap
  throughput; Go already gives a goroutine per request).
- The response-mode axis (immediate vs deferred) is modeled in the spec but not
  yet needed as a separate declaration — today's three combinations are covered
  by the execution mode alone. Splitting it out is a future step when an
  operation needs serial-or-deferred execution with the opposite response.
