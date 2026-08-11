# Context Capability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-scoped `contexts` capability — a stored, named, nestable set of resource references that resolves down to concrete leaf resources — and wire it into document prompt-block scope resolution.

**Architecture:** A dumb store (`{name, includes, excludes}` where each member is a `{kind, id, name}` ref) plus a pure set-flattening resolver. All "smart" behavior — nesting, cycles, `whole-project`, leaf-level exclusion — lives in a `Resolve(projectID, Definition)` function that operates on a *definition value*, so stored and anonymous (per-refresh) contexts resolve through the same code. Two thin ports keep capabilities decoupled: a `Catalog` port (contexts → resource catalog, for `whole-project`) and a `document.ScopeResolver` port (document → contexts, for expanding a bound context at retrieval time). No capability imports another; adapters live in wiring.

**Tech Stack:** Go, Echo transport, pure-Go SQLite (`modernc.org/sqlite`), ports-and-adapters, cookie sessions.

## Global Constraints

- **Work on main only.** Commit directly to main; never create a feature branch.
- **TDD.** Write the failing test first, watch it fail for the right reason, then minimal code. Deterministic plumbing → unit tests; model quality → live `dev-test/` only.
- **Never stub the model.** Do not mock intelligence to assert on *quality*. `ResolveBlock` plumbing may use the existing `fakeModel`/`fakeRetriever` (see `core/capability/document/prompt_test.go`) because that tests wiring, not intelligence. End-to-end retrieval quality is proven only in a live suite that reports its token cost.
- **Companion docs, same commit.** Every non-test `.go` file under `core/` has a sibling `FILE.go.md`: short prose overview, `## Code breakdown`, one `### <one-line>` section per logical block in source order, each with a ```` ```go ```` block reproducing that slice **verbatim** (exact bytes, tabs preserved). Concatenated code blocks must reproduce the whole file. Run `gofmt -w` on the `.go` file **before** regenerating its companion. Verify zero drift with:
  `awk '/^```go$/{c=1;next}/^```$/{c=0}c' FILE.go.md | diff <(gofmt FILE.go) -` (empty diff = clean; MD010 hard-tab lint warnings are expected and ignored).
- **Change records.** One `docs/records/NNNN-<slug>.md` per increment (latest existing is `0102`; start at `0103`). Small follow-ups append to the most recent relevant record.
- **Project-scoped** everything; `crypto/rand` hex IDs; errors as package-level vars.
- **Package name is `contexts`** (dir `core/capability/contexts`) to avoid colliding with the stdlib `context` package. Service type `Contexts`, record `Context`.

---

### Task 1: Contexts capability — record, store interface, CRUD service

**Files:**
- Create: `core/capability/contexts/contexts.go`
- Create: `core/capability/contexts/contexts.go.md`
- Test: `core/capability/contexts/contexts_test.go`

**Interfaces:**
- Produces:
  - `type Ref struct { Kind, ID, Name string }`
  - `type Definition struct { Includes, Excludes []Ref }`
  - `type Context struct { ID, ProjectID, Name, CreatorID string; Includes, Excludes []Ref; CreatedAt, UpdatedAt time.Time }`
  - `type Actor struct { ID, Name string }`
  - `type Store interface { InsertContext(Context) error; ContextByID(projectID, id string) (Context, error); ContextSummaries(projectID string) ([]Context, error); UpdateContext(Context) error; DeleteContext(projectID, id string) error }`
  - `type Contexts struct{…}`; `func New(Store) *Contexts`
  - `func (c *Contexts) Create(projectID string, a Actor, name string, includes, excludes []Ref) (Context, error)`
  - `func (c *Contexts) Get(projectID, id string) (Context, error)`
  - `func (c *Contexts) List(projectID string) ([]Context, error)`
  - `func (c *Contexts) Update(projectID, id, name string, includes, excludes []Ref) (Context, error)`
  - `func (c *Contexts) Delete(projectID, id string) error`
  - vars `ErrNotFound`, `ErrInvalidName`; consts `KindContext = "context"`, `WholeProjectID = "whole-project"`

- [ ] **Step 1: Write the failing test**

`core/capability/contexts/contexts_test.go`:

```go
package contexts_test

import (
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
)

// memStore is an in-memory contexts.Store for deterministic plumbing tests.
// (A fake STORE is fine — this is not intelligence; only the model may not be stubbed.)
type memStore struct{ rows map[string]contexts.Context }

func newMem() *memStore { return &memStore{rows: map[string]contexts.Context{}} }

func key(p, id string) string { return p + "|" + id }

func (m *memStore) InsertContext(c contexts.Context) error { m.rows[key(c.ProjectID, c.ID)] = c; return nil }
func (m *memStore) ContextByID(p, id string) (contexts.Context, error) {
	c, ok := m.rows[key(p, id)]
	if !ok {
		return contexts.Context{}, contexts.ErrNotFound
	}
	return c, nil
}
func (m *memStore) ContextSummaries(p string) ([]contexts.Context, error) {
	var out []contexts.Context
	for _, c := range m.rows {
		if c.ProjectID == p {
			out = append(out, c)
		}
	}
	return out, nil
}
func (m *memStore) UpdateContext(c contexts.Context) error {
	if _, ok := m.rows[key(c.ProjectID, c.ID)]; !ok {
		return contexts.ErrNotFound
	}
	m.rows[key(c.ProjectID, c.ID)] = c
	return nil
}
func (m *memStore) DeleteContext(p, id string) error {
	if _, ok := m.rows[key(p, id)]; !ok {
		return contexts.ErrNotFound
	}
	delete(m.rows, key(p, id))
	return nil
}

