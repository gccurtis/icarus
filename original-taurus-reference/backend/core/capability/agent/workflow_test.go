package agent

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

type actionLoopProvider struct {
	documentID string
	calls      int
	requests   []intelligence.ReasoningRequest
}

func (*actionLoopProvider) Name() string { return "action-loop" }

func (*actionLoopProvider) Inference(context.Context, intelligence.InferenceRequest) (intelligence.InferenceResponse, error) {
	return intelligence.InferenceResponse{}, nil
}

func (p *actionLoopProvider) Reasoning(_ context.Context, req intelligence.ReasoningRequest) (intelligence.ReasoningResponse, error) {
	p.calls++
	p.requests = append(p.requests, req)
	switch p.calls {
	case 1:
		return intelligence.ReasoningResponse{Content: `{"queries":[]}`}, nil
	case 2:
		arguments, _ := json.Marshal(map[string]string{"documentId": p.documentID})
		return intelligence.ReasoningResponse{ToolCalls: []intelligence.ToolCall{{ID: "read-1", Name: "document.get", Version: "v1", Arguments: arguments}}}, nil
	case 3:
		arguments, _ := json.Marshal(struct {
			DocumentID string       `json:"documentId"`
			Ops        []markdownOp `json:"ops"`
		}{p.documentID, formattedStoryOps()})
		return intelligence.ReasoningResponse{ToolCalls: []intelligence.ToolCall{{ID: "change-1", Name: "document.edit", Version: "v1", Arguments: arguments}}}, nil
	case 4:
		arguments, _ := json.Marshal(map[string]string{"documentId": p.documentID})
		return intelligence.ReasoningResponse{ToolCalls: []intelligence.ToolCall{{ID: "verify-1", Name: "document.get", Version: "v1", Arguments: arguments}}}, nil
	default:
		return intelligence.ReasoningResponse{Content: `{"summary":"Changed the document.","outcome":"completed","operations":[{"toolCallId":"change-1","summary":"Updated the text.","outcome":"completed","citations":[]}],"openQuestions":[],"nextSteps":[],"citations":[]}`}, nil
	}
}

func (*actionLoopProvider) Embed(context.Context, intelligence.EmbeddingRequest) (intelligence.EmbeddingResponse, error) {
	return intelligence.EmbeddingResponse{}, nil
}

// formattedStoryOps scripts a formatted multi-section story as block-level
// markdown edits — the shape a real Action model now produces (no byte offsets).
func formattedStoryOps() []markdownOp {
	return []markdownOp{
		{Op: "append", Kind: document.SubKindHeading1, Markdown: "The Glass Harbor"},
		{Op: "append", Kind: document.SubKindHeading2, Markdown: "I. The Bell Before Dawn"},
		{Op: "append", Kind: document.BlockKindText, Markdown: "**No bell had rung in twelve years**, yet Mara woke before dawn with its bronze note trembling through the window glass. She crossed the sleeping quay while lamps faded one by one, following the sound toward the abandoned lighthouse where her father had vanished."},
		{Op: "append", Kind: document.SubKindHeading2, Markdown: "II. What the Tide Kept"},
		{Op: "append", Kind: document.BlockKindText, Markdown: "_The sea remembered every name._ It whispered them beneath the pier as Mara found a narrow skiff tied with her father's blue cord. In its bow lay a dry match, a brass key, and a chart whose ink brightened whenever the impossible bell sounded."},
		{Op: "append", Kind: document.SubKindHeading2, Markdown: "III. The Lantern Room"},
		{Op: "append", Kind: document.BlockKindText, Markdown: "**Keep the light.** _The words were carved beneath the lantern._ When Mara reached the island, she turned the brass key, and the dark lens opened like an eye. Across the harbor, every window caught the returning beam; behind her, a familiar hand settled on her shoulder as the final bell note became morning."},
	}
}

func newTestWorkflows(t *testing.T, model *fakeIntelligence) (*Tasks, *Workflows) {
	t.Helper()
	tasks, err := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	if err != nil {
		t.Fatal(err)
	}
	workflows, err := NewWorkflows(WorkflowOptions{Tasks: tasks, Intelligence: model, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}, Personas: newTestPersonas(t, persona.Options{}), PlanningCast: testCast, DefaultCast: testCast})
	if err != nil {
		t.Fatal(err)
	}
	return tasks, workflows
}

