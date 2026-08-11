---
title: "Work Packet — Ω-011 — Make Project scope explicit per request"
notion_page_id: "3acb6410e5028181902fd66656bb1f67"
notion_url: "https://app.notion.com/3acb6410e5028181902fd66656bb1f67"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:57:56Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-011 — Make Project scope explicit per request

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🧭" color="purple_bg">
	**Frozen-baseline addendum.** Current sessions still store one mutable selected Project, which is incompatible with one User Cell holding several simultaneous Project Subcells. Remove selected Project as an authorization authority. Every Project route/tool/job names Project explicitly and performs current admission; “selected Project” may remain Workspace/navigation state only. Prove two open Projects in one authenticated session cannot retarget each other.
</callout>
## Outcome
Replace the session-selected Project as an implicit backend authority with an
explicit, immutable Project scope on every Project operation. Authentication
establishes who the caller is. The route establishes which Project the caller
is addressing. A fresh authorization decision establishes what that caller may
do there. No capability infers its Project from mutable session state.
This is the execution-plane boundary on which the rest of Omega is completed.
Two clients, two browser tabs, background jobs, and future service callers can
operate in different Projects without changing a shared “selected Project.”
Alpha may retain a selected-Project preference for navigation, but that
preference has no authority over backend reads or writes.
## As-built evidence
The current transport gate authenticates a session and uses its selected Project
to establish request scope. Most Project routes are unprefixed. Capability
records generally include `project_id`, so storage isolation is already close to
the target, but the Project identity arrives implicitly. This couples navigation
state to authorization and makes concurrent multi-Project clients, Project-safe
jobs, and the User Cell / Project Subcell execution hierarchy unnecessarily fragile.
`documentAccessGuard` adds a second direct-resource check for routes containing
`:documentID`, but it passes through when resolution fails and cannot protect
resources whose identifiers are in bodies, queries, composite responses, or
internal calls. Ω-009 establishes caller-aware read contracts; this packet
ensures the correct Project and caller reach every one of them.
## Scope
- Introduce a canonical authenticated caller and explicit Project execution
	scope.
- Prefix every Project endpoint with `/projects/:projectID`.
- Authorize Project membership/grant on every request before dispatch.
- Pass Project scope as an argument to every Project capability command/query.
- Reject a Project id in a request body or stored object when it disagrees with
	route scope.
- Carry the same scope into jobs, tools, internal coordinators, and live streams.
- Deprecate selected Project as authority; retain it only as a user-interface
	preference if Alpha still needs it during cutover.
- Convert transport, handler, capability, store, test, and backend-guide
	contracts in one pre-release migration.
## Non-goals
- No Enterprise Control Plane service split.
- No Organization hierarchy, entitlement engine, or user-library migration.
- No runtime-cell implementation; Ω-013 consumes this contract.
- No live change stream; Ω-014 consumes this scope.
- No change to resource-level grant meaning beyond the fail-closed work in
	Ω-009 and Ω-010.
- No compatibility promise for undocumented unprefixed routes.
## Invariants
1. Session establishes `CallerID`; it never establishes Project authority.
2. `ProjectID` comes from the authenticated route or a trusted durable job
	envelope, never from a mutable process-global or session-selected value.
3. Authorization is checked before User Cell / Project Subcell acquisition,
	capability lookup, persistence access, or existence-revealing response.
4. Every store query and mutation retains a `project_id` predicate even after
	authorization succeeds.
5. A client-supplied body Project id is ignored only if absent; disagreement is
	a typed `400 scope_mismatch`, not silently normalized.
6. Internal capability APIs cannot be invoked with a bare string id where a
	typed caller-aware scope is required.
7. Removing a caller's Project access takes effect on the next request and
	causes existing streams to terminate or reauthorize.
