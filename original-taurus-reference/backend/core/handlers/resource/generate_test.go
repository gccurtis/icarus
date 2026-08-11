package resource

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	resourcecap "github.com/gccurtis/taurus-omega/core/capability/resource"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type genFakeFamily struct{ kind resourcecap.Kind }

func (f *genFakeFamily) Kind() resourcecap.Kind { return f.kind }
func (f *genFakeFamily) Get(string, string) (resourcecap.Summary, error) {
	return resourcecap.Summary{}, resourcecap.ErrNotFound
}
func (f *genFakeFamily) List(string, *resourcecap.Boundary, int) ([]resourcecap.Summary, error) {
	return nil, nil
}
func (f *genFakeFamily) Create(_ string, _ resourcecap.Actor, name string) (resourcecap.Summary, error) {
	return resourcecap.Summary{ID: "doc-new", Kind: f.kind, Name: name}, nil
}
func (f *genFakeFamily) Rename(_ string, _ resourcecap.Actor, id, name string) (resourcecap.Summary, error) {
	return resourcecap.Summary{ID: id, Kind: f.kind, Name: name}, nil
}
func (f *genFakeFamily) Delete(string, resourcecap.Actor, string) error { return nil }

type fakeGenerator struct {
	gotProject, gotDoc, gotPrompt string
	taskID                        string
	err                           error
	calls                         int
}

func (g *fakeGenerator) Generate(projectID, requesterID, documentID, prompt string) (string, error) {
	g.calls++
	g.gotProject, g.gotDoc, g.gotPrompt = projectID, documentID, prompt
	return g.taskID, g.err
}

func genCtx(role access.Role) access.Context {
	return access.Context{
		Project: &access.Project{ID: "p1"},
		User:    access.User{ID: "u1", Name: "Ann"},
		Role:    role,
	}
}

func genReq(body string) endpoint.Request {
	return endpoint.Request{Bind: func(v any) error { return json.Unmarshal([]byte(body), v) }}
}

func newGenHandlers(t *testing.T, gen ResourceGenerator) Handlers {
	t.Helper()
	svc, err := resourcecap.New(&genFakeFamily{kind: resourcecap.KindDocument})
	if err != nil {
		t.Fatalf("resource.New: %v", err)
	}
	return NewHandlers(svc, gen)
}

func TestGenerateCreatesResourceAndRunsAction(t *testing.T) {
	gen := &fakeGenerator{taskID: "task-123"}
	h := newGenHandlers(t, gen)

	resp := h.Generate(genCtx(access.RoleEdit), genReq(`{"kind":"document","prompt":"Write about tides."}`))
	if resp.Status != http.StatusCreated {
		t.Fatalf("status = %d (%v)", resp.Status, resp.Body)
	}
	body, _ := json.Marshal(resp.Body)
	var out struct {
		Resource summaryJSON `json:"resource"`
		TaskID   string      `json:"taskId"`
	}
	json.Unmarshal(body, &out)
	if out.Resource.ID != "doc-new" || out.Resource.Name != "Write about tides." {
		t.Errorf("resource wrong: %+v", out.Resource)
	}
	if out.TaskID != "task-123" {
		t.Errorf("taskId = %q, want task-123", out.TaskID)
	}
	// The Action was scoped to the freshly created resource and got the prompt.
	if gen.calls != 1 || gen.gotDoc != "doc-new" || gen.gotProject != "p1" || gen.gotPrompt != "Write about tides." {
		t.Errorf("generator got project=%q doc=%q prompt=%q (calls=%d)", gen.gotProject, gen.gotDoc, gen.gotPrompt, gen.calls)
	}
}

func TestGenerateDefaultsKindToDocument(t *testing.T) {
	gen := &fakeGenerator{taskID: "t"}
	h := newGenHandlers(t, gen)
	resp := h.Generate(genCtx(access.RoleEdit), genReq(`{"prompt":"No kind given."}`))
	if resp.Status != http.StatusCreated {
		t.Fatalf("status = %d (%v)", resp.Status, resp.Body)
	}
	if gen.calls != 1 {
		t.Errorf("generator should run once, got %d", gen.calls)
	}
}

func TestGenerateReadRoleForbidden(t *testing.T) {
	h := newGenHandlers(t, &fakeGenerator{})
	resp := h.Generate(genCtx(access.RoleRead), genReq(`{"prompt":"x"}`))
	if resp.Status != http.StatusForbidden {
		t.Errorf("read role: want 403, got %d", resp.Status)
	}
}

func TestGenerateEmptyPromptRejected(t *testing.T) {
	h := newGenHandlers(t, &fakeGenerator{})
	resp := h.Generate(genCtx(access.RoleEdit), genReq(`{"prompt":"   "}`))
	if resp.Status != http.StatusBadRequest {
		t.Errorf("empty prompt: want 400, got %d", resp.Status)
	}
}

func TestGenerateNonDocumentRejected(t *testing.T) {
	h := newGenHandlers(t, &fakeGenerator{})
	resp := h.Generate(genCtx(access.RoleEdit), genReq(`{"kind":"slides","prompt":"deck"}`))
	if resp.Status != http.StatusBadRequest {
		t.Errorf("slides kind: want 400, got %d", resp.Status)
	}
}

func TestGenerateNotConfigured(t *testing.T) {
	h := newGenHandlers(t, nil)
	resp := h.Generate(genCtx(access.RoleEdit), genReq(`{"prompt":"x"}`))
	if resp.Status != http.StatusNotImplemented {
		t.Errorf("nil generator: want 501, got %d", resp.Status)
	}
}
