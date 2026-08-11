# Context resolution hardening: write-time member-existence validation (`core/capability/contexts`)

Design: [`docs/superpowers/specs/2026-07-27-context-capability-design.md`](../superpowers/specs/2026-07-27-context-capability-design.md).
Plan: [`docs/superpowers/plans/2026-07-27-context-resolution-hardening.md`](../superpowers/plans/2026-07-27-context-resolution-hardening.md).

The context capability (record 0103) let a context's `Create`/`Update` accept
any `{kind, id}` member, including a dangling one that names a resource or
context that never existed or has since been deleted — `Resolve` (record
0103) already treated a dangling *context* ref as "contributes nothing" at
read time, but nothing stopped a client from writing one. This is Task 1 of a
three-task hardening plan that enforces two write-time invariants on context
membership — this task ships the first:

1. **Member existence (this task).** Every `includes`/`excludes` member on
   `Create`/`Update` must reference something real.
2. **Acyclicity (Task 2, not yet shipped).** No create/update may introduce a
   cycle in the context→context reference graph.

Once both invariants hold, the stored context graph is guaranteed acyclic,
which lets `Resolve` safely memoize each context's resolved leaf set within a
single call (Task 3, not yet shipped) — turning a diamond-shaped reference
lattice's resolution from worst-case exponential fan-out into linear time.
Tasks 2 and 3 are follow-up work; this record will gain a "What changed"
section per task as each lands, per the plan's "small follow-ups append to
it" convention.

## What changed

### `core/capability/contexts/resolve.go`

- **`Catalog` gains a second method:**

  ```go
  type Catalog interface {
  	AllResources(projectID string) ([]Ref, error)
  	Exists(projectID, kind, id string) (bool, error)
  }
  ```

  `AllResources` is unchanged (whole-project expansion); `Exists` is the new
  primitive `validateMembersExist` (below) calls to check one non-context
  member. A nil catalog — the documented default from `New` — now means two
  things degrade gracefully together: whole-project still resolves to
  nothing, and non-context member existence is not enforced (unit tests that
  never call `UseCatalog` keep accepting non-context members exactly as
  before this task).

### `core/capability/contexts/contexts.go`

- **New sentinel:** `ErrUnknownMember = errors.New("context member does not
  exist")`, alongside the existing `ErrNotFound`/`ErrInvalidName`.
