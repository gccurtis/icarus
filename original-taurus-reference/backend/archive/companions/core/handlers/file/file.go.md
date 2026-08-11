# file.go

HTTP handlers for the file endpoints: base64 upload (edit access), binary download under the stored content type, and metadata. See repo conventions (AGENTS.md).

## Code breakdown

```go
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

func fileErr(err error) endpoint.Response {
	// A limit answers with its own body, and is checked BEFORE the sentinels.
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
```

### `fileErr` — the limit arm comes first, and the cause is attached

The size failure now carries `code`, `limit`, `actual` and `subject`, so a client can
say "this file is 31 MB and the cap is 25 MB" instead of only that something was too
large. `limit.Exceeded.Body()` builds it, which is what makes this route and the chat
attachment route answer the *same* bound identically — they used to word it two
different ways, and neither named the bound.

**Order is load-bearing.** The enriched error still satisfies
`errors.Is(err, filecap.ErrTooLarge)`, deliberately, so every existing caller keeps
working. That means an `ErrTooLarge` arm placed above the limit check would claim it
first and throw the numbers away — the compatibility that makes the change safe is
also what makes the ordering matter.

`failed` wraps `errResp` and sets `endpoint.Response.Err`. The body stays opaque; the
transport hands `Err` to the request log, so a 500 stops being an unexplained 500.

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
