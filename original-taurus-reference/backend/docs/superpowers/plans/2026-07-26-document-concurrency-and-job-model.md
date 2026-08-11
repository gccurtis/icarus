# Document store isolation, on-demand normalization, and the job/execution model

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read the companion orientation doc first: [`docs/orientation/job-model-and-concurrency.md`](../../orientation/job-model-and-concurrency.md).

**Goal:** Eliminate the concurrent-edit data race at its root, stop mutating documents on the read path, and introduce a small, honest execution model (a central dispatcher with explicit execution + response semantics) — without regressing throughput.

**Why this exists:** Investigating a `-race` failure in `core/capability/document` (surfaced while running Slice D's checks) revealed a pre-existing, test-only data race and a deeper design smell. The full root-cause writeup is in the orientation doc; this plan is the fix.

## Global constraints

- TDD; verbatim `*.go.md` companions in the same commit; `gofmt` before regen; per-increment `docs/records/NNNN-*.md`.
- Do **not** regress the synchronous edit contract (`POST /documents/:id/changes` returns the new revision inline) into async polling.
- Keep capabilities independent; composition in `core/wiring`.

---

## Part 1 — Document store isolation (the race fix)

**Root cause (short version):** `document.MemoryStore.DocumentByID`/`DocumentsByProject` return the stored `Document` **by value**, which copies the slice *headers* but shares the underlying `Base.Rows` backing arrays. Two concurrent `SubmitChanges` goroutines then share those rows, and `normalizeStoredBase(&doc.Base)` (service.go) **writes** them in place while another goroutine clones them (`cloneBase`) → data race. The SQLite store is immune because it rebuilds an independent `Base` from bytes on every load. So it's a lying test double, and production is safe. (Fix 1 was prototyped and confirmed to make `-race` green 5/5; it was reverted only to land it cleanly here.)

### Task 1.1 — Memory store returns independent loads

**Files:** `core/capability/document/clone.go` (+ `.md`), `core/capability/document/memory.go` (+ `.md`), a new isolation test.

- [ ] **Step 1 (test, RED):** Add `store_isolation_test.go` (`package document_test`): create a doc via `CreateDocument`, `DocumentByID`, mutate the returned `Base.Rows[0].Blocks[0].Atoms[0].Text`, `DocumentByID` again, assert the second read is unchanged. It fails today (leaks "MUTATED").
- [ ] **Step 2:** Add `cloneStoredBase(Base) Base` to `clone.go` = `cloneBase(base)` **plus** `base.Template = cloneTemplateInfo(base.Template)` (cloneBase leaves Template shared).
- [ ] **Step 3:** In `DocumentByID` and `DocumentsByProject`, set `d.Base = cloneStoredBase(d.Base)` before returning (under the existing lock).
- [ ] **Step 4 (GREEN + race):** isolation test passes; `for i in 1..5; go test -race -run Concurrent ./core/capability/document/` → 0 races.
- [ ] **Step 5:** companions (zero drift), commit.

### Task 1.2 — Correct the one test that relied on the leak

**File:** `core/capability/document/changeset_test.go` — `TestMoveOperationsPreserveIdentityAndUndo`.

Only this test breaks under 1.1, because it's the only undo/restore test with a **multi-block row** (r1: b1,b2) that `normalizeRowTracks` rewrites to `[50,50]`. It asserts `restored.Base` (from `Get`, normalized) `== doc.Base` (from `Create`, raw); that only held because the leak mutated the test's `doc.Base` reference through shared memory.

- [ ] Capture a read-back baseline right after `Create`: `originalRead, _ := docs.Get("p", doc.ID)`.
- [ ] Change the **three** `reflect.DeepEqual(restored.Base, doc.Base)` sites *inside this test* to compare against `originalRead.Base` (use `replace_all` or unique context — there are three identical `Undo`+`Get`+compare blocks). Rationale in a comment: undo restores to how the doc *reads back*, not to the raw `Create` input.
- [ ] `go test ./core/capability/document/` fully green. Commit with 1.1 (or immediately after) so no commit leaves the package red. **Verify green before committing** — the earlier mistake was committing 1.1 without seeing the FAIL.

### Task 1.3 — (Optional hardening) copy on write

- [ ] Consider having `CreateDocument`/`RebaseDocument` store `cloneStoredBase(d.Base)` too, so a caller that retains and mutates an inserted base can't alter stored state. Not required for the race; matches the "store owns its canonical copy" model. Decide during review.

---

## Part 2 — On-demand normalization (stop mutating on read)

**The smell:** `normalizeStoredBase` mutates the loaded `Base` **in place** at ~9 load sites (layout defaults, row track weights, block styles). It only *happens* to be safe in production because each load is a private deserialized copy. The principle we agreed on: **a load is read-only; normalization is derived and should be computed on demand, never written back.**

**⚠️ Decision required before building:** removing normalization from the read/`Get` path changes what `GET /documents/:id` returns — **raw** track weights instead of rescaled ones. That's a frontend-contract change (Alpha may expect normalized proportions). Resolve one of:
- **(a)** Normalize only inside layout/pagination computations (`Paginate`, and the resolved-document projection) as a **pure** function returning a normalized value; the stored/returned `Base` stays raw. Frontend normalizes or calls a layout view. *(Truest to the principle; needs a frontend check.)*
- **(b)** Keep `Get` returning normalized data, but make `normalizeStoredBase` **pure** (returns a normalized copy; callers do `doc.Base = normalizeBase(doc.Base, …)`), so nothing is mutated in place. No API change; removes the in-place-write anti-pattern; still normalizes on read. *(Lower risk; partial on the "on-demand" ideal.)*

Recommendation: ship **(b)** as the safe, mechanical step now (it removes the anti-pattern with no contract change), and pursue **(a)** ("track weights are derived; don't store them") as a deliberate follow-up gated on a frontend check.

### Task 2.1 — Make `normalizeStoredBase` non-mutating (option b)

**Files:** `core/capability/document/layout.go` (+ `.md`), all ~9 call sites in `service.go`/`template.go` (+ `.md`), tests.

- [ ] Change signature to `normalizeStoredBase(base Base, pageLayout, rules) Base` operating on a clone (or building a new value); return it.
- [ ] Update every call site from `normalizeStoredBase(&x.Base, …)` to `x.Base = normalizeStoredBase(x.Base, …)` (grep: `normalizeStoredBase(` — sites at `template.go:181`, `service.go:192,215,271,276,509,804,1048`).
- [ ] Full package green + `-race` green; companions; record.

### Task 2.2 — (Follow-up, gated) derive track weights on demand (option a)

- [ ] Confirm with the frontend whether `GET` may return raw tracks. If yes: remove normalization from load/`Get`; normalize only in `Paginate` and any layout projection (pure). Delete the load-time calls. This is a document-model change — its own spec + plan.

---

## Part 3 — The job / execution model

**The vision (yours):** a central dispatcher — config → runtime objects → each supported request wrapped at **wiring time** into a lambda that closes over its dependencies and is tagged with an **execution mode** and a **response mode**. One place to see and govern all work.

**What exists today:** handlers *are* those lambdas (closures over injected capabilities, registered in `core/transport`). The `core/platform/job` system is a **single queue with N concurrent workers (default 2)** and retry/backoff — there is **no serial queue and no per-key serialization**. Async (202 + poll) is used only for slow work (`resolve`, `rebase`, connector sync).

**Two flaws in the naive "two queues" version (must avoid):**
1. A single **serial queue serializes globally** — user A editing doc X would block user B editing doc Y. The right primitive is **per-key serialization** (keyed by document id): same key serial, different keys parallel.
2. Routing fast **synchronous** work through an N-worker pool is a **downgrade** — Go's HTTP server already gives a goroutine per request (unbounded concurrency, no queue latency), and you'd need a future/bridge to return the sync result. The pool earns its keep only for genuinely-deferred slow work.

### The refined model — three execution modes, not two queues

- **Concurrent → run inline** on the request goroutine (lean on the Go scheduler; no pool). ~95% of requests.
- **Serial → a per-key lock/lane** keyed by resource id (document). Same doc serial, different docs parallel. Where document writes go; gives a clean linear record without a global bottleneck and without the optimistic rebase dance.
- **Deferred → the existing job pool**, for slow work the client shouldn't wait on.

**Response mode (immediate vs "here's a key, poll later") is a separate axis**, declared per request at wiring time, independent of execution mode. The function itself stays ignorant of request dynamics.

**Note:** the current design already has a serialization point for linearity — the **revision-checked append** (`AppendChangeSet(expectedRevision)`); first writer at revision N wins, the loser rebases/conflicts. Per-key serial writes are an *alternative* (pessimistic) to that optimistic model — decide which you want; don't run both half-way.

### Task 3.1 — Design spec

- [ ] Write `docs/superpowers/specs/YYYY-MM-DD-execution-model-design.md`: the dispatch layer (declarative request→lambda with injected deps + `{execution, response}` tags), the three modes, per-key serialization primitive, and how it coexists with (or replaces) the revision-checked append. Decide optimistic-append vs pessimistic-per-key-serial for document writes.

### Task 3.2 — Per-key serialization primitive

- [ ] Build a small keyed serializer (`map[key]*sync.Mutex` with reference counting, or a per-key single-slot lane). Unit-test: same key serializes, different keys run concurrently. This is the one genuinely-new primitive.

### Task 3.3 — Declarative dispatch layer

- [ ] Formalize the request→lambda registration so each route declares `{execution: concurrent|serial(keyFn)|deferred, response: immediate|deferred}`. Concurrent = call inline; serial = acquire per-key lock then call inline; deferred = enqueue on the job pool. Keep handler signatures unchanged; this is a wiring/transport-layer wrapper.

### Task 3.4 — Migrate document writes

- [ ] Route `SubmitChanges`/undo/redo through `serial(byDocumentID)`. Verify `-race` clean under a per-document concurrent test, and that different-document writes still run in parallel.

---

## Sequence

1. **Part 1** (store isolation) — small, self-contained, fixes the race. Do first.
2. **Part 2 option (b)** (non-mutating normalize) — mechanical, no contract change. Do next.
3. **Part 3** (execution model) — the larger build; start with the design spec (3.1) and the per-key primitive (3.2). Part 2 option (a) can fold in here or stay a separate document-model change.

## Self-review

- Part 1 fixes the actual defect and is verified (prototype was 5/5 race-free). Part 1.2 fixes exactly one test and explains why.
- Part 2 separates the safe mechanical step (b) from the contract-affecting ideal (a), with the frontend decision called out.
- Part 3 keeps the user's central-dispatch intent while avoiding the global-serial bottleneck and the sync-through-pool downgrade; it notes the optimistic-vs-pessimistic decision rather than silently running both.
