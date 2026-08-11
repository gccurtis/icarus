# routes.go

The route table. This file holds a single function, `New`, which builds the Echo
instance, installs the global middleware, and maps every URL in the product onto
an imported application handler. It is deliberately one long function: the value
of a route table is that the entire HTTP surface is visible in one place, in the
order a reader would look for it.

`New` is kept separate from composition so tests can exercise the handlers
without starting a listener — it returns an `*echo.Echo`, and the caller decides
whether to serve it or drive it in memory.

**Three access tiers**, and every route sits in exactly one:

1. **Public** — registered directly on `e`. Reachable with no user at all:
   `/healthz`, `/auth/register`, `/auth/login`.
2. **Gated** — the `gated` group behind `s.requireUser` and `requireCSRF`.
   Requires a signed-in user but no selected project: identity, jobs, project
   management and selection, organizations, intelligence, and the formula name
   manager.
3. **Project-scoped** — the `scoped` group behind `s.requireProject` and
   `requireCSRF`. Requires a signed-in user who has *also* selected a project;
   everything operating on that project's content lives here.

Both non-public tiers carry `requireCSRF` (see `middleware.go.md`), so a mutating
request must echo the `to_csrf` cookie in an `X-CSRF-Token` header. It is attached
at the group, not per route, so a newly added route is covered by default. The
public tier is deliberately exempt: register and login have no session to forge a
request with yet. Note the ordering — the gate runs first, so an anonymous caller
still gets `401` rather than a confusing `403`, and the gate has already issued a
token to a caller that lacked one.

**Conditional registration.** Most blocks are guarded by an `opts.X != nil`
check. A capability the composition root did not build simply has no routes, so
the surface is a function of what was actually wired (see `transport.go.md` on
`Options`).

**Named operations — all of them.** No scoped route calls an adapter directly.
Every one is `s.dispatchScoped("<capability>.<verb>", handler, nil)`, naming an
operation whose execution mode is looked up in `operationMode` (`dispatch.go`);
the two async routes pass a `nil` handler and an inline `*deferredSpec` instead. A
route naming an operation the table does not classify panics while `New` runs, so
the table and this file cannot drift apart. Reading a route therefore answers two
questions at once: what URL it is, and how it executes.

## Code breakdown

### Echo construction and global middleware

`echo.New()` with the banner hidden, then four layers in order: `Recover`; a body
limit at `maxBodySize` carrying a **skipper for `POST /files`**, because that one
route attaches its own larger cap further down; `Secure` with nosniff,
`X-Frame-Options: DENY`, and `hstsMaxAge`; and — only when `opts.LogRequests` —
the structured request logger. The body-limit skipper and the per-route upload
cap are a matched pair; changing one without the other either leaves uploads
capped at 1M or leaves them uncapped.

### The server value and the always-present handler sets

Builds `&server{access: opts.Access, enqueuer: opts.Enqueuer}` — the receiver for
every gate, adapter, and dispatcher in the package — then the handler sets that
are always registered: auth, users, projects, and jobs. `projects` is
re-constructed with `opts.Activity` when an activity service was supplied, which
is how project routes gain their semantic feed.

### The auth rate limiter

An in-memory per-IP limiter (rate 5, burst 10, 3-minute expiry) applied *only* to
`/auth/register` and `/auth/login`, to blunt online brute-force and
credential-stuffing. It is route middleware, not global, so ordinary traffic is
unthrottled.

### Public routes

`GET /healthz`, `POST /auth/register`, `POST /auth/login`. The two credential
routes carry `authLimiter`. These use the plain `adapt` (no access context) — the
whole point is that they work without one.

### Gated group: identity, jobs, projects, organizations

`gated := e.Group("", s.requireUser, requireCSRF)`, then: the `/auth/me` trio; the two **jobs**
routes; project
CRUD, membership, invite links (`/projects/:projectID/links/:role`),
`POST /join/:token`, and project selection (`/session/project`). A batch identity
resolver turns mixed user/persona references into public profile cards. The
organizations block — the above-project tier — registers only when
`opts.Organizations` is set.

