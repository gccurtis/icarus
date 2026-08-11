package persona

import (
	"errors"
	"testing"
)

func newTestPersonas(t *testing.T) *Personas {
	t.Helper()
	personas, err := New(NewMemoryStore(), Options{GeneralDefinition: Definition{BehavioralGuidance: "General guidance."}})
	if err != nil {
		t.Fatal(err)
	}
	return personas
}

func TestGeneralAndPerUserDefault(t *testing.T) {
	personas := newTestPersonas(t)
	scope := Scope{ProjectID: "project-a"}
	general, err := personas.DefaultForUser(scope, "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if general.Persona.ID != GeneralID || general.Version.Version != 1 {
		t.Errorf("general = %+v", general)
	}
	custom, err := personas.Create(scope, "user-a", CreateRequest{Name: "Researcher", Definition: Definition{Focus: "Research", BehavioralGuidance: "Search carefully."}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := personas.SetDefault(scope, "user-a", custom.Persona.ID); err != nil {
		t.Fatal(err)
	}
	selected, err := personas.DefaultForUser(scope, "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if selected.Persona.ID != custom.Persona.ID {
		t.Errorf("default = %+v", selected)
	}
	other, err := personas.DefaultForUser(scope, "user-b")
	if err != nil {
		t.Fatal(err)
	}
	if other.Persona.ID != GeneralID {
		t.Errorf("other default = %+v", other)
	}
}

func TestGeneralTracksBackendConfigurationAndCannotBeUserRevised(t *testing.T) {
	store := NewMemoryStore()
	scope := Scope{ProjectID: "project-a"}
	first, err := New(store, Options{GeneralName: "General", GeneralDescription: "First deployment", GeneralDefinition: Definition{BehavioralGuidance: "Use the first policy."}})
	if err != nil {
		t.Fatal(err)
	}
	v1, err := first.EnsureGeneral(scope)
	if err != nil {
		t.Fatal(err)
	}
	second, err := New(store, Options{GeneralName: "Taurus General", GeneralDescription: "Second deployment", GeneralDefinition: Definition{Focus: "Project work", BehavioralGuidance: "Use the revised policy.", DefaultVerification: "Verify effects."}})
	if err != nil {
		t.Fatal(err)
	}
	v2, err := second.Get(scope, Selection{ID: GeneralID})
	if err != nil {
		t.Fatal(err)
	}
	if v2.Persona.Name != "Taurus General" || v2.Persona.Description != "Second deployment" || v2.Version.Version != 2 || v2.Version.Definition.BehavioralGuidance != "Use the revised policy." {
		t.Errorf("configured General = %+v", v2)
	}
	old, err := second.Get(scope, Selection{ID: GeneralID, Version: 1})
	if err != nil {
		t.Fatal(err)
	}
	if old.Version.Definition.BehavioralGuidance != v1.Version.Definition.BehavioralGuidance {
		t.Errorf("version 1 changed = %+v", old)
	}
	if _, err := second.Revise(scope, "user-a", GeneralID, 2, Definition{BehavioralGuidance: "User policy."}); !errors.Is(err, ErrManaged) {
		t.Fatalf("General revision error = %v, want ErrManaged", err)
	}
	if _, err := second.Update(scope, "user-a", GeneralID, UpdateRequest{ExpectedVersion: 2, Name: "Replacement", Definition: Definition{BehavioralGuidance: "User policy."}}); !errors.Is(err, ErrManaged) {
		t.Fatalf("General update error = %v, want ErrManaged", err)
	}
}

func TestTaskSnapshotSurvivesPersonaRevision(t *testing.T) {
	personas := newTestPersonas(t)
	scope := Scope{ProjectID: "project-a"}
	created, err := personas.Create(scope, "user-a", CreateRequest{Name: "Editor", Definition: Definition{BehavioralGuidance: "Draft carefully.", OutputPreferences: "Concise"}})
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := personas.Resolve(scope, Selection{ID: created.Persona.ID, Version: 1})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := personas.Revise(scope, "user-a", created.Persona.ID, 1, Definition{BehavioralGuidance: "Draft and verify.", OutputPreferences: "Detailed"}); err != nil {
		t.Fatal(err)
	}
	if snapshot.Version != 1 || snapshot.Instructions != "Draft carefully." || snapshot.OutputPreferences != "Concise" {
		t.Errorf("snapshot changed = %+v", snapshot)
	}
	current, err := personas.Resolve(scope, Selection{ID: created.Persona.ID})
	if err != nil {
		t.Fatal(err)
	}
	if current.Version != 2 || current.Instructions != "Draft and verify." {
		t.Errorf("current = %+v", current)
	}
	versions, err := personas.Versions(scope, created.Persona.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(versions) != 2 {
		t.Errorf("versions = %+v", versions)
	}
}

func TestCustomPersonaUpdateAndDeleteLifecycle(t *testing.T) {
	personas := newTestPersonas(t)
	scope := Scope{ProjectID: "project-a"}
	created, err := personas.Create(scope, "user-a", CreateRequest{Name: "Editor", Description: "Initial description", Definition: Definition{BehavioralGuidance: "Draft carefully."}})
	if err != nil {
		t.Fatal(err)
	}
	updated, err := personas.Update(scope, "user-a", created.Persona.ID, UpdateRequest{
		ExpectedVersion: 1,
		Name:            "Senior Editor",
		Description:     "Revised description",
		Definition:      Definition{Focus: "Editing", BehavioralGuidance: "Draft and verify.", OutputPreferences: "Use clear sections."},
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Persona.Name != "Senior Editor" || updated.Persona.Description != "Revised description" || updated.Version.Version != 2 || updated.Version.Definition.Focus != "Editing" {
		t.Errorf("updated = %+v", updated)
	}
	if _, err := personas.Update(scope, "user-a", created.Persona.ID, UpdateRequest{ExpectedVersion: 1, Name: "Stale", Definition: Definition{BehavioralGuidance: "Stale."}}); !errors.Is(err, ErrVersionConflict) {
		t.Fatalf("stale update error = %v, want ErrVersionConflict", err)
	}
	old, err := personas.Get(scope, Selection{ID: created.Persona.ID, Version: 1})
	if err != nil {
		t.Fatal(err)
	}
	if old.Version.Definition.BehavioralGuidance != "Draft carefully." {
		t.Errorf("version 1 changed = %+v", old)
	}
	snapshot, err := personas.Resolve(scope, Selection{ID: created.Persona.ID})
	if err != nil {
		t.Fatal(err)
	}
	for _, userID := range []string{"user-a", "user-b"} {
		if _, err := personas.SetDefault(scope, userID, created.Persona.ID); err != nil {
			t.Fatal(err)
		}
	}
	if err := personas.Delete(scope, created.Persona.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := personas.Get(scope, Selection{ID: created.Persona.ID}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted Persona get error = %v, want ErrNotFound", err)
	}
	if _, err := personas.Versions(scope, created.Persona.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted Persona versions error = %v, want ErrNotFound", err)
	}
	for _, userID := range []string{"user-a", "user-b"} {
		fallback, err := personas.DefaultForUser(scope, userID)
		if err != nil {
			t.Fatal(err)
		}
		if fallback.Persona.ID != GeneralID {
			t.Errorf("default after delete for %s = %+v", userID, fallback)
		}
	}
	if snapshot.ID != created.Persona.ID || snapshot.Version != 2 || snapshot.Instructions != "Draft and verify." {
		t.Errorf("captured snapshot changed = %+v", snapshot)
	}
	if err := personas.Delete(scope, created.Persona.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("second delete error = %v, want ErrNotFound", err)
	}
	if err := personas.Delete(scope, GeneralID); !errors.Is(err, ErrManaged) {
		t.Fatalf("General delete error = %v, want ErrManaged", err)
	}
}

func TestPersonaScopeAndExpectedVersion(t *testing.T) {
	personas := newTestPersonas(t)
	created, err := personas.Create(Scope{ProjectID: "project-a"}, "user-a", CreateRequest{Name: "Planner", Definition: Definition{BehavioralGuidance: "Plan."}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := personas.Get(Scope{ProjectID: "project-b"}, Selection{ID: created.Persona.ID}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-Project get error = %v", err)
	}
	if _, err := personas.Revise(Scope{ProjectID: "project-a"}, "user-a", created.Persona.ID, 2, Definition{BehavioralGuidance: "Revise."}); !errors.Is(err, ErrVersionConflict) {
		t.Fatalf("stale revision error = %v", err)
	}
}