func TestPlanTaskPersistsSelectedPersonaAndRevision(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"title":"Launch plan","objective":"Launch","summary":"A plan.","assumptions":[],"openQuestions":[],"successCriteria":[],"steps":[{"id":"step-1","title":"Prepare","description":"Prepare launch.","rationale":"Required.","dependsOnStepIds":[],"deliverables":[],"completionCriteria":[],"citations":[]}],"risks":[],"citations":[]}`)},
	}
	tasks, workflows := newTestWorkflows(t, model)
	task, err := workflows.CreatePlan(Scope{ProjectID: "project-a"}, "user-a", "Plan a launch.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	if task.Persona.ID != persona.GeneralID || task.Persona.Version != 1 || task.Persona.Name != "General" {
		t.Errorf("persona = %+v", task.Persona)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatalf("RunJob: %v", err)
	}
	stored, err := tasks.Get(Scope{ProjectID: "project-a"}, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.State != TaskStateCompleted || len(stored.Plans) != 1 || stored.Plans[0].State != "draft" {
		t.Errorf("task = %+v", stored)
	}
}

func TestActionTaskReconcilesToolReport(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"summary":"Changed the document.","outcome":"completed","operations":[{"toolCallId":"change-1","summary":"Applied changes.","outcome":"completed","citations":[]}],"openQuestions":[],"nextSteps":[],"citations":[]}`), ToolResults: []intelligence.ToolResult{{CallID: "change-1", Name: "document.edit", Version: "v1", OK: true, Output: json.RawMessage(`{"documentId":"doc-1"}`)}}},
	}
	tasks, workflows := newTestWorkflows(t, model)
	task, err := workflows.CreateAction(Scope{ProjectID: "project-a"}, "user-a", "Update the document.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatalf("RunJob: %v", err)
	}
	stored, err := tasks.Get(Scope{ProjectID: "project-a"}, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.State != TaskStateCompleted || stored.Runs[0].State != TaskStateCompleted {
		t.Errorf("task = %+v", stored)
	}
}

