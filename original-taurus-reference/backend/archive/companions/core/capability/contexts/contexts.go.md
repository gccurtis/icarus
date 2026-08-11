# contexts.go

The contexts capability: a project-scoped, named set of resource references. A
context is a definition value (`{includes, excludes}`); the same value resolves
whether it is stored (named) or anonymous (built per refresh and never
persisted). This file holds the domain (`Ref`, `Definition`, `Context`,
`Actor`, errors), the `Store` port, and the `Contexts` service
(create/get/list/update/delete). The store is deliberately dumb — it only
holds the refs the user typed; resolution down to concrete leaf resources is a
later slice (see `resolve.go`), always computed live rather than cached on the
record. The package is named `contexts`, not `context`, to avoid colliding
with the standard library package of that name. See repo conventions
(AGENTS.md).

## Code breakdown

### Package declaration and imports

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

```

The package name is `contexts` (plural), which is the deliberate choice
flagged in the task: `context` alone would collide with the standard library's
`context` package. `maxName` bounds the display name the same way the
connector capability bounds its own name.

### Name the context kind and the whole-project sentinel

```go
// KindContext is the resource kind of a context, both as a member's kind (a
// member of this kind nests another context) and as the wire kind a document
// variable binds to. KindConnector is the resource kind of a connector member
// — contexts refers to it by this string alone and never imports the
// connector capability. WholeProjectID is the reserved virtual context id
// that resolves to every leaf resource in the project.
const (
	KindContext    = "context"
	KindConnector  = "connector"
	WholeProjectID = "whole-project"
)

```

`KindContext` gives a context an identity in the same vocabulary as any other
resource kind, so a context can nest inside another context's membership and a
document variable can bind to one. `KindConnector` names the connector kind
the same way, without an import: `resolve.go`'s `expand` switches on this
string to recognize a connector member and expand it to its current file
origins (see `resolve.go.md`), so `contexts` stays decoupled from the
`connector` capability while still knowing what a connector member looks like
on the wire — the same "own the string, not the dependency" shape
`KindContext` already established. `WholeProjectID` reserves an id that never
names a stored row — it is the virtual context that expands to everything in
the project, resolved rather than persisted.

### Define the store and service error sentinels

```go
var (
	ErrNotFound      = errors.New("context not found")
	ErrInvalidName   = errors.New("context name must not be empty")
	ErrUnknownMember = errors.New("context member does not exist")
	ErrCycle         = errors.New("context membership would create a cycle")
)

```

Four sentinels cover the whole surface: a missing row, a name that fails
validation, a member ref that names something that does not exist, and — new
in this task — membership that would close a cycle in the context→context
reference graph. All four are asserted directly with `==`/`errors.Is` in the
tests.

### Represent a resource reference

```go
// Ref names a resource by its catalog identity. Name is an optional display
// label only — resolution uses Kind+ID and never trusts Name, which may go stale.
type Ref struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

```

`Ref` is the atom of membership: a `(Kind, ID)` pair that identifies one
resource in the catalog, plus an optional `Name` carried purely for display.
The doc comment is explicit that `Name` is never trusted by resolution — it is
a label snapshot that can drift once the referenced resource is renamed.

### Represent a context's definition value

```go
// Definition is a context value: the sets built up (Includes) and removed
// (Excludes). Stored contexts persist a definition plus a name; anonymous
// contexts are a bare definition passed straight to Resolve.
type Definition struct {
	Includes []Ref
	Excludes []Ref
}

```

`Definition` is the shape shared by stored and anonymous contexts alike: two
`Ref` sets, what is included and what is excluded. Separating this from
`Context` lets an anonymous, never-persisted definition flow through the same
resolution path as a named one.

### Represent a stored context record

```go
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

```

`Context` is the persisted row: a `Definition`'s two ref sets plus the
project scoping, identity, display name, creator, and timestamps every stored
capability record carries.

### Project a context onto its definition

```go
// Definition projects the stored membership as a resolvable value.
func (c Context) Definition() Definition {
	return Definition{Includes: c.Includes, Excludes: c.Excludes}
}

```

This method is the bridge between the two types: it strips a stored
`Context` down to the bare `Definition` that resolution actually consumes,
so a named context and an anonymous one resolve through identical logic.

### Represent trusted request identity

```go
// Actor is trusted request identity.
type Actor struct {
	ID   string
	Name string
}