func TestCreateGetListUpdateDelete(t *testing.T) {
	svc := contexts.New(newMem())
	inc := []contexts.Ref{{Kind: "document", ID: "d1", Name: "Doc 1"}}
	c, err := svc.Create("p", contexts.Actor{ID: "u1", Name: "U"}, "Design docs", inc, nil)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if c.ID == "" || c.Name != "Design docs" || len(c.Includes) != 1 || c.CreatorID != "u1" {
		t.Fatalf("unexpected created context: %+v", c)
	}

	got, err := svc.Get("p", c.ID)
	if err != nil || got.ID != c.ID {
		t.Fatalf("get: %v %+v", err, got)
	}

	list, err := svc.List("p")
	if err != nil || len(list) != 1 {
		t.Fatalf("list: %v %d", err, len(list))
	}

	upd, err := svc.Update("p", c.ID, "Design", nil, []contexts.Ref{{Kind: "document", ID: "d2"}})
	if err != nil || upd.Name != "Design" || len(upd.Includes) != 0 || len(upd.Excludes) != 1 {
		t.Fatalf("update: %v %+v", err, upd)
	}

	if err := svc.Delete("p", c.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := svc.Get("p", c.ID); err != contexts.ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

func TestCreateRejectsBlankName(t *testing.T) {
	svc := contexts.New(newMem())
	if _, err := svc.Create("p", contexts.Actor{ID: "u1"}, "  ", nil, nil); err != contexts.ErrInvalidName {
		t.Fatalf("want ErrInvalidName, got %v", err)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./core/capability/contexts/`
Expected: FAIL — package/symbols undefined.

- [ ] **Step 3: Write minimal implementation**

`core/capability/contexts/contexts.go`:

```go
// Package contexts owns project-scoped "context" resources: named, nestable sets
// of resource references that resolve down to the concrete leaf resources they
// represent. A context is a definition value ({includes, excludes}); the same
// value resolves whether it is stored (named) or anonymous (built per refresh and
// never persisted). The store is deliberately dumb — it only holds the refs the
// user typed. Resolution (see resolve.go) is always computed live.
package contexts

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

const maxName = 200

// KindContext is the resource kind of a context, both as a member's kind (a
// member of this kind nests another context) and as the wire kind a document
// variable binds to. WholeProjectID is the reserved virtual context id that
// resolves to every leaf resource in the project.
const (
	KindContext    = "context"
	WholeProjectID = "whole-project"
)

var (
	ErrNotFound    = errors.New("context not found")
	ErrInvalidName = errors.New("context name must not be empty")
)

// Ref names a resource by its catalog identity. Name is an optional display
// label only — resolution uses Kind+ID and never trusts Name, which may go stale.
type Ref struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

// Definition is a context value: the sets built up (Includes) and removed
// (Excludes). Stored contexts persist a definition plus a name; anonymous
// contexts are a bare definition passed straight to Resolve.
type Definition struct {
	Includes []Ref
	Excludes []Ref
}

// Context is a stored, named definition, project-scoped.
type Context struct {
	ID        string
	ProjectID string
	Name      string
	CreatorID string
	Includes  []Ref
	Excludes  []Ref
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Definition projects the stored membership as a resolvable value.
func (c Context) Definition() Definition { return Definition{Includes: c.Includes, Excludes: c.Excludes} }

// Actor is trusted request identity.
type Actor struct {
	ID   string
	Name string
}

// Store persists context records within a project.
type Store interface {
	InsertContext(c Context) error
	ContextByID(projectID, id string) (Context, error)
	ContextSummaries(projectID string) ([]Context, error)
	UpdateContext(c Context) error
	DeleteContext(projectID, id string) error
}

// Contexts is the context service over an injected Store. A Catalog (set via
// UseCatalog, see resolve.go) backs whole-project expansion; nil means
// whole-project resolves to nothing.
type Contexts struct {
	store   Store
	catalog Catalog
	now     func() time.Time
}

// New constructs the service.
func New(store Store) *Contexts { return &Contexts{store: store, now: time.Now} }

// Create makes a new context with the given membership.
func (c *Contexts) Create(projectID string, a Actor, name string, includes, excludes []Ref) (Context, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxName {
		return Context{}, ErrInvalidName
	}
	at := c.clock()
	rec := Context{
		ID: newID(), ProjectID: projectID, Name: name, CreatorID: a.ID,
		Includes: normalizeRefs(includes), Excludes: normalizeRefs(excludes),
		CreatedAt: at, UpdatedAt: at,
	}
	if err := c.store.InsertContext(rec); err != nil {
		return Context{}, err
	}
	return rec, nil
}

// Get returns one context scoped to its project.
func (c *Contexts) Get(projectID, id string) (Context, error) { return c.store.ContextByID(projectID, id) }

// List returns a project's contexts (unordered).
func (c *Contexts) List(projectID string) ([]Context, error) { return c.store.ContextSummaries(projectID) }

// Update replaces a context's name and membership (set-style).
func (c *Contexts) Update(projectID, id, name string, includes, excludes []Ref) (Context, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxName {
		return Context{}, ErrInvalidName
	}
	rec, err := c.store.ContextByID(projectID, id)
	if err != nil {
		return Context{}, err
	}
	rec.Name = name
	rec.Includes = normalizeRefs(includes)
	rec.Excludes = normalizeRefs(excludes)
	rec.UpdatedAt = c.clock()
	if err := c.store.UpdateContext(rec); err != nil {
		return Context{}, err
	}
	return rec, nil
}

// Delete removes a context.
func (c *Contexts) Delete(projectID, id string) error { return c.store.DeleteContext(projectID, id) }

// normalizeRefs trims each ref and drops any with a blank kind or id.
func normalizeRefs(refs []Ref) []Ref {
	var out []Ref
	for _, r := range refs {
		r.Kind = strings.TrimSpace(r.Kind)
		r.ID = strings.TrimSpace(r.ID)
		r.Name = strings.TrimSpace(r.Name)
		if r.Kind == "" || r.ID == "" {
			continue
		}
		out = append(out, r)
	}
	return out
}

func (c *Contexts) clock() time.Time {
	if c.now == nil {
		return time.Now().UTC()
	}
	return c.now().UTC()
}

func newID() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./core/capability/contexts/`
Expected: PASS.

- [ ] **Step 5: gofmt, write companion, verify zero drift**

```bash
gofmt -w core/capability/contexts/contexts.go
# author core/capability/contexts/contexts.go.md per the companion format
awk '/^```go$/{c=1;next}/^```$/{c=0}c' core/capability/contexts/contexts.go.md | diff <(gofmt core/capability/contexts/contexts.go) -
```
Expected: empty diff.

- [ ] **Step 6: Commit**

```bash
git add core/capability/contexts/contexts.go core/capability/contexts/contexts.go.md core/capability/contexts/contexts_test.go
git commit -m "Add contexts capability: record, store, CRUD"
```

---

### Task 2: Resolve set-algebra (nesting, cycles, whole-project, leaf exclusion)

**Files:**
- Create: `core/capability/contexts/resolve.go`
- Create: `core/capability/contexts/resolve.go.md`
- Test: `core/capability/contexts/resolve_test.go`

**Interfaces:**
- Consumes: `Contexts`, `Store`, `Ref`, `Definition`, `KindContext`, `WholeProjectID` (Task 1).
- Produces:
  - `type Catalog interface { AllResources(projectID string) ([]Ref, error) }`
  - `func (c *Contexts) UseCatalog(cat Catalog)`
  - `func (c *Contexts) Resolve(projectID string, def Definition) ([]Ref, error)` — flattened leaf refs, `Includes − Excludes`, deduped, include-order preserved.
  - `func (c *Contexts) ResolveID(projectID, id string) ([]Ref, error)` — resolve a stored context by id (used by the `/resolved` endpoint).

- [ ] **Step 1: Write the failing test**

`core/capability/contexts/resolve_test.go`:

```go
package contexts_test

import (
	"reflect"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
)

// fakeCatalog returns a fixed leaf-resource set for whole-project expansion.
type fakeCatalog struct{ refs []contexts.Ref }

func (f fakeCatalog) AllResources(string) ([]contexts.Ref, error) { return f.refs, nil }

func ref(kind, id string) contexts.Ref { return contexts.Ref{Kind: kind, ID: id} }
func ctxRef(id string) contexts.Ref    { return contexts.Ref{Kind: contexts.KindContext, ID: id} }

func TestResolveFlatIncludesAndLeafExclude(t *testing.T) {
	svc := contexts.New(newMem())
	def := contexts.Definition{
		Includes: []contexts.Ref{ref("document", "d1"), ref("document", "d2")},
		Excludes: []contexts.Ref{ref("document", "d1")},
	}
	got, err := svc.Resolve("p", def)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "d2")}) {
		t.Fatalf("got %+v", got)
	}
}

func TestResolveNestedContextThenExcludeLeafInside(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	// Stored context C = {d1, d2}.
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{ref("document", "d1"), ref("document", "d2")}})
	// Anonymous def: include C, exclude the leaf d1 that lives INSIDE C.
	def := contexts.Definition{Includes: []contexts.Ref{ctxRef("C")}, Excludes: []contexts.Ref{ref("document", "d1")}}
	got, err := svc.Resolve("p", def)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "d2")}) {
		t.Fatalf("include-context-exclude-inner-leaf failed: %+v", got)
	}
}

