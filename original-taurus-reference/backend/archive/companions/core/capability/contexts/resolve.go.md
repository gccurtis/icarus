# resolve.go

The set-algebra resolver: it turns a `Definition` (or a stored context looked
up by id) into a flat, deduplicated list of leaf `Ref`s — `Includes − Excludes`,
in include order. A context member nests another context's own definition and
recurses; `visited` carries the ancestor path of context ids above the current
call — copied, never mutated, on each recursion — so a cycle like `A → B → A`
is cut (a context on its own ancestor path is skipped) while a single row's
`Includes` and `Excludes` still expand independently of each other, which
matters because they feed a subtraction: if both sides shared one mutated map,
a context id visited while expanding `Includes` would already read as visited
when `Excludes` needed to expand that same id, silently dropping the exclusion.
The reserved `whole-project` id expands to every leaf resource in the project
via the injected `Catalog` port; and a dangling context reference (one that
names a row that no longer exists) simply contributes nothing rather than
erroring. Resolution is always computed live — nothing here is cached on the
stored record.

## Code breakdown

### Package declaration

```go
package contexts

import "errors"

```

Same package as `contexts.go`; this file only adds behavior over the types and
`Store` port already declared there (plus the `catalog` field that lives on
`Contexts` in `contexts.go`, since this file's `Catalog` type is what that
field's type forward-references). `errors` is used by `expand` to match the
store's `ErrNotFound` sentinel via `errors.Is`.

### Define the whole-project catalog port

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

`Catalog` is the one external port this file needs, now with two methods:
`AllResources` lists every leaf resource in a project for `whole-project`
expansion, and `Exists` reports whether one specific member (by kind and id)
is present — the primitive `contexts.go`'s `validateMembersExist` calls to
reject a non-context member that references nothing real. The doc comment
spells out what a nil catalog means for each: `AllResources` degrades to
"nothing" (unchanged from before), and with `Exists` unavailable,
`validateMembersExist` skips non-context existence checks entirely rather than
rejecting everything — a project that never wires a catalog keeps accepting
non-context members exactly as it did before this method existed. The
`AllResources` invariant is unchanged: it must never hand back context
resources, since `whole-project` means "all content," not "all content and all
organization of that content."

### Wire up the catalog

```go
// UseCatalog sets the whole-project source. A nil catalog (the default) makes
// whole-project resolve to nothing.
func (c *Contexts) UseCatalog(cat Catalog) { c.catalog = cat }

```

`UseCatalog` is the only setter for the `catalog` field on `Contexts`; `New`
leaves it `nil`, so a service that never calls `UseCatalog` resolves
`whole-project` to an empty set rather than panicking or erroring — the same
"absent dependency degrades gracefully" shape used elsewhere in the codebase.

### Define the connector-file expansion port

```go
// ConnectorFiles is the port contexts uses to expand a connector member to
// the file origins it currently syncs — so a connector behaves like a
// context (expand to leaves, then subtract), whether bound directly to a
// prompt variable or nested in a context. It is satisfied over the
// knowledge lattice at composition; a nil ConnectorFiles leaves a connector
// member unexpanded (a single origin), which keeps resolution working
// before the port is wired.
type ConnectorFiles interface {
	FilesUnder(projectID, connectorID string) ([]Ref, error)
}

// UseConnectorFiles sets the connector-file expander. A nil ConnectorFiles
// (the default) leaves connector members unexpanded.
func (c *Contexts) UseConnectorFiles(cf ConnectorFiles) { c.connectorFiles = cf }

```

`ConnectorFiles` mirrors `Catalog`'s shape — a single-method port satisfied by
a wiring-level adapter over the knowledge lattice — but it answers a narrower
question: given a connector's id, what file origins does it currently sync?
`UseConnectorFiles` is the setter, following the same "left `nil` by `New`,
degrades gracefully" pattern as `UseCatalog`: with no expander wired, a
connector member simply is not expanded, so a project that never wires this
port keeps resolving connector members exactly as it did before this port
existed (a single origin, not a set of leaves).

### Identify a leaf for dedup and subtraction

```go
// originKey identifies a leaf by kind+id for dedup/subtraction (Name is ignored).
type originKey struct{ kind, id string }

func keyOf(r Ref) originKey { return originKey{kind: r.Kind, id: r.ID} }

```

`originKey` is the comparable key every set operation in this file keys on:
`Kind` and `ID` only, never `Name`. This matches `Ref`'s own doc comment in
`contexts.go` that `Name` is a display label resolution never trusts — two
refs to the same resource with different `Name` values are still the same
member.

### Resolve a definition to its flat leaf set

```go
// Resolve flattens a definition to its leaf refs: expand Includes to a leaf set,
// expand Excludes to a leaf set, return Includes − Excludes deduped in include
// order (exclude wins). Nested contexts recurse (cycles cut by a visited-set),
// and whole-project expands via the Catalog. Always computed live.
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

`Resolve` is the entry point every caller (stored or anonymous) goes through.
It expands `Includes` and `Excludes` independently — each gets its own fresh
`visited` map, so a context can appear on both sides without one side's cycle
guard poisoning the other — then subtracts at the leaf level: exclusion is
computed after full expansion, so excluding a leaf that only lives inside a
nested context still removes it, and excluding a whole nested context removes
every leaf that context would have contributed. The subtraction itself is
`subtractRefs` — the same include-order, exclude-wins, dedup-by-`originKey`
logic used at every level of nesting, not a separate inline copy. Both calls
to `expand` share one `memo`, a single map allocated per `Resolve` call and
threaded through every recursive call below: a context id resolves to the
same leaf set no matter which side of which definition references it, so
caching by id — rather than by call site or by path — is what turns a
diamond-shaped reference lattice from exponential re-expansion into each
context being read and resolved exactly once. See `expand`'s doc comment for
why this is sound.

### Resolve a stored context by id

```go
// ResolveID resolves a stored context by id — equivalent to resolving an
// anonymous definition that includes just that context.
func (c *Contexts) ResolveID(projectID, id string) ([]Ref, error) {
	return c.Resolve(projectID, Definition{Includes: []Ref{{Kind: KindContext, ID: id}}})
}

```

`ResolveID` is what the `/resolved` endpoint calls: rather than duplicating
any logic, it builds the one-member anonymous definition `{includes: [this
context]}` and resolves that — a stored context's resolution is defined to be
identical to resolving an anonymous reference to it.

### Expand a ref list to leaf refs

```go
// expand flattens a ref list to leaf refs. A context member recurses into its
// stored definition (whole-project via the Catalog); a connector member
// expands to its current file origins via ConnectorFiles (or, with no
// ConnectorFiles wired, stays a single origin); any other kind is a leaf.
// visited holds the ancestor path of context ids above this call — never
// mutated, only copied on recursion — so cycles are cut when a context appears
// on its own ancestor path, while a nested definition's Includes and Excludes
// still expand independently of each other. memo caches a context id's fully
// resolved leaf set for the lifetime of one top-level Resolve call — shared
// across both the Includes and Excludes expansions and across every recursive
// call, so a context referenced from multiple places in the lattice is read
// from the store and expanded at most once. This is only sound because the
// stored context→context graph is write-time guaranteed acyclic (Task 2): a
// context's resolved value can never depend on itself, so caching it by id is
// always correct, not merely a same-path shortcut.
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
			// Copy the visited path and add this context, so the two sides of the
			// nested definition (row.Includes / row.Excludes) expand independently
			// — a context visited on one side must not suppress the other side, or
			// leaf-level exclusion silently fails at depth >= 2. Cycles are still
			// cut: a context on its own ancestor path is skipped.
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
		default:
			out = append(out, r)
		}
	}
	return out, nil
}