// A live model occasionally emits a semantically invalid final report (an
// unknown toolCallId, a bogus outcome) after the action's tool work has already
// succeeded. That work is real — its effects are in the store — so a malformed
// report must not discard it: the workflow re-asks once, tool-free, for a
// corrected report before failing the task.
func TestActionRecoversFromInvalidReportWithOneReask(t *testing.T) {
	valid := `{"summary":"Changed the document.","outcome":"completed","operations":[{"toolCallId":"change-1","summary":"Applied changes.","outcome":"completed","citations":[]}],"openQuestions":[],"nextSteps":[],"citations":[]}`
	model := &fakeIntelligence{
		// The tool loop's final report references a tool call that never ran.
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"summary":"Changed the document.","outcome":"completed","operations":[{"toolCallId":"ghost-1","summary":"Applied changes.","outcome":"completed","citations":[]}],"openQuestions":[],"nextSteps":[],"citations":[]}`), ToolResults: []intelligence.ToolResult{{CallID: "change-1", Name: "document.edit", Version: "v1", OK: true, Output: json.RawMessage(`{"documentId":"doc-1"}`)}}},
		// Call 1: retrieval plan. Call 2: the corrective re-ask, now valid.
		reasonQueue: []intelligence.Result{
			{JSON: json.RawMessage(`{"queries":[]}`)},
			{JSON: json.RawMessage(valid), Usage: intelligence.Usage{PromptTokens: 7, TotalTokens: 9}},
		},
	}
	tasks, workflows := newTestWorkflows(t, model)
	task, err := workflows.CreateAction(Scope{ProjectID: "project-a"}, "user-a", "Update the document.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatalf("RunJob: %v", err)
	}
	stored, err := tasks.Get(Scope{ProjectID: "project-a"}, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.State != TaskStateCompleted || stored.Runs[0].State != TaskStateCompleted {
		t.Fatalf("task after re-ask = %s (run %s), want completed", stored.State, stored.Runs[0].State)
	}
	// The corrective request must hand the model the real executed call IDs.
	if len(model.planningRequests) != 2 {
		t.Fatalf("ReasonJSON calls = %d, want 2 (retrieval plan + corrective re-ask)", len(model.planningRequests))
	}
	corrective := model.planningRequests[1]
	if len(corrective.Messages) == 0 || !strings.Contains(corrective.Messages[len(corrective.Messages)-1].Content, "change-1") {
		t.Errorf("corrective re-ask does not carry the executed toolCallId: %+v", corrective.Messages)
	}
	// The extra call's tokens are visible on the run, not discarded.
	if stored.Runs[0].Usage.Answer.TotalTokens == 0 {
		t.Errorf("corrective usage not recorded: %+v", stored.Runs[0].Usage)
	}
}

// The second corrective attempt also recovers: the first re-ask can itself
// return a bad sample (a degraded provider window makes that likely), and by
// then the model has been handed the exact executed call IDs — one more sample
// is cheap and usually lands.
func TestActionRecoversOnSecondReask(t *testing.T) {
	invalid := `{"summary":"Changed the document.","outcome":"completed","operations":[{"toolCallId":"ghost-1","summary":"Applied changes.","outcome":"completed","citations":[]}],"openQuestions":[],"nextSteps":[],"citations":[]}`
	valid := `{"summary":"Changed the document.","outcome":"completed","operations":[{"toolCallId":"change-1","summary":"Applied changes.","outcome":"completed","citations":[]}],"openQuestions":[],"nextSteps":[],"citations":[]}`
	model := &fakeIntelligence{
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(invalid), ToolResults: []intelligence.ToolResult{{CallID: "change-1", Name: "document.edit", Version: "v1", OK: true, Output: json.RawMessage(`{"documentId":"doc-1"}`)}}},
		reasonQueue: []intelligence.Result{
			{JSON: json.RawMessage(`{"queries":[]}`)},
			{JSON: json.RawMessage(invalid)},
			{JSON: json.RawMessage(valid)},
		},
	}
	tasks, workflows := newTestWorkflows(t, model)
	task, err := workflows.CreateAction(Scope{ProjectID: "project-a"}, "user-a", "Update the document.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatalf("RunJob: %v", err)
	}
	stored, err := tasks.Get(Scope{ProjectID: "project-a"}, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.State != TaskStateCompleted {
		t.Fatalf("task after second re-ask = %s, want completed", stored.State)
	}
}

// The re-ask is bounded at two: a third invalid report fails the task.
func TestActionFailsWhenReaskedReportIsStillInvalid(t *testing.T) {
	invalid := `{"summary":"Changed the document.","outcome":"completed","operations":[{"toolCallId":"ghost-1","summary":"Applied changes.","outcome":"completed","citations":[]}],"openQuestions":[],"nextSteps":[],"citations":[]}`
	model := &fakeIntelligence{
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(invalid), ToolResults: []intelligence.ToolResult{{CallID: "change-1", Name: "document.edit", Version: "v1", OK: true, Output: json.RawMessage(`{"documentId":"doc-1"}`)}}},
		reasonQueue: []intelligence.Result{
			{JSON: json.RawMessage(`{"queries":[]}`)},
			{JSON: json.RawMessage(invalid)},
			{JSON: json.RawMessage(invalid)},
		},
	}
	tasks, workflows := newTestWorkflows(t, model)
	task, err := workflows.CreateAction(Scope{ProjectID: "project-a"}, "user-a", "Update the document.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatalf("RunJob: %v", err)
	}
	stored, err := tasks.Get(Scope{ProjectID: "project-a"}, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.State != TaskStateFailed {
		t.Fatalf("task after thrice-invalid report = %s, want failed", stored.State)
	}
	if len(model.planningRequests) != 3 {
		t.Fatalf("ReasonJSON calls = %d, want exactly 3 — the re-ask is bounded at two", len(model.planningRequests))
	}
}

func TestPlanRejectsCyclicDependencies(t *testing.T) {
	draft := PlanDraft{
		Title: "Plan", Objective: "Do work",
		Steps: []PlanStep{
			{ID: "one", Title: "One", DependsOnStepIDs: []string{"two"}},
			{ID: "two", Title: "Two", DependsOnStepIDs: []string{"one"}},
		},
	}
	if err := validatePlanDraft(draft, nil); err == nil {
		t.Fatal("validatePlanDraft accepted a cyclic dependency")
	}
}

func TestPlanUsesConfiguredPersonaAndPolicy(t *testing.T) {
	policy := DefaultPolicy()
	policy.Prompts.Plan = "Configured plan prompt."
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"title":"Plan","objective":"Do work","summary":"","assumptions":[],"openQuestions":[],"successCriteria":[],"steps":[{"id":"one","title":"One","description":"","rationale":"","dependsOnStepIds":[],"deliverables":[],"completionCriteria":[],"citations":[]}],"risks":[],"citations":[]}`)},
	}
	tasks, err := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	if err != nil {
		t.Fatal(err)
	}
	personas := newTestPersonas(t, persona.Options{GeneralName: "Configured", GeneralDefinition: persona.Definition{BehavioralGuidance: "Configured plan persona."}})
	workflows, err := NewWorkflows(WorkflowOptions{Tasks: tasks, Intelligence: model, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}, Personas: personas, PlanningCast: testCast, DefaultCast: testCast, Policy: policy})
	if err != nil {
		t.Fatal(err)
	}
	task, err := workflows.CreatePlan(Scope{ProjectID: "project-a"}, "user-a", "Plan it.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	if task.Persona.ID != persona.GeneralID || task.Persona.Instructions != "Configured plan persona." {
		t.Errorf("persona = %+v", task.Persona)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatal(err)
	}
	if got := model.toolRequests[0].Messages[0].Content; got != "Configured plan persona. Configured plan prompt." {
		t.Errorf("system message = %q", got)
	}
	if string(model.toolSchemas[0]) != string(policy.Schemas.Plan) {
		t.Errorf("schema = %s", model.toolSchemas[0])
	}
}

