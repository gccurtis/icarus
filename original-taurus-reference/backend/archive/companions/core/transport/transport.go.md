# transport.go

The slim core of the HTTP transport layer: the package documentation, the
settings the composition root supplies, the dependency struct that middleware
and adapters hang off, and the server-wide hardening constants. Nothing here
executes a request — this file declares *what the transport is made of*, and the
rest of the package spends it.

The package is split by concern, and each sibling file carries its own header
saying what it holds:

| File | Holds |
| --- | --- |
| `transport.go` | package doc, `Options`, `server`, hardening constants |
| `routes.go` | `New` — the whole route table |
| `dispatch.go` | operation → execution mode, and the adapters that carry it out |
| `middleware.go` | transport-local Echo middleware (`documentAccessGuard`, `sessionActivity`) |
| `response.go` | Echo ↔ `endpoint` translation: adapters, request build, response write |
| `gate.go` | session resolution and the `requireUser` / `requireProject` gates |

**The shape of a request.** Echo hands a request to a route registered in
`routes.go`. A gate from `gate.go` resolves the session cookie into an
`access.Context` and stashes it on the Echo context; middleware in
`middleware.go` narrows access further; an adapter in `response.go` or
`dispatch.go` turns the Echo context into a neutral `endpoint.Request`, calls the
imported application handler, and writes the `endpoint.Response` back. The
handlers themselves know nothing about Echo — that boundary is the point of the
package.

## Code breakdown

### Package documentation

States the two jobs of the package: build the Echo instance and adapt between
Echo and the neutral `endpoint` contract, and enforce access by splitting routes
into a public group (health, register, login) and a gated group that
`requireUser` blocks without a resolved session.

### Server-wide limits and hardening constants

Three constants that bound and harden every request:

- `maxBodySize` (`"1M"`) caps request bodies. It is both a DoS guard and what
  keeps the request logger from buffering an unbounded body.
- `uploadMaxBodySize` (`"32M"`) is the larger cap applied *only* to the file
  upload route, whose base64 body legitimately exceeds 1M. It is still a cap, so
  no single upload is ever unbounded.
- `hstsMaxAge` (one year, in seconds) feeds the `Strict-Transport-Security`
  header.

The two body limits are a pair: `routes.go` installs the global limiter with a
skipper for `POST /files` and then attaches the upload cap to that one route, so
exactly one route is exempt from the default and none is exempt from a cap.

### `Options` — everything the composition layer supplies

A single struct of dependencies, mostly capability services and their handler
inputs. The dominant pattern is **nil means the feature is not wired**: for
`Notifications`, `Organizations`, `Contexts`, `Intelligence`, `Knowledge`,
`Names`, `Sessions`, `Chats`, `References`, `Comments`, `Files`, `Workspaces`,
and `Presence`, a nil field means `New` simply does not register those routes.
That makes the route table a function of what the composition root actually
built, and lets tests construct a transport with only the surface they care
about.

The fields that are not plain services:

- `Access` is required — the gates in `gate.go` resolve every session through it.
- `Enqueuer` is required *if any deferred operation is routed*; `dispatch.go`'s
  deferred adapter enqueues through it. ("Deferred", not "async": what separates
  that mode is that the work outlives the request and the process, not the shape
  of the response — see `dispatch.go`.)
- `Jobs` is the read side of the same story, backing the dev-path job routes
  (`GET /dev/jobs/:jobID` and `GET /dev/jobs`).
- `ResourceGenerator` backs "Create with AI"; unlike the others, a nil value
  still registers `POST /resources/generate` — the route reports that generation
  is not configured rather than 404ing.
- `MaxAttachmentDirectoryFiles` bounds how many files one directory-manifest
  chat attachment may carry; zero means unbounded.
- `AgentTasks` and `AgentWorkflows` are registered as a pair, and `Personas`
  needs `AgentTasks` alongside it for the task-attribution routes.
- `LogRequests` toggles the structured request/response logging middleware.

### `server` — the dependencies middleware and adapters share

The receiver behind every `s.`-prefixed method in the package: the gates in
`gate.go`, the adapters in `response.go`, and the dispatchers in `dispatch.go`.
It carries four things — the access service, the job enqueuer, the keyed mutex
used by the serial execution mode, and the set of operations already installed on
a route:

```go
type server struct {
	access     *access.Access
	enqueuer   job.Enqueuer
	serial     dispatch.KeyedMutex
	registered map[string]bool
}
```

Both stateful fields need no initialization at construction: `serial`'s zero
value is ready, and `registered` is created lazily on the first registration. The
first is what makes concurrent writes to one document serialize within a process;
the second is a startup-only bookkeeping set that lets `dispatchScoped` panic if
one operation name is installed on two routes. Neither is touched per request
after `New` returns — `registered` is written only while the route table is being
built, on one goroutine. See `dispatch.go` for both.

### `FlattenDocument` — an option because the composition root owns the answer

Renders a document as the text the lattice indexes, with its block map.

It travels as an option rather than being defined in the knowledge handler because
two places need the same answer: the handler that admits a document, and the origin
reader that flattens one again to serve a whole-source read. A read whose text
disagreed with the text that was indexed would return byte ranges citing the wrong
components.

It is spelled as a raw `func(document.Document) (string, []knowledge.BlockSpan)`
rather than the handler package's named `Flattener` type, so this options struct keeps
importing no handler package. Go's assignability between a named function type and an
identical unnamed one is what makes that free.
