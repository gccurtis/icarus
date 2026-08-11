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

func TestTasksCreateRejectsInvalidMode(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	_, err := tasks.Create(Scope{ProjectID: "p"}, "user-a", "ask", "What?", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("invalid mode error = %v, want ErrInvalidTask", err)
	}
}

func TestTasksCreateRejectsEmptyObjective(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	_, err := tasks.Create(Scope{ProjectID: "p"}, "user-a", TaskModePlan, "", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("empty objective error = %v, want ErrInvalidTask", err)
	}
}

func TestTasksCreateRejectsEmptyRequesterID(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	_, err := tasks.Create(Scope{ProjectID: "p"}, "", TaskModePlan, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("empty requester error = %v, want ErrInvalidTask", err)
	}
}

func TestTasksCreateRejectsEmptyProjectScope(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	_, err := tasks.Create(Scope{}, "user-a", TaskModePlan, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	if !errors.Is(err, ErrInvalidScope) {
		t.Fatalf("empty scope error = %v, want ErrInvalidScope", err)
	}
}

func TestTasksCreateRejectsInvalidPersonaSnapshot(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	_, err := tasks.Create(Scope{ProjectID: "p"}, "user-a", TaskModePlan, "Do it.", nil, PersonaSnapshot{}, "")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("invalid persona error = %v, want ErrInvalidTask", err)
	}
}

func TestTasksGetCrossProject(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	task, _ := tasks.Create(Scope{ProjectID: "proj-a"}, "user-a", TaskModePlan, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	_, err := tasks.Get(Scope{ProjectID: "proj-b"}, task.ID)
	if !errors.Is(err, ErrTaskProjectScope) {
		t.Fatalf("cross-project get error = %v, want ErrTaskProjectScope", err)
	}
}

func TestTasksListWithEmptyScope(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	_, err := tasks.List(Scope{})
	if !errors.Is(err, ErrInvalidScope) {
		t.Fatalf("empty scope error = %v, want ErrInvalidScope", err)
	}
}

func TestTasksListByPersonaWithEmptyID(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	_, err := tasks.ListByPersona(Scope{ProjectID: "p"}, "")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("empty persona error = %v, want ErrInvalidTask", err)
	}
}

