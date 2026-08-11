# document.go

HTTP handlers: list, create, get, rename, trash, restore, purge, duplicate,
diff, anchors CRUD + validate, append changes, history, get changeset, undo,
redo, revision hints.

## Code breakdown

```go
// Package document implements the document application endpoints: listing,
// creating, fetching, and deleting the documents within the request's selected
// project. All of these run within a resolved access Context that already has a
// project selected (the transport's project gate guarantees it), and they scope
// every operation to that project. Creating and deleting require write access
// (owner or edit); a read-only member is refused.
package document

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	doc "github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers holds the document endpoints, bound to the Documents service.
type Handlers struct {
	documents *doc.Documents
	// canAccess narrows a listing to the documents the caller may see under each
	// document's access scope. A nil check disables the narrowing (every project
	// member sees every document). It is injected — not a resource import — so the
	// handler stays decoupled from the resource capability.
	canAccess func(callerID, projectID, documentID string) (bool, error)
}

// NewHandlers builds the document endpoints. canAccess enforces per-document
// access scope on the listing; pass nil to list every document in the project.
func NewHandlers(d *doc.Documents, canAccess func(callerID, projectID, documentID string) (bool, error)) Handlers {
	return Handlers{documents: d, canAccess: canAccess}
}

// List returns the documents in the selected project the caller may access.
func (h Handlers) List(ctx access.Context, _ endpoint.Request) endpoint.Response {
	docs, err := h.documents.List(ctx.Project.ID)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not list documents")
	}
	if h.canAccess != nil {
		visible := make([]doc.Summary, 0, len(docs))
		for _, d := range docs {
			allowed, err := h.canAccess(ctx.User.ID, ctx.Project.ID, d.ID)
			if err != nil {
				return errResp(http.StatusInternalServerError, "could not list documents")
			}
			if allowed {
				visible = append(visible, d)
			}
		}
		docs = visible
	}
	if docs == nil {
		docs = []doc.Summary{}
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"documents": docs}}
}

// Create makes a new document in the selected project. Requires write access.
func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot create documents")
	}

	var in struct {
		Name           string          `json:"name"`
		PageLayout     *doc.PageLayout `json:"pageLayout"`
		Rows           []doc.Row       `json:"rows"`
		FromTemplateID string          `json:"fromTemplateId"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	// Instantiate from a template: copy its structure, clear the bindings.
	if strings.TrimSpace(in.FromTemplateID) != "" {
		d, err := h.documents.CreateFromTemplate(ctx.Project.ID, in.FromTemplateID, actor(ctx))
		if errors.Is(err, doc.ErrNotFound) {
			return errResp(http.StatusNotFound, "template not found")
		}
		if err != nil {
			return errResp(http.StatusInternalServerError, "could not create from template")
		}
		return endpoint.Response{Status: http.StatusCreated, Body: d}
	}

	base := doc.Base{Rows: in.Rows}
	if in.PageLayout != nil {
		base.PageLayout = *in.PageLayout
	}
	d, err := h.documents.Create(ctx.Project.ID, in.Name, base, actor(ctx))
	if errors.Is(err, doc.ErrInvalidName) {
		return errResp(http.StatusBadRequest, "document name must not be empty")
	}
	if errors.Is(err, doc.ErrInvalidContent) {
		return errResp(http.StatusBadRequest, "document content or layout is invalid")
	}
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not create document")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: d}
}

// Templates lists the project's documents that are marked as reusable templates.
func (h Handlers) Templates(ctx access.Context, _ endpoint.Request) endpoint.Response {
	templates, err := h.documents.Templates(ctx.Project.ID)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not list templates")
	}
	if templates == nil {
		templates = []doc.Document{}
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"templates": templates}}
}

// Get returns one document from the selected project.
func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	d, err := h.documents.Get(ctx.Project.ID, req.Param("documentID"))
	if errors.Is(err, doc.ErrNotFound) {
		return errResp(http.StatusNotFound, "document not found")
	}
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not get document")
	}
	return endpoint.Response{Status: http.StatusOK, Body: d}
}

