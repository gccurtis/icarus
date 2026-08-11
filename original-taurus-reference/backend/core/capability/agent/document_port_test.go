package agent

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

// fakeDocumentEditor is a stand-in for the document capability, recording the
// calls the agent's document tools make. Its existence is the point of the test:
// the agent must depend on a narrow port it declares, not on the concrete
// *document.Documents service.
type fakeDocumentEditor struct {
	doc        document.Document
	gets       int
	submits    int
	lastAuthor string
}

func (f *fakeDocumentEditor) Get(projectID, documentID string) (document.Document, error) {
	f.gets++
	if documentID != f.doc.ID {
		return document.Document{}, document.ErrNotFound
	}
	return f.doc, nil
}

func (f *fakeDocumentEditor) SubmitChanges(projectID, id, authorID string, submission document.ChangeSubmission, actorNames ...string) (document.ChangeSet, error) {
	f.submits++
	f.lastAuthor = authorID
	return document.ChangeSet{ID: "cs-1", DocumentID: id, Seq: 1}, nil
}

// TestDocumentToolsUseTheDeclaredPort pins COH-1: the agent capability composes
// the document capability through an agent-owned DocumentEditor port, so its
// behavioural dependency is the two operations it actually uses rather than the
// whole Documents service. A fake satisfying that port must drive the tools.
func TestDocumentToolsUseTheDeclaredPort(t *testing.T) {
	editor := &fakeDocumentEditor{doc: document.Document{ID: "doc-1", ProjectID: "proj-a", Name: "Doc"}}
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	workflows, err := NewWorkflows(WorkflowOptions{
		Tasks: tasks, Intelligence: &fakeIntelligence{},
		Knowledge:    &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas:     newTestPersonas(t, persona.Options{}),
		Documents:    editor,
		PlanningCast: testCast, DefaultCast: testCast, Policy: DefaultPolicy(),
	})
	if err != nil {
		t.Fatal(err)
	}

	tool := workflows.documentGetTool(Scope{ProjectID: "proj-a"}, Task{})
	input, _ := json.Marshal(map[string]string{"documentId": "doc-1"})
	if _, err := tool.Handler(context.Background(), input); err != nil {
		t.Fatalf("document.get through the port: %v", err)
	}
	if editor.gets != 1 {
		t.Fatalf("port Get called %d times, want 1 — the tool is not reading through the port", editor.gets)
	}
}

// TestDocumentsServiceSatisfiesThePort keeps the port honest: the canonical
// document service must satisfy it directly, so wiring needs no adapter.
func TestDocumentsServiceSatisfiesThePort(t *testing.T) {
	var _ DocumentEditor = document.New(document.NewMemoryStore(), document.Options{})
}
