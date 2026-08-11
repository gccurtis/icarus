package wiring

import (
	"context"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/platform/job"
)

type fakeEnqueuer struct {
	types    []string
	payloads []any
}

func (f *fakeEnqueuer) Enqueue(_ context.Context, typ string, payload any) (job.Job, error) {
	f.types = append(f.types, typ)
	f.payloads = append(f.payloads, payload)
	return job.Job{}, nil
}

func TestCascaderEnqueuesReloadForDependents(t *testing.T) {
	docs := document.New(document.NewMemoryStore(), document.Options{})
	base := document.Base{
		Template: &document.TemplateInfo{Variables: []document.ContextVariable{
			{Name: "sales", BoundResource: &document.ResourceRef{Kind: "connector", ID: "CX"}},
		}},
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
			ID: "pb1", Kind: document.BlockKindPrompt,
			Data:    document.PromptData{Instruction: "summarize"},
			Context: &document.BlockContext{Include: []string{"sales"}},
		}}}},
	}
	doc, err := docs.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}
	q := &fakeEnqueuer{}
	c := refreshCascader{docs: docs, queue: q}

	c.RefreshDependents("p", "connector", "CX")

	if len(q.types) != 1 || q.types[0] != document.JobTypeResolve {
		t.Fatalf("enqueued types = %+v, want one %q", q.types, document.JobTypeResolve)
	}
	got, ok := q.payloads[0].(map[string]string)
	if !ok {
		t.Fatalf("payload type %T", q.payloads[0])
	}
	if got["projectId"] != "p" || got["documentId"] != doc.ID || got["blockId"] != "pb1" || got["mode"] != "reload" {
		t.Fatalf("payload %+v", got)
	}

	// A source with no dependents enqueues nothing.
	q2 := &fakeEnqueuer{}
	refreshCascader{docs: docs, queue: q2}.RefreshDependents("p", "connector", "GHOST")
	if len(q2.types) != 0 {
		t.Fatalf("ghost source enqueued %+v", q2.types)
	}
}
