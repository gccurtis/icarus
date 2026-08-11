package wiring

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/connector"
	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

type reembedMembershipStub struct {
	role access.Role
	err  error
}

func (s reembedMembershipStub) MembershipRole(string, string) (access.Role, error) {
	return s.role, s.err
}

type reembedEntitlementStub struct {
	space knowledge.EmbeddingSpace
	err   error
}

func (s reembedEntitlementStub) ConfiguredSpace(context.Context) (knowledge.EmbeddingSpace, error) {
	return s.space, s.err
}

func TestKnowledgeReembedAuthorizerRequiresCurrentOwner(t *testing.T) {
	target := knowledge.SpaceForIdentity(knowledge.VectorIdentity{Provider: "p", Model: "m", Dims: 8})
	for _, tc := range []struct {
		name string
		role access.Role
		err  error
		want error
	}{
		{name: "owner", role: access.RoleOwner},
		{name: "editor", role: access.RoleEdit, want: knowledge.ErrReembedForbidden},
		{name: "reader", role: access.RoleRead, want: knowledge.ErrReembedForbidden},
		{name: "nonmember", err: access.ErrForbidden, want: knowledge.ErrReembedForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := knowledgeReembedAuthorizer{
				access:     reembedMembershipStub{role: tc.role, err: tc.err},
				embeddings: reembedEntitlementStub{space: target},
			}
			err := a.AuthorizeReembed(context.Background(), "p1", "u1", target)
			if !errors.Is(err, tc.want) || (tc.want == nil && err != nil) {
				t.Fatalf("AuthorizeReembed() = %v, want %v", err, tc.want)
			}
		})
	}

	t.Run("target model is not entitled", func(t *testing.T) {
		a := knowledgeReembedAuthorizer{
			access: reembedMembershipStub{role: access.RoleOwner},
			embeddings: reembedEntitlementStub{space: knowledge.SpaceForIdentity(
				knowledge.VectorIdentity{Provider: "p", Model: "other", Dims: 8},
			)},
		}
		if err := a.AuthorizeReembed(context.Background(), "p1", "u1", target); !errors.Is(err, knowledge.ErrReembedForbidden) {
			t.Fatalf("AuthorizeReembed() = %v, want ErrReembedForbidden", err)
		}
	})
}

type reembedResourceAccessStub struct {
	allowed bool
	err     error
	kind    resource.Kind
	id      string
}

func (s *reembedResourceAccessStub) CanAccessResource(
	_, _ string,
	kind resource.Kind,
	id string,
) (bool, error) {
	s.kind, s.id = kind, id
	return s.allowed, s.err
}

type reembedDocumentStub struct {
	doc document.Document
	err error
}

func (s reembedDocumentStub) Get(string, string) (document.Document, error) {
	return s.doc, s.err
}

type reembedConnectorStub struct {
	text            string
	meta            connector.ItemMeta
	err             error
	connectorID     string
	itemID          string
	expectedVersion string
}

func (s *reembedConnectorStub) OpenItem(
	_ context.Context,
	_, connectorID, itemID, expectedVersion string,
) (io.ReadCloser, connector.ItemMeta, error) {
	s.connectorID, s.itemID, s.expectedVersion = connectorID, itemID, expectedVersion
	if s.err != nil {
		return nil, connector.ItemMeta{}, s.err
	}
	return io.NopCloser(strings.NewReader(s.text)), s.meta, nil
}

type reembedAttachmentStub struct {
	fileID string
	found  bool
	err    error
}

func (s reembedAttachmentStub) AttachmentFileBySourceID(
	chat.Scope,
	string,
) (string, bool, error) {
	return s.fileID, s.found, s.err
}

type reembedFileStub struct {
	meta    file.File
	content []byte
	err     error
}

func (s reembedFileStub) Meta(file.Scope, string) (file.File, error) {
	return s.meta, s.err
}

func (s reembedFileStub) Download(file.Scope, string) (file.File, []byte, error) {
	return s.meta, append([]byte(nil), s.content...), s.err
}

func readReembedItem(t *testing.T, item knowledge.AddItem) string {
	t.Helper()
	rc, err := item.Content.Open()
	if err != nil {
		t.Fatalf("open content: %v", err)
	}
	defer rc.Close()
	body, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("read content: %v", err)
	}
	return string(body)
}

