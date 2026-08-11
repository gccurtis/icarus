# Connectors as context: per-file connector model (`core/capability/connector`)

Design: [`docs/superpowers/specs/2026-07-27-context-capability-design.md`](../superpowers/specs/2026-07-27-context-capability-design.md).
Plan: [`docs/superpowers/plans/2026-07-27-connectors-as-context.md`](../superpowers/plans/2026-07-27-connectors-as-context.md).

**Goal of the slice this plan implements:** make a connector represent its
individual files as first-class lattice sources, so a connector — bound
directly to a prompt variable or nested inside a context — expands to
everything it contains, and a change to any one file refreshes the prompts
that reference it, directly or through a context. The target architecture:
a connector stops syncing its folder as one concatenated blob and instead
syncs **one lattice source per file**, keyed
`SourceType="connector", SourceID = <connectorID><sep><relpath>`. The
connector itself is never a source — it is a container that expands to its
files, reusing the existing `whole-project` expansion mechanism in
`contexts.expand`. This record gains a "What changed" section per task as
each lands, per the working agreement's "small follow-ups append to it"
convention.

## Task 1: Provider `Snapshot` exposes per-file entries; local provider walks recursively

`Provider.Snapshot()` moves from returning one concatenated blob to
returning **per-file entries**, the foundation the later per-file sync
(Task 4) and lattice expansion (later tasks) build on.

### `core/capability/connector/provider.go`

- **New `FileEntry`**: `{ Path, Content string }` — one file a connector's
  source exposes, `Path` relative to the connector root and
  slash-separated.
- **`Snapshot` gains `Files []FileEntry`.** The plan's Task 1 spec calls for
  dropping the old single `Content` field once nothing reads it, but at this
  point in the plan three call sites still read it — `sync.go`'s
  `applySync` (until Task 4 migrates it to `Files`), plus the HTTP provider's
  decode and the in-repo watcher's response marshalling (both until Task 2
  migrates them) — and none is touched by this task. **This task
  deliberately keeps `Content` on `Snapshot`** so the build and those
  callers stay green; `Content` is documented as a temporary back-compat
  shim that later tasks retire. (As of Task 4, `applySync` no longer reads
  `Content` at all — it reads `snap.Files` — so `Content` was a
  dead-but-populated shim whose only remaining touches were the watcher's
  JSON marshalling and the HTTP provider's decode. It has since been removed
  in this cleanup — see "Cleanup: `Snapshot.Content` removed" below.)

### `core/capability/connector/localfolder.go`

- `Snapshot()` replaces the flat `os.ReadDir` with `filepath.WalkDir`,
  recursing into subdirectories and skipping directory entries themselves.
  Each file's path is made relative to the root (`filepath.Rel`) and
  normalized to forward slashes (`filepath.ToSlash`) so `FileEntry.Path` is
  stable across platforms; the resulting `files` slice is sorted by path for
  determinism.
- The fingerprint is unchanged in spirit — SHA-256 folding in each file's
  path, content length, and bytes (`path\x00len\x00content`) — now computed
  over the recursive file set instead of one directory level, so it still
  changes iff any file's path or content changes, anywhere in the tree.
- `Content` is still populated: the same loop that builds `Files` also
  builds the concatenated `"# <path>\n<content>\n\n"` blob (now keyed by
  relative path rather than bare file name), so the in-repo watcher keeps
  serving meaningful content until Task 2 migrates it to `Files`.

### Test

`core/capability/connector/localfolder_test.go`:

- `TestLocalFolderSnapshotWalksRecursivelyIntoFiles` (new, TDD'd against the
  failing build first — `Files` undefined) — a temp dir with `a.txt` and
  `sub/b.txt`; asserts `Snapshot().Files` has both entries, sorted, with
  relative slash-separated paths (`a.txt`, `sub/b.txt`) and correct
  contents; asserts `Fingerprint` is non-empty and changes when the nested
  file's content changes; asserts `Content` still contains both files' text
  (back-compat).
- `TestLocalFolderSnapshotConcatenatesAndFingerprints` (pre-existing) is
  unchanged and continues to pass, confirming the flat (non-nested) case's
  `Content`/`Fingerprint` behavior is preserved.

Both are deterministic plumbing tests over a real temp-directory
filesystem — no intelligence is stubbed.

### Verification

```
go test ./core/capability/connector/ -run TestLocalFolderSnapshotWalksRecursivelyIntoFiles
go test ./core/capability/connector/
go build ./...
```

All pass; `go build ./...` is green because `Content` was kept rather than
dropped. Zero-drift verified for both changed companion docs
(`provider.go.md`, `localfolder.go.md`) via
`awk '/^```go$/{c=1;next}/^```$/{c=0}c' FILE.go.md | diff <(gofmt FILE.go) -`.

Later tasks in the plan (not yet landed): the watcher and HTTP provider
migrate to `Files` (Task 2), the file-source key scheme
(`connector.FileSourceID`) lands, sync diffs per file instead of the whole
blob (Task 4), context expansion learns to treat a `connector`-kind member
like `whole-project` (later tasks), and — once all readers of `Content` are
migrated — `Snapshot.Content` is dropped for good.

## Task 2: Watcher serves per-file JSON; HTTP provider decodes it

The in-repo `connector-watcher` and the `httpProvider` that polls it both
learn the `Files` shape Task 1 added to `Snapshot`, while keeping `Content`
on the wire too — `Snapshot.Content` isn't dropped until every reader has
migrated, and neither side of this HTTP contract is that reader yet.

### `cmd/connector-watcher/main.go`

- `snapshotHandler`'s response used to be a bare `map[string]string` (only
  `content` + `fingerprint`), which can't hold a JSON array. It's now a new
  `snapshotResponse` struct (`Content string`, `Files []snapshotFile`,
  `Fingerprint string`) with a `snapshotFile{Path, Content string}` element
  type — both tagged for the same wire shape (`{"content":...,
  "files":[{"path":...,"content":...}], "fingerprint":...}`).
