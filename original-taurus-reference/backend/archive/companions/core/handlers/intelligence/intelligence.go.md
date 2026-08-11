# intelligence.go

`intelligence.go` is the application-layer adapter for the intelligence endpoints
— reasoning, inference, and embedding. It sits between the transport layer and
the core intelligence service, in the same role the other application packages
play for their domains: bind a request body, call the service, and map the
outcome onto the neutral `endpoint.Response`.

Each handler is gated — it takes an `access.Context` — so it only runs for a
signed-in caller. Callers pass a semantic *cast* on the body, never a model: the
cast is what the core service resolves to a concrete provider and model, so this
layer stays free of any model or provider knowledge. Reason and infer share a
body whose optional `schema` field is what routes a call to the structured
(`…JSON`) service method rather than the plain one.

Error mapping is where this layer earns its keep. The service returns typed
sentinels, and `errFor` turns them into the right HTTP status — and, for the
catch-all provider failure, a generic message so upstream detail is never echoed
back to a caller.

## Code breakdown

### Package documentation and declaration

```go
// Package intelligence implements the intelligence endpoints — reasoning,
// inference, and embedding — as gated application handlers. Each handler binds a
// request body carrying a semantic cast, hands it to the core intelligence
// service, and maps the outcome (including cast and provider errors) onto an
// endpoint response. A reason/infer request that includes a schema is dispatched
// to the structured (…JSON) variant.
package intelligence
```

The doc comment states the package's whole shape: gated handlers for the three
endpoints, each binding a body carrying a semantic cast, delegating to the core
service, and mapping the outcome — successes and typed errors alike — onto an
endpoint response, with a schema on a reason/infer request routing to the
structured variant.

### Imports

```go
import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)
```

`context` supplies the background context passed to service calls, `encoding/json`
provides the `json.RawMessage` schema field, `errors` backs the `errors.Is`
checks in the error mapping, and `net/http` names the status codes. The three
internal imports are the layers this adapter bridges: `access` for the gated
handler signature, `capability/intelligence` for the core service and its types,
and `endpoint` for the neutral request and response shapes.

### Handlers and NewHandlers

```go
// Handlers holds the intelligence endpoints, bound to the core service.
type Handlers struct {
	svc *intelligence.Intelligence
}

// NewHandlers builds the intelligence endpoints over the given service.
func NewHandlers(svc *intelligence.Intelligence) Handlers { return Handlers{svc: svc} }
```

`Handlers` binds the endpoints to the core `*intelligence.Intelligence` service,
and `NewHandlers` constructs it, following the same "constructor returns a value"
pattern the other application packages use. Holding the service by pointer is
what every handler method calls through.

### castBody and its conversion

```go
// castBody is the wire form of a cast on a request.
type castBody struct {
	Purpose  string `json:"purpose"`
	Strength string `json:"strength"`
	Speed    string `json:"speed"`
	Cost     string `json:"cost"`
}

func (c castBody) cast() intelligence.Cast {
	return intelligence.Cast{Purpose: c.Purpose, Strength: c.Strength, Speed: c.Speed, Cost: c.Cost}
}
```

`castBody` is the JSON wire form of a cast — the semantic knobs (`purpose`,
`strength`, `speed`, `cost`) a caller sets instead of naming a model. Its `cast()`
method converts it to the core `intelligence.Cast`, keeping the wire shape and the
service type as separate concerns so the handlers hand the service its own type.

### generateBody and embedBody

```go
// generateBody is the request body for reason and infer: a cast, the messages,
// and an optional JSON schema that switches the call to structured output.
type generateBody struct {
	Cast     castBody               `json:"cast"`
	Messages []intelligence.Message `json:"messages"`
	Schema   json.RawMessage        `json:"schema"`
}

// embedBody is the request body for embed: a cast and the inputs to embed.
type embedBody struct {
	Cast   castBody `json:"cast"`
	Inputs []string `json:"inputs"`
}
```

`generateBody` is the shared body for both reason and infer: a cast, the message
history, and an optional `Schema`. A non-empty `Schema` is what switches the call
to structured output, surfaced as an optional field rather than a separate route.
`embedBody` is the embedding body — a cast and the batch of inputs to embed.

### Reason

```go
// Reason handles POST /intelligence/reason. With a schema it constrains the
// output to that schema; without one it returns free text.
func (h Handlers) Reason(_ access.Context, req endpoint.Request) endpoint.Response {
	var body generateBody
	if err := req.Bind(&body); err != nil {
		return badJSON()
	}
	r := intelligence.ReasonRequest{Cast: body.Cast.cast(), Messages: body.Messages}
	if len(body.Schema) > 0 {
		return generateResult(h.svc.ReasonJSON(context.Background(), r, body.Schema))
	}
	return generateResult(h.svc.Reason(context.Background(), r))
}
```