func TestResolveExcludeWholeContext(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "C",
		Includes: []contexts.Ref{ref("document", "d1"), ref("document", "d2")}})
	def := contexts.Definition{
		Includes: []contexts.Ref{ref("document", "d1"), ref("document", "d2"), ref("document", "d3")},
		Excludes: []contexts.Ref{ctxRef("C")}, // subtract everything C represents
	}
	got, err := svc.Resolve("p", def)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "d3")}) {
		t.Fatalf("exclude-whole-context failed: %+v", got)
	}
}

func TestResolveCycleTerminates(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "A", Includes: []contexts.Ref{ctxRef("B"), ref("document", "da")}})
	_ = m.InsertContext(contexts.Context{ProjectID: "p", ID: "B", Includes: []contexts.Ref{ctxRef("A"), ref("document", "db")}})
	got, err := svc.Resolve("p", contexts.Definition{Includes: []contexts.Ref{ctxRef("A")}})
	if err != nil {
		t.Fatal(err)
	}
	// da and db, in first-seen order; the A->B->A cycle is cut.
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "db"), ref("document", "da")}) {
		t.Fatalf("cycle resolve failed: %+v", got)
	}
}

func TestResolveWholeProjectMinusOne(t *testing.T) {
	svc := contexts.New(newMem())
	svc.UseCatalog(fakeCatalog{refs: []contexts.Ref{ref("document", "d1"), ref("connector", "k1")}})
	def := contexts.Definition{
		Includes: []contexts.Ref{ctxRef(contexts.WholeProjectID)},
		Excludes: []contexts.Ref{ref("document", "d1")},
	}
	got, err := svc.Resolve("p", def)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("connector", "k1")}) {
		t.Fatalf("whole-project minus one failed: %+v", got)
	}
}

func TestResolveDanglingContextRefContributesNothing(t *testing.T) {
	svc := contexts.New(newMem())
	got, err := svc.Resolve("p", contexts.Definition{Includes: []contexts.Ref{ctxRef("missing"), ref("document", "d1")}})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, []contexts.Ref{ref("document", "d1")}) {
		t.Fatalf("dangling ref not ignored: %+v", got)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./core/capability/contexts/ -run TestResolve`
Expected: FAIL — `Resolve`/`UseCatalog`/`Catalog` undefined.

- [ ] **Step 3: Write minimal implementation**

`core/capability/contexts/resolve.go`:

```go
package contexts

// Catalog is the port contexts uses to enumerate a project's leaf resources for
// whole-project expansion. It is satisfied over the resource catalog at
// composition; a nil catalog means whole-project resolves to nothing. It must
// NOT return context resources (whole-project is content, not organization).
type Catalog interface {
	AllResources(projectID string) ([]Ref, error)
}

// UseCatalog sets the whole-project source. A nil catalog (the default) makes
// whole-project resolve to nothing.
func (c *Contexts) UseCatalog(cat Catalog) { c.catalog = cat }

// originKey identifies a leaf by kind+id for dedup/subtraction (Name is ignored).
type originKey struct{ kind, id string }

func keyOf(r Ref) originKey { return originKey{kind: r.Kind, id: r.ID} }

// Resolve flattens a definition to its leaf refs: expand Includes to a leaf set,
// expand Excludes to a leaf set, return Includes − Excludes deduped in include
// order (exclude wins). Nested contexts recurse (cycles cut by a visited-set),
// and whole-project expands via the Catalog. Always computed live.
func (c *Contexts) Resolve(projectID string, def Definition) ([]Ref, error) {
	inc, err := c.expand(projectID, def.Includes, map[string]bool{})
	if err != nil {
		return nil, err
	}
	exc, err := c.expand(projectID, def.Excludes, map[string]bool{})
	if err != nil {
		return nil, err
	}
	excluded := make(map[originKey]bool, len(exc))
	for _, r := range exc {
		excluded[keyOf(r)] = true
	}
	seen := make(map[originKey]bool, len(inc))
	var out []Ref
	for _, r := range inc {
		k := keyOf(r)
		if excluded[k] || seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, r)
	}
	return out, nil
}

// ResolveID resolves a stored context by id — equivalent to resolving an
// anonymous definition that includes just that context.
func (c *Contexts) ResolveID(projectID, id string) ([]Ref, error) {
	return c.Resolve(projectID, Definition{Includes: []Ref{{Kind: KindContext, ID: id}}})
}

// expand flattens a ref list to leaf refs. A context member recurses into its
// stored definition (whole-project via the Catalog); any other kind is a leaf.
// visited holds context ids on the current expansion so cycles terminate; it is
// shared across the walk (double-expansion of a diamond is idempotent after the
// caller dedups).
func (c *Contexts) expand(projectID string, refs []Ref, visited map[string]bool) ([]Ref, error) {
	var out []Ref
	for _, r := range refs {
		switch {
		case r.Kind == KindContext && r.ID == WholeProjectID:
			if c.catalog == nil {
				continue
			}
			all, err := c.catalog.AllResources(projectID)
			if err != nil {
				return nil, err
			}
			out = append(out, all...)
		case r.Kind == KindContext:
			if visited[r.ID] {
				continue
			}
			visited[r.ID] = true
			row, err := c.store.ContextByID(projectID, r.ID)
			if err == ErrNotFound {
				continue // dangling ref contributes nothing
			}
			if err != nil {
				return nil, err
			}
			inc, err := c.expand(projectID, row.Includes, visited)
			if err != nil {
				return nil, err
			}
			exc, err := c.expand(projectID, row.Excludes, visited)
			if err != nil {
				return nil, err
			}
			out = append(out, subtractRefs(inc, exc)...)
		default:
			out = append(out, r)
		}
	}
	return out, nil
}

// subtractRefs returns inc − exc, deduped, in inc order (exclude wins).
func subtractRefs(inc, exc []Ref) []Ref {
	excluded := make(map[originKey]bool, len(exc))
	for _, r := range exc {
		excluded[keyOf(r)] = true
	}
	seen := make(map[originKey]bool, len(inc))
	var out []Ref
	for _, r := range inc {
		k := keyOf(r)
		if excluded[k] || seen[k] {
			continue
		}
		seen[k] = true
		out = append(out, r)
	}
	return out
}
```

Note: `Resolve` and the per-context subtraction share `subtractRefs`; refactor `Resolve` to call it if you prefer strict DRY — the explicit form above is kept for readability. The tests assert the observable behavior either way.

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./core/capability/contexts/`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: gofmt, companion, zero-drift**

```bash
gofmt -w core/capability/contexts/resolve.go
# author core/capability/contexts/resolve.go.md
awk '/^```go$/{c=1;next}/^```$/{c=0}c' core/capability/contexts/resolve.go.md | diff <(gofmt core/capability/contexts/resolve.go) -
```
Expected: empty diff.

- [ ] **Step 6: Write the change record**

Create `docs/records/0103-context-capability.md` covering the capability: the definition-value model, leaf-level exclusion, nesting + cycle handling, whole-project via the Catalog port, and that resolution is always live. Reference the spec `docs/superpowers/specs/2026-07-27-context-capability-design.md`.

- [ ] **Step 7: Commit**

```bash
git add core/capability/contexts/resolve.go core/capability/contexts/resolve.go.md core/capability/contexts/resolve_test.go docs/records/0103-context-capability.md
git commit -m "Add contexts.Resolve: nesting, cycles, whole-project, leaf exclusion (record 0103)"
```

---

