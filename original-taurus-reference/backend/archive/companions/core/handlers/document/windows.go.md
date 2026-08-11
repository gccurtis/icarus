# windows.go

HTTP handlers for the windowed row-read endpoints: descriptor, row-manifest, rows (from/count), and rows/locate (anchor|index). See repo conventions (AGENTS.md).

## Code breakdown

```go
package document

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	doc "github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Descriptor returns a document's body-less shape (page geometry, style
// registry, row count, revision) for bounded large-document loading.
func (h Handlers) Descriptor(ctx access.Context, req endpoint.Request) endpoint.Response {
	d, err := h.documents.Descriptor(ctx.Project.ID, req.Param("documentID"))
	if err != nil {
		return windowErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: d}
}

// RowManifest returns each row's height and cumulative offset, revision-stamped.
func (h Handlers) RowManifest(ctx access.Context, req endpoint.Request) endpoint.Response {
	m, err := h.documents.RowManifest(ctx.Project.ID, req.Param("documentID"))
	if err != nil {
		return windowErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: m}
}

// Rows returns a window of full rows: ?from=<rowId|index>&count=<n>.
func (h Handlers) Rows(ctx access.Context, req endpoint.Request) endpoint.Response {
	count, _ := strconv.Atoi(req.Query("count"))
	w, err := h.documents.RowWindow(ctx.Project.ID, req.Param("documentID"), req.Query("from"), count)
	if err != nil {
		return windowErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: w}
}

// RowsLocate maps ?anchor=<atomId> or ?index=<n> to a row jump target.
func (h Handlers) RowsLocate(ctx access.Context, req endpoint.Request) endpoint.Response {
	anchor := req.Query("anchor")
	indexRaw := req.Query("index")
	if anchor == "" && indexRaw == "" {
		return errResp(http.StatusBadRequest, "anchor or index is required")
	}
	index, byIndex := 0, false
	if indexRaw != "" {
		n, err := strconv.Atoi(indexRaw)
		if err != nil {
			return errResp(http.StatusBadRequest, "index must be an integer")
		}
		index, byIndex = n, true
	}
	loc, err := h.documents.Locate(ctx.Project.ID, req.Param("documentID"), anchor, index, byIndex)
	if err != nil {
		return windowErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: loc}
}

// windowErr maps projection errors to responses: a missing document or an
// unresolved row/atom is a 404; a malformed document is a 400.
func windowErr(err error) endpoint.Response {
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "not found")
	case errors.Is(err, doc.ErrInvalidContent):
		return errResp(http.StatusBadRequest, "document layout is invalid")
	default:
		return errResp(http.StatusInternalServerError, "row window read failed")
	}
}
```

### Failures carry their cause

Its one failure response (`row window read failed`)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.
