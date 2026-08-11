// Package file exposes the project-scoped file endpoints: upload (base64 JSON),
// binary download, and metadata. Each route is project-scoped by transport
// before it reaches these handlers; upload requires edit access, and every route
// re-checks the file's project inside the service.
package file

import (
	"encoding/base64"
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	filecap "github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// Handlers adapt the file service to HTTP.
type Handlers struct {
	files *filecap.Files
}

// NewHandlers binds the file endpoints to the file service.
func NewHandlers(files *filecap.Files) Handlers { return Handlers{files: files} }

// Upload stores a new file. The body is JSON with base64-encoded content:
// {name, contentType, content}.
func (h Handlers) Upload(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot upload files")
	}
	var in struct {
		Name        string `json:"name"`
		ContentType string `json:"contentType"`
		Content     string `json:"content"` // base64
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	content, err := base64.StdEncoding.DecodeString(in.Content)
	if err != nil {
		return errResp(http.StatusBadRequest, "content must be base64")
	}
	f, err := h.files.Upload(filecap.Scope{ProjectID: ctx.Project.ID}, in.Name, in.ContentType, content, ctx.User.ID, ctx.User.Name)
	if err != nil {
		return fileErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: f}
}

// Meta returns a file's metadata as JSON.
func (h Handlers) Meta(ctx access.Context, req endpoint.Request) endpoint.Response {
	f, err := h.files.Meta(filecap.Scope{ProjectID: ctx.Project.ID}, req.Param("fileID"))
	if err != nil {
		return fileErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: f}
}

// Download streams a file's bytes under its stored content type.
func (h Handlers) Download(ctx access.Context, req endpoint.Request) endpoint.Response {
	meta, content, err := h.files.Download(filecap.Scope{ProjectID: ctx.Project.ID}, req.Param("fileID"))
	if err != nil {
		return fileErr(err)
	}
	// Always a download, never inline: a stored text/html file must not render in
	// the app's origin.
	return endpoint.Response{Status: http.StatusOK, Raw: content, ContentType: meta.ContentType, Filename: meta.Name}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}

// failed answers with an opaque body and attaches the cause for the request log.
// The two halves are the point: a client learns nothing internal, and an operator
// stops having to guess. Response.Err has existed since endpoint.go was written and
// nothing set it, which is why a 500 here used to say only that something failed.
func failed(status int, msg string, err error) endpoint.Response {
	resp := errResp(status, msg)
	resp.Err = err
	return resp
}

func fileErr(err error) endpoint.Response {
	// A limit answers with its own body — code, limit, actual, subject — so a client
	// can say "this file is 31 MB and the cap is 25 MB". Checked before the sentinel
	// arms because the enriched error still satisfies errors.Is(err, ErrTooLarge) and
	// the sentinel arm would otherwise claim it and throw the numbers away.
	if e, ok := limit.From(err); ok {
		return endpoint.Response{Status: http.StatusRequestEntityTooLarge, Body: e.Body(), Err: err}
	}
	switch {
	case errors.Is(err, filecap.ErrNotFound):
		return failed(http.StatusNotFound, "file not found", err)
	case errors.Is(err, filecap.ErrInvalid), errors.Is(err, filecap.ErrInvalidScope):
		return failed(http.StatusBadRequest, err.Error(), err)
	default:
		return failed(http.StatusInternalServerError, "file operation failed", err)
	}
}