// Rename changes a document's canonical name. Requires write access.
func (h Handlers) Rename(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot rename documents")
	}
	var in struct {
		Name string `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	d, err := h.documents.Rename(ctx.Project.ID, req.Param("documentID"), in.Name, actor(ctx))
	switch {
	case errors.Is(err, doc.ErrInvalidName):
		return errResp(http.StatusBadRequest, "document name must not be empty")
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not rename document")
	}
	return endpoint.Response{Status: http.StatusOK, Body: d}
}

// Delete moves a document to trash. Requires write access.
func (h Handlers) Delete(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot trash documents")
	}

	switch err := h.documents.Delete(ctx.Project.ID, req.Param("documentID"), actor(ctx)); {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not trash document")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "trashed"}}
}

// Restore moves a document from trash back to active. Requires write access.
func (h Handlers) Restore(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot restore documents")
	}

	switch err := h.documents.Restore(ctx.Project.ID, req.Param("documentID"), actor(ctx)); {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found or not in trash")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not restore document")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "restored"}}
}

// Purge permanently deletes a trashed document. Requires write access.
func (h Handlers) Purge(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot purge documents")
	}

	switch err := h.documents.Purge(ctx.Project.ID, req.Param("documentID"), actor(ctx)); {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found or not in trash")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not purge document")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "purged"}}
}

// Duplicate creates a new document by copying the source with fresh internal IDs.
// Requires write access.
func (h Handlers) Duplicate(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot duplicate documents")
	}

	d, err := h.documents.Duplicate(ctx.Project.ID, req.Param("documentID"), actor(ctx))
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not duplicate document")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: d}
}

// Diff compares two revision heads of the same document and returns a bounded
// list of structural changes.
func (h Handlers) Diff(ctx access.Context, req endpoint.Request) endpoint.Response {
	oldRev, _ := strconv.ParseInt(req.Query("old"), 10, 64)
	newRev, _ := strconv.ParseInt(req.Query("new"), 10, 64)
	limit, err := strconv.Atoi(req.Query("limit"))
	if err != nil || limit < 1 {
		limit = 50
	}
	result, err := h.documents.Diff(ctx.Project.ID, req.Param("documentID"), oldRev, newRev, doc.DiffBounds{MaxChanges: limit, MaxTextLen: 200})
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case errors.Is(err, doc.ErrInvalidDiffRevisions):
		return errResp(http.StatusBadRequest, "old revision must be less than new revision")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not diff document")
	}
	return endpoint.Response{Status: http.StatusOK, Body: result}
}

// CreateAnchor stores an external anchor targeting a specific row, block, and
// optional atom in the document. Requires write access.
func (h Handlers) CreateAnchor(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot create anchors")
	}

	var in struct {
		RowID   string `json:"rowId"`
		BlockID string `json:"blockId"`
		AtomID  string `json:"atomId"`
		Start   int    `json:"start"`
		End     int    `json:"end"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	a, err := h.documents.CreateAnchor(ctx.Project.ID, req.Param("documentID"), doc.DocumentAnchor{
		RowID: in.RowID, BlockID: in.BlockID, AtomID: in.AtomID, Start: in.Start, End: in.End,
	})
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case errors.Is(err, doc.ErrAnchorInvalid):
		return errResp(http.StatusBadRequest, "anchor target does not exist in the document")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not create anchor")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: a}
}

// ListAnchors returns all anchors on a document.
func (h Handlers) ListAnchors(ctx access.Context, req endpoint.Request) endpoint.Response {
	anchors, err := h.documents.ListAnchors(ctx.Project.ID, req.Param("documentID"))
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not list anchors")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"anchors": anchors}}
}

// DeleteAnchor removes one anchor from a document. Requires write access.
func (h Handlers) DeleteAnchor(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot delete anchors")
	}

	switch err := h.documents.DeleteAnchor(ctx.Project.ID, req.Param("documentID"), req.Param("anchorID")); {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not delete anchor")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "deleted"}}
}

// ValidateAnchor checks whether an anchor's target still exists and updates its state.
func (h Handlers) ValidateAnchor(ctx access.Context, req endpoint.Request) endpoint.Response {
	a, err := h.documents.ValidateAnchor(ctx.Project.ID, req.Param("documentID"), req.Param("anchorID"))
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document or anchor not found")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not validate anchor")
	}
	return endpoint.Response{Status: http.StatusOK, Body: a}
}

