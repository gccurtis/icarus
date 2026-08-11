// Package intelligence implements the intelligence endpoints — reasoning,
// inference, and embedding — as gated application handlers. Each handler binds a
// request body carrying a semantic cast, hands it to the core intelligence
// service, and maps the outcome (including cast and provider errors) onto an
// endpoint response. A reason/infer request that includes a schema is dispatched
// to the structured (…JSON) variant.
package intelligence

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers holds the intelligence endpoints, bound to the core service.
type Handlers struct {
	svc *intelligence.Intelligence
}

// NewHandlers builds the intelligence endpoints over the given service.
func NewHandlers(svc *intelligence.Intelligence) Handlers { return Handlers{svc: svc} }

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

func badJSON() endpoint.Response {
	return endpoint.Response{Status: http.StatusBadRequest, Body: map[string]string{"error": "invalid JSON body"}}
}

// errFor maps a service error onto an HTTP status: an unconfigured cast is a
// client error, a provider with no credential is a service-unavailable, and any
// other provider failure is a bad gateway with a generic message (so upstream
// detail is never echoed back).
func errFor(err error) endpoint.Response {
	switch {
	case errors.Is(err, intelligence.ErrNoCast):
		return endpoint.Response{Status: http.StatusBadRequest, Body: map[string]string{"error": err.Error()}}
	case errors.Is(err, intelligence.ErrProviderNotConfigured):
		return endpoint.Fail(http.StatusServiceUnavailable, "intelligence provider not configured", err)
	default:
		// The provider's own message stays out of the body — it can name models,
		// quotas and upstream vendors — and goes to the log instead.
		return endpoint.Fail(http.StatusBadGateway, "intelligence provider call failed", err)
	}
}
