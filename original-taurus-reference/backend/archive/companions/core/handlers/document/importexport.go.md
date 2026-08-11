# importexport.go

HTTP handlers for Markdown import and export: Export streams a document as text/markdown; ImportHandlers reads an uploaded Markdown file and creates a document from it, bridging the file and document capabilities. See repo conventions (AGENTS.md).

## Code breakdown

```go
package document

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	doc "github.com/gccurtis/taurus-omega/core/capability/document"
	filecap "github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Export serializes a document to the requested ?format. Only Markdown is
// supported today; pdf/docx are follow-ups.
func (h Handlers) Export(ctx access.Context, req endpoint.Request) endpoint.Response {
	format := strings.ToLower(strings.TrimSpace(req.Query("format")))
	switch format {
	case "", "markdown", "md":
		// Markdown is the default and only supported format.
	default:
		return errResp(http.StatusBadRequest, "unsupported export format; only markdown is available")
	}
	_, md, err := h.documents.ExportMarkdown(ctx.Project.ID, req.Param("documentID"))
	if errors.Is(err, doc.ErrNotFound) {
		return errResp(http.StatusNotFound, "document not found")
	}
	if err != nil {
		return errResp(http.StatusInternalServerError, "export failed")
	}
	return endpoint.Response{Status: http.StatusOK, Raw: []byte(md), ContentType: "text/markdown; charset=utf-8"}
}

// maxImportBytes bounds a Markdown import so one upload cannot become an
// unboundedly large document (one block per blank-line-separated chunk).
const maxImportBytes = 2 << 20 // 2 MiB

// ImportHandlers creates a document from an uploaded file. It bridges the file
// and document capabilities, so it holds both services.
type ImportHandlers struct {
	documents *doc.Documents
	files     *filecap.Files
}

// NewImportHandlers binds the import endpoint to the document and file services.
func NewImportHandlers(documents *doc.Documents, files *filecap.Files) ImportHandlers {
	return ImportHandlers{documents: documents, files: files}
}

// Import reads an uploaded Markdown file and creates a new document from it.
func (h ImportHandlers) Import(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot import documents")
	}
	var in struct {
		FileID string `json:"fileId"`
		Name   string `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	meta, content, err := h.files.Download(filecap.Scope{ProjectID: ctx.Project.ID}, in.FileID)
	if err != nil {
		return errResp(http.StatusNotFound, "file not found")
	}
	if len(content) > maxImportBytes {
		return errResp(http.StatusRequestEntityTooLarge, "file is too large to import as a document")
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = markdownDocName(meta.Name)
	}
	created, err := h.documents.ImportMarkdown(ctx.Project.ID, name, string(content), actor(ctx))
	if errors.Is(err, doc.ErrInvalidName) {
		return errResp(http.StatusBadRequest, "invalid document name")
	}
	if err != nil {
		return errResp(http.StatusInternalServerError, "import failed")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: created}
}

// markdownDocName derives a document name from an uploaded file's name, dropping
// a Markdown extension.
func markdownDocName(fileName string) string {
	name := strings.TrimSpace(fileName)
	name = strings.TrimSuffix(name, ".md")
	name = strings.TrimSuffix(name, ".markdown")
	if name == "" {
		return "Imported document"
	}
	return name
}
```

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

Its 2 failure responses (`export failed`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.
