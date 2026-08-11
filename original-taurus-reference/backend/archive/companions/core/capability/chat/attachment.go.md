# attachment.go

Chat attachments: a chat can carry uploaded files and directory manifests. The bytes live in the file capability; this stores only the reference + presentation metadata (name, relative path, directory-upload id) so chat never imports file. Add/list/delete are Project-scoped; a nil store disables attachments. See repo conventions (AGENTS.md).

## Attachments are Knowledge, not prompt filler

The design decision that shapes the rest of this file: an attachment's content is
**admitted to the project's Knowledge** when it is uploaded.

It did not start that way. A chat's attachments were originally inlined into each
turn's prompt as caller-supplied context. That looked sufficient — the content was
right there in front of the model — and it was not, for a reason that only shows
up at the end of the flow. Caller context is not evidence, so nothing in it
carries a citable locator. Ask rejects a grounded answer that cites nothing. So a
question answerable *only* from an attachment produced a correct answer that was
then thrown away, and the request failed with a 500.

Indexing the content instead means an attachment is retrieved, read, and cited
through exactly the same paths as a document or a connector's file. Nothing
downstream needs to know attachments exist. The `AttachmentIndexer` port is how
that happens without this capability importing knowledge or file.

## Code breakdown

### Ordering: index before storing, withdraw after deleting

`AddAttachment` admits the content to Knowledge **before** it records the
attachment, and `DeleteAttachment` withdraws it **after** the record is gone. The
two are mirror images, and both orderings are chosen so that the failure leaves
the safer state.

On add, indexing first means a failure leaves nothing behind. The alternative —
store, then index — leaves an attachment the user can see, that every answer
resting on it will fail to cite, with no indication anything went wrong. That is
strictly worse than the upload plainly failing, so a failed index fails the
request. If the store write then fails, the already-admitted content is withdrawn
rather than left as a source nothing references.

On delete, withdrawing last means a failure cannot leave content retrievable that
the user believes they deleted. The residue in the other direction — a record
whose content is already gone — degrades to an attachment that reads as
unreadable, which is visible and recoverable.

A nil indexer skips both, which is the correct behavior for a deployment running
without Knowledge rather than a reason to fail.

### Project scoping of the by-id read (DEF-1)

`AttachmentStore.ChatAttachmentByID` takes the project id as its first parameter
and the store filters on it, so an attachment owned by another project is
`ErrNotFound` instead of a record the caller must vet. This matches the scoping
`ChatByID` gained for DEF-1.

`DeleteAttachment` still checks both `att.ProjectID != scope.ProjectID` and
`att.ChatID != chatID` on the loaded record, and `ownedChat` still compares the
chat's `ProjectID`. Those checks stay — deliberately redundant with the store's
filter, two independent layers, neither load-bearing alone. The `ChatID` half in
particular is not covered by project scoping at all: it stops an attachment being
deleted through a *sibling* chat in the same project.

```go
package chat

import (
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

// UseAttachments injects the attachment store. Set once at composition; a nil
// store leaves the attachment methods returning ErrAttachmentsUnavailable.
func (c *Chats) UseAttachments(store AttachmentStore) { c.attachments = store }

// UseAttachmentIndexer injects the Knowledge indexer. Set once at composition; a
// nil indexer leaves attachments stored but never admitted to Knowledge.
func (c *Chats) UseAttachmentIndexer(indexer AttachmentIndexer) { c.attachmentIndex = indexer }

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
	if err := c.attachments.CreateChatAttachment(att); err != nil {
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
```

### `SourceID` and `SourceLabel` — address by id, recognise by name

An attachment's source id is its grouping id joined to **its own attachment id**.
The filename is no longer part of it; it moved to `SourceLabel`, which is what the
lattice stores as the source's label and what a listing shows.

The attachment table was already the registry this needs — every row has an id
and the name it was uploaded under — so this costs no new storage. What it buys
is that a filename can now be anything a user can type without touching the
addressable identity: spaces, quotes, brackets, a path separator. A source id is
handed to a model as evidence and must come back byte-exact as a citation, and an
id survives that where a name is a liability.

A lone file being its own group means its source id repeats its id on both sides.
That is deliberate rather than tidy: it keeps every attachment addressable by the
same group-prefix query, so "withdraw this whole upload" is one operation whether
the upload held one file or a hundred.

### `AttachmentFileBySourceID` — the pairing only chat can resolve

Maps a lattice source id back to the stored file holding that attachment's bytes,
scoped to the project.

The chat capability minted both ids and owns the pairing, so it is the only thing that
can answer. It exists because whole-source reads now reach an attachment's content at
its origin — the file store — rather than from a copy the lattice used to keep.

Two details carry weight. It reports **false, not an error**, for an id that is not an
attachment's: a caller sweeping several source types is asking an ordinary question,
not making a mistake. And it re-derives `att.SourceID()` and compares, so a caller
cannot reach a real attachment through a mismatched group half — the id a source was
admitted under is the only one that may read it back.
