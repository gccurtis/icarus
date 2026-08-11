# Connector sync + change detection (Slice B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a connector a **provider** it reads content from, a **sync** that feeds that content into the knowledge lattice under a `connector` source type, and **change detection** that re-syncs automatically when the underlying source changes — with no manual API call required.

**Architecture:** A `Provider` port in the connector capability exposes `Snapshot() → (content, fingerprint)`. The `local-folder` provider implements it by reading a directory. `Connectors.Sync` feeds the snapshot into `knowledge.Add(sourceType="connector", sourceID=connectorID)` and records the fingerprint + a monotonically increasing sync revision. A `connector.sync` job and a bounded detector poller (on the existing job pool) call `SyncIfChanged`, which snapshots and re-syncs only when the fingerprint moved. A manual `POST /connectors/:id/sync` route forces a sync.

**Tech Stack:** Go, pure-Go SQLite, the existing `core/platform/job` pool, `core/capability/knowledge`.

## Global Constraints

- Capabilities never import each other; composition in `core/wiring` only.
- Verbatim `*.go.md` companions in the same commit; `gofmt` before regen; multi-section companions hand-edited.
- One `docs/records/NNNN-*.md` for the increment.
- TDD: failing test first.
- The `local-folder` provider only reads a local directory. No network.

**Proto simplification (flagged for product confirmation):** the design calls for change detection via a *running companion watcher program* the server queries. For the proto, the `local-folder` provider reads the directory **in-process** on the job pool. This lives entirely behind the `Provider` port, so a companion-watcher-program provider satisfies the same port later without touching sync, the lattice, or the reference graph. If the separate watcher process is wanted now, only the provider implementation changes.

---

## File structure

- `core/capability/knowledge/knowledge.go` (modify) — add `SourceTypeConnector` constant.
- `core/capability/connector/provider.go` (create) — the `Provider` port + `Snapshot`.
- `core/capability/connector/localfolder.go` (create) — the `local-folder` provider (reads a directory).
- `core/capability/connector/sync.go` (create) — `Sync`, `SyncIfChanged`, the `LatticeWriter` port, the sync-job payload/handler, `SyncSeq`/`Fingerprint` persistence.
- `core/capability/connector/connector.go` (modify) — add `Fingerprint`, `SyncSeq`, `SyncedAt` to `Connector`; extend `Store` with `SetSyncState`.
- `core/capability/connector/*_test.go` (modify/create) — sync + change-detection unit tests with a fake `LatticeWriter` and a temp folder.
- `core/platform/storage/sqlite/sqlite.go` (modify) — columns `fingerprint`, `sync_seq`, `synced_at`; `SetConnectorSyncState`.
- `core/wiring/wiring.go` (modify) — build the provider factory + `LatticeWriter` adapter over `knowledge`; register the `connector.sync` job; start the detector poller.
- `core/wiring/connector_lattice.go` (create) — `knowledge`→`LatticeWriter` adapter (keeps the capabilities independent).
- `core/handlers/connector/connector.go` (modify) — `POST /connectors/:id/sync`.
- `core/transport/transport.go` (modify) — the sync route.
- `dev-test/connectors/run.sh` (modify) — sync + auto re-sync coverage.
- `docs/records/NNNN-connector-sync.md` (create).

---

## Task B1: `SourceTypeConnector` constant

**Files:**
- Modify: `core/capability/knowledge/knowledge.go:31`
- Test: `core/capability/knowledge/knowledge_test.go`

**Interfaces:**
- Produces: `knowledge.SourceTypeConnector = "connector"`.

- [ ] **Step 1: Failing test**

```go
func TestSourceTypeConnectorConstant(t *testing.T) {
	if SourceTypeConnector != "connector" {
		t.Fatalf("got %q", SourceTypeConnector)
	}
}
```

- [ ] **Step 2: Run — FAIL** (`undefined: SourceTypeConnector`). Run: `go test ./core/capability/knowledge/ -run TestSourceTypeConnectorConstant`
- [ ] **Step 3: Add constant** beside `SourceTypeDocument`:

