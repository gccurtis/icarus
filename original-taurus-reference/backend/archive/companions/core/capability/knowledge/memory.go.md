# memory.go

`memory.go` provides `MemoryStore`, an in-memory implementation of the
knowledge package's `Store` interface. It exists so the lattice service can be
exercised in tests without a database: sources, windows and nodes are held in
three flat slices, and every query filters them by project and local reference
on the fly.

The store is deliberately simple over fast — linear scans, no indexes — because
its only job is to be a correct, dependency-free stand-in for the real SQLite
store. A single mutex makes each `Store` call atomic, mirroring the SQLite
store's transactional semantics. The load-bearing case is `ReplaceSources`: it
swaps one source's rows and rebuilds the corpus tier through the service's
callback under the same held lock, so writers serialize, every corpus rebuild
sees the complete post-replacement frontier, and no reader ever observes the
half-updated state between the two steps.

## Code breakdown

### Package declaration and import

```go
package knowledge

import (
	"strings"
	"sync"
	"time"
)

```

The file lives in the same `knowledge` package as the service it backs, so it
can implement `Store` and reference `Source`, `Window`, `Node` and
`FrontierEntry` directly. It depends only on the standard library: `strings`,
for the prefix match `SourcesUnder` filters by; `sync`, for the mutex that
serializes access to the slices; and `time`, for the instant
`ProjectChangedSince` compares each source's `SyncedAt` against.

### The MemoryStore type

```go
// MemoryStore is an in-memory Store used in tests. It keeps sources, windows and
// nodes in flat slices and filters by project/local-reference. Its mutex makes
// each Store call atomic, mirroring the transactional semantics of the SQLite
// store — in particular, ReplaceSources swaps the source and rebuilds the corpus
// tier under one lock, so a reader never sees the half-updated state between.
type MemoryStore struct {
	mu      sync.Mutex
	sources []Source
	windows []Window
	nodes   []Node
}

```

`MemoryStore` holds the whole lattice as three unindexed slices guarded by one
mutex. Keeping everything flat means every read is a linear scan, which is fine
for the small corpora tests use and keeps the implementation obvious — there is
no schema, no keying, just append and filter. The doc comment states the
contract the mutex carries: each call is atomic like a SQLite transaction, and
`ReplaceSources` in particular does its source swap and corpus rebuild under one
lock so no reader sees the state in between.

### Construction

```go
// NewMemoryStore returns an empty in-memory lattice store.
func NewMemoryStore() *MemoryStore { return &MemoryStore{} }

```

`NewMemoryStore` returns a ready-to-use empty store. The zero value already
works — nil slices append cleanly and the mutex is usable unlocked — so the
constructor exists mainly to give tests a clear, named entry point.

### Looking up a source by origin

```go
func (s *MemoryStore) SourceByOrigin(projectID, sourceType, sourceID string) (Source, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, src := range s.sources {
		if src.ProjectID == projectID && src.SourceType == sourceType && src.SourceID == sourceID {
			return src, true, nil
		}
	}
	return Source{}, false, nil
}

```

`SourceByOrigin` answers whether an origin `(projectID, sourceType, sourceID)`
is already registered, which is how `Add` decides between a first insert and a
re-sync. It scans the sources slice and returns the first match with an `ok` of
true, or the zero source and false when none is found — never an error, since an
absent source is a normal outcome, not a failure.

### Listing sources under a prefix

```go
func (s *MemoryStore) SourcesUnder(projectID, sourceType, sourceIDPrefix string) ([]Origin, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Origin
	for _, src := range s.sources {
		if src.ProjectID == projectID && src.SourceType == sourceType && strings.HasPrefix(src.SourceID, sourceIDPrefix) {
			out = append(out, Origin{SourceType: src.SourceType, SourceID: src.SourceID})
		}
	}
	return out, nil
}

```