- **New validator**, called from both `Create` and `Update` after
  `normalizeRefs`, before the store is touched:

  ```go
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

  A context-kind member is checked against the store directly (`WholeProjectID`
  is always valid — it names no row); any other kind is checked against the
  catalog, but only when one is wired, matching the nil-catalog leniency
  `resolve.go`'s `Catalog` doc comment now states explicitly. This is the
  mirror image of `expand` in `resolve.go`: `expand` treats a dangling
  reference as "contributes nothing" because resolution must never fail on
  stale data at read time; `validateMembersExist` treats the same reference as
  an error because write time is where correctness is enforced, so what gets
  stored is never stale to begin with.
- **`Create` and `Update` both normalize once and validate before storing:**
  each now computes `inc, exc := normalizeRefs(includes), normalizeRefs(excludes)`
  a single time, calls `validateMembersExist(projectID, inc, exc)` before any
  store write (and, in `Create`, before minting an id or stamping a
  timestamp — a rejected create leaves no partial side effect), and reuses
  `inc`/`exc` for the stored record instead of re-normalizing.

### `core/wiring/context_catalog.go`

- **`resourceCatalog` implements `Exists`:**

  ```go
  func (c resourceCatalog) Exists(projectID, kind, id string) (bool, error) {
  	if _, err := c.resources.Get(projectID, resource.Kind(kind), id); err != nil {
  		if errors.Is(err, resource.ErrNotFound) ||
  			errors.Is(err, resource.ErrUnknownKind) ||
  			errors.Is(err, resource.ErrUnavailableKind) {
  			return false, nil
  		}
  		return false, err
  	}
  	return true, nil
  }
  ```

  Reuses `*resource.Resources.Get`, the same one-resource lookup the rest of
  the resource catalog already exposes. `Get` validates the kind against the
  catalog's closed vocabulary before routing to a family, so an unrecognized
  member kind surfaces `resource.ErrUnknownKind`, a missing id surfaces
  `resource.ErrNotFound`, and a kind that is in the closed vocabulary but has
  no family registered in this deployment (e.g. `spreadsheet` when only
  `document`/`connector` are wired) surfaces `resource.ErrUnavailableKind` —
  **note (fix round 1): unregistered-but-otherwise-valid resource kinds count
  as non-existent members too, so `validateMembersExist` correctly rejects
  them with `ErrUnknownMember` (400) instead of surfacing the family lookup
  as an unhandled error (500)**. All three fold into `false, nil` since "not
  found" is the expected answer for a bad reference, not a failure. Any other
  error (a real storage failure) propagates as `false, err`.

### `core/handlers/context/context.go`

- **`mapErr` maps the new sentinel to 400:**

  ```go
  case errors.Is(err, contextscap.ErrUnknownMember):
  	return errResp(http.StatusBadRequest, "context member does not exist")
  ```

  Same shape as the existing `ErrInvalidName` → 400 mapping. `Create` and
  `Update` now reject a request naming a nonexistent member at the transport
  layer, before anything is stored; `Resolved`'s existing 404-on-missing-subject
  behavior (record 0104) is unrelated and unchanged — that check is about the
  endpoint's own top-level id, not about members inside a definition.

## Test

`core/capability/contexts/resolve_test.go`:

- `fakeCatalog` (used by the existing `Resolve` tests) gains `Exists`, so the
  package continues to compile now that `Catalog` requires it — it reports
  `true` for any `(kind, id)` present in its fixed `refs` set, `false`
  otherwise. No existing `Resolve` test's behavior changes; `Exists` is unused
  by resolution itself.

`core/capability/contexts/contexts_test.go`:

- `existCatalog{have map[string]bool}` is a second, purpose-built fake
  catalog for validation tests — keyed `kind+"|"+id` — independent of
  `fakeCatalog`, since the existence tests care only about `Exists`, not
  `AllResources`.
- `TestCreateRejectsUnknownMember` — a `document` member not in the catalog's
  `have` set is rejected with `ErrUnknownMember`; the same kind/id that *is*
  present succeeds.
- `TestCreateAllowsWholeProjectMemberWithoutExistenceCheck` — a
  `{context, whole-project}` member is always accepted, even against a
  catalog whose `have` set is empty, proving the reserved id is never
  existence-checked.
- `TestContextMemberMustExistEvenWithoutCatalog` — a `context`-kind member
  that isn't a stored row is rejected with `ErrUnknownMember` even when no
  catalog is wired at all, since context existence is checked against the
  store, not the catalog.
- `TestNonContextMemberSkippedWhenNoCatalog` — a non-context member is
  permitted when no catalog is wired, confirming the documented nil-catalog
  leniency for existence checks (as opposed to context-kind members, which
  are always checked).

Per the working agreement, these are deterministic plumbing tests over fake
`Store`/`Catalog` doubles — no intelligence is stubbed; nothing here judges
model output.

## Verification

```
go test ./core/capability/contexts/ -run 'Member|UnknownMember|WholeProjectMember'
go test ./core/capability/contexts/ ./core/wiring/ ./core/handlers/context/
go build ./...
```

All pass; zero-drift verified for all four changed companion docs
(`resolve.go.md`, `contexts.go.md`, `context_catalog.go.md`, `context.go.md`)
via `awk '/^```go$/{c=1;next}/^```$/{c=0}c' FILE.go.md | diff <(gofmt FILE.go) -`.

## Task 2: Acyclicity validation

The second invariant now holds: a `Create`/`Update` that would introduce a
cycle in the context→context reference graph is rejected before anything is
stored.

### `core/capability/contexts/contexts.go`

- **New sentinel:** `ErrCycle = errors.New("context membership would create a
  cycle")`, alongside the existing three.
- **New check, `wouldCycle`**, called from both `Create` and `Update` right
  after `validateMembersExist` (existence is checked first, so the cycle walk
  never has to reason about a member that does not exist):

  ```go
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

  The question `wouldCycle` answers is: would giving context `selfID` this
  membership let it reach itself? It walks the *stored* graph only (the
  candidate `members` being written are the starting points, not part of the
  graph yet), following each context-kind member's own stored
  includes/excludes outward, skipping `WholeProjectID` (a virtual member that
  names no row and so has no outgoing edges). A `store.ErrNotFound` mid-walk
  is not an error — same treatment `validateMembersExist` and `resolve.go`'s
  `expand` give a dangling context ref elsewhere in this file: it just means
  that branch has nowhere further to go. `visited` is a defensive guard, not
  the mechanism that makes a diamond safe — a diamond (two members that both
  nest a shared descendant) is fine precisely because `reaches` only fails on
  revisiting `selfID` itself, not on revisiting any other already-seen node;
  `visited` just keeps that revisit cheap.
- **`Create`** mints its id before the check instead of inline in the
  returned struct literal (`id := newID()`, then `ID: id` in the literal), so
  the same `id` is available to pass to `wouldCycle` — a freshly minted id
  can't already be part of a cycle (nothing references it yet), but calling
  the check uniformly for both `Create` and `Update` keeps the two write paths
  symmetric:

  ```go
  	id := newID()
  	if cyclic, err := c.wouldCycle(projectID, id, inc, exc); err != nil {
  		return Context{}, err
  	} else if cyclic {
  		return Context{}, ErrCycle
  	}
  ```
- **`Update`** runs the same check with the target `id` — the one id that can
  actually close a loop back on itself — right after existence validation and
  before any field on `rec` is overwritten, so a rejected update leaves the
  stored record untouched.

### `core/handlers/context/context.go`

- **`mapErr` maps the new sentinel to 400**, same shape as the other three:

  ```go
  case errors.Is(err, contextscap.ErrCycle):
  	return errResp(http.StatusBadRequest, "context membership would create a cycle")
  ```

### Test

`core/capability/contexts/contexts_test.go` gains three cases, TDD'd against
the failing build first (`ErrCycle` undefined) per the working agreement:

- `TestUpdateRejectsCycle` — `A` created bare, `B` created including `A`
  (valid), then updating `A` to include `B` closes `A→B→A` and is rejected
  with `ErrCycle`.
- `TestUpdateRejectsSelfReference` — updating `A` to include itself is
  rejected with `ErrCycle`.
- `TestCycleCheckAllowsDiamond` — `D` created bare, `B` and `C` each include
  `D`, and `A` includes both `B` and `C`; both paths reach the same `D`, but
  that is a diamond, not a cycle, and `Create` succeeds. Because
  `validateMembersExist` (Task 1) runs first, this test builds the fixture
  bottom-up through real `Create` calls so every referenced member already
  exists by the time it is referenced.

These remain deterministic plumbing tests over the fake `Store` double from
Task 1 — no intelligence is stubbed.

### Why this enables safe memoization next

With both invariants in force — every member exists, and no member can ever
close a loop back on its own context — the stored context→context graph is
now guaranteed to be a finite DAG: any walk starting from a context and
following its stored includes/excludes is guaranteed to terminate, and a
given descendant context is reached by however many paths the reference
lattice has to it (a diamond, or wider), never by walking back into a context
already on the current path. That guarantee is exactly what Task 3's planned
`Resolve` memoization needs to be *safe*: caching "this context id resolves to
this leaf set" within a single resolve call is only correct if a context's
resolved value cannot depend on itself, directly or transitively — which
acyclicity is precisely the property that rules out. Without this task, a
diamond-shaped reference lattice already makes naive resolution's fan-out
exponential in the depth of the lattice (each shared descendant gets walked
once per path that reaches it); memoizing per context id turns that into
linear time, because each context is resolved once no matter how many parents
reference it. Task 2 is what makes that memoization provably sound rather
than merely "probably fine."

### Verification

```
go test ./core/capability/contexts/ -run 'Cycle|SelfReference|Diamond'
go test ./core/capability/contexts/ ./core/handlers/context/
go build ./...
```

All pass; zero-drift verified for both changed companion docs
(`contexts.go.md`, `context.go.md`) via
`awk '/^```go$/{c=1;next}/^```$/{c=0}c' FILE.go.md | diff <(gofmt FILE.go) -`.

## Task 3: Memoized bounded resolution

With both write-time invariants in force, the third piece lands: `Resolve`
now memoizes each context's resolved leaf set within a single call, so a
diamond-shaped (or wider) reference lattice resolves in time linear in the
number of distinct contexts touched, instead of exponential in the depth of
the lattice.

### `core/capability/contexts/resolve.go`

- **`expand` gains a `memo map[string][]Ref` parameter**, allocated once per
  top-level `Resolve` call and threaded through every call site — the two
  top-level calls (`Includes`/`Excludes`) and both recursive calls inside
  `expand` all share the same `memo`:

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

  `Resolve`'s previous inline dedup loop is replaced with a direct call to
  `subtractRefs` — the same include-order, exclude-wins, dedup-by-`originKey`
  logic `expand` already used for each nested context, now applied uniformly
  at every level including the outermost. This is a pure refactor: the
  existing `Resolve` tests (flat include/exclude, nested exclude, exclude
  whole context, dangling ref, `ResolveID`) all still pass unchanged,
  confirming the inline loop and `subtractRefs` compute the same result.
- **`expand` checks `memo` before the store**, and caches on first
  computation — including the "dangling ref" and "cycle-cut" paths, so a
  repeated reference to the same missing or already-visited context id is
  also just a map read thereafter:

  ```go
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
  	// ...expand row.Includes/row.Excludes with the same memo, then:
  	resolved := subtractRefs(inc, exc)
  	memo[r.ID] = resolved
  	out = append(out, resolved...)
  ```

  `visited` is kept exactly as it was — a defensive, ancestor-path cycle
  breaker copied (never mutated) on each recursive call — even though Task 2
  now makes a genuine cycle unreachable in a correctly-written graph; belt
  and suspenders costs nothing here and protects against any future write
  path that might bypass `wouldCycle`. `whole-project` is deliberately *not*
  keyed in `memo`: it has no stable id per nested position, and
  `AllResources` is a single cheap call per occurrence. A context that itself
  includes `whole-project` is still memoized under its own id, so that call
  still runs at most once per such context within one `Resolve`.

### Why this is sound, not just fast

Memoizing "context id → resolved leaves" is only correct if a context's
resolved value can never depend on itself, directly or transitively — exactly
the property Task 2's acyclicity check now guarantees for every stored
context. Without that guarantee, caching would be unsound: a (rejected,
pre-Task-2) self-referential or mutually-referential context could compute a
different result depending on where in a recursive expansion the cache was
first populated. With acyclicity enforced at write time, a context's leaf set
is a pure function of the stored graph beneath it, so it is safe to compute
once per `Resolve` call and reuse everywhere that id is referenced.

### Test

`core/capability/contexts/resolve_test.go`:

- `countingStore` — a `Store` wrapper that counts `ContextByID` calls per id,
  TDD'd alongside the failing test to make the fan-out observable.
- `TestResolveMemoizesDiamondFanOut` — a 13-context chain (`C0..C12`) where
  each context includes the next one *twice*; naive expansion re-walks the
  remainder of the chain on every duplicate reference, so `ContextByID` calls
  grow as 2^depth (confirmed failing before the fix: `C1` alone was read
  twice, and the fan-out compounds down the chain). After memoization, every
  `C0..C12` is read exactly once while the resolved result — the single leaf
  `document/leaf` at the end of the chain — is unchanged.

All pre-existing `Resolve`/`ResolveID` tests (nesting, cycle-defensive,
exclude-inside-context, whole-project-minus-one, dangling ref, nested
exclude-collision) pass unmodified, confirming memoization changes only the
number of `ContextByID` calls, never the resolved output, its order, or the
exclude-wins/dedup semantics.

### Verification

```
go test ./core/capability/contexts/ -run TestResolveMemoizesDiamondFanOut
go test ./core/capability/contexts/
go build ./...
```

All pass; zero-drift verified for the changed companion doc (`resolve.go.md`)
via `awk '/^```go$/{c=1;next}/^```$/{c=0}c' resolve.go.md | diff <(gofmt resolve.go) -`.

With all three tasks landed, the context capability's write-time invariants
(member existence, acyclicity) and its read-time resolution (bounded,
memoized) are complete: `Resolve` is now guaranteed to terminate, to touch
each stored context at most once per call, and to produce the same
`Includes − Excludes` result it always has.
