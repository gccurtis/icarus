# knowledge.go

Dev knowledge endpoints: add/remove document from lattice, retrieve, with
revision-tagged source identity.

## Code breakdown

```go
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
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	doc "github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	kb "github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers holds the knowledge endpoints, bound to the document and knowledge
// services (documents supply the source text; knowledge owns the lattice).
type Handlers struct {
	documents *doc.Documents
	knowledge *kb.Knowledge
}

// NewHandlers builds the knowledge endpoints.
func NewHandlers(documents *doc.Documents, knowledge *kb.Knowledge) Handlers {
	return Handlers{documents: documents, knowledge: knowledge}
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
		return errResp(http.StatusInternalServerError, "could not load document")
	}

	text, blocks := flatten(d)
	res, err := h.knowledge.Add(context.Background(), ctx.Project.ID, kb.SourceTypeDocument, d.ID, text, blocks, d.Revision)
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
		return errResp(http.StatusInternalServerError, "could not remove from the lattice")
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

// flatten renders a document's rows/blocks into the plain text the lattice
// indexes — each block's display text on its own line — and returns, alongside
// it, the byte-range → (row, block) map so retrieved spans cite real document
// addresses rather than offsets into a disposable string.
//
// Inferred blocks are skipped: a prompt block's text is generated *from* the
// lattice, so feeding it back in would let the lattice index its own output.
// Only authored source text is indexed.
func flatten(d doc.Document) (string, []kb.BlockSpan) {
	var sb strings.Builder
	var blocks []kb.BlockSpan
	for _, r := range d.Base.Rows {
		for _, b := range r.Blocks {
			if b.Inferred {
				continue
			}
			start := sb.Len()
			sb.WriteString(b.DisplayText())
			blocks = append(blocks, kb.BlockSpan{RowID: r.ID, BlockID: b.ID, Start: start, End: sb.Len()})
			sb.WriteByte('\n')
		}
	}
	return sb.String(), blocks
}

// embedErr maps an embedding failure onto a status: an unconfigured provider is
// a service-unavailable, a vector-identity mismatch is a conflict the caller
// resolves by re-adding sources, anything else a bad gateway with a generic
// message.
func embedErr(err error) endpoint.Response {
	if errors.Is(err, intelligence.ErrProviderNotConfigured) {
		return errResp(http.StatusServiceUnavailable, "intelligence provider not configured")
	}
	if errors.Is(err, kb.ErrIdentityMismatch) {
		return errResp(http.StatusConflict, "embedding model changed since sources were added; edit or remove-and-re-add them to rebuild the lattice")
	}
	return errResp(http.StatusBadGateway, "lattice embedding failed")
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
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

### A document indexes under its name as the label

`Add` is called with the document's `Name` as the source label. A document's
source id is its document id, which is already the identity every caller
addresses it by, so unlike a connector file or an attachment it needs no minted
member id — but a listing still has to be able to say which document a source is,
and the label is where that lives.

### `Sources` — the registry, reachable

Lists the project's lattice sources: each source's addressable id together with
the name it was stored under. `sourceType` narrows the walk; `prefix` narrows it
further, and for a connector `prefix=<connectorID>/` enumerates exactly that
connector's files and nothing else.

It exists because source ids are composed of minted ids. That is the right trade
for addressing — nothing in an id can be corrupted by a filename or mangled in
transit — but it means a caller holding only a name cannot construct the id it
needs. "Exclude this one file from this block" is exactly that caller: it knows
what the user is looking at, which is a name.

Without this the mapping is real but unreachable outside the process that owns
it, which is the same as not having it. The `connector-context` suite uses this
route rather than a workaround, so the flow a product needs is the flow a suite
exercises.

Two connectors may each hold a file of the same name. They are separated by the
prefix rather than the name — two sources, two ids, two prefixes — so the lookup
stays exact.

### Failures carry their cause

Its 5 failure responses (`could not load document`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.

### `Flattener` is injected rather than defined here

`flatten` used to live in this package. It is now `wiring.FlattenDocument`, passed in
as a `Flattener`.

The reason is that two composition points need the same answer and must not drift:
this handler, which admits a document, and the origin reader, which flattens one again
to serve a whole-source read. A read whose text disagreed with the text that was
indexed would return byte ranges citing the wrong components — silently, since both
would look well-formed.

One definition, supplied from the one place that can see both sides. The handler keeps
its logic visible; only the conversion moved.