`SourcesUnder` is the lattice enumeration primitive: every origin of a given
`sourceType` whose `SourceID` starts with `sourceIDPrefix`, scoped to the
project. It is the same linear scan as `SourceByOrigin`, but collects every
match instead of stopping at the first — a connector uses it to list its
current sub-keys (e.g. its files, keyed `connectorID + "/" + path`), so it
can diff that listing against what the lattice already holds and prune what
vanished. `strings.HasPrefix` makes the match literal, never a pattern.

### Replacing a source and rebuilding the corpus tier

```go
func (s *MemoryStore) ReplaceSources(writes []SourceWrite) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, w := range writes {
		ref := w.Source.LocalRefID
		s.sources = filterSources(s.sources, func(x Source) bool { return x.LocalRefID != ref })
		// ... windows and nodes filtered the same way, then all three appended
	}
	s.invalidateCorpusLocked(writes[0].Source.ProjectID)
	return nil
}
```

`ReplaceSources` is the store's transaction, in two halves under one lock. The
first half swaps **every** source in the batch: for each, it filters out every
row carrying that `LocalRefID`, then appends the fresh snapshot, windows and
nodes, so a re-sync never leaves stale rows behind. The second half hands off to
`invalidateCorpusLocked`, which drops the project's corpus tier and bumps its
dirty sequence — still under the same held mutex, so the swap and the
invalidation are one atomic step, mirroring the SQLite store's single write
transaction.

It does **not** rebuild. That happens off the write path (`corpus.go`), for the
same reason it does in SQLite: the clustering is O(F²) in the project's whole
frontier, and doing it here would make every writer wait on it.

### Deleting a source

`DeleteSource` removes a source by its `(projectID, sourceType, sourceID)`
origin under one lock. It first scans for the origin's `LocalRefID`; an origin
that was never registered leaves `ref` empty, so the method returns
`(false, nil)` without touching a thing — the no-op a caller maps to a 404. When
the source does exist it filters the source, its windows and its nodes out of the
three slices, invalidates the corpus tier the same way, and reports `true`.

### `invalidateCorpusLocked`, `SourceFrontier`, `CorpusSeq`, `RebuildCorpus`

The corpus tier's lifecycle, split the way the Store port splits it.

`invalidateCorpusLocked` is what both writers share: it drops the project's
corpus-tier nodes (those with an empty `LocalRefID`), leaving every source's own
forest untouched, and bumps `corpus[projectID].dirty`.

`corpusSeq` is a `{dirty, built}` pair per project, mirroring the SQLite store's
`knowledge_corpus_state` table. A pair rather than a boolean because the rebuild
computes outside the lock: a write landing mid-computation pushes `dirty` past
the value the rebuild will claim, so the result is stored and the project still
reads as stale. A boolean would be cleared by that write's own rebuild and the
intervening change would be lost.

`SourceFrontier` gathers the project's nodes and the windows belonging to its
sources and derives the frontier with `sourceFrontier` — the same derivation the
SQLite store expresses in SQL. `RebuildCorpus` swaps in a freshly computed tier,
records `built = seq`, and replaces the project's persisted level indexes
wholesale (nil clears them) — mirroring the SQLite store's single-transaction
semantics under the one lock.

`CorpusIndexes` returns what the last rebuild stored. The indexes are
deliberately **not** dropped by `invalidateCorpusLocked`: the tier is dropped
because descent would follow it into dangling members, but the index's only
reader is the next rebuild, which diffs it against the live frontier by
artifact id — a stale index is exactly the input a repair wants.

`CorpusIndexHeader` returns one level's machinery without its artifacts, and
`EntryFrontierProbed` narrows the entry frontier by the index (covered
artifacts survive only in probed cells; uncovered artifacts always survive) —
both mirroring the SQLite semantics for the retrieval probe. The shared
derivation moved into `entryFrontierLocked` so the plain and probed reads
cannot drift apart.

### Returning source identities

