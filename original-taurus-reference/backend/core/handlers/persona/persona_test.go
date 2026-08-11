package persona_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/agent"
	personacap "github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	personahandler "github.com/gccurtis/taurus-omega/core/handlers/persona"
)

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

func newHandler(t *testing.T) personahandler.Handlers {
	t.Helper()
	ps, err := personacap.New(personacap.NewMemoryStore(), personacap.Options{})
	if err != nil {
		t.Fatalf("persona.New: %v", err)
	}
	taskStore := agent.NewMemoryTaskStore()
	tasks, _ := agent.NewTasks(taskStore, agent.TaskOptions{})
	return personahandler.NewHandlers(ps, tasks)
}

func TestPersonaCreateAndList(t *testing.T) {
	h := newHandler(t)

	req := bodyReq(`{"name":"Researcher","description":"A research persona.","definition":{"behavioralGuidance":"Search carefully."}}`)
	resp := h.Create(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusCreated {
		t.Fatalf("Create status = %d, body = %v", resp.Status, resp.Body)
	}
	var record personacap.Record
	raw, _ := json.Marshal(resp.Body)
	json.Unmarshal(raw, &record)
	if record.Persona.Name != "Researcher" || record.Version.Version != 1 {
		t.Fatalf("created = %+v", record)
	}

	resp = h.List(ctx("proj-a", "u1", access.RoleOwner), endpoint.Request{})
	if resp.Status != http.StatusOK {
		t.Fatalf("List status = %d", resp.Status)
	}
	body, _ := json.Marshal(resp.Body)
	var wrapper struct {
		Personas []personacap.Record `json:"personas"`
	}
	json.Unmarshal(body, &wrapper)
	if len(wrapper.Personas) < 2 {
		t.Fatalf("expected at least General + Researcher, got %d", len(wrapper.Personas))
	}
}

func TestPersonaGet(t *testing.T) {
	h := newHandler(t)

	req := endpoint.Request{Param: func(k string) string {
		if k == "personaID" {
			return personacap.GeneralID
		}
		return ""
	}}
	resp := h.Get(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusOK {
		t.Fatalf("Get status = %d", resp.Status)
	}
}

func TestPersonaGetNotFound(t *testing.T) {
	h := newHandler(t)

	req := endpoint.Request{Param: func(k string) string {
		if k == "personaID" {
			return "nonexistent"
		}
		return ""
	}}
	resp := h.Get(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.Status)
	}
}

func TestPersonaUpdate(t *testing.T) {
	h := newHandler(t)

	create := bodyReq(`{"name":"Editor","description":"Original","definition":{"behavioralGuidance":"Edit carefully."}}`)
	cResp := h.Create(ctx("proj-a", "u1", access.RoleOwner), create)
	if cResp.Status != http.StatusCreated {
		t.Fatalf("Create: %d", cResp.Status)
	}
	var created personacap.Record
	raw, _ := json.Marshal(cResp.Body)
	json.Unmarshal(raw, &created)

	update := bodyReq(`{"expectedVersion":1,"name":"Senior Editor","description":"Updated","definition":{"behavioralGuidance":"Edit and verify."}}`)
	req := endpoint.Request{
		Bind: update.Bind,
		Param: func(k string) string {
			if k == "personaID" {
				return created.Persona.ID
			}
			return ""
		},
	}
	resp := h.Update(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusOK {
		t.Fatalf("Update status = %d, body = %v", resp.Status, resp.Body)
	}
	var updated personacap.Record
	raw, _ = json.Marshal(resp.Body)
	json.Unmarshal(raw, &updated)
	if updated.Persona.Name != "Senior Editor" || updated.Version.Version != 2 {
		t.Fatalf("updated = %+v", updated)
	}
}

func TestPersonaDelete(t *testing.T) {
	h := newHandler(t)

	create := bodyReq(`{"name":"ToDelete","description":"Will be deleted","definition":{"behavioralGuidance":"Gone."}}`)
	cResp := h.Create(ctx("proj-a", "u1", access.RoleOwner), create)
	var created personacap.Record
	raw, _ := json.Marshal(cResp.Body)
	json.Unmarshal(raw, &created)

	req := endpoint.Request{Param: func(k string) string {
		if k == "personaID" {
			return created.Persona.ID
		}
		return ""
	}}
	resp := h.Delete(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusOK {
		t.Fatalf("Delete status = %d", resp.Status)
	}

	resp = h.Get(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", resp.Status)
	}
}

func TestPersonaCannotDeleteGeneral(t *testing.T) {
	h := newHandler(t)

	req := endpoint.Request{Param: func(k string) string {
		if k == "personaID" {
			return personacap.GeneralID
		}
		return ""
	}}
	resp := h.Delete(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Status)
	}
}

func TestPersonaDefaultFlow(t *testing.T) {
	h := newHandler(t)

	resp := h.Default(ctx("proj-a", "u1", access.RoleOwner), endpoint.Request{})
	if resp.Status != http.StatusOK {
		t.Fatalf("Default status = %d", resp.Status)
	}
	var def personacap.Record
	raw, _ := json.Marshal(resp.Body)
	json.Unmarshal(raw, &def)
	if def.Persona.ID != personacap.GeneralID {
		t.Fatalf("expected General default, got %s", def.Persona.ID)
	}

	create := bodyReq(`{"name":"Custom","description":"Custom persona","definition":{"behavioralGuidance":"Custom."}}`)
	cResp := h.Create(ctx("proj-a", "u1", access.RoleOwner), create)
	var created personacap.Record
	raw, _ = json.Marshal(cResp.Body)
	json.Unmarshal(raw, &created)

	setDefault := bodyReq(`{"personaId":"` + created.Persona.ID + `"}`)
	resp = h.SetDefault(ctx("proj-a", "u1", access.RoleOwner), setDefault)
	if resp.Status != http.StatusOK {
		t.Fatalf("SetDefault status = %d", resp.Status)
	}

	resp = h.Default(ctx("proj-a", "u1", access.RoleOwner), endpoint.Request{})
	raw, _ = json.Marshal(resp.Body)
	json.Unmarshal(raw, &def)
	if def.Persona.ID != created.Persona.ID {
		t.Fatalf("expected Custom default, got %s", def.Persona.ID)
	}
}

func TestPersonaVersions(t *testing.T) {
	h := newHandler(t)

	create := bodyReq(`{"name":"Versioned","description":"Descr","definition":{"behavioralGuidance":"V1."}}`)
	cResp := h.Create(ctx("proj-a", "u1", access.RoleOwner), create)
	var created personacap.Record
	raw, _ := json.Marshal(cResp.Body)
	json.Unmarshal(raw, &created)

	req := endpoint.Request{Param: func(k string) string {
		if k == "personaID" {
			return created.Persona.ID
		}
		return ""
	}}
	resp := h.Versions(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusOK {
		t.Fatalf("Versions status = %d", resp.Status)
	}
	body, _ := json.Marshal(resp.Body)
	var wrapper struct {
		Versions []personacap.Version `json:"versions"`
	}
	json.Unmarshal(body, &wrapper)
	if len(wrapper.Versions) != 1 {
		t.Fatalf("expected 1 version, got %d", len(wrapper.Versions))
	}
}

func TestPersonaTasks(t *testing.T) {
	h := newHandler(t)

	req := endpoint.Request{Param: func(k string) string {
		if k == "personaID" {
			return personacap.GeneralID
		}
		return ""
	}}
	resp := h.Tasks(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusOK {
		t.Fatalf("Tasks status = %d", resp.Status)
	}
	body, _ := json.Marshal(resp.Body)
	var wrapper struct {
		Tasks []agent.Task `json:"tasks"`
	}
	json.Unmarshal(body, &wrapper)
	if wrapper.Tasks == nil {
		t.Fatal("expected empty tasks list, got nil")
	}
}

func TestPersonaRevise(t *testing.T) {
	h := newHandler(t)

	create := bodyReq(`{"name":"ToRevise","description":"Descr","definition":{"behavioralGuidance":"V1."}}`)
	cResp := h.Create(ctx("proj-a", "u1", access.RoleOwner), create)
	var created personacap.Record
	raw, _ := json.Marshal(cResp.Body)
	json.Unmarshal(raw, &created)

	revise := bodyReq(`{"expectedVersion":1,"definition":{"behavioralGuidance":"V2."}}`)
	req := endpoint.Request{
		Bind: revise.Bind,
		Param: func(k string) string {
			if k == "personaID" {
				return created.Persona.ID
			}
			return ""
		},
	}
	resp := h.Revise(ctx("proj-a", "u1", access.RoleOwner), req)
	if resp.Status != http.StatusOK {
		t.Fatalf("Revise status = %d, body = %v", resp.Status, resp.Body)
	}
	var revised personacap.Record
	raw, _ = json.Marshal(resp.Body)
	json.Unmarshal(raw, &revised)
	if revised.Version.Version != 2 || revised.Persona.Name != "ToRevise" {
		t.Fatalf("revised = %+v", revised)
	}
}

func TestPersonaReaderRejected(t *testing.T) {
	h := newHandler(t)

	req := bodyReq(`{"name":"Reader","description":"X","definition":{"behavioralGuidance":"X."}}`)
	resp := h.Create(ctx("proj-a", "u1", access.RoleRead), req)
	if resp.Status != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Status)
	}
}
