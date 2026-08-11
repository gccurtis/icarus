// Package comment exposes the project-scoped anchored-comment endpoints. Each
// route is project-scoped by transport before it reaches these handlers; writes
// require edit access, and the /comments/:id routes re-check project ownership
// inside the service.
package comment

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	commentcap "github.com/gccurtis/taurus-omega/core/capability/comment"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers adapt the comment service to HTTP.
type Handlers struct {
	comments *commentcap.Comments
	// canAccess, when set, enforces the parent document's access scope on the
	// by-id comment routes (patch/delete/reply), which — unlike the
	// document-scoped list/create routes — carry no :documentID for the transport
	// guard to see. It is injected so the handler stays decoupled from the
	// resource capability.
	canAccess func(callerID, projectID, documentID string) (bool, error)
}

// NewHandlers binds the comment endpoints to the comment service. A nil canAccess
// disables the per-document access check on the by-id comment routes.
func NewHandlers(comments *commentcap.Comments, canAccess func(callerID, projectID, documentID string) (bool, error)) Handlers {
	return Handlers{comments: comments, canAccess: canAccess}
}

// authorizeComment denies a caller who cannot access the comment's parent
// document. It returns nil to proceed, or an error response to send. A nil
// canAccess check (access scoping not configured) always proceeds.
func (h Handlers) authorizeComment(ctx access.Context, commentID string) *endpoint.Response {
	if h.canAccess == nil {
		return nil
	}
	c, err := h.comments.Get(commentcap.Scope{ProjectID: ctx.Project.ID}, commentID)
	if err != nil {
		resp := commentErr(err)
		return &resp
	}
	allowed, err := h.canAccess(ctx.User.ID, ctx.Project.ID, c.DocumentID)
	if err != nil {
		resp := endpoint.Fail(http.StatusInternalServerError, "could not check document access", err)
		return &resp
	}
	if !allowed {
		resp := errResp(http.StatusForbidden, "you do not have access to this document")
		return &resp
	}
	return nil
}

// List returns a document's comments, optionally filtered by ?resolved=true|false.
func (h Handlers) List(ctx access.Context, req endpoint.Request) endpoint.Response {
	var resolved *bool
	switch strings.ToLower(req.Query("resolved")) {
	case "true":
		resolved = boolPtr(true)
	case "false":
		resolved = boolPtr(false)
	}
	list, err := h.comments.List(commentcap.Scope{ProjectID: ctx.Project.ID}, req.Param("documentID"), resolved)
	if err != nil {
		return commentErr(err)
	}
	if list == nil {
		list = []commentcap.Comment{}
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"comments": list}}
}

// Create opens a comment against an existing anchor or an inline target.
func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot create comments")
	}
	var in struct {
		Body     string `json:"body"`
		AnchorID string `json:"anchorId"`
		Anchor   *struct {
			RowID   string `json:"rowId"`
			BlockID string `json:"blockId"`
			AtomID  string `json:"atomId"`
			Start   int    `json:"start"`
			End     int    `json:"end"`
		} `json:"anchor"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	sel := commentcap.AnchorSelector{AnchorID: in.AnchorID}
	if in.Anchor != nil {
		sel.Inline = &commentcap.AnchorRef{
			RowID: in.Anchor.RowID, BlockID: in.Anchor.BlockID, AtomID: in.Anchor.AtomID,
			Start: in.Anchor.Start, End: in.Anchor.End,
		}
	}
	c, err := h.comments.Create(commentcap.Scope{ProjectID: ctx.Project.ID}, req.Param("documentID"), ctx.User.ID, ctx.User.Name, in.Body, sel)
	if err != nil {
		return commentErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: c}
}

// Patch updates a comment's body and/or resolved state.
func (h Handlers) Patch(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot edit comments")
	}
	if denied := h.authorizeComment(ctx, req.Param("commentID")); denied != nil {
		return *denied
	}
	var in struct {
		Body     *string `json:"body"`
		Resolved *bool   `json:"resolved"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	c, err := h.comments.Patch(commentcap.Scope{ProjectID: ctx.Project.ID}, req.Param("commentID"), in.Body, in.Resolved)
	if err != nil {
		return commentErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: c}
}

// Delete removes a comment and its replies.
func (h Handlers) Delete(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot delete comments")
	}
	if denied := h.authorizeComment(ctx, req.Param("commentID")); denied != nil {
		return *denied
	}
	if err := h.comments.Delete(commentcap.Scope{ProjectID: ctx.Project.ID}, req.Param("commentID")); err != nil {
		return commentErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "deleted"}}
}

// Reply appends a message to a comment thread.
func (h Handlers) Reply(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot reply")
	}
	if denied := h.authorizeComment(ctx, req.Param("commentID")); denied != nil {
		return *denied
	}
	var in struct {
		Body string `json:"body"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	r, err := h.comments.Reply(commentcap.Scope{ProjectID: ctx.Project.ID}, req.Param("commentID"), ctx.User.ID, ctx.User.Name, in.Body)
	if err != nil {
		return commentErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: r}
}

func boolPtr(b bool) *bool { return &b }

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}

func commentErr(err error) endpoint.Response {
	switch {
	case errors.Is(err, commentcap.ErrNotFound):
		return errResp(http.StatusNotFound, "comment not found")
	case errors.Is(err, commentcap.ErrAnchorMissing), errors.Is(err, commentcap.ErrInvalid), errors.Is(err, commentcap.ErrInvalidScope):
		return errResp(http.StatusBadRequest, err.Error())
	default:
		return endpoint.Fail(http.StatusInternalServerError, "comment operation failed", err)
	}
}
