package chat

import (
	"errors"
	"testing"
)

func newTestChats() *Chats {
	// No engine: these tests cover store/scoping/validation and PostTurn's
	// pre-engine guards. Turn execution against the real engine is proven in the
	// live dev-test, never with a stubbed model.
	chats, err := NewChats(NewMemoryChatStore(), nil)
	if err != nil {
		panic(err)
	}
	return chats
}

type recordingEngine struct{ lastReq ChatReplyRequest }

func (e *recordingEngine) Reply(_ Scope, req ChatReplyRequest) (ChatReply, error) {
	e.lastReq = req
	return ChatReply{Body: "ok"}, nil
}

func TestChatsSetPersonaPersistsAndFlowsToEngine(t *testing.T) {
	engine := &recordingEngine{}
	chats, err := NewChats(NewMemoryChatStore(), engine)
	if err != nil {
		t.Fatal(err)
	}
	scope := Scope{ProjectID: "p"}
	chat, err := chats.Create(scope, "u1", ModeAsk, "t", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := chats.SetPersona(scope, chat.ID, "persona-x"); err != nil {
		t.Fatalf("set persona: %v", err)
	}
	got, _, err := chats.Get(scope, chat.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.PersonaID != "persona-x" {
		t.Fatalf("persona not persisted: %q", got.PersonaID)
	}
	if _, err := chats.PostTurn(scope, chat.ID, "u1", "hello", false); err != nil {
		t.Fatalf("post turn: %v", err)
	}
	if engine.lastReq.PersonaID != "persona-x" {
		t.Fatalf("engine did not receive the chat's persona: %+v", engine.lastReq)
	}
	// Clearing reverts to the requester default (empty persona id).
	if err := chats.SetPersona(scope, chat.ID, ""); err != nil {
		t.Fatalf("clear persona: %v", err)
	}
	if got, _, _ := chats.Get(scope, chat.ID); got.PersonaID != "" {
		t.Fatalf("persona not cleared: %q", got.PersonaID)
	}
}

func TestChatsSetPersonaCrossProjectRejected(t *testing.T) {
	chats := newTestChats()
	chat, err := chats.Create(Scope{ProjectID: "p"}, "u1", ModeAsk, "t", "")
	if err != nil {
		t.Fatal(err)
	}
	// Since DEF-1 the store's WHERE refuses the foreign id first, so this reads
	// as ErrNotFound; the service's own ProjectID comparison stands behind it.
	if err := chats.SetPersona(Scope{ProjectID: "other"}, chat.ID, "x"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-project set persona = %v, want ErrNotFound", err)
	}
}

func TestChatsCreateAndGet(t *testing.T) {
	chats := newTestChats()
	scope := Scope{ProjectID: "proj-a"}

	chat, err := chats.Create(scope, "user-1", ModeAsk, "Structure the findings", "doc-1")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if chat.ID == "" || chat.ProjectID != "proj-a" || chat.RequesterID != "user-1" ||
		chat.Mode != ModeAsk || chat.Title != "Structure the findings" || chat.ResourceID != "doc-1" {
		t.Fatalf("unexpected chat: %+v", chat)
	}

	got, turns, err := chats.Get(scope, chat.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.ID != chat.ID || len(turns) != 0 {
		t.Fatalf("get returned %q with %d turns", got.ID, len(turns))
	}
}

func TestChatsCreateRejectsBadInput(t *testing.T) {
	chats := newTestChats()
	if _, err := chats.Create(Scope{}, "u1", ModeAsk, "t", ""); !errors.Is(err, ErrInvalidScope) {
		t.Fatalf("empty scope = %v, want ErrInvalidScope", err)
	}
	if _, err := chats.Create(Scope{ProjectID: "p"}, "u1", "bogus", "t", ""); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad mode = %v, want ErrInvalid", err)
	}
	if _, err := chats.Create(Scope{ProjectID: "p"}, "", ModeAsk, "t", ""); !errors.Is(err, ErrInvalid) {
		t.Fatalf("empty requester = %v, want ErrInvalid", err)
	}
}

func TestChatsGetCrossProjectRejected(t *testing.T) {
	chats := newTestChats()
	chat, _ := chats.Create(Scope{ProjectID: "proj-a"}, "u1", ModeAsk, "t", "")
	if _, _, err := chats.Get(Scope{ProjectID: "proj-b"}, chat.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-project get = %v, want ErrNotFound (scoped in the store since DEF-1)", err)
	}
}

func TestChatsListByProjectAndResource(t *testing.T) {
	chats := newTestChats()
	a := Scope{ProjectID: "proj-a"}
	b := Scope{ProjectID: "proj-b"}

	c1, _ := chats.Create(a, "u1", ModePlan, "one", "doc-1")
	_, _ = chats.Create(a, "u1", ModeAsk, "two", "doc-2")
	_, _ = chats.Create(a, "u1", ModeAsk, "three", "")
	_, _ = chats.Create(b, "u9", ModeAsk, "other", "doc-1")

	if all, err := chats.List(a, ""); err != nil || len(all) != 3 {
		t.Fatalf("project A chats = %d (%v), want 3", len(all), err)
	}
	forDoc1, err := chats.List(a, "doc-1")
	if err != nil || len(forDoc1) != 1 || forDoc1[0].ID != c1.ID {
		t.Fatalf("doc-1 chats = %+v (%v)", forDoc1, err)
	}
	if bl, _ := chats.List(b, ""); len(bl) != 1 {
		t.Fatalf("project B chats = %d, want 1 (isolation)", len(bl))
	}
}

func TestChatsPostTurnGuards(t *testing.T) {
	chats := newTestChats()
	a := Scope{ProjectID: "proj-a"}
	chat, _ := chats.Create(a, "u1", ModeAsk, "chat", "")

	// Cross-project and empty-message both fail before the engine is consulted.
	if _, err := chats.PostTurn(Scope{ProjectID: "proj-b"}, chat.ID, "u9", "sneak", false); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-project post = %v, want ErrNotFound (scoped in the store since DEF-1)", err)
	}
	if _, err := chats.PostTurn(a, chat.ID, "u1", "   ", false); !errors.Is(err, ErrInvalid) {
		t.Fatalf("empty message = %v, want ErrInvalid", err)
	}
	// A valid message with no engine wired errors rather than silently no-op.
	if _, err := chats.PostTurn(a, chat.ID, "u1", "hello", false); err == nil {
		t.Fatal("post turn with nil engine should error")
	}
}

// TestStoreChatReadsAreProjectScoped pins DEF-1 at the chat ports: both by-id
// reads carry the project label themselves, so a foreign project is refused by
// the store rather than only by the service's ProjectID comparison. The service
// comparisons stay in place — two independent layers, neither load-bearing
// alone.
func TestStoreChatReadsAreProjectScoped(t *testing.T) {
	store := NewMemoryChatStore()
	chats, err := NewChats(store, nil)
	if err != nil {
		t.Fatal(err)
	}
	chats.UseAttachments(store)
	ch, err := chats.Create(Scope{ProjectID: "proj-a"}, "u1", ModeAsk, "Findings", "")
	if err != nil {
		t.Fatal(err)
	}
	att, err := chats.AddAttachment(Scope{ProjectID: "proj-a"}, ch.ID, AttachmentFile, AttachmentInput{
		FileID: "file-1", Name: "secret.txt",
	})
	if err != nil {
		t.Fatal(err)
	}

	if got, err := store.ChatByID("proj-a", ch.ID); err != nil || got.Title != "Findings" {
		t.Fatalf("owning-project ChatByID = %+v, %v", got, err)
	}
	if got, err := store.ChatByID("proj-b", ch.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("foreign-project ChatByID = %+v, %v; want ErrNotFound", got, err)
	}
	if got, err := store.ChatAttachmentByID("proj-a", att.ID); err != nil || got.Name != "secret.txt" {
		t.Fatalf("owning-project ChatAttachmentByID = %+v, %v", got, err)
	}
	if got, err := store.ChatAttachmentByID("proj-b", att.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("foreign-project ChatAttachmentByID = %+v, %v; want ErrNotFound", got, err)
	}
}
