# System-driven refresh + attribution (Slice G) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a connector sync changes a source, the server **refreshes every dependent prompt block itself** — enqueuing a reload resolve per dependent — so the document updates on its own. The refresh is **attributed to the system actor and logged in Activity** (already true of resolution today), so it is an accountable journal entry, not an opaque mutation.

**Architecture:** A `Cascader` port on the connector capability is called best-effort after a *changed* sync. The wiring-level implementation maps the synced connector to a `ScopeOrigin`, asks `Documents.DependentPrompts` (Slice F) who depends on it, and enqueues a `document.resolve` job (mode `reload`) per dependent. Resolution is already authored by `systemAuthor` (`prompt.go:25`) and writes back through the normal changeset pipeline, which emits the Activity edit event — so attribution and logging need no new code. The cascade never fails a sync.

**Tech Stack:** Go, `core/capability/connector`, `core/capability/document` (via Slice F), the job queue.

## Global Constraints

- Capabilities never import each other: the connector depends on an abstract `Cascader`, not on `document` or the job queue; the concrete cascader lives in `core/wiring`.
- Refresh is **best-effort**: a cascade error is logged, never returned into the sync.
- Verbatim `*.go.md` companions same commit; multi-section hand-edited.
- One `docs/records/NNNN-*.md`.
- TDD: failing test first.
- **Non-goal (spec):** continuous no-viewer polling and the "updating in progress" hold-state UX are out of scope. The cascade fires on sync; the detector's cadence is Slice B's concern.

---

## File structure

- `core/capability/connector/sync.go` (modify) — `Cascader` port; call it after a changed `applySync`.
- `core/capability/connector/sync_test.go` (modify) — assert the cascader is invoked on change, not on no-op.
- `core/wiring/connector_cascade.go` (create) — `refreshCascader{docs, queue}` implementing `Cascader`.
- `core/wiring/wiring.go` (modify) — inject the cascader into `connector.NewWithSync`.
- `docs/records/NNNN-system-driven-refresh.md` (create).

---

## Task G1: `Cascader` port, invoked on changed sync

**Files:**
- Modify: `core/capability/connector/sync.go`
- Test: `core/capability/connector/sync_test.go`

**Interfaces:**
- Produces:
  - `type Cascader interface { RefreshDependents(projectID, sourceType, sourceID string) }`
  - `Connectors` gains an optional `cascader Cascader`; `NewWithSync` accepts it (extend the signature or add a setter `UseCascader`).
  - `applySync` calls `cascader.RefreshDependents(rec.ProjectID, "connector", rec.ID)` after a successful, changed sync — best-effort (no error path).

- [ ] **Step 1: Failing test**

```go
type recordingCascader struct{ calls []string }
func (r *recordingCascader) RefreshDependents(projectID, sourceType, sourceID string) {
	r.calls = append(r.calls, projectID+"/"+sourceType+"/"+sourceID)
}

func TestSyncTriggersCascadeOnlyWhenChanged(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "f.txt"), []byte("v1"), 0o644)
	casc := &recordingCascader{}
	c := NewWithSync(NewMemoryStore(nil), func(cn Connector) (Provider, error) { return NewLocalFolderProvider(cn.Path), nil }, newFakeLattice())
	c.UseCascader(casc)
	made, _ := c.Create("p", Actor{ID: "u1"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	c.Sync("p", made.ID) // changed
	if len(casc.calls) != 1 || casc.calls[0] != "p/connector/"+made.ID {
		t.Fatalf("cascade calls after change: %+v", casc.calls)
	}
	c.SyncIfChanged("p", made.ID) // no change → no cascade
	if len(casc.calls) != 1 {
		t.Fatalf("cascade fired on no-op: %+v", casc.calls)
	}
}
```

- [ ] **Step 2: Run — FAIL.** (`UseCascader` undefined.)
- [ ] **Step 3: Implement**
  - Add `cascader Cascader` to the `Connectors` struct and `func (c *Connectors) UseCascader(x Cascader) { c.cascader = x }`.
  - In `applySync`, after `SetConnectorSyncState` succeeds, if `c.cascader != nil` call `c.cascader.RefreshDependents(rec.ProjectID, "connector", rec.ID)`. Do this only on the changed path (both `Sync` and `SyncIfChanged` reach `applySync` only when re-syncing, so the call sits in `applySync`).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companion** `sync.go.md`.
- [ ] **Step 6: Commit** `git commit -m "Invoke a cascader after a changed connector sync"`

---

## Task G2: The wiring cascader — enqueue reload resolves for dependents

**Files:**
- Create: `core/wiring/connector_cascade.go`
- Modify: `core/wiring/wiring.go`
- Test: `core/wiring/connector_cascade_test.go` (or a transport-level test)

**Interfaces:**
- Consumes: `Documents.DependentPrompts` (Slice F), the job `Enqueuer`, `document.JobTypeResolve`.
- Produces: `refreshCascader{docs *document.Documents; queue job.Enqueuer}` implementing `connector.Cascader`.

- [ ] **Step 1: Failing test**

Seed a document (memory-backed `Documents`) with a prompt block scoped to connector `CX`; use a fake `Enqueuer` capturing enqueued jobs; call `RefreshDependents("p", "connector", "CX")`; assert exactly one `document.resolve` job was enqueued with `{projectId:"p", documentId:<doc>, blockId:<pb>, mode:"reload"}`.