```

`expand` is the recursive heart of resolution, walking one ref list down to
leaves. Four cases: a `whole-project` member defers to the `Catalog` (or
contributes nothing if none is wired up); an ordinary context member first
checks `visited` — if this context id is already on the current ancestor path
it is skipped rather than recursed into, a defensive cut against a cycle like
`A → B → A` that write-time validation (Task 2) should already have made
unreachable — then checks `memo`, returning the cached leaves immediately on a
hit; a connector member defers to `ConnectorFiles` (or stays a single origin
if none is wired up, the same "absent dependency degrades gracefully" shape
`whole-project`'s `Catalog` case uses); and any other kind is already a leaf
and is appended as-is. For a context member that is neither a cycle nor
already cached, it loads the stored row (a missing row — matched with
`errors.Is(err, ErrNotFound)` — is treated as "contributes nothing," not an
error, matching the dangling-ref test, and that empty result is itself cached
in `memo` so a repeated dangling reference does not re-query the store),
builds `child`: a *copy* of `visited` with this context's own id added, and
recurses into that row's own `Includes` and `Excludes` using `child` for
both. The copy is the fix for the correctness bug the original
shared-and-mutated `visited` map had: if `Includes` and `Excludes` shared one
map and `Includes`'s expansion mutated it by marking a context id visited,
`Excludes`'s expansion of that same id would then read as already-visited and
silently contribute nothing — quietly breaking `Includes − Excludes` (e.g. a
row that includes context `X` and also excludes context `X` must resolve to
the empty set, not to all of `X`'s leaves). Copying `visited` per recursive
call keeps the two sides of a row's definition independent while still
cutting genuine cycles, since each side still inherits — and cannot escape —
the full ancestor path above it. Once both sides are expanded, `subtractRefs`
folds them into this context's resolved leaves, which are cached in `memo`
under `r.ID` *before* being folded into `out` — so the very next reference to
this same context id anywhere else in the current `Resolve` call, at any
depth, is a map read instead of a fresh store round-trip and re-expansion.
`memo` is not keyed by `whole-project`: it has no stable id per nested
position, and `AllResources` is one cheap call per occurrence; a context that
itself *includes* `whole-project` is still memoized under its own id, so that
call still runs at most once per such context within the resolve.

The connector case is placed before `default` and after the context case, and
is unmemoized: unlike a stored context, a connector's file listing is cheap
(no recursion, no nested definition to walk), and if a connector appears
under multiple memoized contexts, each such context is itself memoized, so
`FilesUnder` still runs at most once per referencing context. One subtlety
worth naming: a connector's expanded file origins carry the *same* `Kind`
(`KindConnector`) as the connector itself — the file-source-id convention
(`connectorID` + a separator + relative path, applied by the wiring adapter,
never by this package) distinguishes a root from a leaf only in the `ID`
string, not the `Kind`. That means an `Excludes` entry naming one synced file
directly — `{KindConnector, "X<sep>a"}` — flows through this very same
`case r.Kind == KindConnector` branch, calling `FilesUnder(projectID,
"X<sep>a")` exactly as it would for a genuine connector root. For leaf-level
exclusion of one file inside a connector to work, the wired `ConnectorFiles`
must answer that query by resolving back to the file itself when the id names
no children — see `context_connector.go.md` in `core/wiring` for how the
production adapter does this over the knowledge lattice.

### Report whether a context transitively references an origin

```go
// References reports whether context contextID has (kind,id) as a member,
// directly or transitively through nested contexts (over both Includes and
// Excludes — a prompt that excludes a context still depends on that context's
// membership). whole-project is NOT treated as referencing a specific origin
// (it would make every prompt depend on every change). Cycle/visited-guarded;
// a missing context contributes nothing.
func (c *Contexts) References(projectID, contextID, kind, id string) (bool, error) {
	visited := map[string]bool{}
	var walk func(ctxID string) (bool, error)
	walk = func(ctxID string) (bool, error) {
		if visited[ctxID] {
			return false, nil
		}
		visited[ctxID] = true
		row, err := c.store.ContextByID(projectID, ctxID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return false, nil
			}
			return false, err
		}
		for _, list := range [][]Ref{row.Includes, row.Excludes} {
			for _, r := range list {
				if r.Kind == kind && r.ID == id {
					return true, nil
				}
				if r.Kind == KindContext && r.ID != WholeProjectID {
					ok, err := walk(r.ID)
					if err != nil {
						return false, err
					}
					if ok {
						return true, nil
					}
				}
			}
		}
		return false, nil
	}
	return walk(contextID)
}