```go
// SourceTypeConnector is the source type for connector-synced external content.
const SourceTypeConnector = "connector"
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companion** `knowledge.go.md` (hand-edit the const block; multi-section).
- [ ] **Step 6: Commit** `git commit -m "Add connector knowledge source type"`

---

## Task B2: The `Provider` port + `local-folder` provider

**Files:**
- Create: `core/capability/connector/provider.go`, `core/capability/connector/localfolder.go`
- Test: `core/capability/connector/localfolder_test.go`

**Interfaces:**
- Produces:
  - `type Snapshot struct { Content string; Fingerprint string }`
  - `type Provider interface { Snapshot() (Snapshot, error) }`
  - `func NewLocalFolderProvider(path string) Provider`

- [ ] **Step 1: Failing test**

```go
package connector

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLocalFolderSnapshotConcatenatesAndFingerprints(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("alpha"), 0o644)
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("beta"), 0o644)

	p := NewLocalFolderProvider(dir)
	s1, err := p.Snapshot()
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if s1.Content == "" || s1.Fingerprint == "" {
		t.Fatalf("empty snapshot: %+v", s1)
	}
	// Stable when nothing changes.
	s2, _ := p.Snapshot()
	if s1.Fingerprint != s2.Fingerprint {
		t.Fatal("fingerprint changed with no edit")
	}
	// Moves when content changes.
	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("ALPHA"), 0o644)
	s3, _ := p.Snapshot()
	if s3.Fingerprint == s1.Fingerprint {
		t.Fatal("fingerprint did not change after edit")
	}
}
```

- [ ] **Step 2: Run — FAIL.** `go test ./core/capability/connector/ -run TestLocalFolder`
- [ ] **Step 3: Implement**

`provider.go`:

```go
package connector

// Snapshot is a provider's current content plus a fingerprint that changes iff
// the content changes. The connector compares fingerprints to decide whether a
// re-sync is needed.
type Snapshot struct {
	Content     string
	Fingerprint string
}

// Provider is the seam to an external source. The local-folder provider reads a
// directory; a companion-watcher-program or a real cloud provider satisfies the
// same contract later.
type Provider interface {
	Snapshot() (Snapshot, error)
}
```

`localfolder.go`:

```go
package connector

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type localFolder struct{ path string }

// NewLocalFolderProvider reads a local directory (non-recursive over regular
// files, name-sorted) as the connector's content.
func NewLocalFolderProvider(path string) Provider { return localFolder{path: path} }

