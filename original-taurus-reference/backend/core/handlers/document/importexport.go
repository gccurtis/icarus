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
		return endpoint.Fail(http.StatusInternalServerError, "export failed", err)
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
	var styleErr *doc.StyleValidationError
	if errors.Is(err, doc.ErrInvalidName) {
		return errResp(http.StatusBadRequest, "invalid document name")
	}
	if errors.As(err, &styleErr) {
		return invalidStyleResp(styleErr)
	}
	if err != nil {
		return endpoint.Fail(http.StatusInternalServerError, "import failed", err)
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