- The handler now converts `provider.Snapshot()`'s `[]connector.FileEntry`
  into `[]snapshotFile` and includes it alongside the still-served `Content`
  and `Fingerprint`. No behavior for existing callers changes — `content`
  and `fingerprint` are unchanged — `files` is additive.
- No companion doc: per AGENTS.md, paired `.go.md` companions apply to
  `core/`; `cmd/connector-watcher/main.go` has never had one, and this task
  doesn't start one.

### `core/capability/connector/httpprovider.go`

- `httpProvider.Snapshot`'s anonymous decode struct gains a `Files []struct
  { Path, Content string }` field alongside the existing `Content` and
  `Fingerprint`. The decoded `files` are converted into
  `[]connector.FileEntry` and returned on `Snapshot.Files`; `Content` and
  `Fingerprint` are decoded and returned exactly as before — the HTTP
  provider now carries both representations, matching the watcher's wire
  shape.

### Tests

- `cmd/connector-watcher/main_test.go`
  (`TestSnapshotHandlerServesFolderContentAndFingerprint`, extended): the
  temp folder now has a nested file too (`a.txt` and `sub/b.txt`); the test
  decodes the handler's JSON into a struct with a `files` array and asserts
  both paths appear with their correct contents (`a.txt` → `"hello world"`,
  `sub/b.txt` → `"nested content"`), plus the pre-existing `content`/
  `fingerprint` assertions still pass.
- `core/capability/connector/httpprovider_test.go`
  (`TestHTTPProviderReadsSnapshotOverHTTP`, extended): the stub
  `httptest.Server` now returns a `files` array (two entries, one nested)
  alongside `content`/`fingerprint`; the test asserts `Snapshot.Files`
  equals the expected `[]FileEntry` (via `reflect.DeepEqual`) in addition to
  the pre-existing `Content`/`Fingerprint` assertions.
  `TestHTTPProviderErrorsOnBadStatus` is unchanged.

Both tests were run first against the pre-implementation code and failed
(`main_test.go:45: expected 2 files, got 0: []`;
`httpprovider_test.go:41: unexpected files: got [], want
[{Path:a.txt Content:file a} {Path:sub/b.txt Content:file b}]`), then passed
after the implementation above.

### Verification

```
go test ./cmd/connector-watcher/ ./core/capability/connector/
go build ./...
```

Both green. Zero-drift verified for `httpprovider.go.md` via
`awk '/^```go$/{c=1;next}/^```$/{c=0}c' core/capability/connector/httpprovider.go.md | diff <(gofmt core/capability/connector/httpprovider.go) -`
(empty).

`Snapshot.Content` is still populated and decoded on both sides — it isn't
dropped until sync (Task 4) and any other remaining readers migrate to
`Files`.

## Task 3: Lattice enumeration — `SourcesUnder`

The "connector kind maps to all sub-keys" primitive: list the current source
origins under a `(sourceType, sourceID-prefix)`. Later tasks use it to prune
vanished connector files (diff this listing against a fresh sync) and to
expand a connector to its files.

### `core/capability/knowledge/knowledge.go`

- `Store` interface gains `SourcesUnder(projectID, sourceType,
  sourceIDPrefix string) ([]Origin, error)`, documented next to
  `SourceByOrigin`.
- `Knowledge.SourcesUnder` delegates straight to `k.store.SourcesUnder`,
  placed next to `ChangedSince`.

### `core/capability/knowledge/memory.go`

- `MemoryStore.SourcesUnder` filters `s.sources` under the same lock the
  other read methods hold, keeping every source whose `ProjectID` and
  `SourceType` match and whose `SourceID` has the prefix
  (`strings.HasPrefix`), returned as `Origin{SourceType, SourceID}`.

### `core/platform/storage/sqlite/sqlite.go`

- `*Store.SourcesUnder` runs `SELECT source_type, source_id FROM
  knowledge_sources WHERE project_id=? AND source_type=? AND
  substr(source_id, 1, ?) = ?`, passing `len([]rune(sourceIDPrefix))` and
  `sourceIDPrefix` itself — a plain BINARY compare of the prefix's first N
  characters against the column, case-sensitive and metacharacter-free by
  construction, matching `strings.HasPrefix` exactly (see "Fix round 1"
  below for why the original `LIKE`-based version didn't).

### Tests

- `core/capability/knowledge/knowledge_test.go`
  (`TestSourcesUnderReturnsPrefixMatches`): seeds three sources via
  `Knowledge.Add` — `(connector, "X\x1fa")`, `(connector, "X\x1fb")`,
  `(connector, "Y\x1fa")` — and asserts `store.SourcesUnder(p, "connector",
  "X\x1f")` returns exactly the two `X` origins, order-insensitive, never the
  `Y` one. A second phase adds `(connector, "X%foo")` and `(connector,
  "Xbarfoo")` and asserts `SourcesUnder(p, "connector", "X%")` returns only
  `X%foo` — proving prefix matching is literal, not a LIKE-style pattern,
  even in the in-memory store where nothing forces that today. A third phase
  (added in "Fix round 1") adds `(connector, "AbC\x1fone")` and `(connector,
  "abc\x1ftwo")` and asserts `SourcesUnder(p, "connector", "AbC\x1f")`
  returns only `AbC\x1fone` — prefix matching is case-sensitive too.
- `core/platform/storage/sqlite/sqlite_test.go`
  (`TestSourcesUnderReturnsPrefixMatches`): seeds sources via
  `s.ReplaceSource` directly (the same lowest-level insert
  `TestKnowledgeStoreRoundTrip`/`TestKnowledgeDeleteSource` use), covering
  the same `X`/`Y` prefix split, a cross-project isolation case (a `p2`
  source sharing the `X\x1f` prefix is invisible from `p1` and vice versa),
  the same literal-`%`-prefix case as the memory test, and (added in "Fix
  round 1") the same case-sensitivity case, now exercising the real SQL.

All were run first against the pre-implementation code and failed to build
(`SourcesUnder undefined`), then passed after the implementation above.

### Verification

```
go build ./...
go test ./core/capability/knowledge/ ./core/platform/storage/sqlite/
```

Both green. Zero-drift verified for all three companion docs
(`knowledge.go.md`, `memory.go.md`, `sqlite.go.md`) via
`awk '/^```go$/{c=1;next}/^```$/{c=0}c' FILE.go.md | diff <(gofmt FILE.go) -`
— all three empty (see "Fix round 1" for `memory.go.md`, whose per-function-
chunked companion needed real content changes, not just re-verification, to
get there).

## Task 3, fix round 1: case-sensitive `SourcesUnder`; real `memory.go.md` zero-drift

Code review on Task 3 found two Important findings, both fixed in this round.

**Finding 1 — sqlite's `SourcesUnder` was case-insensitive.** The original
implementation used `source_id LIKE ? ESCAPE '\'` with an escaped prefix.
SQLite's `LIKE` is case-insensitive for ASCII by default (no
`case_sensitive_like` pragma set in this codebase), so `SourcesUnder(p,
"connector", "AbC\x1f")` matched both `"AbC\x1fone"` and `"abc\x1ftwo"` —
diverging from `MemoryStore.SourcesUnder`'s case-sensitive
`strings.HasPrefix`, and from the interface's documented contract ("SourceID
starts with the prefix", a literal comparison). Fixed by replacing the
`LIKE` clause with `substr(source_id, 1, ?) = ?`: `source_id` carries no
`COLLATE NOCASE`, so `=` is a BINARY (case-sensitive) compare, and `substr`
takes a literal character count with no metacharacter semantics at all — no
escaping needed, so the now-unused `escapeLike` helper was deleted (confirmed
via `grep -rn escapeLike` that nothing else in the tree referenced it).