func (l localFolder) Snapshot() (Snapshot, error) {
	entries, err := os.ReadDir(l.path)
	if err != nil {
		return Snapshot{}, err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	var content strings.Builder
	h := sha256.New()
	for _, name := range names {
		b, err := os.ReadFile(filepath.Join(l.path, name))
		if err != nil {
			return Snapshot{}, err
		}
		fmt.Fprintf(&content, "# %s\n%s\n\n", name, b)
		fmt.Fprintf(h, "%s\x00%d\x00", name, len(b))
		h.Write(b)
	}
	return Snapshot{Content: content.String(), Fingerprint: hex.EncodeToString(h.Sum(nil))}, nil
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companions** `provider.go.md`, `localfolder.go.md`.
- [ ] **Step 6: Commit** `git commit -m "Add connector Provider port and local-folder provider"`

---

## Task B3: Sync state on the connector record

**Files:**
- Modify: `core/capability/connector/connector.go` (add fields + `Store.SetSyncState`)
- Modify: `core/capability/connector/memory.go`
- Modify: `core/platform/storage/sqlite/sqlite.go` (columns + method)
- Test: connector + sqlite tests

**Interfaces:**
- Produces: `Connector.Fingerprint string`, `Connector.SyncSeq int64`, `Connector.SyncedAt time.Time`; `Store.SetConnectorSyncState(projectID, id, fingerprint string, seq int64, at time.Time) error`.

- [ ] **Step 1: Failing test** (connector_test.go): after `SetSyncState`, `Get` reflects fingerprint/seq/syncedAt. (sqlite_test.go: same across reopen.)
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
  - Add the three fields to `Connector`.
  - Add `SetConnectorSyncState` to the `Store` interface; implement in `memory.go` (load, set fields, store) and in `sqlite.go` (add columns to the DDL from Slice A, `ALTER`-free by shipping the columns in the same `CREATE TABLE`; `UPDATE connectors SET fingerprint=?, sync_seq=?, synced_at=? WHERE ...`).
  - The service exposes `func (c *Connectors) recordSync(rec Connector, fp string, at time.Time) error` used by `sync.go`.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companions** (connector.go.md, memory.go.md, sqlite.go.md multi-section).
- [ ] **Step 6: Commit** `git commit -m "Persist connector sync state (fingerprint, seq, syncedAt)"`

---

## Task B4: `Sync` and `SyncIfChanged`

**Files:**
- Create: `core/capability/connector/sync.go`
- Test: `core/capability/connector/sync_test.go`

**Interfaces:**
- Consumes: `Provider`, `Store`, `knowledge.Add` (via a port).
- Produces:
  - `type LatticeWriter interface { AddSource(projectID, sourceID, text string, revision int64) error; RemoveSource(projectID, sourceID string) error }`
  - `type ProviderFactory func(c Connector) (Provider, error)`
  - service gains `providers ProviderFactory` and `lattice LatticeWriter` (set via `New`/options).
  - `func (c *Connectors) Sync(projectID, id string) (SyncResult, error)`
  - `func (c *Connectors) SyncIfChanged(projectID, id string) (SyncResult, error)` where `SyncResult{Changed bool; Fingerprint string; Seq int64}`.

- [ ] **Step 1: Failing test**

```go
type fakeLattice struct{ added map[string]string; rev map[string]int64 }
func newFakeLattice() *fakeLattice { return &fakeLattice{added: map[string]string{}, rev: map[string]int64{}} }
func (f *fakeLattice) AddSource(projectID, sourceID, text string, revision int64) error { f.added[sourceID] = text; f.rev[sourceID] = revision; return nil }
func (f *fakeLattice) RemoveSource(projectID, sourceID string) error { delete(f.added, sourceID); return nil }

func TestSyncFeedsLatticeAndBumpsSeq(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "f.txt"), []byte("hello"), 0o644)
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), func(cn Connector) (Provider, error) { return NewLocalFolderProvider(cn.Path), nil }, lat)
	made, _ := c.Create("p", Actor{ID: "u1"}, "drive", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	r1, err := c.Sync("p", made.ID)
	if err != nil || !r1.Changed || r1.Seq != 1 {
		t.Fatalf("first sync: %+v err=%v", r1, err)
	}
	if lat.added[made.ID] == "" {
		t.Fatal("content not fed to lattice")
	}
	// No change → SyncIfChanged is a no-op.
	r2, _ := c.SyncIfChanged("p", made.ID)
	if r2.Changed {
		t.Fatal("re-synced with no change")
	}
	// Change the folder → SyncIfChanged re-syncs and bumps seq.
	os.WriteFile(filepath.Join(dir, "f.txt"), []byte("HELLO WORLD"), 0o644)
	r3, _ := c.SyncIfChanged("p", made.ID)
	if !r3.Changed || r3.Seq != 2 {
		t.Fatalf("expected re-sync seq 2: %+v", r3)
	}
}
```

- [ ] **Step 2: Run — FAIL.** (`NewWithSync`, `Sync`, `SyncIfChanged` undefined.)
- [ ] **Step 3: Implement `sync.go`**

```go
package connector

import "time"

// LatticeWriter is the knowledge seam the connector feeds. The real adapter wraps
// knowledge.Add/Remove in core/wiring so the two capabilities stay independent.
type LatticeWriter interface {
	AddSource(projectID, sourceID, text string, revision int64) error
	RemoveSource(projectID, sourceID string) error
}

// ProviderFactory builds the Provider for a connector from its stored config.
type ProviderFactory func(c Connector) (Provider, error)

// SyncResult reports whether a sync changed the lattice and the new state.
type SyncResult struct {
	Changed     bool
	Fingerprint string
	Seq         int64
}

// NewWithSync builds a service wired for syncing (provider factory + lattice).
func NewWithSync(store Store, providers ProviderFactory, lattice LatticeWriter) *Connectors {
	c := New(store)
	c.providers = providers
	c.lattice = lattice
	return c
}

// Sync snapshots the provider and feeds its content into the lattice, bumping the
// connector's sync sequence. It always writes (used by the manual endpoint).
func (c *Connectors) Sync(projectID, id string) (SyncResult, error) {
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return SyncResult{}, err
	}
	snap, err := c.snapshot(rec)
	if err != nil {
		return SyncResult{}, err
	}
	return c.applySync(rec, snap)
}

// SyncIfChanged snapshots and only re-syncs when the fingerprint moved.
func (c *Connectors) SyncIfChanged(projectID, id string) (SyncResult, error) {
	rec, err := c.store.ConnectorByID(projectID, id)
	if err != nil {
		return SyncResult{}, err
	}
	snap, err := c.snapshot(rec)
	if err != nil {
		return SyncResult{}, err
	}
	if snap.Fingerprint == rec.Fingerprint && rec.SyncSeq != 0 {
		return SyncResult{Changed: false, Fingerprint: rec.Fingerprint, Seq: rec.SyncSeq}, nil
	}
	return c.applySync(rec, snap)
}

func (c *Connectors) snapshot(rec Connector) (Snapshot, error) {
	if c.providers == nil {
		return Snapshot{}, ErrInvalidPath
	}
	p, err := c.providers(rec)
	if err != nil {
		return Snapshot{}, err
	}
	return p.Snapshot()
}

func (c *Connectors) applySync(rec Connector, snap Snapshot) (SyncResult, error) {
	seq := rec.SyncSeq + 1
	if c.lattice != nil {
		if err := c.lattice.AddSource(rec.ProjectID, rec.ID, snap.Content, seq); err != nil {
			return SyncResult{}, err
		}
	}
	at := c.clock()
	if err := c.store.SetConnectorSyncState(rec.ProjectID, rec.ID, snap.Fingerprint, seq, at); err != nil {
		return SyncResult{}, err
	}
	_ = time.Time{} // (imports; remove if unused after final edit)
	return SyncResult{Changed: true, Fingerprint: snap.Fingerprint, Seq: seq}, nil
}
```

Add the `providers ProviderFactory` and `lattice LatticeWriter` fields to the `Connectors` struct in `connector.go`.

- [ ] **Step 4: Run — PASS.** Remove the placeholder `_ = time.Time{}` line and drop the `time` import if unused.
- [ ] **Step 5: Companions** `sync.go.md`, `connector.go.md`.
- [ ] **Step 6: Commit** `git commit -m "Add connector Sync and SyncIfChanged over a lattice writer"`

---

## Task B5: The sync job + detector, wired

**Files:**
- Create: `core/wiring/connector_lattice.go`
- Modify: `core/wiring/wiring.go`
- Modify: `core/capability/connector/sync.go` (job payload + handler helper)

**Interfaces:**
- Produces: job type `"connector.sync"`; `func (c *Connectors) SyncJob(ctx, payload) error`; a detector that enqueues `connector.sync` for changed connectors.

- [ ] **Step 1: Failing test** (connector sync_test.go): `SyncJob` with a payload `{projectId,id}` runs `SyncIfChanged`. Assert it feeds the fake lattice.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
  - In `sync.go`: `const JobTypeSync = "connector.sync"`; `type syncPayload struct{ ProjectID, ID string }`; `func (c *Connectors) SyncJob(ctx context.Context, payload json.RawMessage) error` decoding the payload and calling `SyncIfChanged`.
  - `core/wiring/connector_lattice.go`: adapter implementing `connector.LatticeWriter` by calling `knowledge.Add(ctx, projectID, knowledge.SourceTypeConnector, sourceID, text, []knowledge.BlockSpan{{Start: 0, End: len(text)}}, revision)` and `knowledge.Remove(...)`. Uses `context.Background()`.
  - In `wiring.go`: build `connectors := connector.NewWithSync(store, localFolderFactory, connectorLatticeWriter{knowledge: know})` (replacing the Slice-A `connector.New(store)`); `localFolderFactory` returns `connector.NewLocalFolderProvider(c.Path)` for `SubKindLocalFolder`. Register `registry.Register(connector.JobTypeSync, connectors.SyncJob)` beside the other `registry.Register(...)` calls at wiring.go:316-319.
  - **Detector:** add a bounded ticker/goroutine (or reuse the pool poll) that lists each project's connectors and enqueues `connector.sync` when `SyncIfChanged` would change — for the proto, a simple `Connectors.DetectAll(enqueue func(projectID,id string))` invoked on the pool's interval. Keep it modest (e.g. every few seconds) and log-free on the happy path. Guard behind a config flag `connectors.detect_interval` (0 disables).
- [ ] **Step 4: Run — PASS + `go build ./...`.**
- [ ] **Step 5: Companions** (`connector_lattice.go.md`, `sync.go.md`, `wiring.go.md` multi-section).
- [ ] **Step 6: Commit** `git commit -m "Wire connector sync job, lattice adapter, and change detector"`

---

## Task B6: Manual sync route

**Files:**
- Modify: `core/handlers/connector/connector.go`, `core/transport/transport.go`
- Test: `core/transport/transport_test.go`

**Interfaces:**
- Produces: `POST /connectors/:connectorID/sync` → `200 {seq, changed}` (forces a sync).

- [ ] **Step 1: Failing test:** create + configure a connector pointing at a temp dir with a file, `POST /connectors/:id/sync` → 200 `changed:true`, `seq:1`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `Sync` handler method calling `h.connectors.Sync`; register the route beside the others in transport (project-scoped, `canWrite`-equivalent gate consistent with other connector writes).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companions + commit** `git commit -m "Add manual connector sync route"`

---

## Task B7: dev-test — sync + automatic re-sync

**Files:**
- Modify: `dev-test/connectors/run.sh`, `dev-test/connectors/manual.md`

- [ ] **Step 1: Extend the suite**
  - Create a temp folder (`mktemp -d`), write a file, create + configure a connector at that path.
  - `POST /connectors/:id/sync` → 200 `changed:true`.
  - (If `/dev/knowledge/retrieve` is available in the suite context) retrieve a query matching the file content and assert a region with `sourceType:"connector"`; otherwise assert the connector's `syncedAt`/`seq` advanced via `GET /connectors/:id`.
  - **Auto re-sync:** overwrite the file with new content; without calling `/sync`, poll `GET /connectors/:id` (bounded loop, a few seconds) until `seq` increments — proving the detector re-synced on its own. Assert the new content is reflected.
- [ ] **Step 2: Run it** `./dev-test/connectors/run.sh` — all pass. Set `connectors.detect_interval` low in the suite's config so the wait is short.
- [ ] **Step 3: Full suite + vet** `go vet ./... && ./dev-test/run.sh`.
- [ ] **Step 4: Commit** `git commit -m "Extend connectors dev-test: sync + automatic re-sync"`

---

## Task B8: Change record

**Files:**
- Create: `docs/records/NNNN-connector-sync.md`

- [ ] Capture *why*: the `Provider` seam; local-folder reads a directory (proto stand-in for the companion watcher, flagged); `Sync` feeds `knowledge.Add` under `connector` source type with a monotonic sync revision; `SyncIfChanged` + the detector give automatic re-sync (acceptance criterion 2); the lattice adapter keeps `connector` and `knowledge` independent. Note the proto-simplification flag and that continuous no-viewer polling remains a non-goal (the detector is bounded/opt-in).
- [ ] Companion-drift check across changed `core/**` files.
- [ ] **Commit** `git commit -m "Record NNNN: connector sync and change detection"`

---

## Self-review

- **Spec coverage:** satisfies acceptance criterion 2 (folder change → auto re-sync into the lattice, no manual call). Downstream refresh of prompt blocks is Slices F/G.
- **Type consistency:** `Provider`/`Snapshot`, `LatticeWriter` (2 methods), `ProviderFactory`, `SyncResult` are used identically in the service, wiring adapter, job, and handler. `knowledge.Add` call matches its real signature (`blocks []BlockSpan`, `revision int64`).
- **No placeholders:** real code throughout; the one `_ = time.Time{}` line is explicitly flagged for removal in B4 Step 4.
- **Boundary check:** connector imports neither `knowledge` nor `job` types beyond `json`/`context`; the `LatticeWriter` and job registration live in wiring. ✓
- **Proto flag:** the in-process local-folder read (vs a companion watcher process) is called out in B intro, B5, and the record for product confirmation.
