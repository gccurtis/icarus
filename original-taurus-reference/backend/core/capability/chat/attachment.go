package chat

import (
	"errors"
	"strings"
	"time"
)

// Attachment kinds. A "file" attachment is a single uploaded file; a "directory"
// attachment is one file that belongs to a directory upload (its siblings share a
// DirectoryUploadID and carry their browser-relative paths).
const (
	AttachmentFile      = "file"
	AttachmentDirectory = "directory"
)

const (
	maxAttachmentName = 512
	maxRelativePath   = 1024
)

// Attachment links a chat to an uploaded file (whose bytes live in the file
// capability). The chat capability stores only the reference and presentation
// metadata, so it never imports the file capability.
type Attachment struct {
	ID                string    `json:"id"`
	ChatID            string    `json:"chatId"`
	ProjectID         string    `json:"projectId"`
	Kind              string    `json:"kind"`
	FileID            string    `json:"fileId"`
	Name              string    `json:"name"`
	RelativePath      string    `json:"relativePath,omitempty"`
	DirectoryUploadID string    `json:"directoryUploadId,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
}

// AttachmentInput is the caller-supplied part of a new attachment. The handler
// has already stored the bytes in the file capability and passes the resulting
// FileID here.
type AttachmentInput struct {
	FileID            string
	Name              string
	RelativePath      string
	DirectoryUploadID string
}

// AttachmentStore persists chat attachments. As with every capability, one
// *sqlite.Store implements it alongside the others, so method names are
// attachment-specific.
type AttachmentStore interface {
	CreateChatAttachment(Attachment) error
	ChatAttachmentsByChat(chatID string) ([]Attachment, error)
	// ChatAttachmentByID returns one attachment scoped to its project: an
	// attachment owned by another project is ErrNotFound. DeleteAttachment
	// compares ProjectID and ChatID afterwards anyway — deliberately redundant.
	ChatAttachmentByID(projectID, id string) (Attachment, error)
	DeleteChatAttachment(id string) error
}

// AttachmentIndexer admits an attachment's content to the project's Knowledge
// and withdraws it again. It is a port rather than a direct dependency so this
// capability keeps importing neither knowledge nor file: the composition layer
// supplies an implementation that resolves FileID to bytes and feeds the
// lattice.
//
// Indexing is what makes an attachment usable. Content merely inlined into a
// turn's prompt is material the answer has no way to cite, so a grounded answer
// resting on it is rejected for having no citation. Admitted to Knowledge, an
// attachment is retrieved and cited exactly like a document or a connector's
// file, and needs no special case anywhere downstream.
type AttachmentIndexer interface {
	// IndexAttachment admits the bytes behind fileID under sourceID, labelled with
	// the name a person knows the file by. Binary content is skipped without error;
	// a configured Knowledge capacity refusal is returned with its typed contract.
	IndexAttachment(projectID, sourceID, label, fileID string) error
	// RemoveAttachment withdraws sourceID from the project's Knowledge.
	RemoveAttachment(projectID, sourceID string) error
}

// UseAttachments injects the attachment store. Set once at composition; a nil
// store leaves the attachment methods returning ErrAttachmentsUnavailable.
func (c *Chats) UseAttachments(store AttachmentStore) { c.attachments = store }

// UseAttachmentIndexer injects the Knowledge indexer. Set once at composition; a
// nil indexer leaves attachments stored but never admitted to Knowledge, which
// is the correct behavior for a deployment running without Knowledge at all.
func (c *Chats) UseAttachmentIndexer(indexer AttachmentIndexer) { c.attachmentIndex = indexer }

// ValidateBoundPorts closes the attachment/File/Knowledge construction cycle
// for the production profile before the transport becomes ready.
func (c *Chats) ValidateBoundPorts() error {
	if c.attachments == nil {
		return errors.New("chat: attachment store port is required")
	}
	if c.attachmentIndex == nil {
		return errors.New("chat: attachment indexer port is required")
	}
	return nil
}

// SourceID is the attachment's identity in Knowledge: a grouping id joined to
// the attachment's own id. Files uploaded together as a directory share their
// DirectoryUploadID, so the whole upload is one addressable group that can be
// listed or withdrawn at once; a lone file is its own group under its id.
//
// The member half is the attachment's ID, never its name or path. A filename can
// hold anything a user can type — spaces, quotes, brackets, its own separators —
// and a source id has to be handed to a model as evidence and come back
// byte-exact in a citation. An id can carry none of that. The name travels
// beside it as the source's label, which is what a listing shows.
//
// This is the same composite shape a connector uses for its files, which is what
// lets an attachment be read, retrieved, and cited through the same paths as
// every other source rather than needing its own.
func (a Attachment) SourceID() string {
	group := a.DirectoryUploadID
	if group == "" {
		group = a.ID
	}
	return group + sourceIDSeparator + a.ID
}

// SourceLabel is the human name the attachment is stored under in Knowledge —
// what a listing shows and what a person recognises. RelativePath is preferred
// so a directory member keeps the shape the user uploaded it as.
func (a Attachment) SourceLabel() string {
	if a.RelativePath != "" {
		return a.RelativePath
	}
	return a.Name
}

// sourceIDSeparator joins the group id to the member id. It mirrors
// knowledge.SourceIDSeparator, restated here because this capability does not
// import knowledge. Both halves are hex ids, so a slash separates them
// unambiguously; it was a unit separator until an unprintable byte proved unable
// to survive a round trip through a model as part of a citation.
const sourceIDSeparator = "/"

// NewDirectoryUploadID mints the id that groups one directory upload's files.
func NewDirectoryUploadID() string { return newID() }

// AddAttachment records one attachment on a chat after proving the chat belongs
// to the trusted current Project. The bytes are already in the file capability;
// FileID references them.
func (c *Chats) AddAttachment(scope Scope, chatID, kind string, in AttachmentInput) (Attachment, error) {
	if c.attachments == nil {
		return Attachment{}, ErrAttachmentsUnavailable
	}
	chat, err := c.ownedChat(scope, chatID)
	if err != nil {
		return Attachment{}, err
	}
	if kind != AttachmentFile && kind != AttachmentDirectory {
		return Attachment{}, ErrInvalid
	}
	if strings.TrimSpace(in.FileID) == "" || strings.TrimSpace(in.Name) == "" {
		return Attachment{}, ErrInvalid
	}
	if len(in.Name) > maxAttachmentName || len(in.RelativePath) > maxRelativePath {
		return Attachment{}, ErrInvalid
	}
	att := Attachment{
		ID: newID(), ChatID: chat.ID, ProjectID: chat.ProjectID, Kind: kind,
		FileID: in.FileID, Name: in.Name, RelativePath: in.RelativePath,
		DirectoryUploadID: in.DirectoryUploadID, CreatedAt: c.now().UTC(),
	}
	// Admit the content to Knowledge before recording the attachment, so a
	// failure here leaves nothing behind. An attachment that exists but cannot be
	// retrieved is the worse outcome: the file looks attached and every answer
	// resting on it fails for want of a citation, with nothing to point at.
	if c.attachmentIndex != nil {
		if err := c.attachmentIndex.IndexAttachment(att.ProjectID, att.SourceID(), att.SourceLabel(), att.FileID); err != nil {
			return Attachment{}, err
		}
	}
	if err := c.attachments.CreateChatAttachment(att); err != nil {
		// The content is admitted but the attachment will not exist; withdraw it
		// rather than leave Knowledge holding a source nothing references.
		if c.attachmentIndex != nil {
			_ = c.attachmentIndex.RemoveAttachment(att.ProjectID, att.SourceID())
		}
		return Attachment{}, err
	}
	return att, nil
}

// Attachments lists a chat's attachments in creation order, after proving the
// chat belongs to the current Project.
func (c *Chats) Attachments(scope Scope, chatID string) ([]Attachment, error) {
	if c.attachments == nil {
		return nil, ErrAttachmentsUnavailable
	}
	if _, err := c.ownedChat(scope, chatID); err != nil {
		return nil, err
	}
	return c.attachments.ChatAttachmentsByChat(chatID)
}

// AttachmentFileBySourceID resolves a lattice source id back to the stored file
// holding that attachment's bytes, scoped to the project. It reports false — not an
// error — when no attachment answers to the id, because "this source is not one of
// mine" is an ordinary answer to give a caller sweeping several source types.
//
// The chat capability is the only thing that can answer it: it minted both ids and
// owns the pairing. It exists so whole-source reads can reach an attachment's content
// at its origin, now that the lattice no longer keeps a copy of every source.
func (c *Chats) AttachmentFileBySourceID(scope Scope, sourceID string) (string, bool, error) {
	if c.attachments == nil {
		return "", false, ErrAttachmentsUnavailable
	}
	// SourceID is group + separator + attachment id, so the member half is the id to
	// look up. Splitting from the right is what makes it independent of whether the
	// group half is a directory-upload id or the attachment's own.
	_, attachmentID, found := strings.Cut(sourceID, sourceIDSeparator)
	if !found || attachmentID == "" {
		return "", false, nil
	}
	att, err := c.attachments.ChatAttachmentByID(scope.ProjectID, attachmentID)
	if errors.Is(err, ErrNotFound) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	// Guard against a caller reaching a real attachment through a mismatched group
	// half: the id it was admitted under is the only one that may read it back.
	if att.SourceID() != sourceID {
		return "", false, nil
	}
	return att.FileID, true, nil
}

// DeleteAttachment removes one attachment after proving both the chat and the
// attachment belong to the current Project and chat.
func (c *Chats) DeleteAttachment(scope Scope, chatID, attachmentID string) error {
	if c.attachments == nil {
		return ErrAttachmentsUnavailable
	}
	if _, err := c.ownedChat(scope, chatID); err != nil {
		return err
	}
	att, err := c.attachments.ChatAttachmentByID(scope.ProjectID, attachmentID)
	if err != nil {
		return err
	}
	if att.ProjectID != scope.ProjectID || att.ChatID != chatID {
		return ErrProjectScope
	}
	if err := c.attachments.DeleteChatAttachment(attachmentID); err != nil {
		return err
	}
	// Withdraw the content only after the attachment is gone, so a failure here
	// cannot leave a retrievable source the user believes they deleted.
	if c.attachmentIndex != nil {
		return c.attachmentIndex.RemoveAttachment(att.ProjectID, att.SourceID())
	}
	return nil
}

// ownedChat loads a chat and proves it belongs to the trusted current Project.
func (c *Chats) ownedChat(scope Scope, chatID string) (Chat, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return Chat{}, ErrInvalidScope
	}
	chat, err := c.store.ChatByID(scope.ProjectID, chatID)
	if err != nil {
		return Chat{}, err
	}
	if chat.ProjectID != scope.ProjectID {
		return Chat{}, ErrProjectScope
	}
	return chat, nil
}
