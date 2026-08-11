// Chat attachment -> knowledge adapter.
//
// An attachment's bytes live in the file capability and its content belongs in
// the knowledge lattice, but the chat capability imports neither. Composing that
// here keeps chat free of both, exactly as connectorLatticeWriter does for
// connectors.
package wiring

import (
	"context"
	"unicode/utf8"

	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// attachmentLatticeWriter admits a chat attachment's text to the project's
// knowledge under the attachment source type, and withdraws it again. It is the
// seam that keeps the chat capability independent of both knowledge and file.
type attachmentLatticeWriter struct {
	know  *knowledge.Knowledge
	files *file.Files
}

// IndexAttachment resolves the attachment's bytes and admits them as one
// knowledge source. File metadata is trusted only because it was written by the
// local File capability; the Knowledge stream still counts the returned bytes.
// Content that is not UTF-8 text is skipped without error: a PDF or an image is
// a legitimate attachment that this text lattice cannot index.
func (w attachmentLatticeWriter) IndexAttachment(projectID, sourceID, label, fileID string) error {
	if w.know == nil || w.files == nil {
		return nil
	}
	scope := file.Scope{ProjectID: projectID}
	meta, err := w.files.Meta(scope, fileID)
	if err != nil {
		return err
	}
	if max := w.know.MaxSourceBytes(); max > 0 && meta.Size > max {
		return knowledge.SourceBytesLimit(sourceID, max, meta.Size)
	}
	_, content, err := w.files.Download(scope, fileID)
	if err != nil {
		return err
	}
	if len(content) == 0 || !utf8.Valid(content) {
		return nil
	}
	_, err = w.know.Add(context.Background(), projectID, knowledge.SourceTypeAttachment, sourceID, label,
		string(content), []knowledge.BlockSpan{{Start: 0, End: len(content)}}, 0)
	return err
}

// RemoveAttachment withdraws the attachment's content from knowledge. Removing a
// source that was never admitted — a skipped binary, say — is not an error.
func (w attachmentLatticeWriter) RemoveAttachment(projectID, sourceID string) error {
	if w.know == nil {
		return nil
	}
	_, err := w.know.Remove(context.Background(), projectID, knowledge.SourceTypeAttachment, sourceID)
	return err
}

// chatAttachmentLister adapts the chat attachment store to the agent's
// Attachments port, reporting each attachment's stable File Resource id and
// whether the File family can project it as text. Composing it here keeps the
// agent capability free of both chat and file.
type chatAttachmentLister struct {
	attachments chat.AttachmentStore
	files       *file.Files
}

// ChatAttachments lists one chat's attachments. Readability depends on the
// owning File's textual projection, never on whether Knowledge admitted it.
// The chat's ownership of the Project is proven by the caller before the tool
// is ever bound.
func (l chatAttachmentLister) ChatAttachments(projectID, chatID string) ([]agent.AttachmentRef, error) {
	if l.attachments == nil {
		return nil, nil
	}
	atts, err := l.attachments.ChatAttachmentsByChat(chatID)
	if err != nil {
		return nil, err
	}
	refs := make([]agent.AttachmentRef, 0, len(atts))
	for _, a := range atts {
		if a.ProjectID != projectID {
			continue
		}
		ref := agent.AttachmentRef{Name: a.Name, RelativePath: a.RelativePath, ResourceID: a.FileID}
		if l.files != nil {
			if meta, err := l.files.Meta(file.Scope{ProjectID: projectID}, a.FileID); err == nil {
				ref.Readable = textualContentType(meta.ContentType)
			}
		}
		refs = append(refs, ref)
	}
	return refs, nil
}
