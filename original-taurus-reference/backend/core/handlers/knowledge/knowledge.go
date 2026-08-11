// Package knowledge implements the (dev-only) knowledge endpoints: adding a
// document's text to the project's retrieval lattice, and retrieving grounded
// spans from it. These are wired under /dev because they are not part of the
// production client surface — ingestion is normally driven by resource changes,
// not called directly.
package knowledge

import (
	"context"
	"errors"
	"net/http"
	"sort"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	doc "github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	kb "github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// Flattener renders a document as the text the lattice indexes, with the byte-range
// → (row, block) map that makes retrieved spans cite real document addresses.
//
// It is injected rather than defined here because the composition root needs the
// same answer: whole-source reads flatten the document again to serve them, and a
// read whose text disagreed with the text that was indexed would return byte ranges
// citing the wrong components. One definition, supplied from the one place that can
// see both sides.
type Flattener func(doc.Document) (string, []kb.BlockSpan)

// Handlers holds the knowledge endpoints, bound to the document and knowledge
// services (documents supply the source text; knowledge owns the lattice).
type Handlers struct {
	documents *doc.Documents
	knowledge *kb.Knowledge
	flatten   Flattener
}

// NewHandlers builds the knowledge endpoints.
func NewHandlers(documents *doc.Documents, knowledge *kb.Knowledge, flatten Flattener) Handlers {
	return Handlers{documents: documents, knowledge: knowledge, flatten: flatten}
}

// AddDocument flattens the selected project's document to text and adds (or
// re-syncs) it as a source in the lattice.
func (h Handlers) AddDocument(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot update the lattice")
	}
	d, err := h.documents.Get(ctx.Project.ID, req.Param("documentID"))
	if errors.Is(err, doc.ErrNotFound) {
		return errResp(http.StatusNotFound, "document not found")
	}
	if err != nil {
		return endpoint.Fail(http.StatusInternalServerError, "could not load document", err)
	}

	text, blocks := h.flatten(d)
	// A document's source id is its document id, which is the identity every
	// caller already addresses it by, so the label carries its name for a listing
	// rather than a second identifier.
	res, err := h.knowledge.Add(context.Background(), ctx.Project.ID, kb.SourceTypeDocument, d.ID, d.Name, text, blocks, d.Revision)
	if err != nil {
		return embedErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: res}
}

// RemoveDocument removes a document from the lattice by id. It does not load the
// document — a document that no longer exists is a reason to remove it, not a
// blocker — so it deletes the source directly and reports 404 only when the
// document was never indexed.
func (h Handlers) RemoveDocument(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot update the lattice")
	}
	res, err := h.knowledge.Remove(context.Background(), ctx.Project.ID, kb.SourceTypeDocument, req.Param("documentID"))
	if err != nil {
		return endpoint.Fail(http.StatusInternalServerError, "could not remove from the lattice", err)
	}
	if !res.Removed {
		return errResp(http.StatusNotFound, "document is not in the lattice")
	}
	return endpoint.Response{Status: http.StatusOK, Body: res}
}

// Retrieve embeds the query and returns the best-matching grounded spans.
func (h Handlers) Retrieve(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Query string `json:"query"`
		TopK  int    `json:"topK"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if strings.TrimSpace(in.Query) == "" {
		return errResp(http.StatusBadRequest, "query must not be empty")
	}
	res, err := h.knowledge.Retrieve(context.Background(), ctx.Project.ID, in.Query, in.TopK)
	if err != nil {
		return embedErr(err)
	}
	if res.Regions == nil {
		res.Regions = []kb.Region{}
	}
	return endpoint.Response{Status: http.StatusOK, Body: res}
}

// PreviewReembed returns the bounded size/cost estimate and freezes the target
// embedding-space identity used by a later start command.
func (h Handlers) PreviewReembed(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		ToSpace kb.EmbeddingSpace `json:"toSpace"`
		Policy  kb.ReembedPolicy  `json:"policy"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	preview, err := h.knowledge.PreviewReembed(context.Background(), kb.ReembedPreviewRequest{
		ProjectID: ctx.Project.ID,
		ActorID:   ctx.User.ID,
		ToSpace:   in.ToSpace,
		Policy:    in.Policy,
	})
	if err != nil {
		return embedErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: preview}
}

