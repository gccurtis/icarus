# healthz.go

`healthz.go` is an **application** layer endpoint: the liveness probe. It lives
in its own directory, as every endpoint does, and defines a single handler
function, `Handle`, that reports the server is up.

Being in the application layer, it is transport-agnostic: it depends only on the
neutral `endpoint` contract, never on Echo. It receives an `endpoint.Request` and
returns an `endpoint.Response`; the transport layer is responsible for turning a
real HTTP request into that call and writing the response back out. This is the
"function layer" of the design — pure request logic with no knowledge of how the
request arrived.

The endpoint is intentionally trivial. Its value is not the payload but the fact
that a response comes back at all, which lets a monitor, load balancer, or
orchestrator confirm the process is alive.

## Code breakdown

### Package documentation and declaration

```go
// Package healthz implements the liveness endpoint.
package healthz
```

The endpoint lives in its own package, `healthz`, in its own directory — the
per-endpoint structure of the application layer. The one-line doc comment states
what it implements: the liveness endpoint.

### Imports

```go
import (
	"net/http"

	"github.com/gccurtis/taurus-omega/core/endpoint"
)
```

Two imports, and notably neither is Echo. `net/http` supplies the status-code
constant, and `endpoint` supplies the neutral request/response contract this
handler is written against. The absence of any transport import is the point: the
application layer is decoupled from how requests are carried.

### The handler

```go
// Handle reports that the server is up. It ignores the request and always
// replies 200 OK with {"status":"ok"}.
func Handle(endpoint.Request) endpoint.Response {
	return endpoint.Response{
		Status: http.StatusOK,
		Body:   map[string]string{"status": "ok"},
	}
}
```

`Handle` matches the `endpoint.Handler` shape — `endpoint.Request` in,
`endpoint.Response` out. It ignores its request entirely (the parameter is
unnamed because it is unused) and always returns `200 OK` with the body
`{"status":"ok"}`. The transport layer's adapter is what serializes that response
to the client; this function only decides the status and body.