### Task 3: SQLite store for contexts

**Files:**
- Modify: `core/platform/storage/sqlite/sqlite.go` (add `contexts` table DDL to the migration list; add the 5 store methods + a `scanContext` helper)
- Modify: `core/platform/storage/sqlite/sqlite.go.md` (companion — add the new sections in source order)
- Test: `core/platform/storage/sqlite/sqlite_test.go` (add a round-trip test)

**Interfaces:**
- Consumes: `contexts.Context`, `contexts.Ref`, `contexts.ErrNotFound` (Task 1).
- Produces: `*Store` satisfies `contexts.Store` (`InsertContext`, `ContextByID`, `ContextSummaries`, `UpdateContext`, `DeleteContext`).

- [ ] **Step 1: Write the failing test**

Add to `core/platform/storage/sqlite/sqlite_test.go` (follow the existing open-store helper in that file — e.g. `openTestStore(t)` or `sqlite.Open(":memory:")`; match whatever the file already uses):

```go
func TestContextStoreRoundTrip(t *testing.T) {
	s := openTestStore(t) // use this file's existing store-open helper
	rec := contexts.Context{
		ID: "c1", ProjectID: "p", Name: "Design", CreatorID: "u1",
		Includes:  []contexts.Ref{{Kind: "document", ID: "d1", Name: "Doc 1"}},
		Excludes:  []contexts.Ref{{Kind: "connector", ID: "k1"}},
		CreatedAt: time.Now().UTC().Truncate(time.Second),
		UpdatedAt: time.Now().UTC().Truncate(time.Second),
	}
	if err := s.InsertContext(rec); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, err := s.ContextByID("p", "c1")
	if err != nil {
		t.Fatalf("byID: %v", err)
	}
	if got.Name != "Design" || len(got.Includes) != 1 || got.Includes[0].ID != "d1" || len(got.Excludes) != 1 {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
	if _, err := s.ContextByID("other", "c1"); err != contexts.ErrNotFound {
		t.Fatalf("cross-project isolation: want ErrNotFound, got %v", err)
	}

	rec.Name = "Design v2"
	rec.Excludes = nil
	if err := s.UpdateContext(rec); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, _ = s.ContextByID("p", "c1")
	if got.Name != "Design v2" || len(got.Excludes) != 0 {
		t.Fatalf("update mismatch: %+v", got)
	}

	list, err := s.ContextSummaries("p")
	if err != nil || len(list) != 1 {
		t.Fatalf("summaries: %v %d", err, len(list))
	}
	if err := s.DeleteContext("p", "c1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := s.ContextByID("p", "c1"); err != contexts.ErrNotFound {
		t.Fatalf("post-delete: want ErrNotFound, got %v", err)
	}
}
```

Ensure the test file imports `"github.com/gccurtis/taurus-omega/core/capability/contexts"` and `"time"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./core/platform/storage/sqlite/ -run TestContextStoreRoundTrip`
Expected: FAIL — methods undefined.

- [ ] **Step 3: Write minimal implementation**

Add the table to the `CREATE TABLE` migration slice (next to `connectors`):

```go
		`CREATE TABLE IF NOT EXISTS contexts (
			project_id    TEXT NOT NULL,
			id            TEXT NOT NULL,
			name          TEXT NOT NULL,
			creator_id    TEXT NOT NULL DEFAULT '',
			includes_json TEXT NOT NULL DEFAULT '[]',
			excludes_json TEXT NOT NULL DEFAULT '[]',
			created_at    TEXT NOT NULL,
			updated_at    TEXT NOT NULL,
			PRIMARY KEY (project_id, id)
		)`,
```

Add the methods (place them near the connector store methods; `encoding/json` and `time` are already imported by this file):

```go
func marshalRefs(refs []contexts.Ref) string {
	if len(refs) == 0 {
		return "[]"
	}
	b, err := json.Marshal(refs)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func unmarshalRefs(s string) []contexts.Ref {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	var refs []contexts.Ref
	if err := json.Unmarshal([]byte(s), &refs); err != nil {
		return nil
	}
	return refs
}

func (s *Store) InsertContext(c contexts.Context) error {
	_, err := s.db.Exec(
		`INSERT INTO contexts(project_id,id,name,creator_id,includes_json,excludes_json,created_at,updated_at)
		 VALUES(?,?,?,?,?,?,?,?)`,
		c.ProjectID, c.ID, c.Name, c.CreatorID,
		marshalRefs(c.Includes), marshalRefs(c.Excludes),
		c.CreatedAt.UTC().Format(time.RFC3339Nano), c.UpdatedAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *Store) ContextByID(projectID, id string) (contexts.Context, error) {
	row := s.db.QueryRow(
		`SELECT project_id,id,name,creator_id,includes_json,excludes_json,created_at,updated_at
		 FROM contexts WHERE project_id=? AND id=?`, projectID, id)
	return scanContext(row)
}

func (s *Store) ContextSummaries(projectID string) ([]contexts.Context, error) {
	rows, err := s.db.Query(
		`SELECT project_id,id,name,creator_id,includes_json,excludes_json,created_at,updated_at
		 FROM contexts WHERE project_id=?`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []contexts.Context
	for rows.Next() {
		c, err := scanContext(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) UpdateContext(c contexts.Context) error {
	res, err := s.db.Exec(
		`UPDATE contexts SET name=?,includes_json=?,excludes_json=?,updated_at=? WHERE project_id=? AND id=?`,
		c.Name, marshalRefs(c.Includes), marshalRefs(c.Excludes),
		c.UpdatedAt.UTC().Format(time.RFC3339Nano), c.ProjectID, c.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return contexts.ErrNotFound
	}
	return nil
}

func (s *Store) DeleteContext(projectID, id string) error {
	res, err := s.db.Exec(`DELETE FROM contexts WHERE project_id=? AND id=?`, projectID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return contexts.ErrNotFound
	}
	return nil
}

// scanContext reads one contexts row (from *sql.Row or *sql.Rows via the shared
// rowScanner interface this file already defines for other resources).
func scanContext(sc rowScanner) (contexts.Context, error) {
	var c contexts.Context
	var inc, exc, created, updated string
	if err := sc.Scan(&c.ProjectID, &c.ID, &c.Name, &c.CreatorID, &inc, &exc, &created, &updated); err != nil {
		if err == sql.ErrNoRows {
			return contexts.Context{}, contexts.ErrNotFound
		}
		return contexts.Context{}, err
	}
	c.Includes = unmarshalRefs(inc)
	c.Excludes = unmarshalRefs(exc)
	c.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
	c.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updated)
	return c, nil
}
```