```go
func (s *MemoryStore) Identities(projectID string) (map[string]VectorIdentity, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := map[string]VectorIdentity{}
	for _, src := range s.sources {
		if src.ProjectID == projectID {
			out[src.LocalRefID] = src.Identity
		}
	}
	return out, nil
}

```

`Identities` returns each project source's stamped `VectorIdentity` keyed by
`LocalRefID`, and nothing else — no text, no vectors. It is what `Retrieve`'s
mismatch check reads, so keeping it this narrow means the check never pulls
source bodies it does not need. A project with no sources yields an empty map,
which the caller reads as "nothing to search".

### The entry frontier

```go
func (s *MemoryStore) EntryFrontier(projectID string) ([]FrontierEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	refs := map[string]bool{}
	for _, src := range s.sources {
		if src.ProjectID == projectID {
			refs[src.LocalRefID] = true
		}
	}
	member := map[string]bool{}
	for _, n := range s.nodes {
		if n.ProjectID == projectID {
			for _, m := range n.MemberIDs {
				member[m] = true
			}
		}
	}
	var out []FrontierEntry
	for _, n := range s.nodes {
		if n.ProjectID == projectID && !member[n.ID] {
			out = append(out, FrontierEntry{ID: n.ID, Vector: n.Centroid})
		}
	}
	for _, w := range s.windows {
		if refs[w.LocalRefID] && !member[w.ID] {
			out = append(out, FrontierEntry{ID: w.ID, Vector: w.Embedding, IsWindow: true})
		}
	}
	return out, nil
}

```

`EntryFrontier` returns the artifacts a descent walk enters from: everything in
the project that is no node's member across *either* tier. It first collects the
project's source references and the full membership set — every id that appears
as some project node's member — then emits the nodes no one claims (corpus roots
and corpus-unabsorbed source roots) and the windows no one claims (never-
clustered orphans), the latter tagged `IsWindow`. Unlike `sourceFrontier`, which
ignores corpus membership because it feeds the corpus rebuild, this set folds in
*both* tiers, so a corpus root reads as a genuine top of the lattice while a
source root the corpus absorbed is correctly excluded.

### Batch-fetching nodes and windows by id

```go
func (s *MemoryStore) NodesByID(ids []string) ([]Node, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	want := map[string]bool{}
	for _, id := range ids {
		want[id] = true
	}
	var out []Node
	for _, n := range s.nodes {
		if want[n.ID] {
			out = append(out, n)
		}
	}
	return out, nil
}

func (s *MemoryStore) WindowsByID(ids []string) ([]Window, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	want := map[string]bool{}
	for _, id := range ids {
		want[id] = true
	}
	var out []Window
	for _, w := range s.windows {
		if want[w.ID] {
			out = append(out, w)
		}
	}
	return out, nil
}

```

`NodesByID` and `WindowsByID` are the batched member reads the descent walk makes
as it expands one node at a time. Each builds a `want` set from the requested ids
and returns the matching rows, silently skipping ids it does not hold — which is
what lets the walk hand the same id list to both without first knowing whether a
member is a node or a window.

### Every window in a project

```go
func (s *MemoryStore) ProjectWindows(projectID string) ([]Window, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	refs := map[string]bool{}
	for _, src := range s.sources {
		if src.ProjectID == projectID {
			refs[src.LocalRefID] = true
		}
	}
	var out []Window
	for _, w := range s.windows {
		if refs[w.LocalRefID] {
			out = append(out, w)
		}
	}
	return out, nil
}

```

`ProjectWindows` returns every window belonging to the project's sources — the
wide read the exact scan and the descent fallback need. It resolves the project's
source references first and keys windows off that `refs` set, so a window whose
owning source is gone can never leak into a scan, the same guard the old
`LoadProject` applied.

### One source's windows