**Finding 2 — `memory.go.md` wasn't actually zero-drift.** The first
Task 3 pass claimed zero-drift for all three companions, but
`memory.go.md`'s per-function-chunked style meant the blank line `gofmt`
inserts between every pair of top-level declarations fell *outside* the
fences (it lives in the prose paragraph between two ```go blocks instead),
so concatenating the fences and diffing against `gofmt`'d `memory.go`
produced 15 blank-line-only hunks (14 pre-existing at the base commit, plus
one more from the `SourcesUnder` section Task 3 added) — not the empty diff
AGENTS.md's companion-doc contract requires. Fixed by inserting the missing
blank line into the appropriate fence at each of the 15 section boundaries
(as the trailing blank line of the earlier section's block, matching how
`gofmt` places it), so the concatenation now reproduces `memory.go`
byte-for-byte.

### Test — mixed-case parity (the scenario Finding 1 broke)

Added to both `TestSourcesUnderReturnsPrefixMatches` tests (memory and
sqlite): seed `(connector, "AbC\x1fone")` and `(connector, "abc\x1ftwo")`,
assert `SourcesUnder(p, "connector", "AbC\x1f")` returns exactly one origin,
`AbC\x1fone`. Confirmed by temporarily reverting `sqlite.go` to the
pre-fix `LIKE`-based code and re-running just this test:

```
$ go test ./core/platform/storage/sqlite/ -run TestSourcesUnderReturnsPrefixMatches -v
=== RUN   TestSourcesUnderReturnsPrefixMatches
    sqlite_test.go:968: SourcesUnder("AbC\x1f") = [{SourceType:connector SourceID:AbCone} {SourceType:connector SourceID:abctwo}], want exactly {AbC\x1fone}
--- FAIL: TestSourcesUnderReturnsPrefixMatches (0.07s)
FAIL
```

then restoring the `substr`-based fix and re-running:

```
$ go test ./core/platform/storage/sqlite/ -run TestSourcesUnderReturnsPrefixMatches -v
=== RUN   TestSourcesUnderReturnsPrefixMatches
--- PASS: TestSourcesUnderReturnsPrefixMatches (0.06s)
PASS
```

The memory-store version of the test passed against the unmodified
`MemoryStore.SourcesUnder` on the first run — it was already
case-sensitive, as the finding said.

### `memory.go.md` drift resolution — before/after

Before this round: 15 hunks (all blank-line omissions at section
boundaries — see Finding 2). After inserting the 15 missing blank lines
(one at the end of each of the 15 non-final fenced blocks, matching
`gofmt`'s placement between `package`/`import`, `MemoryStore` struct,
`NewMemoryStore`, `SourceByOrigin`, `SourcesUnder`, `ReplaceSource`,
`DeleteSource`, `rebuildCorpusLocked`, `Identities`, `EntryFrontier`,
`NodesByID`/`WindowsByID`, `ProjectWindows`, `SourceWindows`,
`ProjectChangedSince`, and `SourcesByRef`): 0 hunks.

### Verification

```
go build ./...
go test ./core/capability/knowledge/ ./core/platform/storage/sqlite/
```

Both green, including the new mixed-case assertions. Zero-drift re-verified
for all three companions — `knowledge.go.md`, `memory.go.md`,
`sqlite.go.md` — via the same `awk | diff` command as above; all three now
genuinely empty.

## Task 4: Per-file sync — `applySync` writes one lattice source per file

The connector switches from syncing its whole folder as one concatenated
blob to syncing **one lattice source per file**, keyed
`connectorID<FileSeparator>relpath`, and prunes any source whose file
vanished from the current snapshot. `Snapshot.Content` is deliberately left
in place — dead but harmless — until a later cleanup removes it once
nothing reads it.

### `core/capability/connector/connector.go`

- New `const FileSeparator = "\x1f"` (a control character, so it never
  collides with a real path segment) and `func FileSourceID(connectorID,
  relpath string) string { return connectorID + FileSeparator + relpath }`
  — the addressing convention every file source ID under a connector
  follows, placed right after `CostRecorder` since it's the other half of
  the sync contract.

### `core/capability/connector/sync.go`

- `LatticeWriter` gains `SourcesUnder(projectID, sourceIDPrefix string)
  ([]string, error)` — the file source-ids currently stored under a
  connector, used to compute what to prune.
- `applySync` is rewritten to the per-file version: for each `snap.Files`
  entry it computes `sid := FileSourceID(rec.ID, f.Path)`, records it in a
  `want` set, and calls `AddSource(rec.ProjectID, sid, f.Content, seq)`,
  accumulating `Usage` across all files (rather than taking the single
  `AddSource` call's usage directly, since there's now one call per file).
  It then calls `SourcesUnder(rec.ProjectID, rec.ID+FileSeparator)` to list
  every source currently stored for the connector and `RemoveSource`s any
  that isn't in `want` — i.e. any file that no longer exists in the current
  snapshot. `SetConnectorSyncState` still records `snap.Fingerprint` (the
  whole-connector fingerprint continues to gate whether a sync happens at
  all, via `SyncIfChanged`), and exactly one `RefreshDependents(projectID,
  "connector", rec.ID)` still fires per changed sync, regardless of how
  many files moved within it.

### `core/wiring/connector_lattice.go`

- `connectorLatticeWriter.SourcesUnder` implements the new interface method
  by calling `w.know.SourcesUnder(projectID, knowledge.SourceTypeConnector,
  sourceIDPrefix)` (Task 3's primitive) and projecting each returned
  `Origin.SourceID` into the `[]string` the connector capability expects —
  the same "adapt knowledge's richer type down to the connector's minimal
  port" pattern `AddSource`/`RemoveSource` already use.

### `core/transport/transport_test.go`

- `noopLattice`, a test-only `LatticeWriter` stub used to build a full
  transport server in tests, gained a no-op `SourcesUnder` returning `(nil,
  nil)` — required for it to keep satisfying the extended interface. This
  file isn't part of the connector or wiring packages this task otherwise
  touches, but the interface change is a breaking one for every
  implementer, and this was the only other one in the tree (confirmed via
  `go vet ./...` failing on it before the fix, and a grep for other
  `LatticeWriter`-shaped types turning up nothing else).

### Tests

`core/capability/connector/sync_test.go`:

- `fakeLattice` gains `SourcesUnder(projectID, sourceIDPrefix string)
  ([]string, error)`, implemented by filtering its own `added` map by
  prefix — this mirrors the real lattice's live-enumeration behavior (the
  real `SourcesUnder` reflects whatever `knowledge` currently has stored,
  not a separately maintained snapshot), so the fake exercises `applySync`
  under the same ordering assumptions as production: pruning runs *after*
  this sync's `AddSource` calls, against whatever prior syncs left behind.
- `TestSyncFeedsLatticeAndBumpsSeq` and `TestDetectChangesResyncsOnlyChanged`
  (pre-existing) are updated: both connectors sync a single file (`f.txt`),
  so under the old whole-blob scheme the lattice key was the bare connector
  ID; under the per-file scheme it's `FileSourceID(connectorID, "f.txt")`.
  Both tests' assertions on `lat.added`/`lat.rev` are updated to key on
  `FileSourceID(...)` instead of the bare ID, and
  `TestDetectChangesResyncsOnlyChanged`'s content assertion changes from the
  old concatenated-blob form (`"# f.txt\nAAA\n\n"`) to the raw per-file
  content (`"AAA"`), since `f.Content` — not the blob — is what's fed to
  `AddSource` now.
- New `TestSyncAddsPerFileSourcesAndPrunesRemoved` (TDD'd first — failed to
  build with `FileSourceID undefined` before the implementation landed):
  a temp folder starts with `a.txt`/`b.txt`; the first `Sync` asserts both
  land in the lattice under their `FileSourceID`s at revision 1 and exactly
  one cascade call fires. `b.txt` is then removed and `c.txt` added; the
  second `Sync` asserts `b.txt`'s source is gone (`RemoveSource` ran),
  `a.txt`'s source is still present with its content and revision bumped to
  2 (re-added, not duplicated), `c.txt`'s source is present, and exactly one
  more cascade call fired (total two) — covering the brief's three
  requirements (add-new, retain-and-update-existing, prune-vanished, and
  one-cascade-per-changed-sync) in a single scenario driven through the real
  `localFolder` provider rather than hand-built `Snapshot` values.
- `TestSyncTriggersCascadeOnlyWhenChanged` and `TestSyncRecordsCost`
  (pre-existing) needed no changes — neither asserts on lattice source keys,
  and per-file `Usage` accumulation over a single-file snapshot still nets
  the same total the fake returns per call.

Confirmed the new test (and the build generally) failed first:

```
$ go test ./core/capability/connector/...
core/capability/connector/sync_test.go:102:12: undefined: FileSourceID
core/capability/connector/sync_test.go:146:15: undefined: FileSourceID
...
FAIL	github.com/gccurtis/taurus-omega/core/capability/connector [build failed]
```

then passed after the implementation above.

### Verification

```
go build ./...
go test ./core/capability/connector/ ./core/wiring/ -count=1
go test ./... -count=1
```

All green — including the full repo suite, confirming the `LatticeWriter`
interface change didn't silently break another implementer. Zero-drift
verified for all three companion docs (`connector.go.md`, `sync.go.md`,
`connector_lattice.go.md`) via the same `awk | diff` command as above; all
three empty. `Snapshot.Content` remains in place, per this task's scope
decision — still populated by `localFolder`, no longer read by anything.

## Task 5: Connector expansion in `contexts`

A `connector`-kind member now expands to its current file origins — a
connector behaves like a context (expand to leaves, then subtract), whether
bound directly to a prompt variable or nested inside a stored context.
`contexts` still does not import `connector` or `knowledge`; a new port,
satisfied by a wiring-level adapter over the knowledge lattice, does the
expansion.

### `core/capability/contexts/contexts.go`

- New `const KindConnector = "connector"`, beside `KindContext` — the
  string `contexts` uses to recognize a connector member without importing
  the `connector` capability.
- `Contexts` gains a `connectorFiles ConnectorFiles` field, left `nil` by
  `New` (same "absent dependency degrades gracefully" default `catalog`
  already uses).

### `core/capability/contexts/resolve.go`

- New port: `type ConnectorFiles interface { FilesUnder(projectID,
  connectorID string) ([]Ref, error) }`, and `func (c *Contexts)
  UseConnectorFiles(cf ConnectorFiles)` — mirrors `Catalog`/`UseCatalog`'s
  shape.
- `expand` gains a case, placed after the context case and before
  `default`: `r.Kind == KindConnector` calls `c.connectorFiles.FilesUnder`
  and appends the returned file origins directly (no further recursion —
  unlike a context, a connector's expansion is one flat set); with no
  `ConnectorFiles` wired, the ref is appended unchanged, so a connector
  member is a single origin exactly as it was before this task (back-compat).

### `core/wiring/context_connector.go` (new)

- `connectorFilesCatalog{ know *knowledge.Knowledge }` implements
  `contexts.ConnectorFiles`. `FilesUnder` calls `know.SourcesUnder(projectID,
  knowledge.SourceTypeConnector, connectorID)` — the *raw* `connectorID`, not
  `connectorID+FileSeparator` — then filters the results client-side to two
  admissible shapes: an origin whose `SourceID` equals `connectorID` exactly,
  or one whose `SourceID` has `connectorID+connector.FileSeparator` as a
  proper prefix. The `\x1f` separator (Task 4) is applied here in wiring, not
  in `contexts`.
- **Why the exact-match branch exists.** A connector's expanded file origins
  carry the *same* `Kind` (`KindConnector`) as the connector itself — the
  `connectorID<sep>relpath` convention distinguishes a root from a leaf only
  in the `ID` string. That means an `Excludes` entry naming one synced file
  directly, e.g. `{connector, "X\x1fa"}`, flows through `expand`'s connector
  case exactly the way a genuine root does, calling `FilesUnder(projectID,
  "X\x1fa")`. A file has no children, so a lookup scoped to only
  `connectorID+FileSeparator` as prefix would return empty for that call,
  `subtractRefs` would have nothing to key against, and the exclusion would
  silently remove nothing. The exact-match branch makes `FilesUnder`
  resolve such an id back to itself instead, so leaf-level exclusion of one
  file inside a connector works the same way leaf-level exclusion already
  works for every other resource kind. The filter still checks the
  *separator-qualified* prefix for the children branch (never the bare
  `connectorID` as a raw string prefix) — reusing an un-separated prefix as
  the admission test would reopen the substring-collision bug the separator
  convention exists to close (`connectorID="X"` incidentally matching a
  different connector `"Xexcept"`'s files), the same risk
  `knowledge_test.go`'s `TestSourcesUnderReturnsPrefixMatches` guards
  against for `SourcesUnder` itself.

### `core/wiring/wiring.go`

- After `contextsSvc.UseCatalog(...)`: `contextsSvc.UseConnectorFiles(connectorFilesCatalog{know: know})`.
  `know` is the `*knowledge.Knowledge` variable wiring already constructs
  earlier (used by `connectorLatticeWriter` and `agent.WorkflowOptions`).

### Tests — `core/capability/contexts/resolve_test.go`

- `connRef(id)` helper, plus `fakeConnectorFiles{byConnector map[string][]contexts.Ref}`:
  `FilesUnder` returns the fixed list for a known connector id, and — mirroring
  the exact-match fallback the real wiring adapter needs — falls back to
  scanning every connector's known files for one whose `ID` matches the
  queried id exactly, returning that single ref if found.
- `TestResolveConnectorExpandsToFileOrigins`: `Resolve` with
  `Includes:[{connector, X}]` and the fake wired to return
  `[{connector,"X\x1fa"},{connector,"X\x1fb"}]` for `X` → both file origins.
- `TestResolveConnectorExcludeOneFileInside`: include `{connector, X}`,
  exclude `{connector, "X\x1fa"}` → only `{connector, "X\x1fb"}` — leaf
  exclusion of one file inside a connector.
- `TestResolveConnectorNestedInsideContextExpands`: a stored context `C`
  includes `{connector, X}`; `ResolveID("C")` → both file origins — a
  connector nested inside a context expands too.
- `TestResolveConnectorWithoutPortPassesThroughUnchanged`: no
  `UseConnectorFiles` call → `{connector, X}` resolves to itself unchanged —
  back-compat with no expander wired.

Confirmed the new tests failed first (build failure, since `KindConnector`
and `UseConnectorFiles` didn't exist yet):

```
$ go test ./core/capability/contexts/
core/capability/contexts/resolve_test.go:46:77: undefined: contexts.KindConnector
core/capability/contexts/resolve_test.go:217:6: svc.UseConnectorFiles undefined (type *contexts.Contexts has no field or method UseConnectorFiles)
core/capability/contexts/resolve_test.go:232:6: svc.UseConnectorFiles undefined (type *contexts.Contexts has no field or method UseConnectorFiles)
core/capability/contexts/resolve_test.go:252:6: svc.UseConnectorFiles undefined (type *contexts.Contexts has no field or method UseConnectorFiles)
FAIL	github.com/gccurtis/taurus-omega/core/capability/contexts [build failed]
```

then, after implementing `KindConnector`/`ConnectorFiles`/`UseConnectorFiles`
and the `expand` case:

```
$ go test ./core/capability/contexts/ -v
--- PASS: TestCreateGetListUpdateDelete
--- PASS: TestCreateRejectsBlankName
--- PASS: TestCreateRejectsUnknownMember
--- PASS: TestCreateAllowsWholeProjectMemberWithoutExistenceCheck
--- PASS: TestContextMemberMustExistEvenWithoutCatalog
--- PASS: TestNonContextMemberSkippedWhenNoCatalog
--- PASS: TestUpdateRejectsCycle
--- PASS: TestUpdateRejectsSelfReference
--- PASS: TestCycleCheckAllowsDiamond
--- PASS: TestResolveFlatIncludesAndLeafExclude
--- PASS: TestResolveNestedContextThenExcludeLeafInside
--- PASS: TestResolveExcludeWholeContext
--- PASS: TestResolveCycleTerminates
--- PASS: TestResolveWholeProjectMinusOne
--- PASS: TestResolveDanglingContextRefContributesNothing
--- PASS: TestResolveNestedExcludeCollisionInsideRow
--- PASS: TestResolveIDResolvesStoredContext
--- PASS: TestResolveMemoizesDiamondFanOut
--- PASS: TestResolveConnectorExpandsToFileOrigins
--- PASS: TestResolveConnectorExcludeOneFileInside
--- PASS: TestResolveConnectorNestedInsideContextExpands
--- PASS: TestResolveConnectorWithoutPortPassesThroughUnchanged
PASS
```

All pre-existing resolve tests (whole-project, nesting, memoization) still
pass, confirming the new connector case doesn't disturb the context case it
sits beside.

### Verification

```
go build ./...
go vet ./...
go test ./core/capability/contexts/ ./core/wiring/ -count=1
go test ./... -count=1
```

All green — the full repo suite included. Zero-drift verified for all four
companion docs (`resolve.go.md`, `contexts.go.md`, `context_connector.go.md`,
`wiring.go.md`) via the same `awk | diff` command as above; all four empty.

## Task 6: Deep cascade — refresh through contexts

Today's cascade only sees a block's *direct* scope origins: `DependentPrompts`
compares each block's resolved `resolveBlockScope` against the changed
origin. That misses the case a connector-as-context slice creates: a block
whose variable binds to a CONTEXT `C` — not to the connector itself — has
scope origin `{context, C}`, never `{connector, X}`, even when `C`'s stored
membership contains `X`. When connector `X` re-syncs, `RefreshDependents`
fires `DependentPrompts(projectID, {connector, X})` and that block is
invisible to it. This task adds a second, best-effort match path: does one of
a block's selected *contexts* transitively reference the changed origin. The
cascade itself stays at connector granularity — this only widens which
blocks a cascade at that granularity can find; nothing about `applySync` or
`RefreshDependents` changes.

### `core/capability/contexts/resolve.go`

- New `func (c *Contexts) References(projectID, contextID, kind, id string)
  (bool, error)`: a visited-guarded walk from `contextID`, checking whether
  `(kind, id)` appears in that context's `Includes` or `Excludes`, directly
  or through a nested context member (recursing on `Kind == KindContext &&
  ID != WholeProjectID`). Structurally it mirrors `wouldCycle` in
  `contexts.go` — same `visited` map shape, same "walk `Includes` and
  `Excludes` together," same `errors.Is(err, ErrNotFound)` → contributes
  nothing for a dangling reference — but answers a different question:
  `wouldCycle` asks "can this id reach `selfID`" at write time to reject a
  cycle; `References` asks "does this id's stored membership contain
  `(kind, id)`" at read time to answer the cascade's dependency query.
- **Excludes count too.** The walk checks `Excludes` as well as `Includes`,
  not just the included side. A context that *excludes* resource `X` still
  depends on `X`'s current state — change `X` and the context's resolved
  value changes (whether `X` reappears in the output depends on whether it's
  still excluded) — so a prompt scoped to that context is a genuine
  dependent of `X`, and `DependentPrompts` needs to find it.
- **Why `whole-project` does NOT count as referencing an arbitrary origin.**
  If a context that includes `whole-project` (or `whole-project` itself, were
  it ever passed as `contextID`) were treated as referencing every
  `(kind, id)`, then every prompt scoped to that context would show up as a
  dependent of *every* resource change in the project — the connector sync
  path would refresh every whole-project-scoped prompt on every file sync,
  which is exactly the over-triggering the brief calls out to avoid. The walk
  therefore skips recursing into a `whole-project` member (`r.ID !=
  WholeProjectID` guards the recursive call) and never treats it as a direct
  match either, since `whole-project` is never itself the `kind` this
  function is asked about (`kind` is always a concrete resource kind like
  `"connector"` or `"document"`, and `whole-project` is a reserved context
  id, not a `(kind, id)` pair `References` would ever be asked to match
  against).
- A missing `contextID` (`ErrNotFound` on the very first `ContextByID` call)
  returns `false, nil` — same "dangling reference contributes nothing"
  behavior `expand` already uses, not an error.

### `core/capability/document/dependencies.go`

- New port: `type ScopeReferences interface { ContextReferences(projectID,
  contextID string, origin ScopeOrigin) (bool, error) }` — the seam that lets
  `DependentPrompts` see a change reached through a context, satisfied over
  `contexts.References` at composition. `document` still never imports
  `contexts`.
- `DependentPrompts`'s inner block loop now runs two passes. The first pass
  is unchanged: `resolveBlockScope` (includes − excludes at the origin
  level) is checked against `origin`, and a hit records the block. The
  second pass runs only when the first found nothing *and*
  `d.scopeReferences != nil`: it re-derives the block's raw, unsubtracted
  selection via `resolveBlockScopeSelection` (so an origin that is only on
  the *exclude* side is still considered — matching `References`'s own
  "excludes count too" semantics), and for every selected origin of kind
  `"context"`, on either side, asks `ContextReferences(projectID, o.ID,
  origin)`. The first `true` records the block and breaks out of both loops
  (a labeled `selectionLoop`). A `ContextReferences` error is swallowed with
  `continue` — best-effort, matching the existing per-document `Get` error
  handling two lines above (skip and keep scanning), so one context lookup
  failing never fails the whole project's cascade.

### `core/capability/document/service.go`

- `Documents` gains a `scopeReferences ScopeReferences` field, left `nil` by
  `New` — the same "absent dependency degrades gracefully" default
  `scopeResolver` already uses.
- New `func (d *Documents) UseScopeReferences(r ScopeReferences)`, mirroring
  `UseScopeResolver`'s doc comment and shape: wired after construction
  because it composes over `contexts`, which is built after `docs`.

### `core/wiring/document_scope.go`

- New `documentScopeReferences{ contexts *contexts.Contexts }` implementing
  `document.ScopeReferences`. `ContextReferences` is a one-line delegation to
  `r.contexts.References(projectID, contextID, origin.Kind, origin.ID)` — no
  translation needed beyond unpacking `origin`'s two fields into the
  discrete `kind, id` arguments `References` takes.

### `core/wiring/wiring.go`

- After `docs.UseScopeResolver(...)`:
  `docs.UseScopeReferences(documentScopeReferences{contexts: contextsSvc})`.

### Tests — `core/capability/contexts/resolve_test.go`

- `TestReferencesDirectMember`: context `C` includes `{connector, X}` →
  `References("C", "connector", "X")` is `true`.
- `TestReferencesTransitiveThroughNestedContext`: `Outer` includes context
  `Inner`, `Inner` includes `{connector, X}` → `References("Outer",
  "connector", "X")` is `true` — the transitive case the deep cascade needs.
- `TestReferencesTrueThroughExcludes`: `C` excludes `{connector, X}` (and
  includes something else) → `References("C", "connector", "X")` is `true`.
- `TestReferencesFalseForNonMember`: `C` includes only `{connector, Y}` →
  `References("C", "connector", "X")` is `false`.
- `TestReferencesCycleSafe`: `A` includes context `B`, `B` includes context
  `A` (no leaf X anywhere) → `References("A", "connector", "X")` terminates
  and returns `false`.
- `TestReferencesWholeProjectDoesNotCountAsReferencingArbitraryOrigin`: `C`
  includes `{context, whole-project}` → `References("C", "connector", "X")`
  is `false` — pins down the deliberate exclusion.
- `TestReferencesMissingContextContributesNothing`: `References("p",
  "missing", "connector", "X")` on an empty store → `false, nil`.

### Tests — `core/capability/document/dependencies_test.go`

- `fakeScopeReferences{contextID, origin}`: a `document.ScopeReferences`
  stub that reports `true` only for the one `(contextID, origin)` pair it's
  configured with.
- `TestDependentPromptsSeesThroughContext`, modeled on the existing
  `TestDependentPromptsSeesPendingContext`/`seedScopedPromptDoc` helpers:
  - A block bound to `{context, "C"}` (via `seedScopedPromptDoc`) does **not**
    match `DependentPrompts("p", {connector, "X"})` when no
    `ScopeReferences` is wired — pins the back-compat requirement that the
    direct-origin-only behavior is unchanged with the port left `nil`.
  - A second block bound straight to `{connector, "X"}` **does** match, with
    or without the port wired — direct-origin matching is unaffected by this
    change.
  - After `d.UseScopeReferences(fakeScopeReferences{contextID: "C", origin:
    {connector, "X"}})`, `DependentPrompts("p", {connector, "X"})` returns
    *both* blocks — the context-bound block via the new deep-cascade path,
    the connector-bound block via the unchanged direct path — confirming the
    two passes coexist correctly and neither suppresses the other.

Confirmed the new tests failed first (build failure — `References` and
`UseScopeReferences` didn't exist yet):

```
$ go test ./core/capability/document/ ./core/capability/contexts/
# github.com/gccurtis/taurus-omega/core/capability/contexts_test [github.com/gccurtis/taurus-omega/core/capability/contexts.test]
core/capability/contexts/resolve_test.go:301:17: svc.References undefined (type *contexts.Contexts has no field or method References)
core/capability/contexts/resolve_test.go:317:17: svc.References undefined (type *contexts.Contexts has no field or method References)
core/capability/contexts/resolve_test.go:332:17: svc.References undefined (type *contexts.Contexts has no field or method References)
core/capability/contexts/resolve_test.go:346:17: svc.References undefined (type *contexts.Contexts has no field or method References)
core/capability/contexts/resolve_test.go:360:17: svc.References undefined (type *contexts.Contexts has no field or method References)
core/capability/contexts/resolve_test.go:374:17: svc.References undefined (type *contexts.Contexts has no field or method References)
core/capability/contexts/resolve_test.go:385:17: svc.References undefined (type *contexts.Contexts has no field or method References)
# github.com/gccurtis/taurus-omega/core/capability/document_test [github.com/gccurtis/taurus-omega/core/capability/document.test]
core/capability/document/dependencies_test.go:131:4: d.UseScopeReferences undefined (type *document.Documents has no field or method UseScopeReferences)
FAIL	github.com/gccurtis/taurus-omega/core/capability/document [build failed]
FAIL	github.com/gccurtis/taurus-omega/core/capability/contexts [build failed]
FAIL
```

then, after implementing `References`, the `ScopeReferences` port,
`DependentPrompts`'s second pass, `UseScopeReferences`, and the wiring
adapter:

```
$ go test ./core/capability/document/ ./core/capability/contexts/ ./core/wiring/ -v
... (203 subtests, all PASS, including
     TestDependentPromptsMatchesScope, TestDependentPromptsSeesPendingContext,
     TestDependentPromptsSeesThroughContext,
     TestDependentPromptsIgnoresUnscopedAndNonPromptBlocks,
     TestReferencesDirectMember, TestReferencesTransitiveThroughNestedContext,
     TestReferencesTrueThroughExcludes, TestReferencesFalseForNonMember,
     TestReferencesCycleSafe,
     TestReferencesWholeProjectDoesNotCountAsReferencingArbitraryOrigin,
     TestReferencesMissingContextContributesNothing,
     TestDocumentScopeResolverExpandsContext, and every pre-existing
     contexts/document/wiring test)
PASS
ok  	github.com/gccurtis/taurus-omega/core/capability/document
ok  	github.com/gccurtis/taurus-omega/core/capability/contexts
ok  	github.com/gccurtis/taurus-omega/core/wiring
```

All pre-existing tests in all three packages still pass, confirming the new
match path sits alongside the direct-origin path without disturbing it.

### Verification

```
go build ./...
go vet ./...
go test ./core/capability/document/ ./core/capability/contexts/ ./core/wiring/ -count=1
go test ./... -count=1
```

All green — the full repo suite included. Zero-drift verified for all five
touched companion docs (`resolve.go.md`, `dependencies.go.md`, `service.go.md`,
`document_scope.go.md`, `wiring.go.md`) via the same `awk | diff` command as
above; all five empty.

## Task 7: Live dev-test — connector-as-context end to end (real model, reports cost)

`dev-test/connector-context/run.sh` (new; registered in `dev-test/run.sh`'s
`intelligence_suites`) is the one live proof that every task in this record
composes end to end against a real provider, and it makes the deep cascade
(Task 6) tangible rather than only unit-tested. Modeled on
`dev-test/live-document/run.sh` (watcher + connector harness) and
`dev-test/context-scope/run.sh` / `dev-test/context-binding/run.sh` (context
and scoped-retrieval assertions, `submissionId`/revision discipline).

**What it proves, in order:**

1. A temp folder with two files carrying distinct, invented facts —
   `tower.md`: "The Meridian tower is 512 meters tall.", `bridge.md`: "The
   Solace bridge spans 1400 meters." — is watched by `cmd/connector-watcher`
   and synced by a `local-folder` connector.
2. `POST /contexts` with `includes:[{kind:"connector", id:<connectorID>}]`,
   then `GET /contexts/:id/resolved` — **before any model call** — returns
   exactly two origins, both `kind:"connector"` with an `id` that has
   `<connectorID>\x1f` as a prefix, and never the bare connector id. This is
   Task 5's per-file expansion, observed live.
3. A prompt document binds one template variable (`src`) to that context and
   a second (`noBridge`) directly to `bridge.md`'s composite leaf id
   (`<connectorID>\x1fbridge.md`); the block's context is
   `{"include":["src"],"exclude":["noBridge"]}` — leaf exclusion of one file
   inside a connector, wired at the block level (validated: `POST /contexts`
   itself can't carry a composite file id in `excludes`, since the resource
   catalog only knows the bare connector id — `set_context_variable` has no
   such existence check, so the leaf exclusion is expressed there instead,
   using whichever wiring the API actually supports for a composite file
   id). A real model
   (`openai/gpt-4o-mini` + `openai/text-embedding-3-small` over OpenRouter)
   resolves the block asking "How tall is the Meridian tower?" — the answer
   contains 512 and never 1400.
4. **Deep-cascade proof:** `tower.md` is edited on disk to 777 with no
   document or connector API call. The background detector
   (`connectorDetectInterval`, 2s) re-syncs the connector, `RefreshDependents`
   fires against the bare connector id, and `DependentPrompts`' second pass
   (Task 6) finds the block via `src`'s context — which directly includes the
   connector — and enqueues a `reload`. The suite only polls
   `GET /documents/:id`; it never re-submits the block. The block's output
   flips to 777 on its own.

### Verification

Run live (`bash dev-test/connector-context/run.sh`, key present in
`etc/config.local.yaml`):

```
▶ Beat 1: a folder with TWO files carrying distinct facts, watched, synced by a connector
  ✓ watcher on 127.0.0.1:39969
  ✓ status 201   (connector created)
  ✓ status 200   (connector configured)
  ✓ status 200   (connector synced)
▶ Beat 2: a context that includes the bare connector resolves to the two FILE origins, before any model call
  ✓ status 201   (context created)
  ✓ status 200   (resolved)
  ✓ resolved to exactly 2 file origins
  ✓ both origins are connector-file ids (connectorID + \x1f + relpath)
  ✓ the bare connector id never appears as an origin
▶ Beat 3: a prompt document — variable bound to the CONTEXT, a second bound to bridge.md's leaf id, excluded at the block
  ✓ status 201 × 5   (document created, template set, both variables bound, block context set)
▶ Beat 4: resolve — grounded in tower.md (512), never bridge.md (1400), leaf-excluded inside the connector
  ✓ status 202   (resolve enqueued)
  ✓ has: 512
  ✓ omits: 1400
▶ Beat 5: deep-cascade proof — edit tower.md on disk (no API call); the detector re-syncs and the block AUTO-refreshes to 777, through the context, without re-submitting the block
  ✓ block auto-refreshed to 777 after the external connector-file change
  ✓ omits: 1400
▶ Token usage this run: 1646 total tokens (1555 prompt)
▶ Estimated cost: $0.000329 (at $0.20/1M tokens)
  ✓ all checks passed
```

The resolved block's `evidence`/`sources` on both resolutions carried
`sourceType:"connector"`, `sourceId:"<connectorID>\x1ftower.md"` only —
`bridge.md`'s leaf never appeared, confirming the exclusion held at
retrieval, not just in the final text. All checks passed; observed cost for
the full run was **$0.000329** (1646 total tokens, 1555 prompt) against
`openai/gpt-4o-mini` (reasoning) and `openai/text-embedding-3-small`
(embedding) — negligible, as the working agreement requires.

## Design intent: file-level scoping lives at the block, not the stored context

A connector is the single catalog resource; the knowledge lattice expands its
id to per-file origins on demand, for retrieval and for context expansion
(Task 5). A stored context (or a bare `include`) addresses the connector by
its bare id, not by an individual file id — that's deliberate, not a gap:
the connector is the addressable unit above the block. Scoping to (or
excluding) one file is available at the **block** level via the composite id
(`connectorID<sep>relpath`), exactly as Task 7's dev-test demonstrates with
`noBridge`'s block-level exclude — that's the intended escape hatch.

The refresh cascade matches that same shape: `RefreshDependents(projectID,
"connector", connectorID)` (Task 4) and `DependentPrompts` (Task 6) fire at
**connector** granularity, so a block that includes the connector (or a
context referencing it) refreshes correctly on any file change within it —
consistent with connector files being addressed through the connector, not
individually.

Design intent: connector files are lattice-only, behind the connector —
deliberately not first-class resource-table rows (that would clutter the
resource catalog with every file of every connector). The connector id is
the one catalog entry; it expands to its files on demand.

## Cleanup: `Snapshot.Content` removed

The `Content string` shim `Snapshot` carried since Task 1 (see above) is
gone: `provider.go`'s `Snapshot` struct no longer has a `Content` field,
`localfolder.go` no longer builds the concatenated blob, `httpprovider.go`
no longer decodes or returns a `content` field, and
`cmd/connector-watcher/main.go`'s `snapshotResponse` no longer serves one —
the wire and Go shapes are now `Files` + `Fingerprint` only.
(`FileEntry.Content`, the per-file content `applySync` and the lattice
actually read, is untouched.) Tests updated to match: `localfolder_test.go`,
`httpprovider_test.go`, and `cmd/connector-watcher/main_test.go` assert on
`Files`/`fingerprint` instead of the retired `Content`/`content`; the
recursive-walk, per-file, fingerprint, and round-trip coverage all remain.
`go build ./...` and `go test ./...` green; zero-drift re-verified for
`provider.go.md`, `localfolder.go.md`, and `httpprovider.go.md`.