## Representative contracts
```go
type AuthenticatedCaller struct {
    UserID         string
    OrganizationID string // optional acting organization, explicitly resolved
    SessionID      string
}

type ProjectScope struct {
    ProjectID string
    Caller    AuthenticatedCaller
}

type ProjectPermission string

const (
    ProjectRead  ProjectPermission = "project.read"
    ProjectWrite ProjectPermission = "project.write"
    ProjectAdmin ProjectPermission = "project.admin"
)

type ProjectAuthorizer interface {
    Authorize(
        ctx context.Context,
        caller AuthenticatedCaller,
        projectID string,
        permission ProjectPermission,
    ) (ProjectScope, error)
}
```
Handlers receive scope after middleware authorization:
```go
func (h *Documents) Get(w http.ResponseWriter, r *http.Request) {
    scope := projectscope.MustFromContext(r.Context())
    documentID := route.Param(r, "documentID")
    result, err := h.documents.Get(r.Context(), scope, documentID)
    // ...
}
```
Target route examples:
```plain text
GET    /projects/:projectID/resources
POST   /projects/:projectID/documents
POST   /projects/:projectID/documents/:documentID/changes
GET    /projects/:projectID/activity
POST   /projects/:projectID/chats/:chatID/turns
GET    /projects/:projectID/workspace
GET    /projects/:projectID/events
```
User-level library and identity routes remain outside this prefix in later
waves.
## Likely paths
- `core/transport/routes.go`
- `core/transport/middleware.go`
- `core/transport/dispatch.go`
- `core/handlers/`
- `core/capability/access/`
- `core/capability/session/`
- every Project capability interface
- `core/wiring/wiring.go`
- `core/platform/storage/sqlite/`
- `dev-test/`
- `docs/backend-guide.md`
## Ordered implementation
1. Extend Ω-001's operation matrix with target scope, minimum permission, route
	parameter, and every body/query Project field. Add a test that no
	Project-scoped operation lacks these columns.
2. Add `AuthenticatedCaller`, `ProjectScope`, and `ProjectAuthorizer` without
	changing routes. Adapt current access storage behind the new port and make
	errors fail closed.
3. Add middleware that parses a canonical Project id, selects the operation's
	required permission, authorizes the caller, and attaches immutable scope to
	context. Remove `documentAccessGuard` pass-through behavior; resource access
	remains an explicit capability check after Project admission.
4. Convert capability interfaces and handlers one vertical at a time. Start
	with Resource and Document, then Context/Knowledge/Agent, then Activity,
	references, comments, presence, Chat, Connector, Workspace, and supporting
	projections. Keep the tree green after each conversion.
5. Add `project_id` predicates and mismatch assertions to every store method.
	A test fixture with duplicate entity ids across Projects must prove the
	predicate cannot be accidentally omitted.
6. Mount prefixed routes and update operation registration. Because Taurus is
	pre-release, cut over directly once Alpha's endpoint adapter is prepared;
	if a temporary alias is unavoidable, it must resolve an explicit path Project
	and emit removal telemetry, never read the session-selected authority.
7. Change `/session/project` or equivalent selection to a navigation preference
	only. Name the property accordingly and document that it grants nothing.
8. Introduce a trusted scope envelope for durable jobs and internal tools.
	Ω-014 completes job ownership, but new work cannot enqueue without Project id
	and initiating caller.
9. Reauthorize long-lived streams on access-revision notification or bounded
	interval and terminate on loss.
10. Update Alpha backend contract fixtures, backend guide, companions,
	completion matrix, migration notes, and change record.
## Security, concurrency, persistence, and observability
Do not cache authorization inside a User Cell or Project Subcell. A subcell is
bound to one User and Project, while its `ProjectScope` and admission are still
request-local and access-epoch bounded.
Short-lived request caches may batch resource decisions only when keyed by
caller, Project, permission, and access revision.
The selected-Project preference can race harmlessly across clients because no
backend operation reads it for authority. Jobs persist their Project and
initiator at enqueue time; execution rechecks the current authorization required
by the job type. Logs and traces include Project id, caller id, operation, and
authorization outcome but never session token, grant contents, or hidden names.
## Tests and gates
- Route inventory test: every Project operation is under exactly one explicit
	Project prefix.
- Two users × two Projects × two roles matrix for point reads, collections,
	writes, jobs, streams, and internal Agent tools.
- Same resource id fixture in two Projects proving no cross-scope read/write.
- Two concurrent clients for one user operating in different Projects while
	repeatedly changing the navigation preference.
- Body/query/path mismatch and malformed Project id tests.
- Access removal during stream and model/tool execution.
- Middleware resolver failure returns non-enumerating denial and invokes no
	capability.
- `go test -race`, all backend E2E suites, and standard repository gates.
## Completion evidence
- No Project capability public method lacks `ProjectScope`.
- No Project route relies on selected session Project.
- Storage isolation and fresh authorization are proven across concurrent
	Projects.
- Alpha can switch Projects by changing its route base, not a backend session
	mutation.
- The completion matrix classifies every route as Project, user, operator, or
	public.
## Dependencies
Depends on Ω-009 and Ω-010 for caller-aware reads and wire behavior. Blocks
Ω-012 through Ω-019 and every later Project resource capability.
## Sources
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/docs/architecture/runtime-model.md)
---

