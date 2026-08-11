# 0025 — Name manager: transport routes, wiring, and dev-test (pass 2 of 2)

This is Increment 4 of the formula design, pass 2: it makes the name manager
reachable over HTTP. Pass 1 ([record 0024](0024-name-manager-storage-and-handlers.md))
landed the SQLite-backed `names.NameStore` and the `core/handlers/name`
handler package but deliberately deferred route registration and composition
to this pass — nothing called either until now.

Three pieces, landed together: route registration in `transport.go`, manager
construction and wiring in `wiring.go`, and a live `dev-test/names/` suite that
exercises the whole surface end to end.

## `core/transport/transport.go`

### `Options.Names` and the nine name-manager routes

```go
// Names backs the /projects/:projectID/names/* and
// /projects/:projectID/evaluate routes. When nil, those routes are not
// registered.
Names *names.Manager
```

```go
if opts.Names != nil {
	nameHandlers := nameapp.NewHandlers(opts.Access, opts.Names)
	gated.GET("/projects/:projectID/names", s.adaptScoped(nameHandlers.List))
	gated.GET("/projects/:projectID/names/:name", s.adaptScoped(nameHandlers.Get))
	gated.DELETE("/projects/:projectID/names/:name", s.adaptScoped(nameHandlers.Delete))
	gated.PUT("/projects/:projectID/names/:name/value", s.adaptScoped(nameHandlers.SetValue))
	gated.PUT("/projects/:projectID/names/:name/table", s.adaptScoped(nameHandlers.SetTable))
	gated.PUT("/projects/:projectID/names/:name/function", s.adaptScoped(nameHandlers.SetFunction))
	gated.POST("/projects/:projectID/names/:name/columns", s.adaptScoped(nameHandlers.AddColumn))
	gated.POST("/projects/:projectID/names/:name/rows", s.adaptScoped(nameHandlers.AppendRows))
	gated.POST("/projects/:projectID/evaluate", s.adaptScoped(nameHandlers.Evaluate))
}
```

**What / goal / why:** the name-manager routes are registered on the **gated**
group (`s.requireUser`), not the **project-scoped** group (`s.requireProject`)
that document routes use — deliberately, matching what `core/handlers/name`'s
package doc already says: every handler authorizes against the `:projectID`
path parameter directly (via `access.MembershipRole`), not the session's
*selected* project, since a caller may act on a project's names without that
project being their current selection. Following the existing
`opts.Intelligence`/`opts.Knowledge` pattern, the whole block is conditional on
`opts.Names != nil`, so a composition that supplies no manager simply omits
the routes — nothing to configure, nothing to break. The capability package
`core/capability/formula/names` is imported unaliased (its `*names.Manager`
is what `Options.Names` is typed as); the handler package `core/handlers/name`
is imported as `nameapp`, matching the file's existing `xxxapp` alias
convention (`documentapp`, `knowledgeapp`, `intelligenceapp`, ...). The local
variable holding the constructed handlers is `nameHandlers`, not `names`, to
avoid shadowing the bare `names` package import within `New`.

## `core/wiring/wiring.go`

### Constructing the name manager

```go
// Names: the formula name-manager's per-project namespace, over the same
// durable store and the pure formula evaluator.
nameManager := names.New(store, formula.NewService())
```

```go
e := transport.New(transport.Options{
	Access:       acc,
	Documents:    docs,
	Enqueuer:     queue,
	Jobs:         store,
	Intelligence: intel,
	Knowledge:    know,
	Names:        nameManager,
	LogRequests:  cfg.Logging.Requests,
})
```

**What / goal / why:** `names.New` takes the same `*sqlite.Store` every other
resource is built over (it already implements `names.NameStore` per pass 1)
and a fresh `formula.NewService()` for the evaluation limits and parser — no
new configuration surface, since the name manager has none yet. It is
constructed just before the job registry, alongside the other capability
services, and passed straight into `transport.Options.Names`, the one new
field this pass adds to the composition call. No other part of `Run`'s
lifecycle (shutdown, job pool, TLS) changes: the name manager holds no
background work and no goroutines of its own.

## `dev-test/names/run.sh` (new suite)

**What / goal / why:** a live, end-to-end walkthrough of the whole HTTP
surface against the real server (no OpenRouter key needed — the name manager
is pure, so this suite always runs and is picked up automatically by
`dev-test/run.sh`'s `*/run.sh` glob). It signs in, creates a project, then in
sequence: sets a scalar (`PUT .../price/value`) and evaluates an expression
reading it (`price * 2` → `84`); sets a table (`PUT .../items/table`) and
evaluates `SUM(items.qty)` over one of its columns; appends a row (`POST
.../items/rows`) and re-evaluates the sum; adds a column (`POST
.../items/columns`) and confirms the existing rows read back `null` in it; sets
a function (`PUT .../double/function`) and evaluates a call to it
(`double(21)` → `42`); gets one name and lists the whole namespace; deletes a
name and confirms a subsequent `GET` is `404`. Two negative cases close it
out: setting a value under a reserved name (`SUM`) is `400`, and a project
member added at the `read` role can `GET` a name but is refused `403` when it
attempts a `PUT`, exercising `authorizeWrite`'s read/write split. Every
`formula.Value` in a request or response body is built and asserted against
the canonical wire shape
(`{"kind":"number","shape":{"fields":1,"rows":1},"number":"42"}`) that
`formula.Value.MarshalJSON`/`UnmarshalJSON` define.

## Dependency direction, unchanged

`names` and `formula` gained no new import from this pass — `transport` and
`wiring` are the only files that now import `names` (`transport` also
imports `core/handlers/name`; `wiring` also imports `formula` directly, to
build the service the manager needs), and neither is imported back. `go
build ./...`, `go vet ./...`, and `go test ./...` are green.
