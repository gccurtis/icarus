package agent_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	agenthandler "github.com/gccurtis/taurus-omega/core/handlers/agent"
)

var testCast = intelligence.Cast{Purpose: "general", Strength: "low", Speed: "high", Cost: "low"}

type stubIntelligence struct{}

func (*stubIntelligence) ReasonJSON(_ context.Context, _ intelligence.ReasonRequest, _ json.RawMessage) (intelligence.Result, error) {
	return intelligence.Result{}, nil
}
func (*stubIntelligence) ReasonWithToolsJSON(_ context.Context, _ intelligence.ToolRequest, _ json.RawMessage) (intelligence.ToolResponse, error) {
	return intelligence.ToolResponse{}, nil
}

type stubKnowledge struct{}

func (*stubKnowledge) Retrieve(_ context.Context, _, _ string, _ int) (knowledge.RetrieveResult, error) {
	return knowledge.RetrieveResult{}, nil
}
func (*stubKnowledge) SearchTool(_ string) intelligence.ToolBinding {
	return intelligence.ToolBinding{}
}
func (*stubKnowledge) ListTool(_ string) intelligence.ToolBinding {
	return intelligence.ToolBinding{}
}
func (*stubKnowledge) ReadTool(_ string) intelligence.ToolBinding {
	return intelligence.ToolBinding{}
}

func ctx(projectID, userID string, role access.Role) access.Context {
	return access.Context{
		Project: &access.Project{ID: projectID},
		User:    access.User{ID: userID, Name: "Test User", Email: "test@b.com"},
		Role:    role,
	}
}

func bodyReq(body string) endpoint.Request {
	return endpoint.Request{Bind: func(v any) error { return json.Unmarshal([]byte(body), v) }}
}

func newPersonas(t *testing.T) *persona.Personas {
	t.Helper()
	ps, err := persona.New(persona.NewMemoryStore(), persona.Options{})
	if err != nil {
		t.Fatalf("persona.New: %v", err)
	}
	return ps
}

func TestAgentCreatePlan(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	personas := newPersonas(t)
	personas.EnsureGeneral(persona.Scope{ProjectID: "proj-a"})
	workflows, err := agent.NewWorkflows(agent.WorkflowOptions{Tasks: tasks, Personas: personas, Intelligence: &stubIntelligence{}, Knowledge: &stubKnowledge{}, PlanningCast: testCast, DefaultCast: testCast})
	if err != nil {
		t.Fatalf("NewWorkflows: %v", err)
	}
	h := agenthandler.NewHandlers(tasks, workflows)

	req := bodyReq(`{"objective":"Plan the launch.","persona":{"personaId":"general"}}`)
	resp := h.CreatePlan(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusCreated {
		t.Fatalf("CreatePlan status = %d, body = %v", resp.Status, resp.Body)
	}
	var task agent.Task
	raw, _ := json.Marshal(resp.Body)
	json.Unmarshal(raw, &task)
	if task.Objective != "Plan the launch." || task.Mode != agent.TaskModePlan || task.State != agent.TaskStateQueued {
		t.Fatalf("task = %+v", task)
	}
	got, err := tasks.Get(agent.Scope{ProjectID: "proj-a"}, task.ID)
	if err != nil || got.Objective != "Plan the launch." {
		t.Fatalf("Get = %+v, %v", got, err)
	}
}

func TestAgentCreateAction(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	personas := newPersonas(t)
	personas.EnsureGeneral(persona.Scope{ProjectID: "proj-a"})
	workflows, _ := agent.NewWorkflows(agent.WorkflowOptions{Tasks: tasks, Personas: personas, Intelligence: &stubIntelligence{}, Knowledge: &stubKnowledge{}, PlanningCast: testCast, DefaultCast: testCast})
	h := agenthandler.NewHandlers(tasks, workflows)

	req := bodyReq(`{"objective":"Update the document.","persona":{"personaId":"general"}}`)
	resp := h.CreateAction(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusCreated {
		t.Fatalf("CreateAction status = %d", resp.Status)
	}
}

func TestAgentCreatePlanRejectedByReader(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	personas := newPersonas(t)
	workflows, _ := agent.NewWorkflows(agent.WorkflowOptions{Tasks: tasks, Personas: personas, Intelligence: &stubIntelligence{}, Knowledge: &stubKnowledge{}, PlanningCast: testCast, DefaultCast: testCast})
	h := agenthandler.NewHandlers(tasks, workflows)

	req := bodyReq(`{"objective":"Do it.","persona":{"personaId":"general"}}`)
	resp := h.CreatePlan(ctx("proj-a", "u1", access.RoleRead), req)
	if resp.Status != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Status)
	}
}

