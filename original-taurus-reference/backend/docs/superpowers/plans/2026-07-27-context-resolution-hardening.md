# Context Resolution Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make context membership impossible to create into a cycle or a dangling reference, and make `Resolve` bounded (linear) instead of worst-case exponential.

**Architecture:** Enforce two write-time invariants in the `contexts` service — every member references an existing resource/context, and no create/update introduces a cycle in the context→context graph. Because the graph is then guaranteed acyclic, `Resolve` can safely memoize each context's resolved leaf set within a single call, eliminating the diamond fan-out. Existence checking reuses the existing `Catalog` port (extended with `Exists`); cycle checking walks the stored graph via the existing store.

**Tech Stack:** Go, pure-Go SQLite, ports-and-adapters. Builds directly on the `contexts` capability shipped in `docs/superpowers/plans/2026-07-27-context-capability.md`.

## Global Constraints

- **Work on main only.** Commit directly to main; never branch.
- **TDD.** Failing test first, watch it fail for the right reason, then minimal code. All of Plan 1 is deterministic logic — unit + transport tests only, **no live/model test**.
- **Companion docs, same commit.** Every changed non-test `.go` under `core/` updates its sibling `FILE.go.md` verbatim (short overview, `## Code breakdown`, one `### <one-line>` section per logical block in source order, each a ```` ```go ```` block reproducing that slice exactly). `gofmt -w` the `.go` before regenerating, then verify zero drift: `awk '/^```go$/{c=1;next}/^```$/{c=0}c' FILE.go.md | diff <(gofmt FILE.go) -` (empty = clean; MD010 hard-tab warnings expected/ignored).
- **Change record.** One `docs/records/0106-context-resolution-hardening.md`; small follow-ups append to it. (Latest existing record is `0105`.)
- **Errors are package-level vars; operations project-scoped.**
- **Reserved id** `contexts.WholeProjectID` ("whole-project") is always a valid member and is never subjected to existence or cycle checks.
- **Nil-catalog leniency (existing convention):** when no `Catalog` is wired (unit tests without one), `whole-project` resolves to nothing; likewise, **non-context** member existence is not enforced when the catalog is nil. Context-kind member existence is always enforced (it needs only the store). Production always wires the catalog.

---

### Task 1: Member-existence validation

Every member of a created/updated context must reference something that exists: a context-kind member (other than `whole-project`) must be a stored context in the project; any other kind must exist in the resource catalog (when a catalog is wired).

**Files:**
- Modify: `core/capability/contexts/resolve.go` (extend `Catalog` with `Exists`)
- Modify: `core/capability/contexts/contexts.go` (add `ErrUnknownMember`; validate in `Create`/`Update`)
- Modify: `core/capability/contexts/resolve.go.md`, `core/capability/contexts/contexts.go.md`
- Modify: `core/wiring/context_catalog.go` (+`.go.md`) — implement `Exists`
- Modify: `core/handlers/context/context.go` (+`.go.md`) — map `ErrUnknownMember` → 400
- Test: `core/capability/contexts/contexts_test.go` (validation unit tests; `memStore` + a fake catalog)
- Test: `core/capability/contexts/resolve_test.go` (add `Exists` to the existing `fakeCatalog`)

**Interfaces:**
- Consumes: `Catalog`, `Ref`, `Definition`, `KindContext`, `WholeProjectID`, `Store`, `ErrNotFound`.
- Produces: `Catalog.Exists(projectID, kind, id string) (bool, error)`; `ErrUnknownMember`; `Create`/`Update` now reject unknown members.

- [ ] **Step 1: Write the failing tests**

Add `Exists` to the existing `fakeCatalog` in `resolve_test.go` (so the package still compiles) — a catalog that knows a fixed set of leaf origins:

```go
func (f fakeCatalog) Exists(_ string, kind, id string) (bool, error) {
	for _, r := range f.refs {
		if r.Kind == kind && r.ID == id {
			return true, nil
		}
	}
	return false, nil
}
```

Add to `contexts_test.go`:

```go
// existCatalog reports existence for a fixed leaf set; unknown → false.
type existCatalog struct{ have map[string]bool } // key = kind+"|"+id

func (e existCatalog) AllResources(string) ([]contexts.Ref, error) { return nil, nil }
func (e existCatalog) Exists(_ string, kind, id string) (bool, error) {
	return e.have[kind+"|"+id], nil
}

func TestCreateRejectsUnknownMember(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	svc.UseCatalog(existCatalog{have: map[string]bool{"document|d1": true}})
	// d1 exists, d2 does not.
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: "document", ID: "d2"}}, nil); err != contexts.ErrUnknownMember {
		t.Fatalf("want ErrUnknownMember for missing d2, got %v", err)
	}
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: "document", ID: "d1"}}, nil); err != nil {
		t.Fatalf("d1 exists, want nil, got %v", err)
	}
}

