package chat_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	chatcap "github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/file"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	chathandler "github.com/gccurtis/taurus-omega/core/handlers/chat"
)

type refusingAttachmentIndexer struct{ err error }

func (r refusingAttachmentIndexer) IndexAttachment(string, string, string, string) error {
	return r.err
}
func (refusingAttachmentIndexer) RemoveAttachment(string, string) error { return nil }

func newHandlers() chathandler.Handlers {
	// nil engine: these route tests never post a turn. Turn execution is proven
	// live against the real provider, never a stubbed model.
	chats, err := chatcap.NewChats(chatcap.NewMemoryChatStore(), nil)
	if err != nil {
		panic(err)
	}
	return chathandler.NewHandlers(chats, nil, 0)
}

func ctx(projectID, userID string, role access.Role) access.Context {
	return access.Context{
		Project: &access.Project{ID: projectID},
		User:    access.User{ID: userID, Name: "Test", Email: "t@b.com"},
		Role:    role,
	}
}

func bodyReq(body string) endpoint.Request {
	return endpoint.Request{Bind: func(v any) error { return json.Unmarshal([]byte(body), v) }}
}

func TestChatCreateAndGet(t *testing.T) {
	h := newHandlers()
	c := ctx("p1", "u1", access.RoleOwner)

	resp := h.Create(c, bodyReq(`{"mode":"ask","title":"Findings","resourceId":"doc-1"}`))
	if resp.Status != http.StatusCreated {
		t.Fatalf("create = %d", resp.Status)
	}
	created := resp.Body.(chatcap.Chat)
	if created.Mode != "ask" || created.ResourceID != "doc-1" || created.ProjectID != "p1" {
		t.Fatalf("chat: %+v", created)
	}
	if got := h.Get(c, endpoint.Request{Param: func(string) string { return created.ID }}); got.Status != http.StatusOK {
		t.Fatalf("get = %d", got.Status)
	}
}

func TestChatCreateReaderRejected(t *testing.T) {
	h := newHandlers()
	if resp := h.Create(ctx("p1", "u1", access.RoleRead), bodyReq(`{"mode":"ask"}`)); resp.Status != http.StatusForbidden {
		t.Fatalf("reader create = %d, want 403", resp.Status)
	}
}

func TestChatListAndCrossProject(t *testing.T) {
	h := newHandlers()
	created := h.Create(ctx("p1", "u1", access.RoleOwner), bodyReq(`{"mode":"ask","resourceId":"doc-1"}`)).Body.(chatcap.Chat)

	if list := h.List(ctx("p1", "u1", access.RoleRead), endpoint.Request{Query: func(string) string { return "doc-1" }}); list.Status != http.StatusOK {
		t.Fatalf("list = %d", list.Status)
	}
	// A different project cannot read the chat.
	if resp := h.Get(ctx("p2", "u9", access.RoleOwner), endpoint.Request{Param: func(string) string { return created.ID }}); resp.Status != http.StatusNotFound {
		t.Fatalf("cross-project get = %d, want 404", resp.Status)
	}
}

func TestAttachmentCapacityRefusalKeepsKnowledgeLimitContract(t *testing.T) {
	store := chatcap.NewMemoryChatStore()
	chats, err := chatcap.NewChats(store, nil)
	if err != nil {
		t.Fatal(err)
	}
	chats.UseAttachments(store)
	chats.UseAttachmentIndexer(refusingAttachmentIndexer{err: knowledge.ArtifactLimitExceeded("p1", 10, 11)})
	files, err := file.New(file.NewMemoryStore(), 1024)
	if err != nil {
		t.Fatal(err)
	}
	h := chathandler.NewHandlers(chats, files, 0)
	c := ctx("p1", "u1", access.RoleOwner)
	created := h.Create(c, bodyReq(`{"mode":"ask"}`)).Body.(chatcap.Chat)
	resp := h.AddAttachment(c, endpoint.Request{
		Param: func(string) string { return created.ID },
		Bind:  bodyReq(`{"name":"notes.txt","contentType":"text/plain","content":"eA=="}`).Bind,
	})
	if resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", resp.Status)
	}
	body, ok := resp.Body.(map[string]any)
	if !ok || body["code"] != knowledge.CodeArtifactLimit || body["retryable"] != false {
		t.Fatalf("body = %#v, want typed artifact refusal", resp.Body)
	}
}