func TestCompletedActionRejectsFailedReportedOperation(t *testing.T) {
	report := ExecutionReport{
		Summary: "Tried a change.", Outcome: "completed",
		Operations: []ExecutionOperation{{ToolCallID: "failed-change", Summary: "Change", Outcome: "failed"}},
	}
	_, err := validateReport(report, nil, []intelligence.ToolResult{{CallID: "failed-change", Name: "document.edit", Version: "v1", OK: false}})
	if err == nil {
		t.Fatal("validateReport accepted a completed action with a failed operation")
	}
}

func TestActionRunsDocumentToolLoopAndPersistsEffect(t *testing.T) {
	documents := document.New(document.NewMemoryStore(), document.Options{})
	doc, err := documents.Create("project-a", "Story", document.Base{})
	if err != nil {
		t.Fatal(err)
	}
	provider := &actionLoopProvider{documentID: doc.ID}
	intel, err := intelligence.New(intelligence.Options{
		Providers: map[string]intelligence.Provider{"action-loop": provider},
		Routes:    map[intelligence.Kind][]intelligence.Route{intelligence.KindReasoning: {{Cast: testCast, Provider: "action-loop", Model: "test/model"}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	tasks, err := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	if err != nil {
		t.Fatal(err)
	}
	workflows, err := NewWorkflows(WorkflowOptions{Tasks: tasks, Intelligence: intel, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}, Personas: newTestPersonas(t, persona.Options{}), Documents: documents, PlanningCast: testCast, DefaultCast: testCast})
	if err != nil {
		t.Fatal(err)
	}
	task, err := workflows.CreateAction(Scope{ProjectID: "project-a"}, "user-a", "Write a three-section story with a title, section headings, bold emphasis, and italic emphasis.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatal(err)
	}
	stored, err := tasks.Get(Scope{ProjectID: "project-a"}, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.State != TaskStateCompleted || provider.calls != 5 {
		t.Errorf("task = %+v, provider calls = %d", stored, provider.calls)
	}
	if len(provider.requests) < 3 || !hasTool(provider.requests[1].Tools, "document.get") || !hasTool(provider.requests[1].Tools, "document.edit") {
		t.Errorf("Action document tools = %+v", provider.requests)
	}
	updated, err := documents.Get("project-a", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(updated.Base.Rows) != 7 || updated.Base.Rows[0].Blocks[0].SubKind != document.SubKindHeading1 {
		t.Fatalf("document structure = %+v", updated.Base.Rows)
	}
	storyBytes, headings, bold, italic := 0, 0, 0, 0
	for _, row := range updated.Base.Rows {
		for _, block := range row.Blocks {
			storyBytes += len(block.DisplayText())
			if block.SubKind == document.SubKindHeading1 || block.SubKind == document.SubKindHeading2 {
				headings++
			}
			for _, mark := range block.Marks {
				switch mark.Kind {
				case document.MarkKindBold:
					bold++
				case document.MarkKindItalic:
					italic++
				}
			}
		}
	}
	if storyBytes < 700 || headings != 4 || bold != 2 || italic != 2 {
		t.Errorf("story bytes=%d headings=%d bold=%d italic=%d", storyBytes, headings, bold, italic)
	}
}

func hasTool(tools []intelligence.ToolDefinition, name string) bool {
	for _, tool := range tools {
		if tool.Name == name {
			return true
		}
	}
	return false
}