```go
func (s *MemoryStore) SourceWindows(localRefID string) ([]Window, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Window
	for _, w := range s.windows {
		if w.LocalRefID == localRefID {
			out = append(out, w)
		}
	}
	return out, nil
}

```

`SourceWindows` returns just the windows belonging to one `LocalRefID`,
embeddings included. It is the read the smart-update path in `Add` makes to
recover a source's previous windows, so a re-sync can reuse the stored
embedding of any window whose text did not change rather than paying to embed
it again. Unlike `ProjectWindows` it keys straight off the window's own
`LocalRefID` rather than resolving the project's sources first, since the
caller already holds the specific ref it is re-syncing.

### Reporting whether the project changed

```go
func (s *MemoryStore) ProjectChangedSince(projectID string, t time.Time) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, src := range s.sources {
		if src.ProjectID == projectID && src.SyncedAt.After(t) {
			return true, nil
		}
	}
	return false, nil
}

```

`ProjectChangedSince` is the in-memory counterpart of the store's cheap freshness
probe, backing `Knowledge.ChangedSince`. Under the same lock every other call
holds, it scans the project's sources and returns true the moment one carries a
`SyncedAt` strictly after `t`, otherwise false. It reads only the timestamp
already on each source — no windows, no nodes, no text — so the refresh check
never pulls the lattice. Like the SQLite store's version it is deliberately
project-granular and blind to removals: a dropped source leaves no row to trip
the check, so only an add or a re-sync moves the signal.

### Sources by reference

```go
func (s *MemoryStore) SourcesByRef(refs []string) (map[string]Source, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	want := map[string]bool{}
	for _, ref := range refs {
		want[ref] = true
	}
	out := map[string]Source{}
	for _, src := range s.sources {
		if want[src.LocalRefID] {
			out[src.LocalRefID] = src
		}
	}
	return out, nil
}

```

`SourcesByRef` returns the full sources — text and blocks included — for a given
set of `LocalRefID`s, keyed by ref. `regionsFor` calls it with just the refs the
ranked windows carry, so the only source bodies a retrieval ever loads are the
ones it is about to cite.

### The filter helpers

```go
func filterSources(in []Source, keep func(Source) bool) []Source {
	out := in[:0:0]
	for _, x := range in {
		if keep(x) {
			out = append(out, x)
		}
	}
	return out
}

func filterWindows(in []Window, keep func(Window) bool) []Window {
	out := in[:0:0]
	for _, x := range in {
		if keep(x) {
			out = append(out, x)
		}
	}
	return out
}

func filterNodes(in []Node, keep func(Node) bool) []Node {
	out := in[:0:0]
	for _, x := range in {
		if keep(x) {
			out = append(out, x)
		}
	}
	return out
}
```

These three helpers are the same filter written once per slice type, since Go
generics are not used here. Each keeps the elements for which `keep` returns
true. The `in[:0:0]` slice expression is the notable detail: it starts a
fresh empty slice with zero capacity that shares no backing array with `in`, so
appending the kept elements allocates a new array rather than overwriting the
input in place — the replace methods pass `s.sources`/`s.windows`/`s.nodes`
straight in, and this avoids corrupting them mid-filter.

### `SourcesUnder` returns the label with the origin

The in-memory store returns each matching source's `Label` alongside its origin,
exactly as the SQLite store does. It is not decoration: a connector diffing its
watcher's file list against the lattice matches on the label, because the path is
the only name its provider knows a file by — the id was minted here.

A fake or a store that dropped the label would still satisfy every existing
prefix test and would silently break id stability, so the two implementations
have to agree on this.

### `WindowContent` — the same shape as the persisted store

Returns each requested window's text and covered blocks, keyed by id, skipping
unknown ids the way every other by-id batch read does.

The in-memory store cannot avoid holding text — the whole store is memory — so this
saves it nothing. It exists so a test exercises the *same assembly path* production
does, rather than reaching into the window records directly and proving a shortcut
works.