func TestAgentCreatePlanRequiresObjective(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	personas := newPersonas(t)
	workflows, _ := agent.NewWorkflows(agent.WorkflowOptions{Tasks: tasks, Personas: personas, Intelligence: &stubIntelligence{}, Knowledge: &stubKnowledge{}, PlanningCast: testCast, DefaultCast: testCast})
	h := agenthandler.NewHandlers(tasks, workflows)

	req := bodyReq(`{"objective":"","persona":{"personaId":"general"}}`)
	resp := h.CreatePlan(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Status)
	}
}

func TestAgentCreatePlanRequiresPersona(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	personas := newPersonas(t)
	workflows, _ := agent.NewWorkflows(agent.WorkflowOptions{Tasks: tasks, Personas: personas, Intelligence: &stubIntelligence{}, Knowledge: &stubKnowledge{}, PlanningCast: testCast, DefaultCast: testCast})
	h := agenthandler.NewHandlers(tasks, workflows)

	req := bodyReq(`{"objective":"Do it.","persona":{"personaId":""}}`)
	resp := h.CreatePlan(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Status)
	}
}

func TestAgentListEmpty(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	h := agenthandler.NewHandlers(tasks, nil)

	resp := h.List(ctx("proj-a", "u1", access.RoleOwner), endpoint.Request{Query: func(string) string { return "" }})
	if resp.Status != http.StatusOK {
		t.Fatalf("List status = %d", resp.Status)
	}
	body, _ := json.Marshal(resp.Body)
	var wrapper struct {
		Tasks []agent.Task `json:"tasks"`
	}
	json.Unmarshal(body, &wrapper)
	if wrapper.Tasks == nil || len(wrapper.Tasks) != 0 {
		t.Fatalf("expected empty list, got %+v", wrapper.Tasks)
	}
}

func TestAgentListByDocument(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	scope := agent.Scope{ProjectID: "proj-a"}
	personas := newPersonas(t)
	personas.EnsureGeneral(persona.Scope{ProjectID: "proj-a"})
	snapshot, _ := personas.Resolve(persona.Scope{ProjectID: "proj-a"}, persona.Selection{ID: persona.GeneralID})

	scoped, _ := tasks.Create(scope, "u1", agent.TaskModeAction, "Edit the doc.", nil, snapshot, "docX")
	tasks.Create(scope, "u1", agent.TaskModePlan, "Unrelated.", nil, snapshot, "")       // no target
	tasks.Create(scope, "u1", agent.TaskModeAction, "Other doc.", nil, snapshot, "docY") // different doc
	h := agenthandler.NewHandlers(tasks, nil)

	listFor := func(documentID string) []agent.Task {
		req := endpoint.Request{Query: func(k string) string {
			if k == "documentId" {
				return documentID
			}
			return ""
		}}
		resp := h.List(ctx("proj-a", "u1", access.RoleOwner), req)
		if resp.Status != http.StatusOK {
			t.Fatalf("List status = %d", resp.Status)
		}
		body, _ := json.Marshal(resp.Body)
		var wrapper struct {
			Tasks []agent.Task `json:"tasks"`
		}
		json.Unmarshal(body, &wrapper)
		return wrapper.Tasks
	}

	docX := listFor("docX")
	if len(docX) != 1 || docX[0].ID != scoped.ID || docX[0].TargetDocumentID != "docX" {
		t.Fatalf("docX filter should return only the docX task, got %+v", docX)
	}
	if got := listFor("docZ"); len(got) != 0 {
		t.Fatalf("a document with no tasks should be empty, got %+v", got)
	}
	if got := listFor(""); len(got) != 3 {
		t.Fatalf("unfiltered list should return all three tasks, got %d", len(got))
	}
}

