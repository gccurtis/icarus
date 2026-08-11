# context.go

`context.go` defines `access.Context` — the resolved per-request access state —
and `access.ScopedHandler`, the handler shape for routes that need it. Together
they are the bridge between the access layer's domain (users, sessions, projects,
cells) and the handlers that run against it, without either side taking a
dependency on the transport.

The `Context` is produced by the transport middleware from the session cookie: it
resolves the cookie into as much access state as the request has earned. Its four
pointer fields make the request's position in the access state machine legible at
a glance — how many are non-nil says whether the request is anonymous, merely
authenticated, or fully project-selected. Two small predicates, `Authenticated`
and `HasProject`, name those states so handlers and middleware don't re-derive
them from nil checks.

`ScopedHandler` is the counterpart to the plain `endpoint.Handler` for routes
that require this resolved context. By taking the `Context` as an explicit first
argument, it lets the handler stay transport-agnostic: the transport layer does
the work of resolving the context and building the request, then invokes the
handler with both.

## Code breakdown

### Package declaration and import

```go
package access

import "github.com/gccurtis/taurus-omega/core/endpoint"
```

The file belongs to the `access` package and imports only `endpoint`, the neutral
request/response contract. That single import is what lets `ScopedHandler` be
defined in terms of `endpoint.Request` and `endpoint.Response` while the access
layer stays free of any transport (Echo) dependency.

### The Context type

```go
// Context is the resolved access state for a single request. The transport
// middleware produces it from the session cookie and passes it to scoped
// handlers. How many fields are populated reflects how far the request's session
// has moved through the access flow:
//
//   - anonymous:         all nil
//   - authenticated:     Session and User set
//   - project-selected:  Session, User, Project, and Cell all set
type Context struct {
	Session *Session
	User    *User
	Project *Project
	Cell    *Cell
}
```

`Context` is the resolved access state for one request. Its four pointer fields
are filled in progressively as a session advances through the access flow, and
the comment spells out the three meaningful configurations: all nil for an
anonymous request, `Session` and `User` set once signed in, and all four set once
a project has been selected and its cell resolved. Using pointers makes "not
present" representable as nil, so the shape of the struct directly encodes the
request's position in the state machine.

### The state predicates

```go
// Authenticated reports whether the request carries a valid signed-in user.
func (c Context) Authenticated() bool { return c.User != nil }

// HasProject reports whether a project has been selected and a cell resolved.
func (c Context) HasProject() bool { return c.Project != nil && c.Cell != nil }
```

These two predicates name the states the field layout encodes. `Authenticated`
is true once a user is present; `HasProject` is true once both a project and its
cell are resolved. Giving these checks names lets middleware and handlers gate on
"is this signed in?" or "is a project selected?" without repeating nil-comparison
logic, and keeps the meaning of each state in one place.

### The ScopedHandler type

```go
// ScopedHandler is a request handler that runs within a resolved access Context.
// It is the counterpart to endpoint.Handler for routes that require a signed-in
// user (and, for project routes, a selected project and cell). The transport
// layer builds the Context and the endpoint.Request and invokes the handler,
// keeping the handler itself free of any transport dependency.
type ScopedHandler func(Context, endpoint.Request) endpoint.Response
```

`ScopedHandler` is the handler shape for routes that need resolved access state.
Where `endpoint.Handler` takes just a request, a `ScopedHandler` also takes the
`Context`, so the handler receives its user, project, and cell as plain arguments.
The transport layer is responsible for producing both the `Context` and the
`endpoint.Request` and calling the handler — which is what keeps the handler
itself transport-agnostic, mirroring the application layer's decoupling.