func TestTasksBeginRunOnRunningTask(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	scope := Scope{ProjectID: "p"}
	task, _ := tasks.Create(scope, "user-a", TaskModePlan, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	tasks.BeginRun(scope, RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	_, _, err := tasks.BeginRun(scope, RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if !errors.Is(err, ErrTaskNotRunnable) {
		t.Fatalf("second BeginRun error = %v, want ErrTaskNotRunnable", err)
	}
}

func TestTasksFinishRunOnUnexecutedRun(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	scope := Scope{ProjectID: "p"}
	task, _ := tasks.Create(scope, "user-a", TaskModePlan, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	err := tasks.FinishRun(scope, task.ID, task.Runs[0].ID, TaskStateCompleted, nil, Usage{}, "")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("finish queued run error = %v, want ErrInvalidTask", err)
	}
}

func TestTasksAcceptPlanOnActionTask(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	scope := Scope{ProjectID: "p"}
	task, _ := tasks.Create(scope, "user-a", TaskModeAction, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	_, err := tasks.AcceptPlan(scope, task.ID, "some-plan")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("accept plan on action task error = %v, want ErrInvalidTask", err)
	}
}

func TestTasksAcceptPlanWithNonexistentPlan(t *testing.T) {
	planDraft := PlanDraft{
		Title: "Plan", Objective: "Do work", Summary: "", Assumptions: nil, OpenQuestions: nil, SuccessCriteria: nil,
		Steps: []PlanStep{{ID: "s1", Title: "One", Description: "", Rationale: "", DependsOnStepIDs: nil, Deliverables: nil, CompletionCriteria: nil, Citations: nil}},
		Risks: nil, Citations: nil,
	}
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	scope := Scope{ProjectID: "p"}
	task, _ := tasks.Create(scope, "user-a", TaskModePlan, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	task.Plans = []PlanRevision{{ID: "plan-1", State: "draft", Draft: planDraft}}
	tasks.store.UpdateTask(task)
	_, err := tasks.AcceptPlan(scope, task.ID, "does-not-exist")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("nonexistent plan error = %v, want ErrInvalidTask", err)
	}
}

func TestAcceptPlanOnlyAcceptsDraft(t *testing.T) {
	planDraft := PlanDraft{
		Title: "Plan", Objective: "Do work", Summary: "", Assumptions: nil, OpenQuestions: nil, SuccessCriteria: nil,
		Steps: []PlanStep{{ID: "s1", Title: "One", Description: "", Rationale: "", DependsOnStepIDs: nil, Deliverables: nil, CompletionCriteria: nil, Citations: nil}},
		Risks: nil, Citations: nil,
	}
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	scope := Scope{ProjectID: "p"}
	task, _ := tasks.Create(scope, "user-a", TaskModePlan, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	task.Plans = []PlanRevision{{ID: "plan-1", State: "accepted", Draft: planDraft}}
	tasks.store.UpdateTask(task)
	_, err := tasks.AcceptPlan(scope, task.ID, "plan-1")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("re-accept plan error = %v, want ErrInvalidTask", err)
	}
}

func TestMemoryTaskStoreRejectsDuplicateCreate(t *testing.T) {
	store := NewMemoryTaskStore()
	task := Task{ID: "t1", ProjectID: "p1", State: TaskStateQueued}
	store.CreateTask(task)
	if err := store.CreateTask(task); !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("duplicate create error = %v, want ErrInvalidTask", err)
	}
}

func TestDocumentGetToolCrossProjectRejection(t *testing.T) {
	documents := document.New(document.NewMemoryStore(), document.Options{})
	doc, _ := documents.Create("proj-a", "Doc", document.Base{})

	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	policy := DefaultPolicy()
	workflows, err := NewWorkflows(WorkflowOptions{
		Tasks: tasks, Intelligence: &fakeIntelligence{}, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas: newTestPersonas(t, persona.Options{}), Documents: documents,
		PlanningCast: testCast, DefaultCast: testCast, Policy: policy,
	})
	if err != nil {
		t.Fatal(err)
	}
	tool := workflows.documentGetTool(Scope{ProjectID: "proj-b"}, Task{})
	input, _ := json.Marshal(map[string]string{"documentId": doc.ID})
	_, err = tool.Handler(context.Background(), input)
	if !errors.Is(err, document.ErrNotFound) {
		t.Fatalf("cross-project document get error = %v, want ErrNotFound", err)
	}
}

func TestDocumentAppendToolCrossProjectRejection(t *testing.T) {
	documents := document.New(document.NewMemoryStore(), document.Options{})
	doc, _ := documents.Create("proj-a", "Doc", document.Base{})

	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	policy := DefaultPolicy()
	workflows, err := NewWorkflows(WorkflowOptions{
		Tasks: tasks, Intelligence: &fakeIntelligence{}, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas: newTestPersonas(t, persona.Options{}), Documents: documents,
		PlanningCast: testCast, DefaultCast: testCast, Policy: policy,
	})
	if err != nil {
		t.Fatal(err)
	}
	scope := Scope{ProjectID: "proj-b"}
	task := Task{ID: "cross-task", ProjectID: "proj-b", RequesterID: "u1", Mode: TaskModeAction}
	tool := workflows.documentEditTool(scope, task)
	input, _ := json.Marshal(struct {
		DocumentID string       `json:"documentId"`
		Ops        []markdownOp `json:"ops"`
	}{DocumentID: doc.ID, Ops: []markdownOp{{Op: "append", Kind: "paragraph", Markdown: "x"}}})
	_, err = tool.Handler(context.Background(), input)
	if err == nil {
		t.Fatal("cross-project append should have failed")
	}
}

func TestDocumentAppendToolRejectsEmptyOps(t *testing.T) {
	documents := document.New(document.NewMemoryStore(), document.Options{})
	doc, _ := documents.Create("proj-a", "Doc", document.Base{})

	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	policy := DefaultPolicy()
	workflows, err := NewWorkflows(WorkflowOptions{
		Tasks: tasks, Intelligence: &fakeIntelligence{}, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas: newTestPersonas(t, persona.Options{}), Documents: documents,
		PlanningCast: testCast, DefaultCast: testCast, Policy: policy,
	})
	if err != nil {
		t.Fatal(err)
	}
	scope := Scope{ProjectID: "proj-a"}
	task := Task{ID: "t1", ProjectID: "proj-a", RequesterID: "u1", Mode: TaskModeAction}
	tool := workflows.documentEditTool(scope, task)
	input, _ := json.Marshal(struct {
		DocumentID string       `json:"documentId"`
		Ops        []markdownOp `json:"ops"`
	}{DocumentID: doc.ID, Ops: nil})
	_, err = tool.Handler(context.Background(), input)
	if err == nil {
		t.Fatal("expected error for empty ops")
	}
}

func TestAskRunWithEmptyScope(t *testing.T) {
	_, err := (&Ask{}).Run(context.Background(), Scope{}, AskRequest{Prompt: "?", Persona: generalPersonaSelection()})
	if !errors.Is(err, ErrInvalidScope) {
		t.Fatalf("empty scope error = %v, want ErrInvalidScope", err)
	}
}

func TestAskRunWithEmptyRequest(t *testing.T) {
	model := &fakeIntelligence{}
	store := &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}
	ask := newTestAsk(t, model, store)
	_, err := ask.Run(context.Background(), Scope{ProjectID: "p"}, AskRequest{Persona: generalPersonaSelection()})
	if !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("empty prompt error = %v, want ErrInvalidRequest", err)
	}
}