Note: this file already imports `encoding/json`, `strings`, `time`, `database/sql`, and defines a `rowScanner` interface for `*sql.Row`/`*sql.Rows` (used by `scanConnector`). Reuse it; if the interface has a different name, match the existing one. Add `contexts` to the import block.

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./core/platform/storage/sqlite/`
Expected: PASS.

- [ ] **Step 5: gofmt, companion, zero-drift**

```bash
gofmt -w core/platform/storage/sqlite/sqlite.go
# update sqlite.go.md: add the contexts DDL block section and the new method
# sections in source order (verbatim).
awk '/^```go$/{c=1;next}/^```$/{c=0}c' core/platform/storage/sqlite/sqlite.go.md | diff <(gofmt core/platform/storage/sqlite/sqlite.go) -
```
Expected: empty diff.

- [ ] **Step 6: Commit** (append to record 0103)

```bash
git add core/platform/storage/sqlite/sqlite.go core/platform/storage/sqlite/sqlite.go.md core/platform/storage/sqlite/sqlite_test.go docs/records/0103-context-capability.md
git commit -m "Add contexts SQLite store (append record 0103)"
```

---

### Task 4: HTTP handlers + routes

**Files:**
- Create: `core/handlers/context/context.go`
- Create: `core/handlers/context/context.go.md`
- Modify: `core/transport/transport.go` (add `Contexts *contexts.Contexts` to `Options`; register routes)
- Modify: `core/transport/transport.go.md`
- Test: `core/transport/transport_test.go` (add an integration test)

**Interfaces:**
- Consumes: `contexts.Contexts` (Tasks 1–2), `access.Context`, `endpoint.Request/Response` (existing).
- Produces: `context` handler package `Handlers` with `Create`, `List`, `Get`, `Resolved`, `Update`, `Delete`. Routes under `/contexts`.

- [ ] **Step 1: Write the failing test**

Add to `core/transport/transport_test.go` (mirror the connector integration test near line 1764 — same `do(t, e, …)`/cookie helpers, and wire `Contexts` into the test server's `transport.Options`):

```go
func TestContextRoutes(t *testing.T) {
	e, cookie := newTestServerWithProject(t) // use this file's existing setup helper
	// Create.
	rec := do(t, e, http.MethodPost, "/contexts",
		`{"name":"Design","includes":[{"kind":"document","id":"d1","name":"Doc 1"}]}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status %d body %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Includes []struct {
			Kind, ID string
		} `json:"includes"`
	}
	mustJSON(t, rec.Body.Bytes(), &created)
	if created.ID == "" || created.Name != "Design" || len(created.Includes) != 1 {
		t.Fatalf("unexpected created: %+v", created)
	}
	// List.
	rec = do(t, e, http.MethodGet, "/contexts", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("list status %d", rec.Code)
	}
	// Get.
	rec = do(t, e, http.MethodGet, "/contexts/"+created.ID, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("get status %d", rec.Code)
	}
	// Resolved (leaf origins; d1 is a leaf so it passes through).
	rec = do(t, e, http.MethodGet, "/contexts/"+created.ID+"/resolved", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("resolved status %d body %s", rec.Code, rec.Body.String())
	}
	// Update (replace membership).
	rec = do(t, e, http.MethodPatch, "/contexts/"+created.ID,
		`{"name":"Design v2","includes":[],"excludes":[{"kind":"document","id":"d1"}]}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("update status %d", rec.Code)
	}
	// Delete.
	rec = do(t, e, http.MethodDelete, "/contexts/"+created.ID, "", cookie)
	if rec.Code != http.StatusOK && rec.Code != http.StatusNoContent {
		t.Fatalf("delete status %d", rec.Code)
	}
}
```

Use whatever server-setup and JSON helpers this test file already provides (`newTestServerWithProject`/`mustJSON` are placeholders for the file's real helpers — match them).

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./core/transport/ -run TestContextRoutes`
Expected: FAIL — routes 404 / `Options.Contexts` undefined.

- [ ] **Step 3: Write minimal implementation**

`core/handlers/context/context.go`:

```go
// Package context serves the project-scoped context resource routes: create,
// list, get, resolve, update, and delete. A context is a named set of resource
// references; the resolve route flattens it to leaf origins.
package context

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	contextscap "github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct{ contexts *contextscap.Contexts }

func NewHandlers(c *contextscap.Contexts) Handlers { return Handlers{contexts: c} }

type refJSON struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

type contextJSON struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	Name      string    `json:"name"`
	Includes  []refJSON `json:"includes"`
	Excludes  []refJSON `json:"excludes"`
	CreatedAt string    `json:"createdAt"`
	UpdatedAt string    `json:"updatedAt"`
}

func refsOut(refs []contextscap.Ref) []refJSON {
	out := make([]refJSON, 0, len(refs))
	for _, r := range refs {
		out = append(out, refJSON{Kind: r.Kind, ID: r.ID, Name: r.Name})
	}
	return out
}

func refsIn(refs []refJSON) []contextscap.Ref {
	out := make([]contextscap.Ref, 0, len(refs))
	for _, r := range refs {
		out = append(out, contextscap.Ref{Kind: r.Kind, ID: r.ID, Name: r.Name})
	}
	return out
}

func view(c contextscap.Context) contextJSON {
	return contextJSON{
		ID: c.ID, Kind: contextscap.KindContext, Name: c.Name,
		Includes:  refsOut(c.Includes),
		Excludes:  refsOut(c.Excludes),
		CreatedAt: c.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt: c.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name     string    `json:"name"`
		Includes []refJSON `json:"includes"`
		Excludes []refJSON `json:"excludes"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	c, err := h.contexts.Create(ctx.Project.ID, contextscap.Actor{ID: ctx.User.ID, Name: ctx.User.Name},
		in.Name, refsIn(in.Includes), refsIn(in.Excludes))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: view(c)}
}

func (h Handlers) List(ctx access.Context, req endpoint.Request) endpoint.Response {
	list, err := h.contexts.List(ctx.Project.ID)
	if err != nil {
		return mapErr(err)
	}
	out := make([]contextJSON, 0, len(list))
	for _, c := range list {
		out = append(out, view(c))
	}
	return endpoint.Response{Status: http.StatusOK, Body: out}
}

func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	c, err := h.contexts.Get(ctx.Project.ID, req.Param("contextID"))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: view(c)}
}

func (h Handlers) Resolved(ctx access.Context, req endpoint.Request) endpoint.Response {
	leaves, err := h.contexts.ResolveID(ctx.Project.ID, req.Param("contextID"))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"origins": refsOut(leaves)}}
}