```

`References` answers a different question than `Resolve`/`expand`: not "what
are this definition's leaves" but "does this one stored context's membership
reach a specific `(kind, id)`, anywhere in its nested graph." This is the seam
the document capability's deep cascade needs: a prompt block scoped to context
`C` (not directly to a connector or document) still depends on any resource
`C` contains, however deeply nested. The walk mirrors `wouldCycle` in
`contexts.go` in shape — a `visited` set of context ids guards against a cycle
in the stored graph, and a missing context (`ErrNotFound`) simply contributes
nothing rather than erroring, the same "dangling reference resolves to
nothing" behavior `expand` uses. It differs from `wouldCycle` in what it walks
for: `wouldCycle` asks "can this id reach `selfID`" to reject a cyclic write;
`References` asks "does this id's membership contain `(kind, id)`" to answer a
read-time query, and it checks both `Includes` and `Excludes` — a context that
*excludes* a resource still depends on that resource's identity (edit the
excluded resource and the context's resolved value changes), so a block
scoped to that context must still be treated as a dependent. Recursion is
restricted to context-kind members other than `whole-project`: `whole-project`
deliberately does *not* count as referencing an arbitrary origin — if it did,
every prompt scoped to `whole-project` (or to any context that itself includes
`whole-project`) would be reported as depending on every resource in the
project, and every resource change would refresh every such prompt, which is
the over-triggering the design brief explicitly calls out to avoid. A
non-context member is checked for an exact `(kind, id)` match but never
recursed into (a connector or document member has no further membership of
its own to walk). The walk returns `true` on the first match found, at any
depth, short-circuiting the rest of the search.

### Subtract one leaf set from another

```go
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

`subtractRefs` is the same include-order, exclude-wins, dedup-by-`originKey`
logic used at every level of nesting: `Resolve` calls it directly for the
outermost `Includes − Excludes`, and `expand` calls it for each nested
context's own `Includes`/`Excludes` pair before caching that context's
resolved leaves in `memo`. One function, one call site's worth of logic,
applied uniformly at every depth.
