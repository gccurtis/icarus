// Package connector serves connector-specific creation and configuration that the
// generic resource catalog cannot express (provider subkind + provider config).
package connector

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	connectorcap "github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

type Handlers struct{ connectors *connectorcap.Connectors }

func NewHandlers(c *connectorcap.Connectors) Handlers { return Handlers{connectors: c} }

type connectorJSON struct {
	ID       string `json:"id"`
	Kind     string `json:"kind"`
	SubKind  string `json:"subkind"`
	Name     string `json:"name"`
	Path     string `json:"path"`
	SyncSeq  int64  `json:"syncSeq"`
	SyncedAt string `json:"syncedAt,omitempty"`
	// The sync's health, present only when a sync is failing. FailedAttempts and
	// LastError say what is wrong; RetryAfter says when it will be tried again;
	// NeedsAttention says it will not be, until someone acts — which is the signal
	// a client turns into "this connector's sync is failing, contact your
	// administrator" rather than leaving a stale source looking current.
	FailedAttempts int    `json:"failedAttempts,omitempty"`
	LastError      string `json:"lastError,omitempty"`
	RetryAfter     string `json:"retryAfter,omitempty"`
	NeedsAttention bool   `json:"needsAttention,omitempty"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

// view is a method rather than a free function because needsAttention is derived
// from the configured attempt cap, which only the service knows.
func (h Handlers) view(c connectorcap.Connector) connectorJSON {
	j := connectorJSON{
		ID: c.ID, Kind: "connector", SubKind: string(c.SubKind), Name: c.Name, Path: c.Path,
		SyncSeq:        c.SyncSeq,
		FailedAttempts: c.FailedAttempts,
		LastError:      c.LastError,
		NeedsAttention: h.connectors.NeedsAttention(c),
		CreatedAt:      c.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt:      c.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
	if !c.SyncedAt.IsZero() {
		j.SyncedAt = c.SyncedAt.UTC().Format(time.RFC3339Nano)
	}
	if !c.RetryAfter.IsZero() {
		j.RetryAfter = c.RetryAfter.UTC().Format(time.RFC3339Nano)
	}
	return j
}

// Create makes a connector of the given subkind (config is set via Configure).
func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name    string `json:"name"`
		SubKind string `json:"subkind"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	c, err := h.connectors.Create(ctx.Project.ID, connectorcap.Actor{ID: ctx.User.ID, Name: ctx.User.Name}, in.Name, connectorcap.SubKind(in.SubKind))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: h.view(c)}
}

// Get returns one connector's current metadata + config.
func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	c, err := h.connectors.Get(ctx.Project.ID, req.Param("connectorID"))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: h.view(c)}
}

// Configure sets a connector's provider path.
func (h Handlers) Configure(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Path string `json:"path"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	c, err := h.connectors.Configure(ctx.Project.ID, req.Param("connectorID"), in.Path)
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: h.view(c)}
}

// Sync forces a re-sync of the connector's provider content into the lattice.
//
// A sync that left files out still answers 200, because it succeeded: one unusable
// file is a reason to leave that file out, never to abandon everything beside it.
// But `skipped` is always present when there is anything in it, with a code, the
// bound and the actual value per file — so a client can say which files did not
// arrive and why, instead of showing a clean success for a folder that is partly
// missing.
func (h Handlers) Sync(ctx access.Context, req endpoint.Request) endpoint.Response {
	res, err := h.connectors.Sync(ctx.Project.ID, req.Param("connectorID"))
	if err != nil {
		resp := mapErr(err)
		if res.Partial {
			body := map[string]any{}
			switch existing := resp.Body.(type) {
			case map[string]any:
				for k, v := range existing {
					body[k] = v
				}
			case map[string]string:
				for k, v := range existing {
					body[k] = v
				}
			}
			body["partial"] = true
			body["usage"] = map[string]int{"promptTokens": res.Usage.PromptTokens, "totalTokens": res.Usage.TotalTokens}
			if len(res.Skipped) > 0 {
				body["skipped"] = res.Skipped
			}
			resp.Body = body
		}
		return resp
	}
	body := map[string]any{
		"seq": res.Seq, "changed": res.Changed,
		"usage": map[string]int{"promptTokens": res.Usage.PromptTokens, "totalTokens": res.Usage.TotalTokens},
	}
	if res.Partial {
		body["partial"] = true
	}
	if len(res.Skipped) > 0 {
		body["skipped"] = res.Skipped
	}
	return endpoint.Response{Status: http.StatusOK, Body: body}
}

// Files lists the connector's synced files: each one's provider key — the path
// relative to the root, for a local folder — beside the id the lattice addresses
// it by.
//
// It exists because those two names are different on purpose. A lattice source
// id is composed of minted ids so that nothing in it can be a filename and
// nothing in it can be unprintable, which is what lets it survive being cited by
// a model. The cost is that a caller holding a name cannot construct the id, and
// every scope selection — "use this connector but not this one file" — is by id.
//
// This is the connector's own listing rather than a lattice one because the
// connector is what owns the relationship: it minted the ids, and it is the only
// thing that knows what its provider calls a member.
func (h Handlers) Files(ctx access.Context, req endpoint.Request) endpoint.Response {
	files, err := h.connectors.Files(ctx.Project.ID, req.Param("connectorID"))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"files": files}}
}

func mapErr(err error) endpoint.Response {
	if e, ok := limit.From(err); ok {
		status := http.StatusRequestEntityTooLarge
		if e.Code == "knowledge.project_artifact_limit" {
			status = http.StatusUnprocessableEntity
		}
		return endpoint.Response{Status: status, Body: e.Body(), Err: err}
	}
	switch {
	case errors.Is(err, connectorcap.ErrNotFound):
		return failed(http.StatusNotFound, "connector not found", err)
	case errors.Is(err, connectorcap.ErrInvalidName):
		return failed(http.StatusBadRequest, "connector name must not be empty", err)
	case errors.Is(err, connectorcap.ErrInvalidSubKind):
		return failed(http.StatusBadRequest, "connector subkind is not supported", err)
	case errors.Is(err, connectorcap.ErrInvalidPath):
		return failed(http.StatusBadRequest, "connector path is invalid", err)
	default:
		// The body stays opaque — a client has no use for our internals — but the
		// cause is attached now. This default arm is where record 0121's sync race
		// hid: an intermittent 500 answered `{"error":"connector error"}` and the
		// request log recorded nothing more, so the failure had to be reproduced to
		// be seen at all.
		return failed(http.StatusInternalServerError, "connector error", err)
	}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]any{"error": msg}}
}

// failed answers with an opaque body and attaches the cause for the request log.
// endpoint.Response.Err has existed since the transport contract was written and
// nothing in the system set it, which is what made an unexplained 500 unexplainable.
func failed(status int, msg string, err error) endpoint.Response {
	resp := errResp(status, msg)
	resp.Err = err
	return resp
}