func (h Handlers) Update(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name     string    `json:"name"`
		Includes []refJSON `json:"includes"`
		Excludes []refJSON `json:"excludes"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	c, err := h.contexts.Update(ctx.Project.ID, req.Param("contextID"), in.Name, refsIn(in.Includes), refsIn(in.Excludes))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: view(c)}
}

func (h Handlers) Delete(ctx access.Context, req endpoint.Request) endpoint.Response {
	if err := h.contexts.Delete(ctx.Project.ID, req.Param("contextID")); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"deleted": true}}
}

func mapErr(err error) endpoint.Response {
	switch {
	case errors.Is(err, contextscap.ErrNotFound):
		return errResp(http.StatusNotFound, "context not found")
	case errors.Is(err, contextscap.ErrInvalidName):
		return errResp(http.StatusBadRequest, "context name must not be empty")
	default:
		return errResp(http.StatusInternalServerError, "context error")
	}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]any{"error": msg}}
}
```

In `core/transport/transport.go`: add the import `contextapp "github.com/gccurtis/taurus-omega/core/handlers/context"` and `contextscap "github.com/gccurtis/taurus-omega/core/capability/contexts"`; add to `Options`:

```go
	// Contexts backs the project-scoped /contexts routes. When nil, those routes
	// are not registered.
	Contexts *contextscap.Contexts
```

And register (next to the `opts.Connectors` block):

```go
	if opts.Contexts != nil {
		ctxs := contextapp.NewHandlers(opts.Contexts)
		scoped.POST("/contexts", s.adaptScoped(ctxs.Create))
		scoped.GET("/contexts", s.adaptScoped(ctxs.List))
		scoped.GET("/contexts/:contextID", s.adaptScoped(ctxs.Get))
		scoped.GET("/contexts/:contextID/resolved", s.adaptScoped(ctxs.Resolved))
		scoped.PATCH("/contexts/:contextID", s.adaptScoped(ctxs.Update))
		scoped.DELETE("/contexts/:contextID", s.adaptScoped(ctxs.Delete))
	}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./core/transport/ -run TestContextRoutes` then `go test ./core/transport/`
Expected: PASS (new test and existing transport tests).

- [ ] **Step 5: gofmt, companions, zero-drift** for `core/handlers/context/context.go` and `core/transport/transport.go`.

- [ ] **Step 6: Commit** (new record 0104)

```bash
git add core/handlers/context/ core/transport/transport.go core/transport/transport.go.md core/transport/transport_test.go docs/records/0104-context-endpoints.md
git commit -m "Add /contexts endpoints (record 0104)"
```
Write `docs/records/0104-context-endpoints.md` describing the route surface and the replace-style PATCH decision.

---

### Task 5: Document scope selection — split include/exclude (pure refactor)

**Files:**
- Modify: `core/capability/document/context.go` (add `resolveBlockScopeSelection` + `subtractOrigins`; make `resolveBlockScope` delegate to them — behavior-preserving)
- Modify: `core/capability/document/context.go.md`
- Test: `core/capability/document/context_test.go` (add a selection test)

**Interfaces:**
- Consumes: `TemplateInfo`, `BlockContext`, `ScopeOrigin` (existing).
- Produces: `func resolveBlockScopeSelection(tmpl *TemplateInfo, ctx *BlockContext) (include, exclude []ScopeOrigin)` and `func subtractOrigins(include, exclude []ScopeOrigin) []ScopeOrigin`. `resolveBlockScope` output is unchanged for all existing callers (`dependencies.go`, `prompt.go`).

- [ ] **Step 1: Write the failing test**

Add to `core/capability/document/context_test.go`:

```go
func TestResolveBlockScopeSelectionSplitsIncludeExclude(t *testing.T) {
	tmpl := &TemplateInfo{Variables: []ContextVariable{
		{Name: "all", BoundResource: &ResourceRef{Kind: "context", ID: "C"}},
		{Name: "drop", BoundResource: &ResourceRef{Kind: "document", ID: "d1"}},
	}}
	inc, exc := resolveBlockScopeSelection(tmpl, &BlockContext{Include: []string{"all"}, Exclude: []string{"drop"}})
	if len(inc) != 1 || inc[0] != (ScopeOrigin{Kind: "context", ID: "C"}) {
		t.Fatalf("include: %+v", inc)
	}
	if len(exc) != 1 || exc[0] != (ScopeOrigin{Kind: "document", ID: "d1"}) {
		t.Fatalf("exclude: %+v", exc)
	}
	// Behavior preserved: resolveBlockScope still returns include − exclude
	// (here the two origins differ, so both-set subtraction leaves the include).
	got := resolveBlockScope(tmpl, &BlockContext{Include: []string{"all"}, Exclude: []string{"drop"}})
	if len(got) != 1 || got[0] != (ScopeOrigin{Kind: "context", ID: "C"}) {
		t.Fatalf("resolveBlockScope changed: %+v", got)
	}
}
```

This test is in `package document` (white-box) — confirm `context_test.go`'s package clause matches (the existing scope tests there are white-box).

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./core/capability/document/ -run TestResolveBlockScopeSelection`
Expected: FAIL — `resolveBlockScopeSelection` undefined.

- [ ] **Step 3: Write minimal implementation**

In `core/capability/document/context.go`, replace `resolveBlockScope` with a delegating form and add the two helpers:

```go
// resolveBlockScopeSelection maps a block's include/exclude variable names to
// their bound-resource origins WITHOUT subtracting — the anonymous context
// definition handed to a ScopeResolver, which expands (nested contexts,
// whole-project) and subtracts at the leaf level. Each side is deduped and kept
// in declared order. Unbound/undeclared variables contribute nothing.
func resolveBlockScopeSelection(tmpl *TemplateInfo, ctx *BlockContext) (include, exclude []ScopeOrigin) {
	if tmpl == nil || ctx == nil {
		return nil, nil
	}
	bind := func(name string) (ScopeOrigin, bool) {
		v := tmpl.contextVariable(name)
		if v == nil || v.BoundResource == nil || v.BoundResource.ID == "" {
			return ScopeOrigin{}, false
		}
		return ScopeOrigin{Kind: v.BoundResource.Kind, ID: v.BoundResource.ID}, true
	}
	collect := func(names []string) []ScopeOrigin {
		seen := make(map[ScopeOrigin]bool)
		var out []ScopeOrigin
		for _, name := range names {
			o, ok := bind(name)
			if !ok || seen[o] {
				continue
			}
			seen[o] = true
			out = append(out, o)
		}
		return out
	}
	return collect(ctx.Include), collect(ctx.Exclude)
}

// subtractOrigins returns include − exclude, deduped, in include order (exclude
// wins). This is the origin-level scope used when no ScopeResolver is wired.
func subtractOrigins(include, exclude []ScopeOrigin) []ScopeOrigin {
	excluded := make(map[ScopeOrigin]bool, len(exclude))
	for _, o := range exclude {
		excluded[o] = true
	}
	seen := make(map[ScopeOrigin]bool, len(include))
	var out []ScopeOrigin
	for _, o := range include {
		if excluded[o] || seen[o] {
			continue
		}
		seen[o] = true
		out = append(out, o)
	}
	return out
}

// resolveBlockScope computes includes − excludes over the template's variable
// bindings at the origin level (the reference-graph and no-resolver retrieval
// path). See resolveBlockScopeSelection for the leaf-level expansion path.
func resolveBlockScope(tmpl *TemplateInfo, ctx *BlockContext) []ScopeOrigin {
	include, exclude := resolveBlockScopeSelection(tmpl, ctx)
	return subtractOrigins(include, exclude)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./core/capability/document/`
Expected: PASS (new test + all existing scope/dependency/prompt tests unchanged).

- [ ] **Step 5: gofmt, companion, zero-drift** for `core/capability/document/context.go`.

- [ ] **Step 6: Commit**

```bash
git add core/capability/document/context.go core/capability/document/context.go.md core/capability/document/context_test.go
git commit -m "Split block scope into include/exclude selection (pure refactor)"
```

---

### Task 6: Document ScopeResolver port + ResolveBlock wiring

**Files:**
- Modify: `core/capability/document/prompt.go` (add `ScopeResolver` port; use `ExpandScope` in `ResolveBlock`)
- Modify: `core/capability/document/prompt.go.md`
- Modify: `core/capability/document/service.go` (add `scopeResolver` field + `UseScopeResolver` setter)
- Modify: `core/capability/document/service.go.md`
- Test: `core/capability/document/prompt_test.go` (add a wiring test with a fake ScopeResolver)

**Interfaces:**
- Consumes: `ScopeOrigin`, `resolveBlockScopeSelection`, `subtractOrigins` (Task 5); existing `fakeModel`/`fakeRetriever` (test).
- Produces:
  - `type ScopeResolver interface { ExpandScope(ctx context.Context, projectID string, include, exclude []ScopeOrigin) ([]ScopeOrigin, error) }`
  - `func (d *Documents) UseScopeResolver(r ScopeResolver)`

Using a fake `ScopeResolver` + `fakeRetriever` here is allowed: it tests **plumbing** (does `ResolveBlock` pass the expanded allow-set to `RetrieveScoped`?), not model quality. The model itself is never stubbed for *quality* assertions — that is Task 8's live suite.

- [ ] **Step 1: Write the failing test**

Add to `core/capability/document/prompt_test.go`. Extend `fakeRetriever` to record the allow-set it received (add a field `gotAllow []document.ScopeOrigin` and set it in `RetrieveScoped`), then:

```go
// fakeScope expands a bound "context" origin into two leaf documents.
type fakeScope struct {
	gotInclude, gotExclude []document.ScopeOrigin
}

func (f *fakeScope) ExpandScope(_ context.Context, _ string, include, exclude []document.ScopeOrigin) ([]document.ScopeOrigin, error) {
	f.gotInclude, f.gotExclude = include, exclude
	return []document.ScopeOrigin{{Kind: "document", ID: "leaf1"}, {Kind: "document", ID: "leaf2"}}, nil
}

func TestResolveBlockExpandsBoundContext(t *testing.T) {
	model := &fakeModel{queries: []string{"q"}}
	retr := &fakeRetriever{}
	docs := promptDocs(model, retr) // existing helper; see prompt_test.go
	scope := &fakeScope{}
	docs.UseScopeResolver(scope)

	// Build a document whose template has a variable bound to a context, and a
	// prompt block that includes that variable. (Reuse this file's document
	// builders / SubmitChanges helpers to create the template variable + prompt
	// block with Context{Include: ["all"]}.)
	projectID, docID, blockID := seedPromptDocWithContextVar(t, docs) // helper to add per this file's patterns

	if _, err := docs.ResolveBlock(context.Background(), projectID, docID, blockID, document.ResolveReload); err != nil {
		t.Fatalf("resolve: %v", err)
	}
	// The bound context origin reached ExpandScope as an include...
	if len(scope.gotInclude) != 1 || scope.gotInclude[0] != (document.ScopeOrigin{Kind: "context", ID: "C"}) {
		t.Fatalf("expand got include %+v", scope.gotInclude)
	}
	// ...and the EXPANDED leaves (not the context origin) were used for retrieval.
	want := []document.ScopeOrigin{{Kind: "document", ID: "leaf1"}, {Kind: "document", ID: "leaf2"}}
	if !reflect.DeepEqual(retr.gotAllow, want) {
		t.Fatalf("RetrieveScoped allow = %+v, want %+v", retr.gotAllow, want)
	}
}
```

`seedPromptDocWithContextVar` is a helper you write using this file's existing document-creation + change-submission helpers: create a template variable `all` bound to `ResourceRef{Kind:"context", ID:"C"}` and a prompt block with `Context{Include:["all"]}`. If that setup is heavy, model it on the existing scoped-retrieval test already in `prompt_test.go` (it builds a bound variable + prompt block today).

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./core/capability/document/ -run TestResolveBlockExpandsBoundContext`
Expected: FAIL — `UseScopeResolver`/`ScopeResolver` undefined (and, once compiling, `gotAllow` shows the un-expanded context origin).

- [ ] **Step 3: Write minimal implementation**

In `core/capability/document/prompt.go`, add the port after `PersonaResolver`:

```go
// ScopeResolver expands a block's context selection to concrete leaf origins. It
// receives the block's included and excluded origins (an anonymous context
// definition) and returns the flattened, leaf-level includes − excludes:
// context-kind origins are expanded (nested contexts, whole-project) and
// non-context origins pass through. Satisfied over the contexts capability at
// composition; when nil, the document falls back to origin-level subtraction.
type ScopeResolver interface {
	ExpandScope(ctx context.Context, projectID string, include, exclude []ScopeOrigin) ([]ScopeOrigin, error)
}
```

Replace the retrieval-scope block in `ResolveBlock` (currently lines ~219–224) with:

```go
	var evidence []EvidenceSpan
	inc, exc := resolveBlockScopeSelection(doc.Base.Template, blk.Context)
	allow := subtractOrigins(inc, exc)
	if d.scopeResolver != nil && (len(inc) > 0 || len(exc) > 0) {
		allow, err = d.scopeResolver.ExpandScope(ctx, projectID, inc, exc)
		if err != nil {
			return ResolveResult{}, err
		}
	}
	if len(allow) > 0 {
		evidence, u, err = d.retriever.RetrieveScoped(ctx, projectID, queries, d.promptTopK, allow)
	} else {
		evidence, u, err = d.retriever.Retrieve(ctx, projectID, queries, d.promptTopK)
	}
```

In `core/capability/document/service.go`: add `scopeResolver ScopeResolver` to the `Documents` struct, and a setter (place near where other ports are, after `New`):

```go
// UseScopeResolver sets the port that expands a prompt block's context selection
// to leaf origins. Wired after construction because it composes over the
// contexts capability, which is built after the document service. Nil (default)
// keeps origin-level scope.
func (d *Documents) UseScopeResolver(r ScopeResolver) { d.scopeResolver = r }
```

(Setter, not an Options field, because `docs` is constructed before `contexts` in wiring — mirrors `connector.UseCascader`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./core/capability/document/`
Expected: PASS.

- [ ] **Step 5: gofmt, companions, zero-drift** for `prompt.go` and `service.go`.

- [ ] **Step 6: Commit** (new record 0105)

```bash
git add core/capability/document/prompt.go core/capability/document/prompt.go.md core/capability/document/service.go core/capability/document/service.go.md core/capability/document/prompt_test.go docs/records/0105-document-context-binding.md
git commit -m "Expand bound contexts in prompt-block retrieval scope (record 0105)"
```
Write `docs/records/0105-document-context-binding.md`: the ScopeResolver port, leaf-level expansion, the setter-vs-Options ordering reason, and the two documented future-work items (deep cascade; connectors-as-context).

---

### Task 7: Wiring — Catalog adapter, document scope adapter, construct Contexts

**Files:**
- Create: `core/wiring/context_catalog.go` (+ `.go.md`) — `contexts.Catalog` over `*resource.Resources`
- Create: `core/wiring/document_scope.go` (+ `.go.md`) — `document.ScopeResolver` over `*contexts.Contexts`
- Modify: `core/wiring/wiring.go` (+ `.go.md`) — construct `contexts`, `UseCatalog`, `docs.UseScopeResolver`, pass `Contexts` to transport `Options`

**Interfaces:**
- Consumes: `contexts.Contexts/Ref/Catalog/KindContext` (Tasks 1–2), `resource.Resources/PageRequest/Page/Summary` (existing), `document.ScopeResolver/ScopeOrigin` (Task 6).
- Produces: composition only — no new exported API. Verified by `go build ./...`, existing tests, and Task 8's live suite.

- [ ] **Step 1: Write the adapters**

`core/wiring/context_catalog.go`:

```go
package wiring

import (
	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// resourceCatalog adapts the unified resource catalog to contexts.Catalog: it
// enumerates every leaf resource in a project (paging through the catalog) for
// whole-project expansion, omitting context resources themselves (organization,
// not content). Keeps the contexts and resource capabilities independent.
type resourceCatalog struct{ resources *resource.Resources }

func (c resourceCatalog) AllResources(projectID string) ([]contexts.Ref, error) {
	var out []contexts.Ref
	req := resource.PageRequest{Limit: 200}
	for {
		page, err := c.resources.List(projectID, req)
		if err != nil {
			return nil, err
		}
		for _, s := range page.Resources {
			if string(s.Kind) == contexts.KindContext {
				continue
			}
			out = append(out, contexts.Ref{Kind: string(s.Kind), ID: s.ID, Name: s.Name})
		}
		if page.NextCursor == "" {
			break
		}
		req.Cursor = page.NextCursor
	}
	return out, nil
}
```

`core/wiring/document_scope.go`:

```go
package wiring

import (
	"context"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// documentScopeResolver adapts the contexts capability to document.ScopeResolver:
// it treats a block's include/exclude origins as an anonymous context definition
// and returns the flattened leaf origins. Keeps document independent of contexts.
type documentScopeResolver struct{ contexts *contexts.Contexts }

func (r documentScopeResolver) ExpandScope(_ context.Context, projectID string, include, exclude []document.ScopeOrigin) ([]document.ScopeOrigin, error) {
	def := contexts.Definition{Includes: toContextRefs(include), Excludes: toContextRefs(exclude)}
	leaves, err := r.contexts.Resolve(projectID, def)
	if err != nil {
		return nil, err
	}
	out := make([]document.ScopeOrigin, 0, len(leaves))
	for _, l := range leaves {
		out = append(out, document.ScopeOrigin{Kind: l.Kind, ID: l.ID})
	}
	return out, nil
}

func toContextRefs(origins []document.ScopeOrigin) []contexts.Ref {
	out := make([]contexts.Ref, 0, len(origins))
	for _, o := range origins {
		out = append(out, contexts.Ref{Kind: o.Kind, ID: o.ID})
	}
	return out
}
```

- [ ] **Step 2: Wire construction in `wiring.go`**

After `resources` is built (line ~264) and before the `transport.New` call (line ~364):

```go
	contextsSvc := contexts.New(store)
	contextsSvc.UseCatalog(resourceCatalog{resources: resources})
	docs.UseScopeResolver(documentScopeResolver{contexts: contextsSvc})
```

Add `Contexts: contextsSvc,` to the `transport.Options{…}` literal. Add the `contexts` import.

- [ ] **Step 3: Build + full test**

Run: `go build ./...` then `go test ./...`
Expected: build clean; all tests pass (no behavior change to existing paths — `docs` gains a resolver, but existing documents have no context-bound variables).

- [ ] **Step 4: gofmt, companions, zero-drift** for `context_catalog.go`, `document_scope.go`, `wiring.go`.

- [ ] **Step 5: Commit** (append record 0105)

```bash
git add core/wiring/context_catalog.go core/wiring/context_catalog.go.md core/wiring/document_scope.go core/wiring/document_scope.go.md core/wiring/wiring.go core/wiring/wiring.go.md docs/records/0105-document-context-binding.md
git commit -m "Wire contexts capability + document scope expansion (append record 0105)"
```

---

### Task 8: Live dev-test — bound context retrieves over its resolved set (real model, reports cost)

**Files:**
- Create: `dev-test/context-binding/run.sh`
- Modify: `dev-test/run.sh` (add `context-binding` to `intelligence_suites`)

**Interfaces:**
- Consumes: the running service (`start_service`), `dev-test/lib.sh` (`request`, `expect_status`, `json_field`, `track_usage`, `usage_summary`, `finish`, `FAILURES`).

This is the only test that exercises real intelligence. It proves end-to-end that a prompt block bound to a **context** retrieves over exactly the context's resolved sources. Keep inputs tiny (short docs, one prompt, a cheap model). Skip (exit 0) when no OpenRouter key is in `etc/config.local.yaml`.

- [ ] **Step 1: Write the suite**

`dev-test/context-binding/run.sh` — model it on `dev-test/context-scope/run.sh` (which already binds a variable to a resource and asserts scoped retrieval). Structure:

1. `start_service`; create a project; create **two source documents** with clearly distinct, retrievable facts (e.g. doc A: "The Meridian tower is 512 meters tall."; doc B: "The Solace bridge spans 1400 meters."). Submit their content with a valid `submissionId`.
2. `POST /contexts` including **only doc A** → capture `CONTEXT_ID`.
3. `GET /contexts/$CONTEXT_ID/resolved` → assert the `origins` array contains doc A and **not** doc B (proves resolution before any model call).
4. Create a **prompt document**: a template variable `src` bound to `{"kind":"context","id":"$CONTEXT_ID"}`, and a prompt block with `Context.Include=["src"]` asking a question answerable from doc A ("How tall is the Meridian tower?").
5. Resolve the block (`POST …/resolve` or the resolve route this repo uses); `track_usage` on the response's `usage` block.
6. Assert the resolved block text reflects doc A's fact (512) and does **not** leak doc B's fact — i.e. retrieval was scoped to the context's resolved set.
7. Add a second assertion: `PATCH` the context to include doc B too, re-resolve (reload), and confirm doc B's fact can now ground an answer — proving the context drives scope.
8. `usage_summary` to print total tokens + estimated dollar cost. `finish`.

Follow `context-scope/run.sh` exactly for the connector-vs-document plumbing, `submissionId` handling, and the `current_revision` capture that must not swallow `request`'s stdout logging (`request GET … >/dev/null` before reading the revision).

- [ ] **Step 2: Register the suite**

In `dev-test/run.sh`, add `context-binding` to the `intelligence_suites` list so it runs with the intelligence group (and is skipped without a key).

- [ ] **Step 3: Run it**

Run: `dev-test/context-binding/run.sh` (with a key in `etc/config.local.yaml`).
Expected: PASS on all assertions; a printed usage/cost summary (expect a few tenths of a cent). Without a key: exits 0 (skip).

- [ ] **Step 4: Commit** (append record 0105)

```bash
git add dev-test/context-binding/run.sh dev-test/run.sh docs/records/0105-document-context-binding.md
git commit -m "Add live dev-test: bound context scopes prompt retrieval (append record 0105)"
```
Append to record 0105 a short "Verification" note: the live suite, the facts it distinguishes, and the observed cost.

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-07-27-context-capability-design.md`):
- Definition-value model (stored + anonymous) → Tasks 1, 2, 6 (anonymous def built in `ExpandScope`).
- Leaf-level exclusion after expansion → Task 2 (`TestResolveNestedContextThenExcludeLeafInside`, `TestResolveExcludeWholeContext`).
- Nesting + cycles + whole-project → Task 2.
- `whole-project` as reserved id and includable member → Task 2 (`ctxRef(WholeProjectID)`).
- Two ports, no cross-capability imports → `Catalog` (Task 2, adapter Task 7), `ScopeResolver` (Task 6, adapter Task 7).
- Storage as JSON columns → Task 3.
- Endpoints (CRUD + resolved) → Task 4.
- Document binding via existing `BoundResource{Kind:"context"}`, no op/template change → Tasks 5–6 (no changeset files touched).
- Unit vs live testing split → Tasks 1–7 unit; Task 8 live with cost.
- Future work documented → Tasks 2/6 records.

**Type consistency:** `Ref{Kind,ID,Name}`, `Definition{Includes,Excludes}`, `ScopeOrigin{Kind,ID}` used identically across tasks; `Contexts.Resolve` / `ResolveID` / `UseCatalog` (Task 2) match the adapter calls (Task 7); `document.ScopeResolver.ExpandScope` (Task 6) matches `documentScopeResolver` (Task 7); `resource.Page.Resources` / `PageRequest{Limit,Cursor}` / `NextCursor` match the catalog adapter (Task 7).

**Placeholder scan:** test helper names flagged as "match this file's existing helper" (`openTestStore`, `newTestServerWithProject`, `mustJSON`, `promptDocs`, `seedPromptDocWithContextVar`) are real functions in those test files or thin wrappers to write there — not code placeholders in production. All production code blocks are complete.