func TestKnowledgeReembedSourceReaderReadsCanonicalFamilies(t *testing.T) {
	t.Run("document", func(t *testing.T) {
		auth := &reembedResourceAccessStub{allowed: true}
		reader := knowledgeReembedSourceReader{
			resources: auth,
			documents: reembedDocumentStub{doc: document.Document{
				ID: "d1", ProjectID: "p1", Name: "Current name", Revision: 9,
				Lifecycle: document.LifecycleActive,
				Base: document.Base{Rows: []document.Row{{
					ID: "r1",
					Blocks: []document.Block{{
						ID: "b1", Kind: document.BlockKindText,
						Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "alpha"}},
					}},
				}}},
			}},
		}
		item, err := reader.ReadReembedSource(context.Background(), "p1", "u1", knowledge.Source{
			ProjectID: "p1", SourceType: knowledge.SourceTypeDocument, SourceID: "d1",
		})
		if err != nil {
			t.Fatal(err)
		}
		if got := readReembedItem(t, item); got != "alpha\n" {
			t.Fatalf("content = %q, want canonical flattened document", got)
		}
		if auth.kind != resource.KindDocument || auth.id != "d1" || item.Revision != 9 ||
			item.Label != "Current name" || len(item.Blocks) != 1 {
			t.Fatalf("document item/auth = %+v, kind=%q id=%q", item, auth.kind, auth.id)
		}
	})

	t.Run("connector item", func(t *testing.T) {
		auth := &reembedResourceAccessStub{allowed: true}
		origin := &reembedConnectorStub{
			text: "streamed connector text",
			meta: connector.ItemMeta{Version: "hash-7", ContentHash: "hash-7"},
		}
		reader := knowledgeReembedSourceReader{resources: auth, connectors: origin}
		item, err := reader.ReadReembedSource(context.Background(), "p1", "u1", knowledge.Source{
			ProjectID: "p1", SourceType: knowledge.SourceTypeConnector,
			SourceID: connector.FileSourceID("c1", "f1"), Label: "dir/a.txt",
			SizeBytes: 23, ContentHash: "hash-7", Revision: 7,
		})
		if err != nil {
			t.Fatal(err)
		}
		if got := readReembedItem(t, item); got != origin.text {
			t.Fatalf("content = %q, want %q", got, origin.text)
		}
		if auth.kind != resource.KindConnector || auth.id != "c1" ||
			origin.connectorID != "c1" || origin.itemID != "dir/a.txt" ||
			origin.expectedVersion != "" || item.Revision != 7 {
			t.Fatalf("connector item/auth mismatch: item=%+v origin=%+v", item, origin)
		}
	})

	t.Run("attachment", func(t *testing.T) {
		auth := &reembedResourceAccessStub{allowed: true}
		content := []byte("current attachment text")
		reader := knowledgeReembedSourceReader{
			resources: auth,
			chats:     reembedAttachmentStub{fileID: "file1", found: true},
			files: reembedFileStub{
				meta:    file.File{ID: "file1", ProjectID: "p1", ContentType: "text/plain", Size: int64(len(content))},
				content: content,
			},
		}
		item, err := reader.ReadReembedSource(context.Background(), "p1", "u1", knowledge.Source{
			ProjectID: "p1", SourceType: knowledge.SourceTypeAttachment,
			SourceID: "upload1/attachment1", Label: "notes.txt", Revision: 3,
		})
		if err != nil {
			t.Fatal(err)
		}
		if got := readReembedItem(t, item); got != string(content) {
			t.Fatalf("content = %q, want %q", got, content)
		}
		if auth.kind != resource.KindFile || auth.id != "file1" ||
			item.Content.Hash != knowledge.ContentHash(string(content)) || item.Revision != 3 {
			t.Fatalf("attachment item/auth = %+v, kind=%q id=%q", item, auth.kind, auth.id)
		}
	})
}

func TestKnowledgeReembedSourceReaderFailsClosed(t *testing.T) {
	source := knowledge.Source{
		ProjectID: "p1", SourceType: knowledge.SourceTypeDocument, SourceID: "d1",
	}
	denied := knowledgeReembedSourceReader{
		resources: &reembedResourceAccessStub{allowed: false},
		documents: reembedDocumentStub{doc: document.Document{ID: "d1", ProjectID: "p1"}},
	}
	if _, err := denied.ReadReembedSource(context.Background(), "p1", "u1", source); !errors.Is(err, knowledge.ErrReembedForbidden) {
		t.Fatalf("denied read = %v, want ErrReembedForbidden", err)
	}

	gone := knowledgeReembedSourceReader{
		resources: &reembedResourceAccessStub{allowed: true},
		documents: reembedDocumentStub{err: document.ErrNotFound},
	}
	if _, err := gone.ReadReembedSource(context.Background(), "p1", "u1", source); !errors.Is(err, knowledge.ErrReembedSourceChanged) {
		t.Fatalf("gone read = %v, want ErrReembedSourceChanged", err)
	}

	binary := knowledgeReembedSourceReader{
		resources: &reembedResourceAccessStub{allowed: true},
		chats:     reembedAttachmentStub{fileID: "file1", found: true},
		files: reembedFileStub{
			meta:    file.File{ID: "file1", ProjectID: "p1", ContentType: "image/png"},
			content: []byte("not text"),
		},
	}
	source.SourceType, source.SourceID = knowledge.SourceTypeAttachment, "upload1/attachment1"
	if _, err := binary.ReadReembedSource(context.Background(), "p1", "u1", source); !errors.Is(err, knowledge.ErrReembedIncomplete) {
		t.Fatalf("binary read = %v, want ErrReembedIncomplete", err)
	}
}