func TestAskRunWithInvalidPersona(t *testing.T) {
	model := &fakeIntelligence{}
	store := &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}
	ask := newTestAsk(t, model, store)
	_, err := ask.Run(context.Background(), Scope{ProjectID: "p"}, AskRequest{Prompt: "?", Persona: persona.Selection{ID: "nonexistent"}})
	if err == nil {
		t.Fatal("invalid persona should have returned an error")
	}
}

func TestRunJobRejectsInvalidPayload(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	model := &fakeIntelligence{}
	workflows, _ := NewWorkflows(WorkflowOptions{
		Tasks: tasks, Intelligence: model, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas: newTestPersonas(t, persona.Options{}), PlanningCast: testCast, DefaultCast: testCast,
	})
	if err := workflows.RunJob(context.Background(), json.RawMessage(`null`)); !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("null payload error = %v, want ErrInvalidTask", err)
	}
	if err := workflows.RunJob(context.Background(), json.RawMessage(`{}`)); !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("empty payload error = %v, want ErrInvalidTask", err)
	}
}

func TestValidateReportRejectsMissingToolCall(t *testing.T) {
	report := ExecutionReport{Summary: "Done", Outcome: "completed", Operations: []ExecutionOperation{{ToolCallID: "made-up", Summary: "x", Outcome: "completed"}}}
	_, err := validateReport(report, nil, []intelligence.ToolResult{})
	if err == nil {
		t.Fatal("validateReport accepted a report referencing a nonexistent tool call")
	}
}

func TestValidateReportRejectsDuplicateOperation(t *testing.T) {
	report := ExecutionReport{
		Summary: "Done", Outcome: "completed",
		Operations: []ExecutionOperation{
			{ToolCallID: "tc-1", Summary: "first", Outcome: "completed"},
			{ToolCallID: "tc-1", Summary: "second", Outcome: "completed"},
		},
	}
	_, err := validateReport(report, nil, []intelligence.ToolResult{{CallID: "tc-1", OK: true}})
	if err == nil {
		t.Fatal("validateReport accepted duplicate operation IDs")
	}
}

func TestValidatePlanDraftRejectsEmptySteps(t *testing.T) {
	draft := PlanDraft{Title: "Plan", Objective: "Do"}
	if err := validatePlanDraft(draft, nil); err == nil {
		t.Fatal("validatePlanDraft accepted plan with no steps")
	}
}

func TestValidatePlanDraftRejectsDuplicateStepIDs(t *testing.T) {
	draft := PlanDraft{
		Title: "Plan", Objective: "Do",
		Steps: []PlanStep{
			{ID: "same", Title: "A"},
			{ID: "same", Title: "B"},
		},
	}
	if err := validatePlanDraft(draft, nil); err == nil {
		t.Fatal("validatePlanDraft accepted duplicate step IDs")
	}
}

func TestValidatePlanDraftRejectsSelfDependency(t *testing.T) {
	draft := PlanDraft{
		Title: "Plan", Objective: "Do",
		Steps: []PlanStep{
			{ID: "one", Title: "One", DependsOnStepIDs: []string{"one"}},
		},
	}
	if err := validatePlanDraft(draft, nil); err == nil {
		t.Fatal("validatePlanDraft accepted a self-dependency")
	}
}

func TestValidatePlanDraftRejectsBadDependency(t *testing.T) {
	draft := PlanDraft{
		Title: "Plan", Objective: "Do",
		Steps: []PlanStep{
			{ID: "one", Title: "One", DependsOnStepIDs: []string{"missing"}},
		},
	}
	if err := validatePlanDraft(draft, nil); err == nil {
		t.Fatal("validatePlanDraft accepted dependency on nonexistent step")
	}
}