The jobs pair sits on the **dev path**: `GET /dev/jobs/:jobID` (the poll endpoint
every async route's `202` points at) and `GET /dev/jobs` (the listing). They are
gated but not project-scoped, and deliberately not part of the product surface:
the `jobs` table carries no user or project column, so a job belongs to the
process, not to a caller. Job status was only ever authorized by possession of the
opaque id; putting both routes under `/dev` says what they are — operator
observability — rather than dressing them up as a client feature.

### Gated group: echo, intelligence, formula names

`POST /echo` is the trivial round-trip. The intelligence block adds
reason/infer/embed. The names block is the notable one: it is gated rather than
project-scoped and takes `:projectID` **from the path**, because a caller may act
on a project's names without that project being their current selection.

### Project-scoped group: the access guard and the document resolver

Defines `docAccess`, a `func(callerID, projectID, documentID) (bool, error)`
closing over `opts.Resources.CanAccessResource`. It is left nil when no resource
service is configured, which disables the narrowing. The same resolver is passed
into the document handlers, into the comment handlers, and — as
`s.documentAccessGuard(opts.Resources)` — installed as group middleware, so a
document restricted in the catalog cannot be opened, edited, or read by URL
either. `scoped := e.Group("", s.requireProject, requireCSRF)` is created here;
everything below hangs off it.

### Sessions, users, activity, notifications

When `opts.Sessions` is set the group also gains `sessionActivity` middleware
(see `middleware.go`) alongside the four `/sessions` routes. Then `GET
/users/:userID`, and the conditional `GET /activity` and `GET /notifications`.

### Resources, connectors, contexts

The `resources.*` routes: get, list, create, rename, delete, plus catalog
`attributes` (pin to top) and `access` patches, and `POST /resources/generate`
("Create with AI", `resources.generate`). Connectors (`connectors.*`) and
contexts (`contexts.*`) follow.

### Documents: CRUD, anchors, changes, collaboration, history

The largest block: list/create/get/rename/delete,
restore/purge/duplicate/diff, the four anchor routes, and
`POST /documents/:documentID/changes` (serial, keyed by document id). The
collaboration trio registers only when both `Presence` and `Activity` are wired.
History reads and the undo/redo pair (also serial) follow, then
`/documents/revision-hints` and the template library.

### Documents: windowed reads, export, import, references, comments, files

Windowed row reading is four routes — a body-less `descriptor`, a `row-manifest`
laying out the scroll region, `rows` windows, and `rows/locate` — every response
revision-stamped, so a large document loads bounded. Then Markdown `export`;
`documents/import`, which needs the file store; the reference/backlink pair; the
anchored-comment routes (list/create are document-scoped, patch/delete/reply
address a comment by id and the service re-checks project ownership); and the
file upload/download/meta trio, where **upload carries
`middleware.BodyLimit(uploadMaxBodySize)`** — the counterpart to the global
skipper above.

### The async block resolve route

`POST /documents/:documentID/blocks/:blockID/resolve` is dispatched async because
resolving a prompt block is inference-heavy (plan + retrieve + synthesize). Its
inline `deferredSpec` authorizes on `ctx.Role.CanWrite()` and builds a payload of
project, document, block, and the resolve mode bound from the request body
(empty = auto).

### Agent, chat, workspace, persona routes

Durable Plan/Action tasks (needs both `AgentTasks` and `AgentWorkflows`);
persistent project-scoped chats, whose attachment sub-routes register only when
`Files` is also present; the per-user `/workspace` get/put, which is personal UI
state rather than project content; and the persona routes — list/create,
default get/set, per-persona CRUD, revisions, versions, and task attribution —
which need `Personas` and `AgentTasks` together.

### Dev-only routes, and the return

The `/dev` prefix marks operations outside the production client surface.
`POST /dev/documents/:documentID/rebase` is the second async route, with an
`deferredSpec` mirroring resolve's but a payload of just project and document. The
knowledge block adds the lattice add/remove/retrieve tooling.

### The not-found catch-all, and why it must be last

`New` finishes by registering `e.Any("/*", …)` returning a 404 JSON body. This
is load-bearing, not decoration. Echo's `Group` attaches its own catch-all
(`/*`) carrying the group's middleware, so that group middleware still runs for
paths the router does not match. Both groups here are declared with an **empty
prefix**, so those catch-alls span the whole API surface and the last one
registered wins — which meant every unknown URL was answered by `requireProject`
with 409 "select a project first" rather than 404. Registering ours afterwards
restores the honest answer: an address that does not exist says so, instead of
reporting on the caller's session state.

`New` then returns the assembled `*echo.Echo`.

### `GET /dev/knowledge/sources`

Registered beside the other dev lattice routes. It is a read, so it is classified
`dispatchConcurrent` like its neighbours.

It is the name-to-id lookup that composite source ids require: ids are minted, so
a caller holding a filename cannot compose the id it needs and has to ask. Under
`/dev` for now, with the rest of the lattice tooling — a production client
addressing one file inside a connector will need it on the supported surface.

### `GET /connectors/:connectorID/files`

Registered with the other connector routes. It lists a connector's synced files
with both names a file has: the provider's key and the lattice source id.

It is on the connector, not under `/dev/knowledge`, because the connector is the
capability that owns the mapping. It is also a real client surface rather than
dev tooling — "use this connector but not this one file" cannot be built without
it, since scope selections are by source id and a user only ever knows a name.

### The knowledge handler takes the flattener

`knowledgeapp.NewHandlers` now receives `opts.FlattenDocument` alongside the document
and knowledge services. The conversion moved to the composition root so the admitting
handler and the origin reader that serves whole-source reads share one definition of a
document's text; see `transport.go.md` for why it is an option.
