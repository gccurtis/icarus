package chat

import (
	"errors"
	"strings"
	"testing"
)

func newAttachmentChats(t *testing.T) (*Chats, *MemoryChatStore) {
	t.Helper()
	store := NewMemoryChatStore()
	chats, err := NewChats(store, nil)
	if err != nil {
		t.Fatal(err)
	}
	chats.UseAttachments(store)
	return chats, store
}

func seedChat(t *testing.T, chats *Chats, projectID string) Chat {
	t.Helper()
	chat, err := chats.Create(Scope{ProjectID: projectID}, "user-1", ModeAsk, "Chat", "")
	if err != nil {
		t.Fatal(err)
	}
	return chat
}

// recordingIndexer captures the indexing calls AddAttachment and DeleteAttachment
// make, so the tests assert on the source ids the chat capability composes.
type recordingIndexer struct {
	indexed map[string]string
	// labels is the human name each source was indexed under. A source id is
	// minted ids only, so the label is the sole part of the record that says which
	// file it is — a test that ignored it could not tell one member of an upload
	// from another.
	labels  map[string]string
	removed []string
	fail    error
}

func newRecordingIndexer() *recordingIndexer {
	return &recordingIndexer{indexed: map[string]string{}, labels: map[string]string{}}
}

func (r *recordingIndexer) IndexAttachment(projectID, sourceID, label, fileID string) error {
	if r.fail != nil {
		return r.fail
	}
	r.indexed[sourceID] = fileID
	r.labels[sourceID] = label
	return nil
}

func (r *recordingIndexer) RemoveAttachment(projectID, sourceID string) error {
	r.removed = append(r.removed, sourceID)
	return nil
}

func TestAttachmentIsIndexedUnderItsUploadGroup(t *testing.T) {
	chats, _ := newAttachmentChats(t)
	indexer := newRecordingIndexer()
	chats.UseAttachmentIndexer(indexer)
	chat := seedChat(t, chats, "proj-a")

	upload := NewDirectoryUploadID()
	var members []Attachment
	for _, f := range []struct{ name, path string }{{"a.txt", "src/a.txt"}, {"b.txt", "src/b.txt"}} {
		att, err := chats.AddAttachment(Scope{ProjectID: "proj-a"}, chat.ID, AttachmentDirectory, AttachmentInput{
			FileID: "file-" + f.name, Name: f.name, RelativePath: f.path, DirectoryUploadID: upload,
		})
		if err != nil {
			t.Fatal(err)
		}
		members = append(members, att)
	}

	// Both members index under the one upload id, keyed by their own attachment
	// id, so the whole upload is one addressable group. The relative path is the
	// label, never part of the id: a path may hold anything a user can type, and a
	// source id has to survive a round trip through a model as a citation.
	for _, att := range members {
		id := upload + "/" + att.ID
		if _, ok := indexer.indexed[id]; !ok {
			t.Errorf("member %q not indexed under upload %q; indexed = %v", att.RelativePath, upload, indexer.indexed)
		}
		if got := indexer.labels[id]; got != att.RelativePath {
			t.Errorf("label for %q = %q, want the relative path %q", id, got, att.RelativePath)
		}
	}
}

func TestSourceIDCarriesNoNameAndNothingUnprintable(t *testing.T) {
	// The failure this guards against was live: an attachment id joined to its
	// filename by a unit separator was handed to a model as evidence, came back
	// with U+FFFD where the 0x1F had been, and a correct answer was rejected for
	// citing evidence that was never retrieved. Nothing in a source id may be
	// unprintable, and nothing in one may be a name.
	att := Attachment{ID: "aaaa1111", Name: `weird "name" (v2).txt`, RelativePath: `dir with spaces/weird "name" (v2).txt`}
	id := att.SourceID()
	if strings.ContainsAny(id, "\x00\x1f�") {
		t.Fatalf("source id %q carries an unprintable byte", id)
	}
	if strings.Contains(id, att.Name) || strings.Contains(id, att.RelativePath) {
		t.Fatalf("source id %q embeds the file's name", id)
	}
	if want := att.ID + "/" + att.ID; id != want {
		t.Fatalf("source id = %q, want %q", id, want)
	}
	if got := att.SourceLabel(); got != att.RelativePath {
		t.Fatalf("label = %q, want the relative path %q", got, att.RelativePath)
	}
}

