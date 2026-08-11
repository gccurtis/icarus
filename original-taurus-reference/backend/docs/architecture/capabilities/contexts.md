# CONTEXTS — named, nestable sets of resource references

CONTEXTS owns **named sets of resource references that resolve live to the
concrete resources they stand for**. "Q3 planning" might mean three documents,
one connector, and another context minus one document from it — and it should
keep meaning that as those resources change. So a context stores only the
references the user typed, and computes the flattened answer on demand.

That live-resolution property is the whole point. A [prompt block](documents/prompt-blocks.md)
bound to a context sees the context's *current* membership every time it
resolves; nothing is baked in at authoring time. The same `Definition` value
works stored or anonymous — a named context persists one, and a prompt block
hands one in per resolve without ever persisting it.

- **Domain** —
  [`core/capability/contexts/contexts.go`](../../../core/capability/contexts/contexts.go)
  (value types, `Store`, CRUD and the write-time invariants) and
  [`resolve.go`](../../../core/capability/contexts/resolve.go) (the two ports and
  the resolution algorithm). In-memory `Store` in
  [`memory.go`](../../../core/capability/contexts/memory.go).
- **Application handlers** —
  [`core/handlers/context/context.go`](../../../core/handlers/context/context.go).

## The model

```go
type Ref struct {                  // a resource by catalog identity
	Kind string                    // "document", "connector", "context", …
	ID   string
	Name string                    // display label only; resolution never trusts it
}

type Definition struct {           // a context *value*
	Includes []Ref
	Excludes []Ref
}

type Context struct {              // a stored, named definition
	ID, ProjectID, Name, CreatorID string
	Includes, Excludes             []Ref
	CreatedAt, UpdatedAt           time.Time
}
```

`Kind` is a bare string on purpose. CONTEXTS knows the literals `"context"` and
`"connector"` and nothing else — it imports neither the
[resource](resources/README.md) nor the [connector](connector.md) capability.
**The store is deliberately dumb**: it holds refs and only refs, with no
resolved-content column, no cache, no denormalized leaf set. `Resolve` runs
against the store on every call.

## Resolution

`Resolve(projectID, def)` expands `Includes` to a leaf set, expands `Excludes`
to a leaf set, and returns `Includes − Excludes`, deduped, in include order.

The order matters: subtraction happens **at the leaf level, after full
expansion**. Excluding one document from a nested context that includes it works,
and so does excluding one file from inside a connector — because by the time
`subtractRefs` runs, both sides are flat lists of concrete leaves.

`expand` has four cases:

- **`kind=context`, id `whole-project`** — the reserved virtual id. Expands via
  the `Catalog` port to every leaf resource in the project. With no catalog
  wired it resolves to nothing.
- **`kind=context`** — recurse into the stored definition, then subtract that
  child's own excludes before returning it. The `visited` ancestor-path set is
  **copied**, never mutated, on each recursion: a context seen on one side of a
  parent's definition must not suppress the other side, or leaf-level exclusion
  silently fails at depth ≥ 2. A context on its own ancestor path is skipped
  (defensive — the stored graph is already acyclic).
- **`kind=connector`** — expand to the connector's current files via the
  `ConnectorFiles` port. With no expander wired the connector stays a single
  unexpanded origin, which keeps resolution working before the port is wired.
- **anything else** — a leaf; passed through.

A `memo` caches each context id's fully resolved leaf set for the lifetime of one
top-level `Resolve`, shared across the Includes and Excludes expansions and every
recursive call. That is sound *only* because the stored graph is write-time
acyclic: a context's value can never depend on itself, so caching by id is
correct rather than a same-path shortcut. A dangling ref caches as nil.

`References(projectID, contextID, kind, id)` is the reverse query: does this
context reach that origin, directly or through nesting, over both Includes *and*
Excludes (a prompt that excludes a context still depends on that context's
membership). `whole-project` is explicitly **not** treated as referencing any
specific origin — it would make every prompt depend on every change.

## Write-time invariants

Both `Create` and `Update` enforce two things before storing, after normalizing
refs (trim; drop any with a blank kind or id):

- **Member existence** — a `kind=context` member other than `whole-project` must
  be a stored context; any other kind must exist in the catalog. Otherwise
  `ErrUnknownMember` → **HTTP 400**.
- **Acyclicity** — `wouldCycle` walks the stored context graph from each
  context-kind member and fails if any of them can already reach the context
  being written. Otherwise `ErrCycle` → **HTTP 400**.

Keeping the graph acyclic on write is what lets resolution memoize and what
guarantees the recursion terminates.

## Ports and who satisfies them

| Port | Satisfied by (in `core/wiring`) |
|---|---|
| `Store` | the one `*sqlite.Store`; `MemoryStore` for tests |
| `Catalog` | `resourceCatalog` over `*resource.Resources` — pages the unified catalog at 200/page, skipping context resources themselves (organization, not content) |
| `ConnectorFiles` | `connectorFilesCatalog` over `*knowledge.Knowledge` — lists lattice sources under the connector's file-source-id prefix |

Both behaviour ports are injected post-construction (`UseCatalog`,
`UseConnectorFiles`) and both are nil-safe. `connectorFilesCatalog` is where the
`"\x1f"` [connector](connector.md) `FileSeparator` convention is applied — never
in this capability. It also falls back to an exact match when an id names no
children, which is what makes excluding one already-synced file work the same way
excluding any other leaf does.

Downstream, wiring's `documentScopeResolver` and `documentScopeReferences` adapt
this service to the document capability's `ScopeResolver` / `ScopeReferences`
ports, so a prompt block's include/exclude origins are just an anonymous
`Definition`. Neither capability imports the other.

## HTTP surface

All routes are project-scoped and register only when a contexts service is wired.

| Method & path | Handler | Purpose |
|---|---|---|
| `POST /contexts` | `Create` | Create a named context. Body `{name, includes[], excludes[]}`. → `201`. |
| `GET /contexts` | `List` | The project's contexts (unordered). |
| `GET /contexts/:contextID` | `Get` | One context's stored membership. |
| `GET /contexts/:contextID/resolved` | `Resolved` | The flattened leaf set: `{origins:[…]}`. |
| `PATCH /contexts/:contextID` | `Update` | Replace name and membership (set-style). |
| `DELETE /contexts/:contextID` | `Delete` | Remove the context. |

Errors: `ErrNotFound` → `404`; `ErrInvalidName`, `ErrUnknownMember`, `ErrCycle` → `400`.

## Persistence

One table in the one SQLite [store](../persistence.md): `contexts`, primary key
`(project_id, id)`, with `includes_json` / `excludes_json` holding the ref lists.
No resolved state is ever written.

## Related

- [Documents · prompt blocks](documents/prompt-blocks.md) — the main consumer.
- [Resources](resources/README.md) — supplies whole-project expansion and existence checks.
- [Connector](connector.md) — a connector member expands to its synced files.
