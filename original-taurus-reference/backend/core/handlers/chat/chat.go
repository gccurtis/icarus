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
	"github.com/gccurtis/taurus-omega/core/platform/limit"
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
	if e, ok := limit.From(err); ok {
		status := http.StatusRequestEntityTooLarge
		if e.Code == "knowledge.project_artifact_limit" {
			status = http.StatusUnprocessableEntity
		}
		return endpoint.Response{Status: status, Body: e.Body(), Err: err}
	}
	switch {
	case errors.Is(err, chatcap.ErrNotFound), errors.Is(err, chatcap.ErrProjectScope):
		return errResp(http.StatusNotFound, "chat not found")
	case errors.Is(err, chatcap.ErrInvalid), errors.Is(err, chatcap.ErrInvalidScope):
		return errResp(http.StatusBadRequest, err.Error())
	default:
		// The client gets an opaque message; the cause travels to the request log,
		// because a 500 with no recorded reason cannot be diagnosed afterwards. This
		// arm is where the practice started (record 0130); endpoint.Fail is the same
		// thing, named once, so it could spread to the handlers that lacked it.
		return endpoint.Fail(http.StatusInternalServerError, "chat operation failed", err)
	}
}
