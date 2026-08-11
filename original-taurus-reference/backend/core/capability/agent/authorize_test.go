package agent

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

// denyingAuthorizer refuses a specific (user, document) pair, standing in for a
// document the requester has been scoped out of.
type denyingAuthorizer struct {
	denyUser, denyDoc string
}

func (a denyingAuthorizer) CanAccessDocument(userID, _ string, documentID string) (bool, error) {
	if userID == a.denyUser && documentID == a.denyDoc {
		return false, nil
	}
	return true, nil
}

func newAuthorizedWorkflows(t *testing.T, documents *document.Documents, auth DocumentAuthorizer) *Workflows {
	t.Helper()
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	workflows, err := NewWorkflows(WorkflowOptions{
		Tasks: tasks, Intelligence: &fakeIntelligence{}, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas: newTestPersonas(t, persona.Options{}), Documents: documents,
		PlanningCast: testCast, DefaultCast: testCast, Policy: DefaultPolicy(), Authorizer: auth,
	})
	if err != nil {
		t.Fatal(err)
	}
	return workflows
}

func TestDocumentGetToolDeniedByAccessScope(t *testing.T) {
	documents := document.New(document.NewMemoryStore(), document.Options{})
	doc, _ := documents.Create("proj-a", "Doc", document.Base{})
	workflows := newAuthorizedWorkflows(t, documents, denyingAuthorizer{denyUser: "member", denyDoc: doc.ID})

	tool := workflows.documentGetTool(Scope{ProjectID: "proj-a"}, Task{RequesterID: "member"})
	input, _ := json.Marshal(map[string]string{"documentId": doc.ID})
	_, err := tool.Handler(context.Background(), input)

	var toolErr *intelligence.ToolError
	if !errors.As(err, &toolErr) || toolErr.Code != "access_denied" {
		t.Fatalf("expected access_denied ToolError, got %v", err)
	}
}

func TestDocumentEditToolDeniedByAccessScope(t *testing.T) {
	documents := document.New(document.NewMemoryStore(), document.Options{})
	doc, _ := documents.Create("proj-a", "Doc", document.Base{})
	workflows := newAuthorizedWorkflows(t, documents, denyingAuthorizer{denyUser: "member", denyDoc: doc.ID})

	tool := workflows.documentEditTool(Scope{ProjectID: "proj-a"}, Task{RequesterID: "member"})
	input, _ := json.Marshal(map[string]any{
		"documentId": doc.ID,
		"ops":        []map[string]string{{"op": "append", "kind": "paragraph", "markdown": "hi"}},
	})
	_, err := tool.Handler(context.Background(), input)

	var toolErr *intelligence.ToolError
	if !errors.As(err, &toolErr) || toolErr.Code != "access_denied" {
		t.Fatalf("expected access_denied ToolError, got %v", err)
	}
}

func TestDocumentToolAllowedForPermittedUser(t *testing.T) {
	documents := document.New(document.NewMemoryStore(), document.Options{})
	doc, _ := documents.Create("proj-a", "Doc", document.Base{})
	// The owner is permitted; the deny rule targets a different user.
	workflows := newAuthorizedWorkflows(t, documents, denyingAuthorizer{denyUser: "member", denyDoc: doc.ID})

	tool := workflows.documentGetTool(Scope{ProjectID: "proj-a"}, Task{RequesterID: "owner"})
	input, _ := json.Marshal(map[string]string{"documentId": doc.ID})
	if _, err := tool.Handler(context.Background(), input); err != nil {
		t.Fatalf("permitted user should read the document, got %v", err)
	}
}