```

`Actor` matches the shape used across the other capabilities (e.g.
`connector.Actor`): the caller's identity is trusted input by the time it
reaches this service, not re-authenticated here.

### Define the context store port

```go
// Store persists context records within a project.
type Store interface {
	InsertContext(c Context) error
	ContextByID(projectID, id string) (Context, error)
	ContextSummaries(projectID string) ([]Context, error)
	UpdateContext(c Context) error
	DeleteContext(projectID, id string) error
}

```

`Store` is the persistence port the service is built against, mirroring the
`Insert/ByID/Summaries/Update/Delete` shape used by `connector.Store`. Every
lookup is scoped by `projectID`, so a store implementation enforces project
isolation itself rather than trusting the caller to filter afterward.

### Construct the context service

```go
// Contexts is the context service over an injected Store.
type Contexts struct {
	store          Store
	catalog        Catalog
	connectorFiles ConnectorFiles
	now            func() time.Time
}

// New constructs the service.
func New(store Store) *Contexts { return &Contexts{store: store, now: time.Now} }

```

`Contexts` holds the injected `Store`, a `catalog` (the `Catalog` port
`resolve.go` defines, set via `UseCatalog` and left `nil` by `New` — a `nil`
catalog is the documented "whole-project resolves to nothing" default), a
`connectorFiles` (the `ConnectorFiles` port `resolve.go` defines, set via
`UseConnectorFiles` and likewise left `nil` by `New` — a `nil` port leaves a
connector member unexpanded rather than resolving to nothing, since it is
still a single valid origin on its own), and a `now` clock function, defaulted
to `time.Now` in `New` and overridable in tests for deterministic timestamps.

### Create a context

```go
// Create makes a new context with the given membership.
func (c *Contexts) Create(projectID string, a Actor, name string, includes, excludes []Ref) (Context, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > maxName {
		return Context{}, ErrInvalidName
	}
	inc, exc := normalizeRefs(includes), normalizeRefs(excludes)
	if err := c.validateMembersExist(projectID, inc, exc); err != nil {
		return Context{}, err
	}
	id := newID()
	if cyclic, err := c.wouldCycle(projectID, id, inc, exc); err != nil {
		return Context{}, err
	} else if cyclic {
		return Context{}, ErrCycle
	}
	at := c.clock()
	rec := Context{
		ID: id, ProjectID: projectID, Name: name, CreatorID: a.ID,
		Includes: inc, Excludes: exc,
		CreatedAt: at, UpdatedAt: at,
	}
	if err := c.store.InsertContext(rec); err != nil {
		return Context{}, err
	}
	return rec, nil
}

```

`Create` validates and trims the name, normalizes both ref sets once into
`inc`/`exc` — reused both for the existence check and the stored record, so
normalization only happens once — then validates every member actually exists
via `validateMembersExist` before stamping a fresh id and timestamps. The id is
minted before the cycle check — not because a brand-new id could possibly be
part of an existing cycle (it can't; nothing yet references it) but so
`wouldCycle` is called the same way `Create` and `Update` both call it,
uniform and cheap. Both validation steps happen before the store is touched,
so a rejected create never leaves a partial side effect.

### Get a context

```go
// Get returns one context scoped to its project.
func (c *Contexts) Get(projectID, id string) (Context, error) {
	return c.store.ContextByID(projectID, id)
}

```

`Get` is a thin, project-scoped pass-through to the store; `ErrNotFound`
propagates straight from the store implementation.

### List a project's contexts

```go
// List returns a project's contexts (unordered).
func (c *Contexts) List(projectID string) ([]Context, error) {
	return c.store.ContextSummaries(projectID)
}

```

`List` likewise passes straight through to `ContextSummaries`; the doc
comment is explicit that ordering is not guaranteed here, matching
`connector.Connectors.Summaries`.

### Update a context's name and membership

```go
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
	inc, exc := normalizeRefs(includes), normalizeRefs(excludes)
	if err := c.validateMembersExist(projectID, inc, exc); err != nil {
		return Context{}, err
	}
	if cyclic, err := c.wouldCycle(projectID, id, inc, exc); err != nil {
		return Context{}, err
	} else if cyclic {
		return Context{}, ErrCycle
	}
	rec.Name = name
	rec.Includes = inc
	rec.Excludes = exc
	rec.UpdatedAt = c.clock()
	if err := c.store.UpdateContext(rec); err != nil {
		return Context{}, err
	}
	return rec, nil
}

