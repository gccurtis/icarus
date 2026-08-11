# Context endpoints: `/contexts` HTTP surface (`core/handlers/context`)

Adds the HTTP transport surface over the `core/capability/contexts` service
(record 0103): a project-scoped `context` resource can now be created, listed,
read, resolved, updated, and deleted over HTTP, mirroring the pattern already
established for connectors (`core/handlers/connector`).

## Route surface

Registered on the project-scoped group only when `Options.Contexts` is set
(the same nil-means-unregistered convention as `Connectors`, `References`,
etc.):

| Method | Path                        | Handler    | Behavior |
|--------|-----------------------------|------------|----------|
| POST   | `/contexts`                 | `Create`   | Creates a context from `{name, includes, excludes}`. 201 with the created context, or 400 on a blank/oversized name. |
| GET    | `/contexts`                 | `List`     | Lists the project's contexts (unordered), 200 with an array. |
| GET    | `/contexts/:contextID`      | `Get`      | Reads one context by id, 200, or 404 if absent/wrong project. |
| GET    | `/contexts/:contextID/resolved` | `Resolved` | Flattens the stored definition to its leaf refs via `Contexts.ResolveID`, 200 with `{"origins": [...]}`. 404s if the requested context itself doesn't exist (member-level dangling refs inside a real context's definition still resolve to nothing, per `resolve.go`, unchanged). |
| PATCH  | `/contexts/:contextID`      | `Update`   | Replaces `{name, includes, excludes}` wholesale, 200 with the updated context. |
| DELETE | `/contexts/:contextID`      | `Delete`   | Deletes the context, 200 with `{"deleted": true}`. |

All six routes require a signed-in user with a selected project (the
`access.ScopedHandler` shape, `ctx.Project.ID` scoping every call into the
service). Errors map to HTTP status the same way connector handlers do:
`contexts.ErrNotFound` → 404, `contexts.ErrInvalidName` → 400, anything else →
500, each as `{"error": "..."}`.

## Replace-style PATCH

`Update` takes the full `{name, includes, excludes}` triple and replaces the
context's membership outright — there is no partial-patch verb for adding or
removing a single ref. This matches `Contexts.Update` in the capability layer
(record 0103), which itself normalizes and overwrites both ref sets rather
than diffing against the stored row. A client wanting to add one include
must currently read the context, splice the new ref into the client-side
list, and PATCH the whole set back. Finer-grained mutation (e.g.
`POST /contexts/:id/includes`) is left for a future task if usage shows it is
needed; the definition-value model this capability is built on (a `Context`
*is* `{includes, excludes}`, nothing more) makes wholesale replacement the
natural, simplest verb to start with.

## Wire shape

`refJSON{kind, id, name}` mirrors `contexts.Ref` field-for-field (`name` is
`omitempty` since it is a display label only, never trusted by resolution).
`contextJSON` adds `kind: "context"` (from `contextscap.KindContext`) so a
context reads the same shape as any other resource-catalog member, plus
RFC3339Nano-formatted `createdAt`/`updatedAt`. `Resolved` does not reuse
`contextJSON` — its body is `{"origins": [refJSON, ...]}`, a flat leaf list,
not a context.

## New in-memory `Store` for tests

`core/capability/contexts/memory.go` adds `MemoryStore`/`NewMemoryStore()`,
the same house shape as `connector.MemoryStore`
(`core/capability/connector/memory.go`): a mutex-guarded map keyed by
`projectID + "\x00" + id`, `ErrNotFound` on a missing key from
`ContextByID`/`UpdateContext`/`DeleteContext`, and project-scoped filtering in
`ContextSummaries`. It additionally deep-copies `Includes`/`Excludes` on every
read and write (`cloneRefs`/`cloneContext`) — `*sqlite.Store` gets this for
free because it round-trips refs through `json.Marshal`/`Unmarshal` on every
call, so a memory store must copy explicitly to match that guarantee (a
caller can't mutate a returned context's ref slice and corrupt what's stored,
or vice versa).

The transport test server (`newTestServerWithStore` in
`core/transport/transport_test.go`) now wires `contexts.New(contexts.NewMemoryStore())`
into `Options.Contexts`. No `Catalog` is attached, so `whole-project` resolves
to nothing in these tests — `TestContextRoutes` only exercises leaf-document
members, which pass through resolution unchanged, so this is not exercised
and not needed yet.

## Verification

- `TestContextRoutes` (`core/transport/transport_test.go`): create with one
  leaf include → 201; list → 200; get → 200; resolved → 200 with the leaf
  passed through; update replacing membership (empty includes, one exclude) →
  200; delete → 200. Confirmed failing first (routes returning 404 with the
  registration block temporarily disabled) before implementing the handlers
  and route registration, then passing.
- `go test ./core/transport/ ./core/capability/contexts/` — all pass,
  including the full pre-existing transport suite and the contexts service's
  own resolve/CRUD tests.
- `go build ./...` passes across the module.

## Out of scope

- Partial-patch verbs for single-ref add/remove (see "Replace-style PATCH"
  above).
- Wiring a real `Catalog` (whole-project resolution) into the transport
  composition layer — no capability yet supplies `Options.Contexts` outside
  tests, and the resource-family registration for `KindContext` remains
  future work per record 0103.
