# chat.go

HTTP handlers for the project-scoped AI chat endpoints. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package chat exposes the project-scoped AI conversation endpoints. Each route
// is project-scoped by transport before it reaches these handlers.
package chat

import (
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	chatcap "github.com/gccurtis/taurus-omega/core/capability/chat"
	filecap "github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers adapt the chat service to HTTP.
type Handlers struct {
	chats *chatcap.Chats
	files *filecap.Files
	// maxDirectoryFiles bounds how many files one directory-manifest upload may
	// carry; per-file size is enforced by the file capability. From config.
	maxDirectoryFiles int
}

// NewHandlers binds the chat endpoints to the chat service. files may be nil,
// which disables the attachment routes.
func NewHandlers(chats *chatcap.Chats, files *filecap.Files, maxDirectoryFiles int) Handlers {
	return Handlers{chats: chats, files: files, maxDirectoryFiles: maxDirectoryFiles}
}

// Create opens a new chat in the selected Project.
func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot create chats")
	}
	var in struct {
		Title      string `json:"title"`
		Mode       string `json:"mode"`
		ResourceID string `json:"resourceId"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	ch, err := h.chats.Create(chatcap.Scope{ProjectID: ctx.Project.ID}, ctx.User.ID, in.Mode, in.Title, in.ResourceID)
	if err != nil {
		return chatErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: ch}
}

// List returns the Project's chats, optionally filtered by ?resourceId=.
func (h Handlers) List(ctx access.Context, req endpoint.Request) endpoint.Response {
	chats, err := h.chats.List(chatcap.Scope{ProjectID: ctx.Project.ID}, req.Query("resourceId"))
	if err != nil {
		return chatErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"chats": chats}}
}

// Get returns one chat and its ordered turns.
func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	ch, turns, err := h.chats.Get(chatcap.Scope{ProjectID: ctx.Project.ID}, req.Param("chatID"))
	if err != nil {
		return chatErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"chat": ch, "turns": turns}}
}

// PostTurn appends the user's message and returns the user + agent turns and the
// summed model usage.
func (h Handlers) PostTurn(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot post to a chat")
	}
	var in struct {
		Message string `json:"message"`
		Web     bool   `json:"web"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	result, err := h.chats.PostTurn(chatcap.Scope{ProjectID: ctx.Project.ID}, req.Param("chatID"), ctx.User.ID, in.Message, in.Web)
	if err != nil {
		return chatErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: result}
}

// SetPersona sets (or clears, with an empty id) the persona this chat's turns
// run under. Returns the updated chat.
func (h Handlers) SetPersona(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot change a chat's persona")
	}
	var in struct {
		PersonaID string `json:"personaId"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	scope := chatcap.Scope{ProjectID: ctx.Project.ID}
	if err := h.chats.SetPersona(scope, req.Param("chatID"), in.PersonaID); err != nil {
		return chatErr(err)
	}
	ch, turns, err := h.chats.Get(scope, req.Param("chatID"))
	if err != nil {
		return chatErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"chat": ch, "turns": turns}}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}

func chatErr(err error) endpoint.Response {
	switch {
	case errors.Is(err, chatcap.ErrNotFound), errors.Is(err, chatcap.ErrProjectScope):
		return errResp(http.StatusNotFound, "chat not found")
	case errors.Is(err, chatcap.ErrInvalid), errors.Is(err, chatcap.ErrInvalidScope):
		return errResp(http.StatusBadRequest, err.Error())
	default:
		// The client gets an opaque message; the cause travels to the request log,
		// because a 500 with no recorded reason cannot be diagnosed afterwards.
		resp := errResp(http.StatusInternalServerError, "chat operation failed")
		resp.Err = err
		return resp
	}
}
```

The two named cases translate a known failure into the status that describes it,
and their messages are safe to show a client: "chat not found" reveals nothing,
and the validation case is the capability's own wording about the request. The
default case is different — it is reached by every failure the handler did *not*
anticipate, which is exactly the set of errors that may carry storage detail,
provider responses, or internal identifiers. So the client gets a fixed string.

That opacity used to end the story: the cause was discarded at this line, and a
live-suite run that produced `500 chat operation failed` gave no way to tell a
provider outage from a malformed model response from a storage fault. Setting
`Err` keeps the client's answer exactly as opaque while the transport hands the
real error to the request log, so the same failure is now self-describing on the
server.

### Where the write gate lives

Every mutating handler here opens with `if !ctx.Role.CanWrite()`, returning 403
for a read-only member. That predicate is **not** defined in this package: it is
`access.Role.CanWrite` in `core/capability/access`. This package used to carry
its own private `canWrite(role access.Role) bool` copy — as did every other
handler package — so a change to what "may write" means would have had to be
repeated in each of them, and one missed copy would be a silent authorization
gap. The copies were identical, so folding them into a single method on the role
type changed no behavior; it just moved the definition to the one place that
owns roles, and left the call sites reading as a question asked of the role
itself.

### Failures carry their cause

Its one failure response (`chat operation failed`)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.
