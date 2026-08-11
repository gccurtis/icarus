package agent

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/platform/job"
)

// promptToolEnqueuer captures the jobs the resolve tool enqueues.
type promptToolEnqueuer struct {
	types    []string
	payloads []any
}

func (e *promptToolEnqueuer) Enqueue(_ context.Context, typ string, payload any) (job.Job, error) {
	e.types = append(e.types, typ)
	e.payloads = append(e.payloads, payload)
	return job.Job{}, nil
}

func newPromptToolDocs(t *testing.T) *document.Documents {
	t.Helper()
	return document.New(document.NewMemoryStore(), document.Options{})
}

func scopedPromptBase(varName, connectorID, blockID, instruction string) document.Base {
	return document.Base{
		Template: &document.TemplateInfo{Variables: []document.ContextVariable{
			{Name: varName, BoundResource: &document.ResourceRef{Kind: "connector", ID: connectorID}},
		}},
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
			ID: blockID, Kind: document.BlockKindPrompt,
			Data:    document.PromptData{Instruction: instruction},
			Context: &document.BlockContext{Include: []string{varName}},
		}}}},
	}
}

func TestDocumentGetRevealsPromptBlock(t *testing.T) {
	docs := newPromptToolDocs(t)
	doc, err := docs.Create("p", "Doc", scopedPromptBase("sales", "CA", "pb", "Summarize sales"))
	if err != nil {
		t.Fatal(err)
	}
	w := &Workflows{documents: docs}
	raw, _ := json.Marshal(map[string]string{"documentId": doc.ID})
	out, err := w.documentGetTool(Scope{ProjectID: "p"}, Task{RequesterID: "u1"}).Handler(context.Background(), raw)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	var got struct {
		Blocks []blockView `json:"blocks"`
	}
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Blocks) != 1 {
		t.Fatalf("blocks = %+v", got.Blocks)
	}
	b := got.Blocks[0]
	if b.Kind != "prompt" || b.Instruction != "Summarize sales" {
		t.Fatalf("prompt block view = %+v", b)
	}
	if b.Context == nil || len(b.Context.Include) != 1 || b.Context.Include[0] != "sales" {
		t.Fatalf("context view = %+v", b.Context)
	}
}

func TestDocumentPromptCreateTool(t *testing.T) {
	docs := newPromptToolDocs(t)
	// A document with a text block so afterBlockId resolves to a real row.
	doc, err := docs.Create("p", "Doc", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{ID: "t1", Kind: document.BlockKindText}},
	}}})
	if err != nil {
		t.Fatal(err)
	}
	w := &Workflows{documents: docs}
	raw, _ := json.Marshal(map[string]any{
		"documentId": doc.ID, "afterBlockId": "t1",
		"instruction": "Summarize the sales data", "include": []string{"sales"},
	})
	out, err := w.documentPromptCreateTool(Scope{ProjectID: "p"}, Task{RequesterID: "u1"}).Handler(context.Background(), raw)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	var res struct {
		BlockID string `json:"blockId"`
	}
	json.Unmarshal(out, &res)

	got, _ := docs.Get("p", doc.ID)
	var found *document.Block
	for _, row := range got.Base.Rows {
		for i := range row.Blocks {
			if row.Blocks[i].ID == res.BlockID {
				found = &row.Blocks[i]
			}
		}
	}
	if found == nil || found.Kind != document.BlockKindPrompt {
		t.Fatalf("new prompt block not found: %+v", got.Base.Rows)
	}
	if pd, _ := found.Data.(document.PromptData); pd.Instruction != "Summarize the sales data" {
		t.Fatalf("instruction = %+v", found.Data)
	}
	if found.Context == nil || len(found.Context.Include) != 1 || found.Context.Include[0] != "sales" {
		t.Fatalf("context = %+v", found.Context)
	}
}

func TestDocumentPromptUpdateTool(t *testing.T) {
	docs := newPromptToolDocs(t)
	doc, err := docs.Create("p", "Doc", scopedPromptBase("sales", "CA", "pb", "old instruction"))
	if err != nil {
		t.Fatal(err)
	}
	w := &Workflows{documents: docs}
	raw, _ := json.Marshal(map[string]any{
		"documentId": doc.ID, "blockId": "pb",
		"instruction": "new instruction", "include": []string{"ops"},
	})
	if _, err := w.documentPromptUpdateTool(Scope{ProjectID: "p"}, Task{RequesterID: "u1"}).Handler(context.Background(), raw); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, _ := docs.Get("p", doc.ID)
	blk := got.Base.Rows[0].Blocks[0]
	if pd, _ := blk.Data.(document.PromptData); pd.Instruction != "new instruction" {
		t.Fatalf("instruction not updated: %+v", blk.Data)
	}
	if blk.Context == nil || len(blk.Context.Include) != 1 || blk.Context.Include[0] != "ops" {
		t.Fatalf("context not updated: %+v", blk.Context)
	}

	// Updating a non-prompt block is rejected.
	textDoc, _ := docs.Create("p", "Text", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{ID: "tx", Kind: document.BlockKindText}},
	}}})
	badRaw, _ := json.Marshal(map[string]any{"documentId": textDoc.ID, "blockId": "tx", "instruction": "x"})
	if _, err := w.documentPromptUpdateTool(Scope{ProjectID: "p"}, Task{RequesterID: "u1"}).Handler(context.Background(), badRaw); err == nil {
		t.Fatal("expected rejection updating a non-prompt block")
	}
}

func TestDocumentPromptResolveTool(t *testing.T) {
	docs := newPromptToolDocs(t)
	doc, err := docs.Create("p", "Doc", scopedPromptBase("sales", "CA", "pb", "summarize"))
	if err != nil {
		t.Fatal(err)
	}
	enq := &promptToolEnqueuer{}
	w := &Workflows{documents: docs, enqueuer: enq}
	raw, _ := json.Marshal(map[string]string{"documentId": doc.ID, "blockId": "pb"})
	out, err := w.documentPromptResolveTool(Scope{ProjectID: "p"}, Task{RequesterID: "u1"}).Handler(context.Background(), raw)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if len(enq.types) != 1 || enq.types[0] != document.JobTypeResolve {
		t.Fatalf("enqueued types = %+v", enq.types)
	}
	payload := enq.payloads[0].(map[string]string)
	if payload["projectId"] != "p" || payload["documentId"] != doc.ID || payload["blockId"] != "pb" || payload["mode"] != "reload" {
		t.Fatalf("payload = %+v", payload)
	}
	if string(out) == "" || !json.Valid(out) {
		t.Fatalf("bad output: %s", out)
	}
}