```

`Update` is a full, set-style replacement: it validates the name the same
way `Create` does, loads the existing record (so a missing context surfaces
`ErrNotFound` rather than silently upserting), normalizes both ref sets once
into `inc`/`exc` and validates their members exist the same way `Create`
does, then — new in this task — checks membership against `wouldCycle` using
the target `id` (unlike `Create`, which mints a fresh id first, `Update`
already has one: the id being modified), then overwrites the name and both
ref sets and re-stamps `UpdatedAt`. A `nil` slice for either side clears that
set, as the test's `Update` call (passing `nil` includes) exercises.

### Delete a context

```go
// Delete removes a context.
func (c *Contexts) Delete(projectID, id string) error { return c.store.DeleteContext(projectID, id) }

```

`Delete` is a direct pass-through; the store's own `ErrNotFound` covers the
already-deleted case.

### Validate that every member references something real

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

`validateMembersExist` is the write-time gate `Create` and `Update` both call
before touching the store: given any number of ref lists (both call it with
`inc` and `exc` together, via variadic `refs ...[]Ref`), it walks every member
and classifies it by kind. A context-kind member is special-cased twice: the
reserved `WholeProjectID` is always valid (it is a virtual member, never a
stored row, so there is nothing to look up), and any other context id must
resolve through `c.store.ContextByID` — a `store.ErrNotFound` there is
translated to this package's own `ErrUnknownMember`, while any other store
error propagates unchanged so a transient storage failure is never
misreported as "the member doesn't exist." A non-context member is checked
against `c.catalog.Exists` instead — but only when a catalog is actually
wired; `c.catalog == nil` skips the check entirely, keeping the documented
"nil catalog degrades gracefully" behavior for existence checks too, matching
what `resolve.go`'s `Catalog` doc comment now says. This deliberately mirrors
`expand` in `resolve.go`: both dispatch on `r.Kind == KindContext` first and
treat `whole-project` and every other context id differently, but where
`expand` treats a dangling context ref as "contributes nothing" (a read-time
concern — resolution must never fail because of stale data), this function
treats the same dangling ref as an error at write time — the two behaviors are
consistent with the surrounding invariant that write time is where correctness
is enforced, and read time is where already-validated data is resolved
permissively.

### Check the graph for a would-be cycle

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

`wouldCycle` is the second write-time gate `Create` and `Update` both call,
right after `validateMembersExist` (existence is checked first, so a cycle
check never walks a member that does not exist). Its question is: would
adding `members` to `selfID`'s definition let `selfID` reach itself? It
answers that with a depth-first `reaches` closure over the *stored* graph
only — `members` (the candidate `inc`/`exc` being written) is not part of
that graph yet, so it is walked once up front, outside `reaches`, as the set
of starting points. From each starting context-kind member (skipping
`WholeProjectID`, which names no row and so can never reach anything),
`reaches` follows that context's own stored `Includes`/`Excludes` looking for
`selfID`; a `store.ErrNotFound` mid-walk is not an error here — a member that
does not exist has no outgoing edges, so the walk simply reports it can't
reach anywhere further, mirroring how `validateMembersExist` and `expand` in
`resolve.go` both treat a dangling context ref as inert rather than fatal.
The `visited` set exists purely as a defensive guard against corrupt stored
data (a cycle already on disk, from before this invariant existed, or written
around it); as the doc comment notes, this very check is what keeps the
stored graph acyclic going forward, so in the steady state the walk would
terminate anyway. `Create` calls this with its freshly minted id — which
cannot already be part of any cycle, since nothing yet references it — purely
so both entry points share one code path; `Update` calls it with the id being
modified, which is the only id that can actually close a loop back on itself.
This is also why a diamond (two different members both nesting a shared
descendant) is allowed: `reaches` only fails to terminate on `selfID` itself,
never on merely revisiting a context reachable by more than one path — the
`visited` guard makes revisits cheap, not forbidden.

### Normalize reference sets

```go
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

```

`normalizeRefs` is the one piece of input hygiene applied to membership: every
field is trimmed, and any ref left with a blank `Kind` or `ID` after trimming
is dropped rather than stored as junk. `Name` is trimmed but never required —
consistent with `Ref`'s doc comment that it is display-only.

### Support the clock and id generation

```go
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

`clock` normalizes every stamped time to UTC regardless of what the injected
`now` function returns (or falls back to `time.Now` directly if `now` is
somehow nil). `newID` mints a random 128-bit hex identifier, the same scheme
`connector.newID` uses, giving each context a collision-resistant id without
depending on the store for id assignment.