```go
func TestCascaderEnqueuesReloadForDependents(t *testing.T) {
	docs := newTestDocuments(t)
	doc := seedDocWithScopedPrompt(t, docs, "sales", document.ResourceRef{Kind: "connector", ID: "CX"}, "pb1")
	q := &fakeEnqueuer{}
	c := refreshCascader{docs: docs, queue: q}

	c.RefreshDependents("p", "connector", "CX")

	if len(q.jobs) != 1 {
		t.Fatalf("enqueued %d jobs", len(q.jobs))
	}
	if q.jobs[0].Type != document.JobTypeResolve {
		t.Fatalf("job type %q", q.jobs[0].Type)
	}
	got := q.jobs[0].Payload.(map[string]string)
	if got["documentId"] != doc.ID || got["blockId"] != "pb1" || got["mode"] != "reload" {
		t.Fatalf("payload %+v", got)
	}
}
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**

`core/wiring/connector_cascade.go`:

```go
package wiring

import (
	"context"
	"log"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/platform/job"
)

// refreshCascader turns a changed source into reload resolves for every prompt
// block that depends on it. Refresh is best-effort: a failure is logged and never
// propagated back into the sync that triggered it. Resolution is already authored
// by the system actor and logged in Activity, so no attribution code is needed
// here.
type refreshCascader struct {
	docs  *document.Documents
	queue job.Enqueuer
}

func (c refreshCascader) RefreshDependents(projectID, sourceType, sourceID string) {
	deps, err := c.docs.DependentPrompts(projectID, document.ScopeOrigin{Kind: sourceType, ID: sourceID})
	if err != nil {
		log.Printf("cascade: dependents for %s/%s: %v", sourceType, sourceID, err)
		return
	}
	for _, d := range deps {
		payload := map[string]string{
			"projectId":  projectID,
			"documentId": d.DocumentID,
			"blockId":    d.BlockID,
			"mode":       "reload",
		}
		if _, err := c.queue.Enqueue(context.Background(), document.JobTypeResolve, payload); err != nil {
			log.Printf("cascade: enqueue resolve %s/%s: %v", d.DocumentID, d.BlockID, err)
		}
	}
}
```

(`ScopeOrigin.Kind` maps 1:1 to the connector source type `"connector"`. `document.JobTypeResolve` is at `prompt.go:88`; the payload shape matches the transport enqueue at `transport.go:453-455`.)

- [ ] **Step 4: Inject in wiring**

In `wiring.go`, after `docs` and `queue` exist and after `connectors` is built (Slice B), wire:

```go
connectors.UseCascader(refreshCascader{docs: docs, queue: queue})
```

- [ ] **Step 5: Run — PASS + `go build ./...`.**
- [ ] **Step 6: Companions** `connector_cascade.go.md`, `wiring.go.md` (multi-section).
- [ ] **Step 7: Commit** `git commit -m "Wire system-driven refresh cascade over the reference graph"`

---

## Task G3: End-to-end + Activity attribution check

**Files:**
- Modify: `dev-test/connectors/run.sh` (or the demo suite, Slice I)

- [ ] **Step 1:** (Live-ish; the resolve itself needs a model key — gate accordingly, or assert only the enqueue/activity for the no-key path.) Extend the connectors dev-test: create a document with a prompt block scoped to a connector; change the connector's folder; without any document call, wait (bounded) for the block to re-resolve; then `GET /activity` and assert a recent edit event on that document is attributed to the **system** actor. If no model key, assert the resolve job was enqueued (e.g. via a job count/log) and skip the content assertion.
- [ ] **Step 2:** Run it; `go vet ./... && ./dev-test/run.sh`.
- [ ] **Step 3:** Commit `git commit -m "Cover system-driven refresh in dev-test"`

---

## Task G4: Change record

- [ ] Create `docs/records/NNNN-system-driven-refresh.md`: *why* — a changed sync drives refresh of dependents via the reference graph; the connector depends on an abstract `Cascader` (kept independent of document/queue); refresh reuses the already-system-authored, Activity-logged resolve, so attribution/logging are free; the cascade is best-effort and never fails a sync. Satisfies acceptance criterion 3. Note the parked frontend "updating in progress" UX.
- [ ] Companion-drift check across changed `core/**`.
- [ ] Commit `git commit -m "Record NNNN: system-driven refresh"`

---

## Self-review

- **Spec coverage:** implements "A reference graph drives refresh server-side" and "System-attributed, activity-logged automatic refresh." Satisfies acceptance criterion 3 (folder change → document refreshes on its own, attributed to system, visible in Activity).
- **Type consistency:** `Cascader.RefreshDependents(projectID, sourceType, sourceID)` is the single seam; the wiring cascader maps `(sourceType,sourceID) → document.ScopeOrigin` and enqueues the exact `document.resolve` payload the transport uses.
- **Attribution:** no new attribution code — resolution is already `systemAuthor` and emits the Activity edit; the plan verifies this rather than re-implementing it.
- **No placeholders:** real code; test helper/fake names (`newTestDocuments`, `seedDocWithScopedPrompt`, `fakeEnqueuer`) must match the package's utilities — flagged.
- **Boundary check:** connector imports no document/job types (only the abstract `Cascader`); composition is in wiring. ✓