func TestAgentGetNotFound(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	h := agenthandler.NewHandlers(tasks, nil)

	req := endpoint.Request{Param: func(k string) string {
		if k == "taskID" {
			return "nonexistent"
		}
		return ""
	}}
	resp := h.Get(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.Status)
	}
}

func TestAgentGetCrossProject(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	scope := agent.Scope{ProjectID: "proj-a"}

	personas := newPersonas(t)
	personas.EnsureGeneral(persona.Scope{ProjectID: "proj-a"})
	snapshot, _ := personas.Resolve(persona.Scope{ProjectID: "proj-a"}, persona.Selection{ID: persona.GeneralID})
	task, _ := tasks.Create(scope, "u1", agent.TaskModePlan, "Do it.", nil, snapshot, "")
	h := agenthandler.NewHandlers(tasks, nil)

	req := endpoint.Request{Param: func(k string) string {
		if k == "taskID" {
			return task.ID
		}
		return ""
	}}
	resp := h.Get(ctx("proj-b", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusNotFound {
		t.Fatalf("cross-project get expected 404, got %d", resp.Status)
	}
}

func TestAgentAcceptPlanNotPlanTask(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	scope := agent.Scope{ProjectID: "proj-a"}
	personas := newPersonas(t)
	personas.EnsureGeneral(persona.Scope{ProjectID: "proj-a"})
	snapshot, _ := personas.Resolve(persona.Scope{ProjectID: "proj-a"}, persona.Selection{ID: persona.GeneralID})
	task, _ := tasks.Create(scope, "u1", agent.TaskModeAction, "Do it.", nil, snapshot, "")
	h := agenthandler.NewHandlers(tasks, nil)

	req := endpoint.Request{
		Param: func(k string) string {
			switch k {
			case "taskID":
				return task.ID
			case "planID":
				return "any"
			}
			return ""
		},
	}
	resp := h.AcceptPlan(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusBadRequest {
		t.Fatalf("accept plan on action task expected 400, got %d (%v)", resp.Status, resp.Body)
	}
}

func TestAgentAcceptPlanReaderRejected(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	h := agenthandler.NewHandlers(tasks, nil)

	req := endpoint.Request{
		Param: func(k string) string { return "any" },
	}
	resp := h.AcceptPlan(ctx("proj-a", "u1", access.RoleRead), req)
	if resp.Status != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Status)
	}
}

func TestAgentListReturnsTasks(t *testing.T) {
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	scope := agent.Scope{ProjectID: "proj-a"}
	personas := newPersonas(t)
	personas.EnsureGeneral(persona.Scope{ProjectID: "proj-a"})
	snapshot, _ := personas.Resolve(persona.Scope{ProjectID: "proj-a"}, persona.Selection{ID: persona.GeneralID})
	tasks.Create(scope, "u1", agent.TaskModePlan, "First.", nil, snapshot, "")
	tasks.Create(scope, "u2", agent.TaskModeAction, "Second.", nil, snapshot, "")
	h := agenthandler.NewHandlers(tasks, nil)

	resp := h.List(ctx("proj-a", "u1", access.RoleOwner), endpoint.Request{Query: func(string) string { return "" }})
	if resp.Status != http.StatusOK {
		t.Fatalf("List status = %d", resp.Status)
	}
	body, _ := json.Marshal(resp.Body)
	var wrapper struct {
		Tasks []agent.Task `json:"tasks"`
	}
	json.Unmarshal(body, &wrapper)
	if len(wrapper.Tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(wrapper.Tasks))
	}
}