// StartReembed creates the durable shadow-generation run. The command is
// idempotent and does not promote when background construction finishes.
func (h Handlers) StartReembed(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in kb.ReembedCommand
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	run, err := h.knowledge.StartReembed(context.Background(), ctx.Project.ID, ctx.User.ID, in)
	if err != nil {
		return embedErr(err)
	}
	return endpoint.Response{Status: http.StatusAccepted, Body: run}
}

func (h Handlers) ReembedStatus(ctx access.Context, req endpoint.Request) endpoint.Response {
	run, err := h.knowledge.ReembedStatus(context.Background(), ctx.Project.ID, ctx.User.ID, req.Param("runID"))
	if err != nil {
		return embedErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: run}
}

func (h Handlers) controlReembed(ctx access.Context, req endpoint.Request, control kb.ReembedControl) endpoint.Response {
	run, err := h.knowledge.ControlReembed(context.Background(), ctx.Project.ID, ctx.User.ID, req.Param("runID"), control)
	if err != nil {
		return embedErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: run}
}

func (h Handlers) PauseReembed(ctx access.Context, req endpoint.Request) endpoint.Response {
	return h.controlReembed(ctx, req, kb.ControlPause)
}

func (h Handlers) ResumeReembed(ctx access.Context, req endpoint.Request) endpoint.Response {
	return h.controlReembed(ctx, req, kb.ControlResume)
}

func (h Handlers) CancelReembed(ctx access.Context, req endpoint.Request) endpoint.Response {
	return h.controlReembed(ctx, req, kb.ControlCancel)
}

func (h Handlers) PromoteReembed(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		ExpectedStateRevision int64 `json:"expectedStateRevision"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	state, err := h.knowledge.PromoteReembed(
		context.Background(), ctx.Project.ID, ctx.User.ID, req.Param("runID"), in.ExpectedStateRevision,
	)
	if err != nil {
		return embedErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: state}
}

func (h Handlers) RollbackReembed(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		ExpectedStateRevision int64 `json:"expectedStateRevision"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	state, err := h.knowledge.RollbackReembed(
		context.Background(), ctx.Project.ID, ctx.User.ID, in.ExpectedStateRevision,
	)
	if err != nil {
		return embedErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: state}
}

// listedSourceTypes is the set Sources walks when no type is named, matching the
// types the lattice admits.
var listedSourceTypes = []string{kb.SourceTypeDocument, kb.SourceTypeConnector, kb.SourceTypeAttachment}

// Sources lists the lattice sources admitted to the selected project: each
// source's addressable id together with the human name it was stored under.
//
// This is the registry made reachable. A source id is composed of minted ids on
// purpose — nothing in one is a name, so nothing in one can be corrupted by a
// filename or mangled in transit — and the consequence is that a caller holding
// only a name cannot construct the id it needs. Anything that addresses one file
// inside a connector or one member of an upload ("exclude this file from this
// block") has to look the id up, and this is where it looks.
//
// Optional `sourceType` narrows the walk; optional `prefix` narrows it further,
// which for a connector is its id plus the file separator — the exact
// enumeration of that connector's files and nothing else.
func (h Handlers) Sources(ctx access.Context, req endpoint.Request) endpoint.Response {
	types := listedSourceTypes
	if named := strings.TrimSpace(req.Query("sourceType")); named != "" {
		if !isListedSourceType(named) {
			return errResp(http.StatusBadRequest, "unknown source type")
		}
		types = []string{named}
	}
	prefix := req.Query("prefix")

	type sourceView struct {
		SourceType string `json:"sourceType"`
		SourceID   string `json:"sourceId"`
		Name       string `json:"name,omitempty"`
	}
	out := []sourceView{}
	for _, sourceType := range types {
		origins, err := h.knowledge.SourcesUnder(ctx.Project.ID, sourceType, prefix)
		if err != nil {
			return endpoint.Fail(http.StatusInternalServerError, "could not list sources", err)
		}
		for _, o := range origins {
			out = append(out, sourceView{SourceType: o.SourceType, SourceID: o.SourceID, Name: o.Label})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].SourceType != out[j].SourceType {
			return out[i].SourceType < out[j].SourceType
		}
		return out[i].SourceID < out[j].SourceID
	})
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"sources": out, "total": len(out)}}
}

