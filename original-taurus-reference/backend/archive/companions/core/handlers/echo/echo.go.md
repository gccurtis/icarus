# echo.go

`echo.go` is an **application** layer endpoint: the echo handler. Like every
endpoint it lives in its own directory and defines a single handler function,
`Handle`, which returns the posted JSON body unchanged so callers can confirm a
full request/response round trip works.

It is transport-agnostic, depending only on the neutral `endpoint` contract and
never on Echo. (The package is named `echo`, but that refers to the *behavior* —
echoing the body — not the Labstack Echo framework, which this file does not
import.) It reads the request body through the `Bind` capability the contract
provides and returns an `endpoint.Response`; translating that to and from real
HTTP is the transport layer's job.

Because it accepts arbitrary JSON and reflects it verbatim, it is a simple,
general-purpose check that data sent in survives the trip back out — with a
distinct error response when the input is not valid JSON.

## Code breakdown

### Package documentation and declaration

```go
// Package echo implements the echo endpoint, which returns the posted JSON body
// unchanged so callers can confirm data sent in a request comes back in the
// response.
package echo
```

The endpoint has its own package, `echo`, in its own directory. The doc comment
describes the behavior — return the posted JSON body unchanged — and why it is
useful: confirming data sent in a request comes back in the response. The package
name describes what the endpoint does, independent of any framework.

### Imports

```go
import (
	"net/http"

	"github.com/gccurtis/taurus-omega/core/endpoint"
)
```

As with every application package, there is no transport import. `net/http`
provides the status-code constants, and `endpoint` provides the neutral contract
— including the `Bind` capability this handler uses to read the request body.

### The handler

```go
// Handle returns the posted JSON body unchanged. If the body is not valid JSON
// it replies 400 Bad Request instead.
func Handle(req endpoint.Request) endpoint.Response {
	var body any
	if err := req.Bind(&body); err != nil {
		return endpoint.Response{
			Status: http.StatusBadRequest,
			Body:   map[string]string{"error": "invalid JSON body"},
		}
	}
	return endpoint.Response{Status: http.StatusOK, Body: body}
}
```

`Handle` matches the `endpoint.Handler` shape. It declares `body` as `any` so it
can accept any shape of JSON, then calls `req.Bind` — the neutral decode
capability the transport supplied — to decode the request body into it. If
binding fails, meaning the body is not valid JSON, it returns `400 Bad Request`
with an `{"error": ...}` message. Otherwise it returns the decoded value verbatim
with `200 OK`. The handler never touches the HTTP framework directly; it works
entirely through the contract, and the transport adapter renders the result.
