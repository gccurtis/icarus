package agent

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestTaskToolsAreClosedOverTheirTaskAndProject(t *testing.T) {
	tasks, err := NewTasks(NewMemoryTaskStore(), TaskOptions{})
	if err != nil {
		t.Fatal(err)
	}
	scope := Scope{ProjectID: "project-a"}
	task, err := tasks.Create(scope, "user-a", TaskModeAction, "Do work.", nil, PersonaSnapshot{ID: "general", Version: 1, Name: "General", Instructions: "Work carefully."}, "")
	if err != nil {
		t.Fatal(err)
	}
	var appendNote func(context.Context, json.RawMessage) (json.RawMessage, error)
	for _, binding := range tasks.ToolBindings(scope, task) {
		if binding.Definition.Name == "task.note.append" {
			appendNote = binding.Handler
			break
		}
	}
	if appendNote == nil {
		t.Fatal("task.note.append binding is missing")
	}
	if _, err := appendNote(context.Background(), json.RawMessage(`{"note":"first observation"}`)); err != nil {
		t.Fatal(err)
	}
	stored, err := tasks.Get(scope, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(stored.Workspace.Notes) != 1 || stored.Workspace.Notes[0] != "first observation" {
		t.Errorf("notes = %+v", stored.Workspace.Notes)
	}
	var wrongScope func(context.Context, json.RawMessage) (json.RawMessage, error)
	for _, binding := range tasks.ToolBindings(Scope{ProjectID: "project-b"}, task) {
		if binding.Definition.Name == "task.note.append" {
			wrongScope = binding.Handler
			break
		}
	}
	_, err = wrongScope(context.Background(), json.RawMessage(`{"note":"should not persist"}`))
	if !errors.Is(err, ErrTaskProjectScope) {
		t.Fatalf("wrong Project error = %v, want ErrTaskProjectScope", err)
	}
	stored, err = tasks.Get(scope, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(stored.Workspace.Notes) != 1 {
		t.Errorf("cross-Project handler changed notes = %+v", stored.Workspace.Notes)
	}
}
