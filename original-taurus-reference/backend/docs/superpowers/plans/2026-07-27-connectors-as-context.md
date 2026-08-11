# Connectors as Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a connector represent its individual files as first-class lattice sources, so a connector (bound directly to a prompt variable or nested inside a context) **expands** to everything it contains — and a change to any file **refreshes** the prompts that reference it, directly or through a context.

**Architecture:** A connector stops syncing its folder as one concatenated blob and instead syncs **one lattice source per file**, keyed `SourceType="connector", SourceID = <connectorID><sep><relpath>`. The connector itself is never a source — it is a container that expands to its files. Expansion reuses the exact `whole-project` mechanism: `contexts.expand` treats a `connector`-kind member like `whole-project`, calling a port that lists the connector's current file origins from the lattice. Refresh reuses the existing cascade (record 0098): the connector fires one `RefreshDependents` on change, and `DependentPrompts` learns to match a block that references the connector **through a context** (membership reachability). Provider `Snapshot` and the in-repo watcher change from one blob to per-file entries.

**Tech Stack:** Go, pure-Go SQLite, ports-and-adapters. Builds on the `contexts` capability (plans of 2026-07-27) and the knowledge lattice.

## Global Constraints

- **Work on main only.** Commit directly; never branch.
- **TDD.** Failing test first. Deterministic plumbing (provider walk, per-file sync diff, lattice enumeration, expansion, cascade) → unit tests. **End-to-end retrieval quality → the live dev-test in Task 7 only** (real model, prints token + dollar cost); never stub the model for a quality claim.
- **Companion docs, same commit**, verbatim, source order, for every changed non-test `.go` under `core/` (and `cmd/`). `gofmt -w` before regenerating; verify zero drift with `awk '/^```go$/{c=1;next}/^```$/{c=0}c' FILE.go.md | diff <(gofmt FILE.go) -` (empty; MD010 hard-tab warnings ignored). NOTE: files under `cmd/` — confirm whether the repo keeps companions there; `core/` is the companion-doc scope per AGENTS.md, so `cmd/connector-watcher/main.go` likely has **no** companion (verify by checking for an existing `cmd/connector-watcher/main.go.md`; if absent, don't create one).
- **Change records** `docs/records/0107-connectors-as-context.md` (append per increment; latest existing is `0106`).
- **The file-source key scheme is owned by the `connector` capability** and shared by reference: `connector.FileSeparator` (a byte that cannot occur in a file path — use `"\x1f"`, ASCII unit separator) and `connector.FileSourceID(connectorID, relpath) string = connectorID + FileSeparator + relpath`. The lattice enumeration prefix for a connector is `connectorID + connector.FileSeparator`. Connector ids are fixed-length hex, so the prefix is unambiguous.
- **`SourceType` stays `"connector"`** (knowledge.SourceTypeConnector); only the `SourceID` becomes composite. Scope origins already map `{Kind, ID}` ↔ `{SourceType, SourceID}` in `documentRetriever` (`wiring.go`), so a file origin `{connector, <id><sep><path>}` retrieves with no retrieval-layer change.

---

### Task 1: Provider `Snapshot` exposes per-file entries; local provider walks recursively

**Files:**
- Modify: `core/capability/connector/provider.go` (+`.go.md`) — `Snapshot.Files []FileEntry`; `FileEntry{Path, Content string}`
- Modify: `core/capability/connector/localfolder.go` (+`.go.md`) — recursive walk, populate `Files`, keep whole-snapshot `Fingerprint`
- Test: `core/capability/connector/localfolder_test.go`

**Interfaces:**
- Produces: `type FileEntry struct { Path, Content string }`; `Snapshot{ Files []FileEntry; Fingerprint string }` (drop the old single `Content` field — nothing should read it after this plan; grep first and fix any reader).

- [ ] **Step 1: Write the failing test** — a temp dir with `a.txt`, `sub/b.txt`; assert `Snapshot().Files` has both (paths relative, slash-separated, sorted: `a.txt`, `sub/b.txt`) with their contents, and a non-empty `Fingerprint` that changes when a file's content changes.

- [ ] **Step 2: Run it** — FAIL (`Files` undefined / not recursive).

- [ ] **Step 3: Implement** — in `provider.go`:

```go
// FileEntry is one file a connector's source exposes: a path relative to the
// connector root (slash-separated) and its content.
type FileEntry struct {
	Path    string
	Content string
}

// Snapshot is a provider's current per-file content plus a fingerprint that
// changes iff any file's path or content changes.
type Snapshot struct {
	Files       []FileEntry
	Fingerprint string
}
```

In `localfolder.go`, replace the flat `os.ReadDir` with `filepath.WalkDir` (recursive, skip dirs), build `Files` (relpath via `filepath.Rel` then `filepath.ToSlash`, name-sorted), and fold each `path\x00len\x00content` into the fingerprint hash as before:

```go
func (l localFolder) Snapshot() (Snapshot, error) {
	var files []FileEntry
	err := filepath.WalkDir(l.path, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(l.path, p)
		if err != nil {
			return err
		}
		files = append(files, FileEntry{Path: filepath.ToSlash(rel), Content: string(b)})
		return nil
	})
	if err != nil {
		return Snapshot{}, err
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	h := sha256.New()
	for _, f := range files {
		fmt.Fprintf(h, "%s\x00%d\x00", f.Path, len(f.Content))
		io.WriteString(h, f.Content)
	}
	return Snapshot{Files: files, Fingerprint: hex.EncodeToString(h.Sum(nil))}, nil
}
```
(Adjust imports: `io/fs`, `io`; drop `strings` if now unused.)

- [ ] **Step 4: Run tests** — PASS. Then `go build ./...` and fix any now-broken reader of the removed `Snapshot.Content` (see Task 4, which is the main one; also `cmd/connector-watcher` — Task 2).

- [ ] **Step 5: gofmt + companions + zero-drift** for `provider.go.md`, `localfolder.go.md`.

- [ ] **Step 6: Record + commit** — create `docs/records/0107-connectors-as-context.md` (the per-file model overview + this slice). Commit `Connector provider Snapshot exposes per-file entries (record 0107)`. (`go build ./...` may fail until Tasks 2 & 4 land; if so, do Tasks 1→2→4 as a tight sequence and only assert full build green after Task 4. Note this in the commit message and keep each commit's own package tests green.)

---

### Task 2: Watcher serves per-file snapshot; HTTP provider decodes it

**Files:**
- Modify: `cmd/connector-watcher/main.go` — serve `{files:[{path,content}], fingerprint}` (build from the same `localFolder` provider)
- Modify: `cmd/connector-watcher/main_test.go`
- Modify: `core/capability/connector/httpprovider.go` (+`.go.md`) — decode per-file
- Test: reuse/extend an httpprovider test if present (else add one)

**Interfaces:** the watcher's `/snapshot` JSON becomes `{"files":[{"path":"...","content":"..."}],"fingerprint":"..."}`; `httpProvider.Snapshot` decodes it into `Snapshot{Files, Fingerprint}`.

- [ ] **Step 1: Failing test** — `main_test.go`: a temp folder with two files (one nested), GET the snapshot handler, assert JSON has a `files` array with both paths+contents and a fingerprint. In `connector`, a test that `httpProvider.Snapshot` against a stub HTTP server returning per-file JSON yields the right `Files`.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — watcher marshals `provider.Snapshot()`'s `Files`+`Fingerprint` (it already calls `provider.Snapshot()`; just change the response struct to include `files`). `httpProvider.Snapshot` decodes:

```go
	var body struct {
		Files []struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		} `json:"files"`
		Fingerprint string `json:"fingerprint"`
	}
	...
	files := make([]FileEntry, 0, len(body.Files))
	for _, f := range body.Files {
		files = append(files, FileEntry{Path: f.Path, Content: f.Content})
	}
	return Snapshot{Files: files, Fingerprint: body.Fingerprint}, nil
```

- [ ] **Step 4: Run** — PASS; `go test ./cmd/connector-watcher/ ./core/capability/connector/`.

- [ ] **Step 5: companions + zero-drift** for `httpprovider.go.md` (and `cmd/connector-watcher/main.go.md` only if one already exists).

- [ ] **Step 6: Commit** (append 0107) — `Watcher and HTTP provider speak per-file snapshots (record 0107)`.

---

### Task 3: Lattice enumeration — `SourcesUnder`

List the current source origins under a `(sourceType, sourceID-prefix)` — the "connector kind maps to all sub-keys" primitive, used by both per-file sync (to prune deleted files) and connector expansion.

**Files:**
- Modify: `core/capability/knowledge/knowledge.go` (+`.go.md`) — `Store.SourcesUnder`; `Knowledge.SourcesUnder`
- Modify: `core/capability/knowledge/memory.go` (+`.go.md`) — implement on `MemoryStore`
- Modify: `core/platform/storage/sqlite/sqlite.go` (+`.go.md`) — implement on `*Store`
- Test: `core/capability/knowledge/*_test.go` (memory), `core/platform/storage/sqlite/sqlite_test.go` (sqlite)

**Interfaces:**
- Produces: `Store.SourcesUnder(projectID, sourceType, sourceIDPrefix string) ([]Origin, error)` and `Knowledge.SourcesUnder(projectID, sourceType, sourceIDPrefix string) ([]Origin, error)` — every source whose `SourceID` starts with the prefix, returned as `Origin{SourceType, SourceID}` (order unspecified; callers sort/set as needed). `knowledge.Origin{SourceType, SourceID string}` already exists.

- [ ] **Step 1: Failing tests** — memory: add three sources `(connector, X\x1fa)`, `(connector, X\x1fb)`, `(connector, Y\x1fa)`; assert `SourcesUnder(p, "connector", "X\x1f")` returns exactly the two `X` origins. sqlite: same round-trip through `*Store`.

- [ ] **Step 2: Run** — FAIL (undefined).

- [ ] **Step 3: Implement** —
  - `MemoryStore.SourcesUnder`: filter `s.sources` by `ProjectID==projectID && SourceType==sourceType && strings.HasPrefix(SourceID, prefix)`; return `Origin{}` for each (lock as the other methods do).
  - `*sqlite.Store.SourcesUnder`: `SELECT source_type, source_id FROM knowledge_sources WHERE project_id=? AND source_type=? AND source_id LIKE ? ESCAPE '\'`, with the prefix as `escapeLike(prefix) || '%'` (escape `%`/`_`/`\` in the prefix; a helper — a connector-id + `\x1f` prefix won't contain them, but escape defensively). Scan rows into `[]knowledge.Origin`.
  - `Knowledge.SourcesUnder` delegates to `k.store.SourcesUnder`.

- [ ] **Step 4: Run** — PASS; `go test ./core/capability/knowledge/ ./core/platform/storage/sqlite/`.

- [ ] **Step 5: gofmt + companions + zero-drift** for `knowledge.go.md`, `memory.go.md`, `sqlite.go.md`.

- [ ] **Step 6: Commit** (append 0107) — `Add knowledge.SourcesUnder(type, id-prefix) enumeration (record 0107)`.

---

### Task 4: Per-file sync

`applySync` writes one lattice source per file and prunes files that vanished, keyed by `connector.FileSourceID`. The whole-connector `Fingerprint` still gates "did anything change"; one cascade fires per changed sync.

**Files:**
- Modify: `core/capability/connector/connector.go` (+`.go.md`) — `FileSeparator`, `FileSourceID`
- Modify: `core/capability/connector/sync.go` (+`.go.md`) — extend `LatticeWriter` with `SourcesUnder`; rewrite `applySync` to per-file add/remove
- Modify: `core/wiring/connector_lattice.go` (+`.go.md`) — implement `SourcesUnder` over `knowledge.SourcesUnder`
- Test: `core/capability/connector/sync_test.go`

**Interfaces:**
- Consumes: `knowledge.SourcesUnder` (Task 3), `Snapshot.Files` (Task 1).
- Produces: `connector.FileSeparator = "\x1f"`, `connector.FileSourceID(connectorID, relpath) string`; `LatticeWriter` gains `SourcesUnder(projectID, sourceIDPrefix string) ([]string, error)` (returns the file source-ids currently stored under the connector).

- [ ] **Step 1: Failing test** — with a fake `LatticeWriter` recording `AddSource`/`RemoveSource` calls and a stubbed `SourcesUnder`: (a) first sync of a snapshot with files `a`,`b` calls `AddSource` for `X\x1fa`,`X\x1fb`; (b) a re-sync whose snapshot drops `b` and adds `c`, with `SourcesUnder` returning `[X\x1fa, X\x1fb]`, calls `AddSource(X\x1fc)` and `RemoveSource(X\x1fb)` and re-adds/updates `X\x1fa`; (c) `RefreshDependents(projectID, "connector", X)` fires exactly once per changed sync.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — `applySync` (per-file):

```go
func (c *Connectors) applySync(rec Connector, snap Snapshot) (SyncResult, error) {
	seq := rec.SyncSeq + 1
	var usage Usage
	if c.lattice != nil {
		want := make(map[string]bool, len(snap.Files))
		for _, f := range snap.Files {
			sid := FileSourceID(rec.ID, f.Path)
			want[sid] = true
			u, err := c.lattice.AddSource(rec.ProjectID, sid, f.Content, seq)
			if err != nil {
				return SyncResult{}, err
			}
			usage.PromptTokens += u.PromptTokens
			usage.TotalTokens += u.TotalTokens
		}
		existing, err := c.lattice.SourcesUnder(rec.ProjectID, rec.ID+FileSeparator)
		if err != nil {
			return SyncResult{}, err
		}
		for _, sid := range existing {
			if !want[sid] {
				if err := c.lattice.RemoveSource(rec.ProjectID, sid); err != nil {
					return SyncResult{}, err
				}
			}
		}
	}
	at := c.clock()
	if err := c.store.SetConnectorSyncState(rec.ProjectID, rec.ID, snap.Fingerprint, seq, at); err != nil {
		return SyncResult{}, err
	}
	if c.costs != nil {
		c.costs.RecordSyncCost(rec.ProjectID, rec.ID, usage)
	}
	if c.cascader != nil {
		c.cascader.RefreshDependents(rec.ProjectID, "connector", rec.ID)
	}
	return SyncResult{Changed: true, Fingerprint: snap.Fingerprint, Seq: seq, Usage: usage}, nil
}
```

Add to `connector.go`: `const FileSeparator = "\x1f"` and `func FileSourceID(connectorID, relpath string) string { return connectorID + FileSeparator + relpath }`. Extend the `LatticeWriter` interface with `SourcesUnder(projectID, sourceIDPrefix string) ([]string, error)`. In `connector_lattice.go`, implement it by calling `w.know.SourcesUnder(projectID, knowledge.SourceTypeConnector, prefix)` and projecting each `Origin.SourceID` into the returned `[]string`.

- [ ] **Step 4: Run** — PASS; `go build ./...` (now green across Tasks 1–4); `go test ./core/capability/connector/ ./core/wiring/`.

- [ ] **Step 5: gofmt + companions + zero-drift** for `connector.go.md`, `sync.go.md`, `connector_lattice.go.md`.

- [ ] **Step 6: Commit** (append 0107) — `Connector syncs one lattice source per file (record 0107)`.

---

### Task 5: Connector expansion in `contexts`

A `connector`-kind member expands to its current file origins — so a connector behaves like a context (expand to leaves, then subtract), whether bound directly to a prompt variable or nested in a context.

**Files:**
- Modify: `core/capability/contexts/resolve.go` (+`.go.md`) — `ConnectorFiles` port + a `connector` case in `expand`
- Modify: `core/capability/contexts/contexts.go` (+`.go.md`) — `connector` field + `UseConnectorFiles` setter (constructed after knowledge in wiring, like `UseCatalog`)
- Modify: `core/wiring/context_catalog.go` (or a new `core/wiring/context_connector.go`) (+`.go.md`) — adapter over `knowledge.SourcesUnder`
- Modify: `core/wiring/wiring.go` (+`.go.md`) — wire `contextsSvc.UseConnectorFiles(...)`
- Test: `core/capability/contexts/resolve_test.go`

**Interfaces:**
- Produces: `type ConnectorFiles interface { FilesUnder(projectID, connectorID string) ([]Ref, error) }`; `(*Contexts).UseConnectorFiles(ConnectorFiles)`. Expansion of `{Kind:"connector", ID:X}` = `FilesUnder(projectID, X)` → `[]Ref{{Kind:"connector", ID:X<sep>path}, ...}`.
- Constant: contexts refers to the connector kind by string `"connector"` — add `const KindConnector = "connector"` in `contexts` (do NOT import the connector capability). The `<sep>` in the returned ids comes from the wiring adapter (which may import `connector` for `FileSeparator`), not from `contexts`.

- [ ] **Step 1: Failing test** — a fake `ConnectorFiles` returning `[{connector, X\x1fa},{connector, X\x1fb}]` for X; assert `Resolve(Definition{Includes:[{connector,X}]})` → those two file origins; assert include connector X, exclude `{connector, X\x1fa}` → just `X\x1fb` (leaf exclusion of a file inside a connector); assert a connector nested inside a context expands too. Nil port → connector member passes through unchanged (back-compat: `{connector,X}` stays one origin) — assert that too.

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — in `expand`, add a case BEFORE the default:

```go
		case r.Kind == KindConnector:
			if c.connectorFiles == nil {
				out = append(out, r) // no expander wired: connector stays a single origin
				continue
			}
			files, err := c.connectorFiles.FilesUnder(projectID, r.ID)
			if err != nil {
				return nil, err
			}
			out = append(out, files...)
```
Add the `connectorFiles ConnectorFiles` field, `UseConnectorFiles`, `KindConnector`, and the `ConnectorFiles` port (in `resolve.go` beside `Catalog`). Wiring: an adapter whose `FilesUnder` calls `knowledge.SourcesUnder(projectID, "connector", connectorID + connector.FileSeparator)` and maps each `Origin.SourceID` → `contexts.Ref{Kind:"connector", ID: origin.SourceID}`. Wire it after knowledge+contexts exist. (Memoization from Plan 1 caches a context's leaves; a connector member is expanded each time it appears but connector files are cheap to list — acceptable; if a connector appears under multiple memoized contexts, each such context is itself memoized, so `FilesUnder` runs at most once per referencing context.)

- [ ] **Step 4: Run** — PASS; `go build ./...`; `go test ./core/capability/contexts/ ./core/wiring/`.

- [ ] **Step 5: gofmt + companions + zero-drift** for all changed files.

- [ ] **Step 6: Commit** (append 0107) — `Expand a connector to its file origins in context resolution (record 0107)`.

---

### Task 6: Deep cascade — refresh through contexts

A change to a resource that a prompt references **through a context** now refreshes that prompt. `DependentPrompts` matches not just direct scope origins but also origins reachable through a selected context's membership.

**Files:**
- Modify: `core/capability/contexts/resolve.go` (or `contexts.go`) (+`.go.md`) — `References(projectID, contextID, kind, id string) (bool, error)` (membership reachability over includes ∪ excludes, cycle/visited-guarded, whole-project treated as "references everything" ONLY if you choose to — default: whole-project does NOT count as referencing a specific origin, to avoid refreshing every prompt on every change; document the choice)
- Modify: `core/capability/document/dependencies.go` (+`.go.md`) — a `ScopeReferences` port; `DependentPrompts` also matches through selected context origins
- Modify: `core/capability/document/service.go` (+`.go.md`) — field + setter for the new port (mirror `UseScopeResolver`)
- Modify: `core/wiring/document_scope.go` (or new adapter) (+`.go.md`) + `wiring.go` — satisfy `ScopeReferences` over `contexts.References`
- Test: `core/capability/document/dependencies_test.go`, `core/capability/contexts/resolve_test.go`

**Interfaces:**
- Produces: `contexts.References(projectID, contextID, kind, id string) (bool, error)`; document port `type ScopeReferences interface { ContextReferences(projectID, contextID string, origin ScopeOrigin) (bool, error) }` (+ `UseScopeReferences` setter). `DependentPrompts`: for each block, if a direct selection origin equals `origin` → match (today's behavior, unchanged); else for each selection origin of kind `"context"`, if `ContextReferences(projectID, ctxID, origin)` → match.

- [ ] **Step 1: Failing tests** — contexts: `References` true when the origin is a direct member, true transitively through a nested context, false otherwise; a self-safe/cycle-safe walk. document: a prompt block whose variable binds to context C that contains connector X; `DependentPrompts(projectID, {connector, X})` returns that block (with a fake `ScopeReferences` that knows C→X). Also assert the pre-existing direct-origin match still works with the port nil (back-compat).

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — `contexts.References` = a reachability walk mirroring `wouldCycle` but the target is `(kind, id)` and it walks `Includes ∪ Excludes`, recursing into context members (visited-guarded), returning true on first match. `DependentPrompts`: after the existing direct-match loop, if `d.scopeReferences != nil`, for each `o` in the block's selection where `o.Kind == "context"`, call `ContextReferences(projectID, o.ID, origin)`; on true, record and break. Wire the adapter (`contextsSvc` satisfies it) in `wiring.go` via a `docs.UseScopeReferences(...)` setter.

- [ ] **Step 4: Run** — PASS; `go build ./...`; `go test ./core/capability/document/ ./core/capability/contexts/ ./core/wiring/`.

- [ ] **Step 5: gofmt + companions + zero-drift** for all changed files.

- [ ] **Step 6: Commit** (append 0107) — `Refresh prompts that reference a changed source through a context (record 0107)`.

---

### Task 7: Live dev-test — connector-as-context end to end (real model, reports cost)

**Files:**
- Create: `dev-test/connector-context/run.sh`
- Modify: `dev-test/run.sh` — add `connector-context` to `intelligence_suites`

Model on `dev-test/context-scope/run.sh` and `dev-test/live-document/run.sh` (which already spin up a connector + watcher). The suite must prove end-to-end:

1. Start service + a connector-watcher over a temp folder with two files carrying distinct facts (file A: a unique tower height; file B: a unique bridge span). Create a connector, point it at the watcher, sync.
2. Assert the connector resolved to per-file sources: create a context including `{"kind":"connector","id":<connectorID>}`, `GET /contexts/:id/resolved`, and assert the origins are the two FILE ids (`<connectorID>\x1f...`), not the bare connector id.
3. Create a prompt document with a variable bound to that context (or directly to the connector), a prompt block scoped to it; resolve; assert the answer reflects file A's fact and not file B's when the context excludes file B (leaf exclusion of a file).
4. Edit file A in the temp folder, let the watcher/detector re-sync; assert the prompt auto-refreshes to the new fact (deep cascade through the context) WITHOUT re-submitting the block.
5. `track_usage`/`usage_summary` (print tokens + est. cost); `finish`. Skip cleanly (exit 0) without an OpenRouter key. RUN IT with the key in `etc/config.local.yaml` and record the observed cost.

- [ ] Write the suite; register it; run it live; commit `Add live dev-test: connector-as-context end to end (record 0107)` and append a Verification note (facts distinguished + observed cost) to record 0107.

---

## Self-Review

**Spec coverage:** per-file provider (T1) + watcher/http (T2); lattice enumeration (T3); per-file sync with pruning (T4); connector expansion incl. leaf exclusion of a file (T5); deep cascade through contexts (T6); live proof incl. auto-refresh (T7).

**Type consistency:** `Snapshot{Files []FileEntry, Fingerprint}` (T1) consumed by watcher/http (T2) and sync (T4); `knowledge.SourcesUnder(projectID, sourceType, prefix) []Origin` (T3) consumed by `connectorLatticeWriter.SourcesUnder` (T4) and the `ConnectorFiles` wiring adapter (T5); `connector.FileSeparator`/`FileSourceID` (T4) used by sync (T4) and the T5 adapter; `contexts.ConnectorFiles.FilesUnder`→`[]Ref` (T5); `contexts.References` + document `ScopeReferences` (T6). `SourceType` stays `"connector"` throughout; only `SourceID` is composite.

**Ordering:** T1→T2→T4 form a build-coupled sequence (dropping `Snapshot.Content` breaks the watcher and sync until they're updated) — land them close together and only assert full `go build ./...` green after T4. T3 is independent (do it before T4, which consumes it). T5 depends on T3+T4; T6 depends on T5 (contexts graph + connector expansion); T7 is last.

**Placeholder scan:** test-helper references ("model on X", "a fake LatticeWriter") match the existing test patterns in those packages; all production code blocks are concrete. Confirm before T1 whether `cmd/connector-watcher/main.go` has a companion `.go.md` (AGENTS.md scopes companions to `core/`); only maintain one if it already exists.