func TestSingleFileAttachmentIndexesUnderItsOwnID(t *testing.T) {
	chats, _ := newAttachmentChats(t)
	indexer := newRecordingIndexer()
	chats.UseAttachmentIndexer(indexer)
	chat := seedChat(t, chats, "proj-a")

	att, err := chats.AddAttachment(Scope{ProjectID: "proj-a"}, chat.ID, AttachmentFile, AttachmentInput{
		FileID: "file-1", Name: "notes.txt",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got, ok := indexer.indexed[att.ID+"/"+att.ID]; !ok || got != "file-1" {
		t.Fatalf("single file not indexed under its own id: %v", indexer.indexed)
	}
}

func TestDeleteAttachmentRemovesItFromKnowledge(t *testing.T) {
	chats, _ := newAttachmentChats(t)
	indexer := newRecordingIndexer()
	chats.UseAttachmentIndexer(indexer)
	chat := seedChat(t, chats, "proj-a")

	att, err := chats.AddAttachment(Scope{ProjectID: "proj-a"}, chat.ID, AttachmentFile, AttachmentInput{
		FileID: "file-1", Name: "notes.txt",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := chats.DeleteAttachment(Scope{ProjectID: "proj-a"}, chat.ID, att.ID); err != nil {
		t.Fatal(err)
	}
	want := att.ID + "/" + att.ID
	if len(indexer.removed) != 1 || indexer.removed[0] != want {
		t.Fatalf("removed = %v, want [%q]", indexer.removed, want)
	}
}

func TestAttachmentIsNotStoredWhenIndexingFails(t *testing.T) {
	chats, _ := newAttachmentChats(t)
	indexer := newRecordingIndexer()
	indexer.fail = errors.New("embedding provider unavailable")
	chats.UseAttachmentIndexer(indexer)
	chat := seedChat(t, chats, "proj-a")

	if _, err := chats.AddAttachment(Scope{ProjectID: "proj-a"}, chat.ID, AttachmentFile, AttachmentInput{
		FileID: "file-1", Name: "notes.txt",
	}); err == nil {
		t.Fatal("AddAttachment succeeded despite the indexer failing")
	}
	// An attachment the model could never retrieve is worse than no attachment:
	// the caller must see the failure rather than a silently unusable file.
	atts, err := chats.Attachments(Scope{ProjectID: "proj-a"}, chat.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(atts) != 0 {
		t.Fatalf("attachment was stored anyway: %+v", atts)
	}
}

func TestAddAndListFileAttachment(t *testing.T) {
	chats, _ := newAttachmentChats(t)
	chat := seedChat(t, chats, "proj-a")

	att, err := chats.AddAttachment(Scope{ProjectID: "proj-a"}, chat.ID, AttachmentFile, AttachmentInput{
		FileID: "file-1", Name: "notes.txt",
	})
	if err != nil {
		t.Fatal(err)
	}
	if att.ID == "" || att.ChatID != chat.ID || att.Kind != AttachmentFile || att.FileID != "file-1" {
		t.Fatalf("unexpected attachment: %+v", att)
	}
	list, err := chats.Attachments(Scope{ProjectID: "proj-a"}, chat.ID)
	if err != nil || len(list) != 1 || list[0].ID != att.ID {
		t.Fatalf("list = %v %+v", err, list)
	}
}

// TestAttachmentIsProjectScoped covers cross-project attachment access. Since
// DEF-1 the store's own WHERE answers first, so the refusal surfaces as
// ErrNotFound rather than ErrProjectScope; ownedChat's ProjectID comparison
// still stands behind it and would return ErrProjectScope for any store that
// does not scope. Both errors are the same 404 to the client.
func TestAttachmentIsProjectScoped(t *testing.T) {
	chats, _ := newAttachmentChats(t)
	chat := seedChat(t, chats, "proj-a")
	if _, err := chats.AddAttachment(Scope{ProjectID: "proj-b"}, chat.ID, AttachmentFile, AttachmentInput{FileID: "f", Name: "n"}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-project add = %v, want ErrNotFound", err)
	}
	if _, err := chats.Attachments(Scope{ProjectID: "proj-b"}, chat.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-project list = %v, want ErrNotFound", err)
	}
}

func TestDirectoryAttachmentsShareUploadID(t *testing.T) {
	chats, _ := newAttachmentChats(t)
	chat := seedChat(t, chats, "proj-a")
	dirID := "dir-1"
	for _, p := range []string{"src/a.txt", "src/b.txt"} {
		if _, err := chats.AddAttachment(Scope{ProjectID: "proj-a"}, chat.ID, AttachmentDirectory, AttachmentInput{
			FileID: "file-" + p, Name: p, RelativePath: p, DirectoryUploadID: dirID,
		}); err != nil {
			t.Fatal(err)
		}
	}
	list, _ := chats.Attachments(Scope{ProjectID: "proj-a"}, chat.ID)
	if len(list) != 2 {
		t.Fatalf("expected 2 directory attachments, got %d", len(list))
	}
	for _, a := range list {
		if a.Kind != AttachmentDirectory || a.DirectoryUploadID != dirID || a.RelativePath == "" {
			t.Fatalf("directory attachment missing fields: %+v", a)
		}
	}
}

func TestDeleteAttachment(t *testing.T) {
	chats, _ := newAttachmentChats(t)
	chat := seedChat(t, chats, "proj-a")
	att, _ := chats.AddAttachment(Scope{ProjectID: "proj-a"}, chat.ID, AttachmentFile, AttachmentInput{FileID: "f", Name: "n"})

	if err := chats.DeleteAttachment(Scope{ProjectID: "proj-a"}, chat.ID, att.ID); err != nil {
		t.Fatal(err)
	}
	list, _ := chats.Attachments(Scope{ProjectID: "proj-a"}, chat.ID)
	if len(list) != 0 {
		t.Fatalf("expected 0 after delete, got %d", len(list))
	}
	// Deleting from the wrong project must not work.
	att2, _ := chats.AddAttachment(Scope{ProjectID: "proj-a"}, chat.ID, AttachmentFile, AttachmentInput{FileID: "f2", Name: "n2"})
	if err := chats.DeleteAttachment(Scope{ProjectID: "proj-b"}, chat.ID, att2.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-project delete = %v, want ErrNotFound (scoped in the store since DEF-1)", err)
	}
}

func TestAddAttachmentRejectsBlankFile(t *testing.T) {
	chats, _ := newAttachmentChats(t)
	chat := seedChat(t, chats, "proj-a")
	if _, err := chats.AddAttachment(Scope{ProjectID: "proj-a"}, chat.ID, AttachmentFile, AttachmentInput{Name: "n"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("blank fileId = %v, want ErrInvalid", err)
	}
}
