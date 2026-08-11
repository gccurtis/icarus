package agent

import (
	"context"
	"encoding/json"
	"sync"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/notification"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

// recordingNotifier captures the toasts a workflow pushes so a test can assert
// the requester was told how their task settled.
type recordingNotifier struct {
	mu    sync.Mutex
	users []string
	sent  []notification.Toast
}

func (r *recordingNotifier) Push(userID string, toast notification.Toast) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.users = append(r.users, userID)
	r.sent = append(r.sent, toast)
}

func newNotifyingWorkflows(t *testing.T, model *fakeIntelligence, notifier Notifier) (*Tasks, *Workflows) {
	t.Helper()
	tasks, err := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	if err != nil {
		t.Fatal(err)
	}
	workflows, err := NewWorkflows(WorkflowOptions{
		Tasks:        tasks,
		Intelligence: model,
		Knowledge:    &fakeKnowledge{results: map[string]knowledge.RetrieveResult{}},
		Personas:     newTestPersonas(t, persona.Options{}),
		PlanningCast: testCast,
		DefaultCast:  testCast,
		Notifier:     notifier,
	})
	if err != nil {
		t.Fatal(err)
	}
	return tasks, workflows
}

func TestCompletedTaskPushesSuccessToast(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"title":"Launch plan","objective":"Launch","summary":"A plan.","assumptions":[],"openQuestions":[],"successCriteria":[],"steps":[{"id":"step-1","title":"Prepare","description":"Prepare launch.","rationale":"Required.","dependsOnStepIds":[],"deliverables":[],"completionCriteria":[],"citations":[]}],"risks":[],"citations":[]}`)},
	}
	notifier := &recordingNotifier{}
	_, workflows := newNotifyingWorkflows(t, model, notifier)
	task, err := workflows.CreatePlan(Scope{ProjectID: "project-a"}, "user-a", "Plan a launch.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatalf("RunJob: %v", err)
	}
	if len(notifier.sent) != 1 {
		t.Fatalf("expected exactly one toast, got %d", len(notifier.sent))
	}
	if notifier.users[0] != "user-a" {
		t.Errorf("toast addressed to %q, want the requester user-a", notifier.users[0])
	}
	got := notifier.sent[0]
	if got.Level != notification.LevelSuccess {
		t.Errorf("level = %q, want success", got.Level)
	}
	if got.ProjectID != "project-a" {
		t.Errorf("projectID = %q, want project-a", got.ProjectID)
	}
	if got.Title == "" {
		t.Errorf("toast should carry a human title")
	}
}

func TestFailedTaskPushesErrorToast(t *testing.T) {
	// A malformed plan draft fails validation — a business error the workflow
	// records as a failed task; the requester should still be told it failed.
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"not":"a valid plan draft"}`)},
	}
	notifier := &recordingNotifier{}
	_, workflows := newNotifyingWorkflows(t, model, notifier)
	task, err := workflows.CreatePlan(Scope{ProjectID: "project-a"}, "user-a", "Plan a launch.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatalf("RunJob should absorb the business error, got %v", err)
	}
	if len(notifier.sent) != 1 {
		t.Fatalf("expected exactly one toast, got %d", len(notifier.sent))
	}
	if notifier.sent[0].Level != notification.LevelError {
		t.Errorf("level = %q, want error", notifier.sent[0].Level)
	}
	if notifier.users[0] != "user-a" {
		t.Errorf("toast addressed to %q, want the requester user-a", notifier.users[0])
	}
}

func TestNilNotifierIsSafe(t *testing.T) {
	model := &fakeIntelligence{
		planResult:      intelligence.Result{JSON: json.RawMessage(`{"queries":[]}`)},
		reasoningResult: intelligence.ToolResponse{JSON: json.RawMessage(`{"title":"Launch plan","objective":"Launch","summary":"A plan.","assumptions":[],"openQuestions":[],"successCriteria":[],"steps":[{"id":"step-1","title":"Prepare","description":"Prepare launch.","rationale":"Required.","dependsOnStepIds":[],"deliverables":[],"completionCriteria":[],"citations":[]}],"risks":[],"citations":[]}`)},
	}
	_, workflows := newNotifyingWorkflows(t, model, nil)
	task, err := workflows.CreatePlan(Scope{ProjectID: "project-a"}, "user-a", "Plan a launch.", nil, generalPersonaSelection(), "")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(RunPayload{TaskID: task.ID, RunID: task.Runs[0].ID})
	if err := workflows.RunJob(context.Background(), raw); err != nil {
		t.Fatalf("RunJob with no notifier must not error: %v", err)
	}
}