func TestCreateAllowsWholeProjectMemberWithoutExistenceCheck(t *testing.T) {
	svc := contexts.New(newMem())
	svc.UseCatalog(existCatalog{have: map[string]bool{}})
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: contexts.WholeProjectID}}, nil); err != nil {
		t.Fatalf("whole-project must be a valid member, got %v", err)
	}
}

func TestContextMemberMustExistEvenWithoutCatalog(t *testing.T) {
	m := newMem()
	svc := contexts.New(m) // no catalog
	// A context-kind member that isn't stored is unknown, regardless of catalog.
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: "missing"}}, nil); err != contexts.ErrUnknownMember {
		t.Fatalf("want ErrUnknownMember for missing context member, got %v", err)
	}
}

func TestNonContextMemberSkippedWhenNoCatalog(t *testing.T) {
	svc := contexts.New(newMem()) // no catalog
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "C",
		[]contexts.Ref{{Kind: "document", ID: "whatever"}}, nil); err != nil {
		t.Fatalf("non-context member must be permitted when no catalog, got %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./core/capability/contexts/ -run 'Member|UnknownMember|WholeProjectMember'`
Expected: compile error until `fakeCatalog.Exists` is added, then FAIL — `ErrUnknownMember` undefined / no validation.

- [ ] **Step 3: Implement**

In `resolve.go`, extend the port:

```go
// Catalog is the port contexts uses to enumerate a project's leaf resources for
// whole-project expansion, and to check a member resource exists. It is
// satisfied over the resource catalog at composition; a nil catalog means
// whole-project resolves to nothing and non-context member existence is not
// enforced. It must NOT return context resources from AllResources.
type Catalog interface {
	AllResources(projectID string) ([]Ref, error)
	Exists(projectID, kind, id string) (bool, error)
}
```

In `contexts.go`, add the error and a validator, and call it from `Create` and `Update`:

```go
var (
	ErrNotFound       = errors.New("context not found")
	ErrInvalidName    = errors.New("context name must not be empty")
	ErrUnknownMember  = errors.New("context member does not exist")
)
```

```go
// validateMembersExist checks every include/exclude member references something
// real: a context-kind member (other than whole-project) must be a stored
// context; any other kind must exist in the catalog when one is wired.
func (c *Contexts) validateMembersExist(projectID string, refs ...[]Ref) error {
	for _, list := range refs {
		for _, r := range list {
			if r.Kind == KindContext {
				if r.ID == WholeProjectID {
					continue
				}
				if _, err := c.store.ContextByID(projectID, r.ID); err != nil {
					if errors.Is(err, ErrNotFound) {
						return ErrUnknownMember
					}
					return err
				}
				continue
			}
			if c.catalog == nil {
				continue
			}
			ok, err := c.catalog.Exists(projectID, r.Kind, r.ID)
			if err != nil {
				return err
			}
			if !ok {
				return ErrUnknownMember
			}
		}
	}
	return nil
}
```

Call it in `Create` (after `normalizeRefs`, before insert) and `Update` (after `normalizeRefs`, before store update), e.g. in `Create`:

```go
	inc, exc := normalizeRefs(includes), normalizeRefs(excludes)
	if err := c.validateMembersExist(projectID, inc, exc); err != nil {
		return Context{}, err
	}
```
(and use `inc`/`exc` in the record instead of re-normalizing).

In `core/wiring/context_catalog.go`, implement `Exists`:

```go
func (c resourceCatalog) Exists(projectID, kind, id string) (bool, error) {
	if _, err := c.resources.Get(projectID, resource.Kind(kind), id); err != nil {
		if errors.Is(err, resource.ErrNotFound) || errors.Is(err, resource.ErrUnknownKind) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}
```
(Add `"errors"` and confirm `resource.ErrNotFound`/`resource.ErrUnknownKind` are the right sentinels — check `core/capability/resource/resource.go`; both exist.)

In `core/handlers/context/context.go` `mapErr`, add:

```go
	case errors.Is(err, contextscap.ErrUnknownMember):
		return errResp(http.StatusBadRequest, "context member does not exist")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./core/capability/contexts/ ./core/wiring/ ./core/handlers/context/ && go build ./...`
Expected: PASS, clean build.

- [ ] **Step 5: gofmt + companions + zero-drift**

`gofmt -w` and regenerate `resolve.go.md`, `contexts.go.md`, `context_catalog.go.md`, `context.go.md`; verify each zero-drift.

- [ ] **Step 6: Record + commit**

Write `docs/records/0106-context-resolution-hardening.md` (the two write-time invariants and the memoization; reference the design spec `docs/superpowers/specs/2026-07-27-context-capability-design.md`). Commit:

```bash
git add core/capability/contexts/resolve.go core/capability/contexts/resolve.go.md core/capability/contexts/contexts.go core/capability/contexts/contexts.go.md core/capability/contexts/contexts_test.go core/capability/contexts/resolve_test.go core/wiring/context_catalog.go core/wiring/context_catalog.go.md core/handlers/context/context.go core/handlers/context/context.go.md docs/records/0106-context-resolution-hardening.md
git commit -m "Reject context members that don't exist (record 0106)"
```

---

### Task 2: Acyclicity validation

A create/update must not introduce a cycle in the context→context reference graph.

**Files:**
- Modify: `core/capability/contexts/contexts.go` (add `ErrCycle`; cycle check in `Create`/`Update`)
- Modify: `core/capability/contexts/contexts.go.md`
- Modify: `core/handlers/context/context.go` (+`.go.md`) — map `ErrCycle` → 400
- Test: `core/capability/contexts/contexts_test.go`

**Interfaces:**
- Consumes: `Store.ContextByID`, `Ref`, `KindContext`, `WholeProjectID`, `ErrNotFound`.
- Produces: `ErrCycle`; `Create`/`Update` reject membership that would form a cycle.

- [ ] **Step 1: Write the failing tests**

```go
func TestUpdateRejectsCycle(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	a, _ := svc.Create("p", contexts.Actor{ID: "u"}, "A", nil, nil)
	// B includes A (A exists — valid).
	b, err := svc.Create("p", contexts.Actor{ID: "u"}, "B",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: a.ID}}, nil)
	if err != nil {
		t.Fatalf("create B: %v", err)
	}
	// Updating A to include B closes the loop A→B→A.
	if _, err := svc.Update("p", a.ID, "A",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: b.ID}}, nil); err != contexts.ErrCycle {
		t.Fatalf("want ErrCycle, got %v", err)
	}
}

func TestUpdateRejectsSelfReference(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	a, _ := svc.Create("p", contexts.Actor{ID: "u"}, "A", nil, nil)
	if _, err := svc.Update("p", a.ID, "A",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: a.ID}}, nil); err != contexts.ErrCycle {
		t.Fatalf("want ErrCycle for self-reference, got %v", err)
	}
}

func TestCycleCheckAllowsDiamond(t *testing.T) {
	m := newMem()
	svc := contexts.New(m)
	d, _ := svc.Create("p", contexts.Actor{ID: "u"}, "D", nil, nil)
	b, _ := svc.Create("p", contexts.Actor{ID: "u"}, "B", []contexts.Ref{{Kind: contexts.KindContext, ID: d.ID}}, nil)
	cc, _ := svc.Create("p", contexts.Actor{ID: "u"}, "C", []contexts.Ref{{Kind: contexts.KindContext, ID: d.ID}}, nil)
	// A includes both B and C (both reach D) — a diamond, NOT a cycle.
	if _, err := svc.Create("p", contexts.Actor{ID: "u"}, "A",
		[]contexts.Ref{{Kind: contexts.KindContext, ID: b.ID}, {Kind: contexts.KindContext, ID: cc.ID}}, nil); err != nil {
		t.Fatalf("diamond must be allowed, got %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./core/capability/contexts/ -run 'Cycle|SelfReference|Diamond'`
Expected: FAIL — `ErrCycle` undefined / cycles accepted.

- [ ] **Step 3: Implement**

Add the error and a reachability check; call it from `Create` and `Update` after existence validation. On `Create`, pass the freshly generated id (a new id can't be in a cycle, so it passes — but the check is uniform and cheap). On `Update`, pass the target id.

```go
// wouldCycle reports whether giving context selfID the given membership would
// create a cycle: true iff any context-kind member (other than whole-project)
// can already reach selfID through the stored context graph. The stored graph is
// kept acyclic by this very check, so the walk terminates; a visited set guards
// against corrupt data.
func (c *Contexts) wouldCycle(projectID, selfID string, members ...[]Ref) (bool, error) {
	visited := map[string]bool{}
	var reaches func(id string) (bool, error)
	reaches = func(id string) (bool, error) {
		if id == selfID {
			return true, nil
		}
		if visited[id] {
			return false, nil
		}
		visited[id] = true
		row, err := c.store.ContextByID(projectID, id)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return false, nil
			}
			return false, err
		}
		for _, list := range [][]Ref{row.Includes, row.Excludes} {
			for _, r := range list {
				if r.Kind != KindContext || r.ID == WholeProjectID {
					continue
				}
				ok, err := reaches(r.ID)
				if err != nil {
					return false, err
				}
				if ok {
					return true, nil
				}
			}
		}
		return false, nil
	}
	for _, list := range members {
		for _, r := range list {
			if r.Kind != KindContext || r.ID == WholeProjectID {
				continue
			}
			ok, err := reaches(r.ID)
			if err != nil {
				return false, err
			}
			if ok {
				return true, nil
			}
		}
	}
	return false, nil
}
```

```go
var ErrCycle = errors.New("context membership would create a cycle")
```

In `Create`, after generating `id` (move `newID()` up so it's available), and after existence validation:

```go
	id := newID()
	if cyclic, err := c.wouldCycle(projectID, id, inc, exc); err != nil {
		return Context{}, err
	} else if cyclic {
		return Context{}, ErrCycle
	}
```
In `Update`, after existence validation, using the target `id`.

In `context.go` `mapErr`, add:

```go
	case errors.Is(err, contextscap.ErrCycle):
		return errResp(http.StatusBadRequest, "context membership would create a cycle")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./core/capability/contexts/ ./core/handlers/context/ && go build ./...`
Expected: PASS.

- [ ] **Step 5: gofmt + companions + zero-drift** for `contexts.go.md`, `context.go.md`.

- [ ] **Step 6: Commit** (append record 0106)

```bash
git add core/capability/contexts/contexts.go core/capability/contexts/contexts.go.md core/capability/contexts/contexts_test.go core/handlers/context/context.go core/handlers/context/context.go.md docs/records/0106-context-resolution-hardening.md
git commit -m "Reject context membership that would create a cycle (record 0106)"
```

---

### Task 3: Memoized bounded resolution

With the graph guaranteed acyclic, `Resolve` memoizes each context's resolved leaf set within one call, so a diamond lattice resolves in linear time (each context read/resolved once) instead of exponential.

**Files:**
- Modify: `core/capability/contexts/resolve.go` (thread a memo through `expand`)
- Modify: `core/capability/contexts/resolve.go.md`
- Test: `core/capability/contexts/resolve_test.go` (correctness under a diamond + a counting store proving each context is read once)

**Interfaces:**
- Consumes: `expand`, `subtractRefs`, `Store.ContextByID`.
- Produces: same `Resolve`/`ResolveID` behavior, now memoized. No signature change.

- [ ] **Step 1: Write the failing test**

Add a counting store wrapper and a fan-out test to `resolve_test.go`:

```go
// countingStore wraps a Store and counts ContextByID calls per id.
type countingStore struct {
	inner  contexts.Store
	counts map[string]int
}

func (s *countingStore) InsertContext(c contexts.Context) error { return s.inner.InsertContext(c) }
func (s *countingStore) ContextByID(p, id string) (contexts.Context, error) {
	s.counts[id]++
	return s.inner.ContextByID(p, id)
}
func (s *countingStore) ContextSummaries(p string) ([]contexts.Context, error) { return s.inner.ContextSummaries(p) }
func (s *countingStore) UpdateContext(c contexts.Context) error                { return s.inner.UpdateContext(c) }
func (s *countingStore) DeleteContext(p, id string) error                      { return s.inner.DeleteContext(p, id) }

func TestResolveMemoizesDiamondFanOut(t *testing.T) {
	mem := newMem()
	cs := &countingStore{inner: mem, counts: map[string]int{}}
	// Chain where each context includes the NEXT one twice: naive expansion is
	// 2^depth ContextByID calls; memoized is one per context.
	depth := 12
	for i := depth; i >= 0; i-- {
		id := "C" + itoa(i)
		var inc []contexts.Ref
		if i == depth {
			inc = []contexts.Ref{{Kind: "document", ID: "leaf"}}
		} else {
			next := contexts.Ref{Kind: contexts.KindContext, ID: "C" + itoa(i+1)}
			inc = []contexts.Ref{next, next} // twice → naive doubles per level
		}
		_ = mem.InsertContext(contexts.Context{ProjectID: "p", ID: id, Includes: inc})
	}
	svc := contexts.New(cs)
	got, err := svc.ResolveID("p", "C0")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != "leaf" {
		t.Fatalf("resolve = %+v, want single leaf", got)
	}
	for i := 0; i <= depth; i++ {
		if n := cs.counts["C"+itoa(i)]; n > 1 {
			t.Fatalf("C%d read %d times; memoization failed (expected 1)", i, n)
		}
	}
}
```

Add a tiny `itoa` helper in the test file if not present (`strconv.Itoa`).

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./core/capability/contexts/ -run TestResolveMemoizesDiamondFanOut`
Expected: FAIL — a mid-chain context is read many times (current code re-expands per path). (If `depth` makes it hang, that itself demonstrates the fan-out; lower to 12 keeps the failing run fast.)

- [ ] **Step 3: Implement**

Thread a `memo map[string][]Ref` from `Resolve` through `expand`; the two top-level `expand` calls (Includes/Excludes) **share one memo** (a context resolves to the same leaves regardless of which side references it). Cache a stored context's resolved leaves on first computation; reuse thereafter. Keep the `visited` ancestor-path guard as a defensive cycle breaker.

```go
func (c *Contexts) Resolve(projectID string, def Definition) ([]Ref, error) {
	memo := map[string][]Ref{}
	inc, err := c.expand(projectID, def.Includes, map[string]bool{}, memo)
	if err != nil {
		return nil, err
	}
	exc, err := c.expand(projectID, def.Excludes, map[string]bool{}, memo)
	if err != nil {
		return nil, err
	}
	return subtractRefs(inc, exc), nil
}
```
(Note: `Resolve`'s final dedup/subtract is exactly `subtractRefs`; use it directly — same result the inline loop produced.)

```go
func (c *Contexts) expand(projectID string, refs []Ref, visited map[string]bool, memo map[string][]Ref) ([]Ref, error) {
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
				continue // defensive cycle cut (graph is kept acyclic on write)
			}
			if cached, ok := memo[r.ID]; ok {
				out = append(out, cached...)
				continue
			}
			row, err := c.store.ContextByID(projectID, r.ID)
			if errors.Is(err, ErrNotFound) {
				memo[r.ID] = nil // dangling ref resolves to nothing; cache it
				continue
			}
			if err != nil {
				return nil, err
			}
			child := make(map[string]bool, len(visited)+1)
			for k := range visited {
				child[k] = true
			}
			child[r.ID] = true
			inc, err := c.expand(projectID, row.Includes, child, memo)
			if err != nil {
				return nil, err
			}
			exc, err := c.expand(projectID, row.Excludes, child, memo)
			if err != nil {
				return nil, err
			}
			resolved := subtractRefs(inc, exc)
			memo[r.ID] = resolved
			out = append(out, resolved...)
		default:
			out = append(out, r)
		}
	}
	return out, nil
}
```

Note: `whole-project` is intentionally NOT memoized by a key here (it has no stable id per nested position and `AllResources` is a single cheap call). If a context that *includes* whole-project is referenced multiple times, that whole context IS memoized (by its own id), so `AllResources` still runs at most once per such context. Leave whole-project un-keyed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./core/capability/contexts/`
Expected: PASS — all existing resolve tests (nesting, cycles-defensive, exclude-inside, whole-project) AND the new memoization test, each context read once.

- [ ] **Step 5: gofmt + companion + zero-drift** for `resolve.go.md`.

- [ ] **Step 6: Commit** (append record 0106)

```bash
git add core/capability/contexts/resolve.go core/capability/contexts/resolve.go.md core/capability/contexts/resolve_test.go docs/records/0106-context-resolution-hardening.md
git commit -m "Memoize context resolution: linear, not exponential (record 0106)"
```

---

## Self-Review

**Spec coverage:**
- Write-time referential integrity (members must exist) → Task 1.
- Write-time acyclicity (no cycles on create/update) → Task 2.
- Bounded resolution given acyclicity (memoize) → Task 3.
- HTTP surfaces the new rejections as 400 → Tasks 1 & 2 (`mapErr`).

**Type consistency:** `Catalog` gains `Exists(projectID, kind, id) (bool, error)` (Task 1) — the wiring `resourceCatalog` and both test doubles (`fakeCatalog`, `existCatalog`) implement it. `ErrUnknownMember` (Task 1) and `ErrCycle` (Task 2) are package vars mapped in `mapErr`. `expand` signature gains a `memo map[string][]Ref` param (Task 3) — the two call sites in `Resolve` and the two recursive calls all pass it.

**Ordering note:** Task 1 extends the `Catalog` interface, so it must land before the wiring/test doubles compile; Tasks 2 and 3 are independent of each other (validation vs. resolution) but both assume Task 1's `inc`/`exc` normalization plumbing.

**Placeholder scan:** `itoa` in Task 3's test = `strconv.Itoa` (import in the test file). All production code blocks are complete; error sentinels and method names match across tasks.