func isListedSourceType(sourceType string) bool {
	for _, known := range listedSourceTypes {
		if known == sourceType {
			return true
		}
	}
	return false
}

// flatten renders a document's rows/blocks into the plain text the lattice
// indexes — each block's display text on its own line — and returns, alongside
// it, the byte-range → (row, block) map so retrieved spans cite real document
// addresses rather than offsets into a disposable string.
//
// Inferred blocks are skipped: a prompt block's text is generated *from* the
// lattice, so feeding it back in would let the lattice index its own output.
// Only authored source text is indexed.
// (The flattening itself lives in the composition root as wiring.FlattenDocument,
// injected above as a Flattener, so the reader that serves whole-source reads and
// this handler cannot disagree about what a document's text is.)

// embedErr maps stable Knowledge failures without exposing hidden source
// existence or provider detail. An embedding-space change is an administrative
// migration conflict; ordinary callers are never told to rewrite sources.
func embedErr(err error) endpoint.Response {
	if e, ok := limit.From(err); ok {
		status := http.StatusRequestEntityTooLarge
		if e.Code == kb.CodeArtifactLimit {
			status = http.StatusUnprocessableEntity
		}
		return endpoint.Response{Status: status, Body: e.Body(), Err: err}
	}
	if errors.Is(err, intelligence.ErrProviderNotConfigured) {
		return endpoint.Fail(http.StatusServiceUnavailable, "intelligence provider not configured", err)
	}
	type mapping struct {
		err     error
		status  int
		code    string
		message string
	}
	for _, m := range []mapping{
		{kb.ErrEmbeddingSpaceUnavailable, http.StatusServiceUnavailable, "knowledge.embedding_space_unavailable", "active embedding space is unavailable"},
		{kb.ErrEmbeddingSpaceChangeRequired, http.StatusConflict, "knowledge.embedding_space_change_required", "embedding-space migration required"},
		{kb.ErrGenerationConflict, http.StatusConflict, "knowledge.generation_conflict", "knowledge generation changed"},
		{kb.ErrReembedPreviewStale, http.StatusConflict, "knowledge.reembed_preview_stale", "re-embed preview is stale"},
		{kb.ErrReembedIncomplete, http.StatusConflict, "knowledge.reembed_incomplete", "re-embed is not ready"},
		{kb.ErrReembedValidationFailed, http.StatusUnprocessableEntity, "knowledge.reembed_validation_failed", "re-embed validation failed"},
		{kb.ErrReembedSourceChanged, http.StatusConflict, "knowledge.reembed_source_changed", "sources changed during re-embed"},
		{kb.ErrReembedCancelled, http.StatusConflict, "knowledge.reembed_cancelled", "re-embed was cancelled"},
		{kb.ErrRollbackExpired, http.StatusGone, "knowledge.rollback_expired", "generation rollback window expired"},
		{kb.ErrEvidenceChanged, http.StatusConflict, "knowledge.evidence_changed", "knowledge evidence changed during retrieval"},
		{kb.ErrEvidenceCorrupt, http.StatusInternalServerError, "knowledge.evidence_corrupt", "knowledge evidence failed integrity validation"},
		{kb.ErrReembedForbidden, http.StatusForbidden, "knowledge.reembed_forbidden", "project owner access required"},
		{kb.ErrReembedNotFound, http.StatusNotFound, "knowledge.reembed_not_found", "re-embed run not found"},
	} {
		if errors.Is(err, m.err) {
			return endpoint.Response{
				Status: m.status,
				Body:   map[string]any{"code": m.code, "error": m.message, "retryable": false},
				Err:    err,
			}
		}
	}
	return endpoint.Fail(http.StatusBadGateway, "lattice embedding failed", err)
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}
