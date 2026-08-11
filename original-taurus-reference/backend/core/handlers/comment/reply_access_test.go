package comment_test

import (
	"encoding/json"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	commentcap "github.com/gccurtis/taurus-omega/core/capability/comment"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	commentapp "github.com/gccurtis/taurus-omega/core/handlers/comment"
)

// stubAnchors satisfies comment.AnchorReader; the Reply path never calls it.
type stubAnchors struct{}

func (stubAnchors) AnchorInProject(string, string, string) (commentcap.AnchorInfo, error) {
	return commentcap.AnchorInfo{}, nil
}
func (stubAnchors) CreateAnchor(string, string, commentcap.AnchorRef) (commentcap.AnchorInfo, error) {
	return commentcap.AnchorInfo{}, nil
}

func newReplyHandler(t *testing.T, canAccess func(string, string, string) (bool, error)) commentapp.Handlers {
	t.Helper()
	store := commentcap.NewMemoryStore()
	if err := store.CreateComment(commentcap.Comment{ID: "c1", ProjectID: "p", DocumentID: "secret"}); err != nil {
		t.Fatal(err)
	}
	svc, err := commentcap.New(store, stubAnchors{})
	if err != nil {
		t.Fatal(err)
	}
	return commentapp.NewHandlers(svc, canAccess)
}

func replyReq() endpoint.Request {
	return endpoint.Request{
		Param: func(n string) string {
			if n == "commentID" {
				return "c1"
			}
			return ""
		},
		Bind: func(v any) error { return json.Unmarshal([]byte(`{"body":"hi"}`), v) },
	}
}

// TestReplyDeniedWithoutDocumentAccess pins PRIV-2: replying to a comment on a
// document the caller cannot access must be forbidden, like Patch/Delete already
// are.
func TestReplyDeniedWithoutDocumentAccess(t *testing.T) {
	h := newReplyHandler(t, func(string, string, string) (bool, error) { return false, nil })
	ctx := access.Context{User: access.User{ID: "bob"}, Project: &access.Project{ID: "p"}, Role: access.RoleEdit}
	if resp := h.Reply(ctx, replyReq()); resp.Status != 403 {
		t.Fatalf("Reply status = %d, want 403 (no access to the comment's document)", resp.Status)
	}
}

// TestReplyAllowedWithDocumentAccess is the control: with access, Reply proceeds.
func TestReplyAllowedWithDocumentAccess(t *testing.T) {
	h := newReplyHandler(t, func(string, string, string) (bool, error) { return true, nil })
	ctx := access.Context{User: access.User{ID: "owner"}, Project: &access.Project{ID: "p"}, Role: access.RoleEdit}
	if resp := h.Reply(ctx, replyReq()); resp.Status != 201 {
		t.Fatalf("Reply status = %d, want 201", resp.Status)
	}
}
