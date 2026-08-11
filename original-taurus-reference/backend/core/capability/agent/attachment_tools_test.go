package agent

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

type stubAttachments struct {
	refs        []AttachmentRef
	err         error
	gotProject  string
	gotChatID   string
	callCounter int
}

func (s *stubAttachments) ChatAttachments(projectID, chatID string) ([]AttachmentRef, error) {
	s.gotProject, s.gotChatID = projectID, chatID
	s.callCounter++
	return s.refs, s.err
}

func TestAttachmentListToolReportsReadabilityPerAttachment(t *testing.T) {
	stub := &stubAttachments{refs: []AttachmentRef{
		{Name: "notes.txt", ResourceID: "file-1", Readable: true},
		{Name: "scan.pdf", ResourceID: "file-2"},
		{Name: "a.txt", RelativePath: "src/a.txt", ResourceID: "file-3", Readable: true},
	}}

	out, err := attachmentListTool(stub, "proj-a", "chat-1").Handler(context.Background(), json.RawMessage(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	var listed struct {
		Attachments []struct {
			Name       string `json:"name"`
			ResourceID string `json:"resourceId"`
			Kind       string `json:"kind"`
			Readable   bool   `json:"readable"`
		} `json:"attachments"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(out, &listed); err != nil {
		t.Fatal(err)
	}
	if listed.Total != 3 {
		t.Fatalf("total = %d, want 3: %s", listed.Total, out)
	}
	// The un-indexable file is still listed — reporting it as unreadable is the
	// whole point, so the model never denies an attachment the user can see.
	if listed.Attachments[1].Name != "scan.pdf" || listed.Attachments[1].Readable {
		t.Errorf("un-indexed attachment = %+v, want scan.pdf unreadable", listed.Attachments[1])
	}
	if listed.Attachments[1].ResourceID != "file-2" || listed.Attachments[1].Kind != "file" {
		t.Errorf("unreadable attachment lost its stable file locator: %+v", listed.Attachments[1])
	}
	if !listed.Attachments[0].Readable || listed.Attachments[0].ResourceID != "file-1" {
		t.Errorf("readable attachment = %+v", listed.Attachments[0])
	}
	// A directory member is named by its relative path, which is what the user
	// sees and what distinguishes it from a sibling of the same base name.
	if listed.Attachments[2].Name != "src/a.txt" {
		t.Errorf("directory member name = %q, want src/a.txt", listed.Attachments[2].Name)
	}
}

func TestAttachmentListToolIsBoundToItsChat(t *testing.T) {
	stub := &stubAttachments{}
	if _, err := attachmentListTool(stub, "proj-a", "chat-1").Handler(context.Background(), json.RawMessage(`{}`)); err != nil {
		t.Fatal(err)
	}
	if stub.gotProject != "proj-a" || stub.gotChatID != "chat-1" {
		t.Fatalf("tool reached (%q, %q), want (proj-a, chat-1)", stub.gotProject, stub.gotChatID)
	}
}

func TestAttachmentListToolSurfacesStoreFailures(t *testing.T) {
	stub := &stubAttachments{err: errors.New("store unavailable")}
	if _, err := attachmentListTool(stub, "proj-a", "chat-1").Handler(context.Background(), json.RawMessage(`{}`)); err == nil {
		t.Fatal("a store failure was reported to the model as an empty list")
	}
}

func TestAskBindsTheAttachmentToolOnlyInsideAChat(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"answer":"No source was retrieved.","citations":[],"uncertainty":"No evidence.","insufficientEvidence":true}`)},
	}
	ask := newTestAsk(t, model, &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}})
	ask.attachments = &stubAttachments{}

	// No chat in scope: the tool has no conversation to enumerate, so it must not
	// be offered at all rather than be offered with an empty binding.
	if _, err := ask.Run(context.Background(), Scope{ProjectID: "project-a"},
		AskRequest{Prompt: "Answer.", Persona: generalPersonaSelection()}); err != nil {
		t.Fatalf("Run: %v", err)
	}
	if len(model.toolRequests) != 1 {
		t.Fatalf("tool requests = %d, want 1", len(model.toolRequests))
	}
	for _, d := range model.toolRequests[0].Tools.Definitions() {
		if d.Name == attachmentListToolName {
			t.Fatal("attachment tool was offered outside a chat")
		}
	}

	model.toolRequests = nil
	if _, err := ask.Run(context.Background(), Scope{ProjectID: "project-a", ChatID: "chat-1"},
		AskRequest{Prompt: "Answer.", Persona: generalPersonaSelection()}); err != nil {
		t.Fatalf("Run: %v", err)
	}
	found := false
	for _, d := range model.toolRequests[0].Tools.Definitions() {
		if d.Name == attachmentListToolName {
			found = true
		}
	}
	if !found {
		t.Error("attachment tool was not offered inside a chat")
	}
}