func TestWorkflowActionOnlyAddsDocumentToolsWhenDocumentsSet(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"summary":"Done","outcome":"completed","operations":[],"openQuestions":[],"nextSteps":[],"citations":[]}`)},
	}
	tasks, err := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	if err != nil {
		t.Fatal(err)
	}
	// No documents supplied — action mode still works, just without doc tools.
	workflows, err := NewWorkflows(WorkflowOptions{
		Tasks: tasks, Intelligence: model, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas: newTestPersonas(t, persona.Options{}), PlanningCast: testCast, DefaultCast: testCast,
	})
	if err != nil {
		t.Fatal(err)
	}
	task, err := workflows.CreateAction(Scope{ProjectID: "project-a"}, "user-a", "Do something.", nil, generalPersonaSelection(), "")
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
	if stored.State != TaskStateCompleted {
		t.Errorf("action without documents should complete; got %s", stored.State)
	}
}

func TestWorkflowPlanDoesNotAddDocumentTools(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"title":"Plan","objective":"Do it","summary":"","assumptions":[],"openQuestions":[],"successCriteria":[],"steps":[{"id":"s1","title":"One","description":"","rationale":"","dependsOnStepIds":[],"deliverables":[],"completionCriteria":[],"citations":[]}],"risks":[],"citations":[]}`)},
	}
	documents := document.New(document.NewMemoryStore(), document.Options{})
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	workflows, _ := NewWorkflows(WorkflowOptions{
		Tasks: tasks, Intelligence: model, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas: newTestPersonas(t, persona.Options{}), Documents: documents,
		PlanningCast: testCast, DefaultCast: testCast,
	})
	task, _ := workflows.CreatePlan(Scope{ProjectID: "p"}, "user-a", "Plan it.", nil, generalPersonaSelection(), "")
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatal(err)
	}
	stored, _ := tasks.Get(Scope{ProjectID: "p"}, task.ID)
	if stored.State != TaskStateCompleted || len(stored.Plans) != 1 {
		t.Errorf("plan task = %+v", stored)
	}
}

func TestTasksCreateContextLimit(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	longContent := make([]byte, maxContextItemBytes+1)
	for i := range longContent {
		longContent[i] = 'x'
	}
	_, err := tasks.Create(Scope{ProjectID: "p"}, "u1", TaskModePlan, "Do it.", []ContextItem{{Label: "x", Content: string(longContent)}}, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	if err == nil {
		t.Fatal("expected error for oversized context item")
	}
}

func TestTasksCreateOversizedObjective(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	longObjective := make([]byte, maxTaskText+1)
	for i := range longObjective {
		longObjective[i] = 'x'
	}
	_, err := tasks.Create(Scope{ProjectID: "p"}, "u1", TaskModePlan, string(longObjective), nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	if !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("oversized objective error = %v, want ErrInvalidTask", err)
	}
}

func TestTodoToolsLimitEnforcement(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	scope := Scope{ProjectID: "p"}
	task, _ := tasks.Create(scope, "user-a", TaskModeAction, "Do work.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	bindings := tasks.ToolBindings(scope, task)
	var createHandler func(context.Context, json.RawMessage) (json.RawMessage, error)
	for _, b := range bindings {
		if b.Definition.Name == "task.todo.create" {
			createHandler = b.Handler
			break
		}
	}
	for i := 0; i < maxTaskTodos; i++ {
		_, err := createHandler(context.Background(), json.RawMessage(`{"text":"todo `+string(rune('a'+i%26))+`"}`))
		if err != nil {
			t.Fatalf("todo %d: %v", i, err)
		}
	}
	_, err := createHandler(context.Background(), json.RawMessage(`{"text":"overflow"}`))
	if err == nil {
		t.Fatal("expected limit error for too many todos")
	}
}

func TestNoteToolsLimitEnforcement(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	scope := Scope{ProjectID: "p"}
	task, _ := tasks.Create(scope, "user-a", TaskModeAction, "Do work.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	bindings := tasks.ToolBindings(scope, task)
	var noteHandler func(context.Context, json.RawMessage) (json.RawMessage, error)
	for _, b := range bindings {
		if b.Definition.Name == "task.note.append" {
			noteHandler = b.Handler
			break
		}
	}
	for i := 0; i < maxTaskNotes; i++ {
		_, err := noteHandler(context.Background(), json.RawMessage(`{"note":"note `+string(rune('a'+i%26))+`"}`))
		if err != nil {
			t.Fatalf("note %d: %v", i, err)
		}
	}
	_, err := noteHandler(context.Background(), json.RawMessage(`{"note":"overflow"}`))
	if err == nil {
		t.Fatal("expected limit error for too many notes")
	}
}

func TestNewWorkflowsRejectsNilTasks(t *testing.T) {
	_, err := NewWorkflows(WorkflowOptions{Personas: newTestPersonas(t, persona.Options{})})
	if err == nil {
		t.Fatal("NewWorkflows accepted nil Tasks")
	}
}

func TestNewWorkflowsRejectsNilPersonas(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	_, err := NewWorkflows(WorkflowOptions{Tasks: tasks})
	if err == nil {
		t.Fatal("NewWorkflows accepted nil Personas")
	}
}

func TestNewAskRejectsNilIntelligence(t *testing.T) {
	_, err := New(Options{Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}, Personas: newTestPersonas(t, persona.Options{}), PlanningCast: testCast, DefaultCast: testCast})
	if err == nil {
		t.Fatal("New accepted nil Intelligence")
	}
}

func TestNewAskRejectsNilKnowledge(t *testing.T) {
	_, err := New(Options{Intelligence: &fakeIntelligence{}, Personas: newTestPersonas(t, persona.Options{}), PlanningCast: testCast, DefaultCast: testCast})
	if err == nil {
		t.Fatal("New accepted nil Knowledge")
	}
}

func TestNewAskRejectsNilPersonas(t *testing.T) {
	_, err := New(Options{Intelligence: &fakeIntelligence{}, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}, PlanningCast: testCast, DefaultCast: testCast})
	if err == nil {
		t.Fatal("New accepted nil Personas")
	}
}

func TestNewAskRejectsEmptyPlanningCast(t *testing.T) {
	_, err := New(Options{Intelligence: &fakeIntelligence{}, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}, Personas: newTestPersonas(t, persona.Options{}), DefaultCast: testCast})
	if err == nil {
		t.Fatal("New accepted empty PlanningCast")
	}
}

