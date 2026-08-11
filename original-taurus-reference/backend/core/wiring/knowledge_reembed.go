package wiring

import (
	"context"
	"errors"
	"io"
	"strings"
	"unicode/utf8"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// These narrow interfaces keep the composition adapter independently testable.
// The production services satisfy them directly; Knowledge still sees only its
// own ReembedAuthorizer and ReembedSourceReader ports.
type reembedMemberships interface {
	MembershipRole(userID, projectID string) (access.Role, error)
}

type reembedEmbeddingEntitlements interface {
	ConfiguredSpace(ctx context.Context) (knowledge.EmbeddingSpace, error)
}

type reembedResourceAccess interface {
	CanAccessResource(callerID, projectID string, kind resource.Kind, id string) (bool, error)
}

type reembedDocuments interface {
	Get(projectID, id string) (document.Document, error)
}

type reembedConnectors interface {
	OpenItem(ctx context.Context, projectID, connectorID, providerItemID, expectedVersion string) (io.ReadCloser, connector.ItemMeta, error)
}

type reembedAttachments interface {
	AttachmentFileBySourceID(scope chat.Scope, sourceID string) (string, bool, error)
}

type reembedFiles interface {
	Meta(scope file.Scope, id string) (file.File, error)
	Download(scope file.Scope, id string) (file.File, []byte, error)
}

// knowledgeReembedAuthorizer rechecks Project administration at every lifecycle
// boundary. Project ownership is the administration role available today:
// editors may change content, but may not spend for or publish a Project-wide
// embedding generation.
type knowledgeReembedAuthorizer struct {
	access     reembedMemberships
	embeddings reembedEmbeddingEntitlements
}

var _ knowledge.ReembedAuthorizer = knowledgeReembedAuthorizer{}

func (a knowledgeReembedAuthorizer) AuthorizeReembed(
	ctx context.Context,
	projectID, actorID string,
	target knowledge.EmbeddingSpace,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if a.access == nil || strings.TrimSpace(projectID) == "" || strings.TrimSpace(actorID) == "" {
		return knowledge.ErrReembedForbidden
	}
	role, err := a.access.MembershipRole(actorID, projectID)
	if err != nil {
		if errors.Is(err, access.ErrForbidden) || errors.Is(err, access.ErrNotFound) {
			return knowledge.ErrReembedForbidden
		}
		return err
	}
	if role != access.RoleOwner {
		return knowledge.ErrReembedForbidden
	}
	if a.embeddings == nil {
		return knowledge.ErrReembedForbidden
	}
	configured, err := a.embeddings.ConfiguredSpace(ctx)
	if err != nil {
		return knowledge.ErrEmbeddingSpaceUnavailable
	}
	if configured.Provider != target.Provider || configured.Model != target.Model ||
		(configured.Dimensions > 0 && configured.Dimensions != target.Dimensions) {
		return knowledge.ErrReembedForbidden
	}
	return nil
}

// knowledgeReembedSourceReader resolves one admitted source back to its current
// canonical owner. It reauthorizes before touching the origin and returns the
// same streaming AddItem shape ordinary ingest uses, so Ω-003's byte and
// artifact ceilings remain authoritative during a migration.
type knowledgeReembedSourceReader struct {
	resources  reembedResourceAccess
	documents  reembedDocuments
	connectors reembedConnectors
	chats      reembedAttachments
	files      reembedFiles
}

var _ knowledge.ReembedSourceReader = knowledgeReembedSourceReader{}

func (r knowledgeReembedSourceReader) ReadReembedSource(
	ctx context.Context,
	projectID, actorID string,
	source knowledge.Source,
) (knowledge.AddItem, error) {
	if err := ctx.Err(); err != nil {
		return knowledge.AddItem{}, err
	}
	if r.resources == nil || strings.TrimSpace(projectID) == "" || strings.TrimSpace(actorID) == "" ||
		source.ProjectID != projectID {
		return knowledge.AddItem{}, knowledge.ErrReembedForbidden
	}

	switch source.SourceType {
	case knowledge.SourceTypeDocument:
		return r.readDocument(ctx, projectID, actorID, source)
	case knowledge.SourceTypeConnector:
		return r.readConnector(ctx, projectID, actorID, source)
	case knowledge.SourceTypeAttachment:
		return r.readAttachment(ctx, projectID, actorID, source)
	default:
		return knowledge.AddItem{}, knowledge.ErrReembedIncomplete
	}
}

func (r knowledgeReembedSourceReader) authorize(
	actorID, projectID string,
	kind resource.Kind,
	id string,
) error {
	allowed, err := r.resources.CanAccessResource(actorID, projectID, kind, id)
	if err != nil {
		if errors.Is(err, resource.ErrAccessDenied) {
			return knowledge.ErrReembedForbidden
		}
		if errors.Is(err, resource.ErrNotFound) {
			return knowledge.ErrReembedSourceChanged
		}
		return err
	}
	if !allowed {
		return knowledge.ErrReembedForbidden
	}
	return nil
}

func (r knowledgeReembedSourceReader) readDocument(
	ctx context.Context,
	projectID, actorID string,
	source knowledge.Source,
) (knowledge.AddItem, error) {
	if r.documents == nil {
		return knowledge.AddItem{}, knowledge.ErrReembedIncomplete
	}
	if err := r.authorize(actorID, projectID, resource.KindDocument, source.SourceID); err != nil {
		return knowledge.AddItem{}, err
	}
	if err := ctx.Err(); err != nil {
		return knowledge.AddItem{}, err
	}
	doc, err := r.documents.Get(projectID, source.SourceID)
	if errors.Is(err, document.ErrNotFound) {
		return knowledge.AddItem{}, knowledge.ErrReembedSourceChanged
	}
	if err != nil {
		return knowledge.AddItem{}, err
	}
	if doc.ProjectID != projectID || doc.Lifecycle == document.LifecycleTrashed {
		return knowledge.AddItem{}, knowledge.ErrReembedSourceChanged
	}
	text, blocks := FlattenDocument(doc)
	return knowledge.AddItem{
		SourceType: source.SourceType,
		SourceID:   source.SourceID,
		Label:      doc.Name,
		Content:    knowledge.TextContent(text),
		Blocks:     blocks,
		Revision:   doc.Revision,
	}, nil
}

func (r knowledgeReembedSourceReader) readConnector(
	ctx context.Context,
	projectID, actorID string,
	source knowledge.Source,
) (knowledge.AddItem, error) {
	if r.connectors == nil {
		return knowledge.AddItem{}, knowledge.ErrReembedIncomplete
	}
	connectorID, _, found := strings.Cut(source.SourceID, connector.FileSeparator)
	if !found || connectorID == "" || strings.TrimSpace(source.Label) == "" {
		return knowledge.AddItem{}, knowledge.ErrReembedIncomplete
	}
	if err := r.authorize(actorID, projectID, resource.KindConnector, connectorID); err != nil {
		return knowledge.AddItem{}, err
	}

	// Source records retain a content hash, not the provider's opaque version.
	// Open the current item without pretending those identities are equivalent,
	// then compare the provider hash and let bounded ingest verify the streamed
	// bytes against Content.Hash.
	open := func() (io.ReadCloser, error) {
		rc, meta, err := r.connectors.OpenItem(
			ctx, projectID, connectorID, source.Label, "",
		)
		switch {
		case errors.Is(err, connector.ErrNotFound), errors.Is(err, connector.ErrVersionChanged):
			return nil, knowledge.ErrReembedSourceChanged
		case errors.Is(err, connector.ErrPointRead), errors.Is(err, connector.ErrInvalidPath):
			return nil, knowledge.ErrReembedIncomplete
		case err != nil:
			return nil, err
		}
		if source.ContentHash != "" && meta.ContentHash != "" && meta.ContentHash != source.ContentHash {
			_ = rc.Close()
			return nil, knowledge.ErrReembedSourceChanged
		}
		return rc, nil
	}
	return knowledge.AddItem{
		SourceType: source.SourceType,
		SourceID:   source.SourceID,
		Label:      source.Label,
		Content: knowledge.Content{
			Size: int64(source.SizeBytes),
			Hash: source.ContentHash,
			Open: open,
		},
		Blocks:   []knowledge.BlockSpan{{Start: 0, End: source.SizeBytes}},
		Revision: source.Revision,
	}, nil
}

func (r knowledgeReembedSourceReader) readAttachment(
	ctx context.Context,
	projectID, actorID string,
	source knowledge.Source,
) (knowledge.AddItem, error) {
	if r.chats == nil || r.files == nil {
		return knowledge.AddItem{}, knowledge.ErrReembedIncomplete
	}
	scope := chat.Scope{ProjectID: projectID}
	fileID, found, err := r.chats.AttachmentFileBySourceID(scope, source.SourceID)
	if errors.Is(err, chat.ErrNotFound) || (!found && err == nil) {
		return knowledge.AddItem{}, knowledge.ErrReembedSourceChanged
	}
	if err != nil {
		return knowledge.AddItem{}, err
	}
	if err := r.authorize(actorID, projectID, resource.KindFile, fileID); err != nil {
		return knowledge.AddItem{}, err
	}
	fileScope := file.Scope{ProjectID: projectID}
	meta, err := r.files.Meta(fileScope, fileID)
	if errors.Is(err, file.ErrNotFound) {
		return knowledge.AddItem{}, knowledge.ErrReembedSourceChanged
	}
	if err != nil {
		return knowledge.AddItem{}, err
	}
	if !textualContentType(meta.ContentType) {
		return knowledge.AddItem{}, knowledge.ErrReembedIncomplete
	}
	_, content, err := r.files.Download(fileScope, fileID)
	if errors.Is(err, file.ErrNotFound) {
		return knowledge.AddItem{}, knowledge.ErrReembedSourceChanged
	}
	if err != nil {
		return knowledge.AddItem{}, err
	}
	if len(content) == 0 || !utf8.Valid(content) {
		return knowledge.AddItem{}, knowledge.ErrReembedIncomplete
	}
	text := string(content)
	return knowledge.AddItem{
		SourceType: source.SourceType,
		SourceID:   source.SourceID,
		Label:      source.Label,
		Content:    knowledge.TextContent(text),
		Blocks:     []knowledge.BlockSpan{{Start: 0, End: len(content)}},
		Revision:   source.Revision,
	}, nil
}