// AppendChanges submits a revision-bound, idempotent batch of layout/content
// operations authored by the current user. Requires write access.
func (h Handlers) AppendChanges(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot edit documents")
	}

	var in struct {
		SubmissionID     string         `json:"submissionId"`
		ExpectedRevision *int64         `json:"expectedRevision"`
		Operations       []doc.ChangeOp `json:"operations"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if in.ExpectedRevision == nil {
		return errResp(http.StatusBadRequest, "expectedRevision is required")
	}

	cs, err := h.documents.SubmitChanges(
		ctx.Project.ID,
		req.Param("documentID"),
		ctx.User.ID,
		doc.ChangeSubmission{
			SubmissionID:     in.SubmissionID,
			ExpectedRevision: *in.ExpectedRevision,
			Operations:       in.Operations,
		},
		actor(ctx).Name,
	)
	var admission *doc.AdmissionConflict
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case errors.Is(err, doc.ErrInvalidSubmission):
		return errResp(http.StatusBadRequest, "submissionId or expectedRevision is invalid")
	case errors.Is(err, doc.ErrInvalidChangeSet):
		return errResp(http.StatusBadRequest, "change set is empty or invalid")
	case errors.As(err, &admission):
		return endpoint.Response{Status: http.StatusConflict, Body: map[string]any{
			"error":            admission.Error(),
			"code":             admission.Code,
			"expectedRevision": admission.ExpectedRevision,
			"currentRevision":  admission.CurrentRevision,
			"resyncRevision":   admission.ResyncRevision,
		}}
	case errors.Is(err, doc.ErrConflict):
		return errResp(http.StatusConflict, "change no longer matches current document state")
	case errors.Is(err, doc.ErrRevisionConflict):
		return errResp(http.StatusConflict, "document revision changed")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not apply changes")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: cs}
}

// History lists bounded, newest-first revision summaries for the selected
// Project's Document.
func (h Handlers) History(ctx access.Context, req endpoint.Request) endpoint.Response {
	pageReq := doc.HistoryRequest{Cursor: req.Query("cursor")}
	if raw := req.Query("limit"); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 {
			return errResp(http.StatusBadRequest, doc.ErrInvalidHistoryLimit.Error())
		}
		pageReq.Limit = limit
	}
	page, err := h.documents.History(
		ctx.Project.ID, req.Param("documentID"), ctx.User.ID, pageReq,
	)
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case errors.Is(err, doc.ErrInvalidHistoryCursor), errors.Is(err, doc.ErrInvalidHistoryLimit):
		return errResp(http.StatusBadRequest, err.Error())
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not list document history")
	}
	var nextCursor any
	if page.NextCursor != "" {
		nextCursor = page.NextCursor
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{
		"entries": page.Entries, "nextCursor": nextCursor,
	}}
}

// GetChangeSet returns one retained detailed revision. Private inverse state is
// omitted by the ChangeSet JSON contract.
func (h Handlers) GetChangeSet(ctx access.Context, req endpoint.Request) endpoint.Response {
	cs, err := h.documents.ChangeSet(
		ctx.Project.ID, req.Param("documentID"), req.Param("changeSetID"),
	)
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case errors.Is(err, doc.ErrChangeSetNotFound):
		return errResp(http.StatusNotFound, "change set detail is not retained")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not get document change set")
	}
	return endpoint.Response{Status: http.StatusOK, Body: cs}
}

// Undo compensates one authored change-set revision. The service requires the
// target to belong to the current user and still be the document head.
func (h Handlers) Undo(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot undo document changes")
	}

	cs, err := h.documents.Undo(
		ctx.Project.ID,
		req.Param("documentID"),
		ctx.User.ID,
		req.Param("changeSetID"),
		actor(ctx).Name,
	)
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case errors.Is(err, doc.ErrChangeSetNotFound):
		return errResp(http.StatusNotFound, "change set not found")
	case errors.Is(err, doc.ErrUndoForbidden):
		return errResp(http.StatusForbidden, "only the revision author may undo it")
	case errors.Is(err, doc.ErrUndoConflict):
		return errResp(http.StatusConflict, "only the current head revision can be undone")
	case errors.Is(err, doc.ErrUndoIneligible):
		return errResp(http.StatusConflict, "an undo revision must be redone explicitly")
	case errors.Is(err, doc.ErrUndoUnavailable):
		return errResp(http.StatusConflict, "undo is unavailable for this retained revision")
	case errors.Is(err, doc.ErrConflict), errors.Is(err, doc.ErrRevisionConflict):
		return errResp(http.StatusConflict, "undo no longer applies to the current document")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not undo change")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: cs}
}

// Redo compensates the current authored undo revision through its explicit
// endpoint and records RedoOf lineage.
func (h Handlers) Redo(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot redo document changes")
	}

	cs, err := h.documents.Redo(
		ctx.Project.ID,
		req.Param("documentID"),
		ctx.User.ID,
		req.Param("changeSetID"),
		actor(ctx).Name,
	)
	switch {
	case errors.Is(err, doc.ErrNotFound):
		return errResp(http.StatusNotFound, "document not found")
	case errors.Is(err, doc.ErrChangeSetNotFound):
		return errResp(http.StatusNotFound, "change set not found")
	case errors.Is(err, doc.ErrRedoForbidden):
		return errResp(http.StatusForbidden, "only the undo revision author may redo it")
	case errors.Is(err, doc.ErrRedoConflict):
		return errResp(http.StatusConflict, "only the current head undo revision can be redone")
	case errors.Is(err, doc.ErrRedoIneligible):
		return errResp(http.StatusConflict, "only an undo revision can be redone")
	case errors.Is(err, doc.ErrRedoUnavailable):
		return errResp(http.StatusConflict, "redo is unavailable for this retained revision")
	case errors.Is(err, doc.ErrConflict), errors.Is(err, doc.ErrRevisionConflict):
		return errResp(http.StatusConflict, "redo no longer applies to the current document")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not redo change")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: cs}
}

func actor(ctx access.Context) doc.Actor {
	name := ctx.User.Name
	if name == "" {
		name = ctx.User.Email
	}
	return doc.Actor{ID: ctx.User.ID, Name: name}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}

// RevisionHints returns a lightweight {documentID: revision} map for every
// document in the selected project. Clients poll this to detect staleness.
func (h Handlers) RevisionHints(ctx access.Context, _ endpoint.Request) endpoint.Response {
	hints, err := h.documents.RevisionHints(ctx.Project.ID)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not get revision hints")
	}
	return endpoint.Response{Status: http.StatusOK, Body: hints}
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

Its 22 failure responses (`could not list documents`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.