`Reason` handles `POST /intelligence/reason`. It binds the `generateBody`,
returning `badJSON` on a parse failure, then builds a `ReasonRequest` from the
converted cast and messages. The presence of a schema chooses the method: with one
it calls `ReasonJSON` for schema-constrained output, without one it calls `Reason`
for free text, and either result is handed to `generateResult`. The
`access.Context` is ignored by name (`_`) — the gate has already done its job by
the time the handler runs.

### Infer

```go
// Infer handles POST /intelligence/infer, mirroring Reason against the inference
// cast table.
func (h Handlers) Infer(_ access.Context, req endpoint.Request) endpoint.Response {
	var body generateBody
	if err := req.Bind(&body); err != nil {
		return badJSON()
	}
	r := intelligence.InferRequest{Cast: body.Cast.cast(), Messages: body.Messages}
	if len(body.Schema) > 0 {
		return generateResult(h.svc.InferJSON(context.Background(), r, body.Schema))
	}
	return generateResult(h.svc.Infer(context.Background(), r))
}
```

`Infer` is the mirror image of `Reason` against the inference cast table: the same
bind, the same schema-versus-plain dispatch, differing only in that it builds an
`InferRequest` and calls `InferJSON` or `Infer`. Keeping the two handlers parallel
makes the single point of difference — which cast table the service consults —
obvious.

### Embed

```go
// Embed handles POST /intelligence/embed, returning one vector per input.
func (h Handlers) Embed(_ access.Context, req endpoint.Request) endpoint.Response {
	var body embedBody
	if err := req.Bind(&body); err != nil {
		return badJSON()
	}
	res, err := h.svc.Embed(context.Background(), intelligence.EmbedRequest{Cast: body.Cast.cast(), Inputs: body.Inputs})
	if err != nil {
		return errFor(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"vectors": res.Vectors, "usage": res.Usage}}
}
```

`Embed` handles `POST /intelligence/embed`. It binds the `embedBody`, calls the
service's `Embed` with the converted cast and inputs, and on error routes through
`errFor`. On success it returns a `200` whose body carries the `vectors` and the
`usage` directly — there is no plain/structured split here, so the response is
assembled inline rather than through `generateResult`.

### generateResult

```go
// generateResult maps a reasoning/inference outcome onto a response, emitting
// either a text or a json field depending on which the service produced.
func generateResult(res intelligence.Result, err error) endpoint.Response {
	if err != nil {
		return errFor(err)
	}
	body := map[string]any{"usage": res.Usage}
	if res.JSON != nil {
		body["json"] = res.JSON
	} else {
		body["text"] = res.Text
	}
	return endpoint.Response{Status: http.StatusOK, Body: body}
}
```

`generateResult` is the shared success/error mapper for reason and infer. It takes
the service's `(Result, error)` pair directly — which is why the handlers can call
it on the result of a service method — and on error defers to `errFor`. On success
it always includes `usage`, then emits a `json` field when the service produced
structured output and a `text` field otherwise, so the response shape reflects
which variant ran.

### badJSON

```go
func badJSON() endpoint.Response {
	return endpoint.Response{Status: http.StatusBadRequest, Body: map[string]string{"error": "invalid JSON body"}}
}
```

`badJSON` is the single canned `400` for an unparseable request body, shared by all
three handlers so a bind failure always looks the same to a caller.

### errFor

```go
// errFor maps a service error onto an HTTP status: an unconfigured cast is a
// client error, a provider with no credential is a service-unavailable, and any
// other provider failure is a bad gateway with a generic message (so upstream
// detail is never echoed back).
func errFor(err error) endpoint.Response {
	switch {
	case errors.Is(err, intelligence.ErrNoCast):
		return endpoint.Response{Status: http.StatusBadRequest, Body: map[string]string{"error": err.Error()}}
	case errors.Is(err, intelligence.ErrProviderNotConfigured):
		return endpoint.Response{Status: http.StatusServiceUnavailable, Body: map[string]string{"error": "intelligence provider not configured"}}
	default:
		return endpoint.Response{Status: http.StatusBadGateway, Body: map[string]string{"error": "intelligence provider call failed"}}
	}
}
```

`errFor` is the single place service errors become HTTP statuses. An unconfigured
cast (`ErrNoCast`) is the caller's fault, so it is a `400` that echoes the
descriptive message. A provider with no credential (`ErrProviderNotConfigured`) is
server state, mapped to `503`. Everything else is treated as an upstream failure:
a `502` with a fixed generic message, deliberately not the underlying error, so no
provider detail is ever echoed back to the caller.

### Failures carry their cause

Its 2 failure responses (`intelligence provider not configured`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.