func TestNewAskRejectsEmptyDefaultCast(t *testing.T) {
	_, err := New(Options{Intelligence: &fakeIntelligence{}, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}}, Personas: newTestPersonas(t, persona.Options{}), PlanningCast: testCast})
	if err == nil {
		t.Fatal("New accepted empty DefaultCast")
	}
}

func TestNewTasksRejectsNilStore(t *testing.T) {
	_, err := NewTasks(nil, TaskOptions{})
	if err == nil {
		t.Fatal("NewTasks accepted nil store")
	}
}

func TestNewPersonasRejectsNilStore(t *testing.T) {
	_, err := persona.New(nil, persona.Options{GeneralDefinition: persona.Definition{BehavioralGuidance: "Help."}})
	if err == nil {
		t.Fatal("persona.New accepted nil store")
	}
}

func TestFinishRunRejectsWrongRunID(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	scope := Scope{ProjectID: "p"}
	task, _ := tasks.Create(scope, "user-a", TaskModePlan, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	_, _, err := tasks.BeginRun(scope, RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err != nil {
		t.Fatal(err)
	}
	if err := tasks.FinishRun(scope, task.ID, "wrong-id", TaskStateCompleted, nil, Usage{}, ""); !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("wrong run ID error = %v, want ErrInvalidTask", err)
	}
}

func TestBeginRunRejectsWrongRunID(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	scope := Scope{ProjectID: "p"}
	task, _ := tasks.Create(scope, "user-a", TaskModePlan, "Do it.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Help."}, "")
	_, _, err := tasks.BeginRun(scope, RunPayload{TaskID: task.ID, RunID: "wrong-run-id"})
	if !errors.Is(err, ErrTaskNotRunnable) {
		t.Fatalf("wrong run ID error = %v, want ErrTaskNotRunnable", err)
	}
}

func TestRunJobNonExistentTask(t *testing.T) {
	tasks, _ := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	model := &fakeIntelligence{}
	workflows, _ := NewWorkflows(WorkflowOptions{
		Tasks: tasks, Intelligence: model, Knowledge: &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas: newTestPersonas(t, persona.Options{}), PlanningCast: testCast, DefaultCast: testCast,
	})
	err := workflows.RunJob(context.Background(), json.RawMessage(`{"taskId":"nonexistent","runId":"r1"}`))
	if !errors.Is(err, ErrTaskNotFound) {
		t.Fatalf("nonexistent task error = %v, want ErrTaskNotFound", err)
	}
}
