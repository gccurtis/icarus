package wiring

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"strconv"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// documentAuthorizer adapts the resource access-scope resolver to the agent's
// DocumentAuthorizer port, so an agent's document tools honor the same
// per-resource access as the HTTP routes — without the agent capability
// importing the resource capability.
type documentAuthorizer struct{ resources *resource.Resources }

func (a documentAuthorizer) CanAccessDocument(userID, projectID, documentID string) (bool, error) {
	return a.resources.CanAccessResource(userID, projectID, resource.KindDocument, documentID)
}

// documentResourceFamily adapts the canonical Document owner to the unified
// Resource catalog without either capability importing the other.
type documentResourceFamily struct{ documents *document.Documents }

func (f documentResourceFamily) Kind() resource.Kind { return resource.KindDocument }

func (f documentResourceFamily) List(projectID string, before *resource.Boundary, limit int) ([]resource.Summary, error) {
	var documentBoundary *document.SummaryBoundary
	if before != nil {
		documentBoundary = &document.SummaryBoundary{UpdatedAt: before.UpdatedAt}
		switch {
		case resource.KindDocument == before.Kind:
			documentBoundary.ID = before.ID
		case resource.KindDocument < before.Kind:
			documentBoundary.SkipEqualTime = true
		default:
			documentBoundary.ID = ""
		}
	}
	items, err := f.documents.Summaries(projectID, documentBoundary, limit)
	if err != nil {
		return nil, err
	}
	out := make([]resource.Summary, len(items))
	for i, item := range items {
		out[i] = resource.Summary{
			ID: item.ID, Kind: resource.KindDocument, Name: item.Name,
			CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt, CreatorID: item.CreatorID,
		}
	}
	return out, nil
}

func (f documentResourceFamily) Get(projectID, id string) (resource.Summary, error) {
	summary, err := f.documents.Summary(projectID, id)
	if err != nil {
		return resource.Summary{}, mapDocumentResourceError(err)
	}
	return resource.Summary{
		ID: summary.ID, Kind: resource.KindDocument, Name: summary.Name,
		CreatedAt: summary.CreatedAt, UpdatedAt: summary.UpdatedAt, CreatorID: summary.CreatorID,
	}, nil
}

func (f documentResourceFamily) Create(projectID string, actor resource.Actor, name string) (resource.Summary, error) {
	doc, err := f.documents.Create(projectID, name, document.Base{}, document.Actor{ID: actor.ID, Name: actor.Name})
	return documentResourceSummary(doc), mapDocumentResourceError(err)
}

func (f documentResourceFamily) Rename(projectID string, actor resource.Actor, id, name string) (resource.Summary, error) {
	doc, err := f.documents.Rename(projectID, id, name, document.Actor{ID: actor.ID, Name: actor.Name})
	return documentResourceSummary(doc), mapDocumentResourceError(err)
}

func (f documentResourceFamily) Delete(projectID string, actor resource.Actor, id string) error {
	return mapDocumentResourceError(f.documents.Delete(projectID, id, document.Actor{ID: actor.ID, Name: actor.Name}))
}

// OpenProjection exposes the Document family's model-readable text projection.
// It resolves the current revision through Documents.Get, so it never depends on
// Knowledge admission or serves an indexed snapshot.
func (f documentResourceFamily) OpenProjection(ctx context.Context, scope resource.ProjectScope, locator resource.ResourceLocator, req resource.ProjectionRequest) (resource.VersionedProjection, error) {
	if err := ctx.Err(); err != nil {
		return resource.VersionedProjection{}, err
	}
	if locator.Subpath != "" || req.Subpath != "" || (locator.Projection != "" && locator.Projection != "text") {
		return resource.VersionedProjection{}, resource.ErrProjectionUnsupported
	}
	doc, err := f.documents.Get(scope.ProjectID, locator.ResourceID)
	if errors.Is(err, document.ErrNotFound) {
		return resource.VersionedProjection{}, resource.ErrOriginGone
	}
	if err != nil {
		return resource.VersionedProjection{}, err
	}
	if doc.Lifecycle == document.LifecycleTrashed {
		return resource.VersionedProjection{}, resource.ErrTrashed
	}
	text, _ := FlattenDocument(doc)
	hash := sha256.Sum256([]byte(text))
	return resource.VersionedProjection{
		Version:     strconv.FormatInt(doc.Revision, 10),
		ContentHash: hex.EncodeToString(hash[:]),
		MediaType:   "text/plain; charset=utf-8",
		Text:        io.NopCloser(strings.NewReader(text)),
	}, nil
}

func documentResourceSummary(doc document.Document) resource.Summary {
	return resource.Summary{
		ID: doc.ID, Kind: resource.KindDocument, Name: doc.Name,
		CreatedAt: doc.CreatedAt, UpdatedAt: doc.UpdatedAt, CreatorID: doc.CreatorID,
	}
}

func mapDocumentResourceError(err error) error {
	switch {
	case errors.Is(err, document.ErrNotFound):
		return resource.ErrNotFound
	case errors.Is(err, document.ErrInvalidName):
		return resource.ErrInvalidName
	default:
		return err
	}
}
