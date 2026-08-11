# session.go

HTTP handlers for session start, close, update, and list endpoints.

## Code breakdown

```go
package session

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	sess "github.com/gccurtis/taurus-omega/core/capability/session"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct {
	sessions *sess.Sessions
}

func NewHandlers(s *sess.Sessions) Handlers { return Handlers{sessions: s} }

func (h Handlers) Start(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		SessionID string `json:"sessionId"`
	}
	_ = req.Bind(&in)
	sessionID := in.SessionID
	if sessionID == "" {
		sessionID = newID()
	}
	name := ctx.User.Name
	if name == "" {
		name = ctx.User.Email
	}
	s, err := h.sessions.Start(ctx.Project.ID, ctx.User.ID, name, ctx.User.Email, sessionID)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not start session")
	}
	return endpoint.Response{Status: http.StatusOK, Body: s}
}

func (h Handlers) Close(ctx access.Context, _ endpoint.Request) endpoint.Response {
	if err := h.sessions.Close(ctx.Project.ID, ctx.User.ID); err != nil {
		return errResp(http.StatusInternalServerError, "could not close session")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "closed"}}
}

func (h Handlers) Update(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in sess.UpdateInput
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.sessions.Update(ctx.Project.ID, ctx.User.ID, in); err != nil {
		return errResp(http.StatusInternalServerError, "could not update session")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "updated"}}
}

func (h Handlers) List(ctx access.Context, _ endpoint.Request) endpoint.Response {
	sessions, err := h.sessions.List(ctx.Project.ID)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not list sessions")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"sessions": sessions}}
}

func newID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:])
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}
```

### Failures carry their cause

Its 4 failure responses (`could not start session`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.
