# task_tools.go

Package `agent`. See repo conventions (AGENTS.md).

## Code breakdown

```go
package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
)

var taskNoInputSchema = json.RawMessage(`{"type":"object","additionalProperties":false}`)

var taskTodoCreateSchema = json.RawMessage(`{
	"type":"object",
	"properties":{"text":{"type":"string","minLength":1},"detail":{"type":"string"}},
	"required":["text"],"additionalProperties":false
}`)

var taskTodoUpdateSchema = json.RawMessage(`{
	"type":"object",
	"properties":{"id":{"type":"string","minLength":1},"state":{"type":"string"},"detail":{"type":"string"}},
	"required":["id","state"],"additionalProperties":false
}`)

var taskNoteSchema = json.RawMessage(`{
	"type":"object",
	"properties":{"note":{"type":"string","minLength":1}},
	"required":["note"],"additionalProperties":false
}`)

var taskPlanCreateSchema = json.RawMessage(`{
	"type":"object",
	"properties":{"title":{"type":"string","minLength":1},"content":{"type":"string","minLength":1}},
	"required":["title","content"],"additionalProperties":false
}`)

var taskPlanGetSchema = json.RawMessage(`{
	"type":"object",
	"properties":{"id":{"type":"string","minLength":1}},
	"required":["id"],"additionalProperties":false
}`)

var taskOutputSchema = json.RawMessage(`{"type":"object"}`)

func (t *Tasks) contextTool(scope Scope, taskID string) intelligence.ToolBinding {
	return t.readOnlyBinding("task.context.get", "Return bounded working context, to-dos, and working plans for this task.", scope, taskID)
}

func (t *Tasks) noteTool(scope Scope, taskID string) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: taskDefinition("task.note.append", "Append a bounded operational note to this task.", taskNoteSchema), Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			Note string `json:"note"`
		}
		if err := decodeTaskInput(raw, &input); err != nil || invalidTaskText(input.Note) {
			return nil, invalidTaskArguments()
		}
		task, err := t.Get(scope, taskID)
		if err != nil {
			return nil, err
		}
		if len(task.Workspace.Notes) >= maxTaskNotes {
			return nil, taskLimitError("notes")
		}
		task.Workspace.Notes = append(task.Workspace.Notes, strings.TrimSpace(input.Note))
		task.UpdatedAt = t.now().UTC()
		if err := t.store.UpdateTask(task); err != nil {
			return nil, err
		}
		return json.Marshal(struct {
			Notes []string `json:"notes"`
		}{task.Workspace.Notes})
	}}
}

func (t *Tasks) todoListTool(scope Scope, taskID string) intelligence.ToolBinding {
	return t.readOnlyBinding("task.todo.list", "List the bounded to-dos for this task.", scope, taskID)
}

func (t *Tasks) todoCreateTool(scope Scope, taskID string) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: taskDefinition("task.todo.create", "Create one bounded task-local to-do.", taskTodoCreateSchema), Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			Text   string `json:"text"`
			Detail string `json:"detail"`
		}
		if err := decodeTaskInput(raw, &input); err != nil || invalidTaskText(input.Text) || len(input.Detail) > maxTaskText {
			return nil, invalidTaskArguments()
		}
		task, err := t.Get(scope, taskID)
		if err != nil {
			return nil, err
		}
		if len(task.Workspace.Todos) >= maxTaskTodos {
			return nil, taskLimitError("todos")
		}
		now := t.now().UTC()
		todo := Todo{ID: newTaskID(), Text: strings.TrimSpace(input.Text), Detail: strings.TrimSpace(input.Detail), State: TodoStateOpen, CreatedBy: "agent", UpdatedAt: now}
		task.Workspace.Todos, task.UpdatedAt = append(task.Workspace.Todos, todo), now
		if err := t.store.UpdateTask(task); err != nil {
			return nil, err
		}
		return json.Marshal(todo)
	}}
}

func (t *Tasks) todoUpdateTool(scope Scope, taskID string) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: taskDefinition("task.todo.update", "Update the state and optional detail of one task-local to-do.", taskTodoUpdateSchema), Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			ID     string    `json:"id"`
			State  TodoState `json:"state"`
			Detail string    `json:"detail"`
		}
		if err := decodeTaskInput(raw, &input); err != nil || input.ID == "" || !validTodoState(input.State) || len(input.Detail) > maxTaskText {
			return nil, invalidTaskArguments()
		}
		task, err := t.Get(scope, taskID)
		if err != nil {
			return nil, err
		}
		index := -1
		for i := range task.Workspace.Todos {
			if task.Workspace.Todos[i].ID == input.ID {
				index = i
				break
			}
		}
		if index < 0 {
			return nil, &intelligence.ToolError{Code: "not_found", Message: "to-do is not in this task"}
		}
		now := t.now().UTC()
		task.Workspace.Todos[index].State, task.Workspace.Todos[index].UpdatedAt = input.State, now
		if input.Detail != "" {
			task.Workspace.Todos[index].Detail = strings.TrimSpace(input.Detail)
		}
		task.UpdatedAt = now
		if err := t.store.UpdateTask(task); err != nil {
			return nil, err
		}
		return json.Marshal(task.Workspace.Todos[index])
	}}
}

func (t *Tasks) planListTool(scope Scope, taskID string) intelligence.ToolBinding {
	return t.readOnlyBinding("task.plan.list", "List task-local working plans.", scope, taskID)
}

func (t *Tasks) planGetTool(scope Scope, taskID string) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: taskDefinition("task.plan.get", "Return one task-local working plan.", taskPlanGetSchema), Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			ID string `json:"id"`
		}
		if err := decodeTaskInput(raw, &input); err != nil || input.ID == "" {
			return nil, invalidTaskArguments()
		}
		task, err := t.Get(scope, taskID)
		if err != nil {
			return nil, err
		}
		for _, plan := range task.Workspace.WorkingPlans {
			if plan.ID == input.ID {
				return json.Marshal(plan)
			}
		}
		return nil, &intelligence.ToolError{Code: "not_found", Message: "working plan is not in this task"}
	}}
}

func (t *Tasks) planCreateTool(scope Scope, taskID string) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: taskDefinition("task.plan.create", "Create a bounded task-local working plan.", taskPlanCreateSchema), Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input struct {
			Title   string `json:"title"`
			Content string `json:"content"`
		}
		if err := decodeTaskInput(raw, &input); err != nil || invalidTaskText(input.Title) || invalidTaskText(input.Content) {
			return nil, invalidTaskArguments()
		}
		task, err := t.Get(scope, taskID)
		if err != nil {
			return nil, err
		}
		if len(task.Workspace.WorkingPlans) >= maxTaskPlans {
			return nil, taskLimitError("working_plans")
		}
		now := t.now().UTC()
		plan := TaskPlan{ID: newTaskID(), Title: strings.TrimSpace(input.Title), Content: strings.TrimSpace(input.Content), CreatedAt: now}
		task.Workspace.WorkingPlans, task.UpdatedAt = append(task.Workspace.WorkingPlans, plan), now
		if err := t.store.UpdateTask(task); err != nil {
			return nil, err
		}
		return json.Marshal(plan)
	}}
}

func (t *Tasks) readOnlyBinding(name, description string, scope Scope, taskID string) intelligence.ToolBinding {
	return intelligence.ToolBinding{Definition: taskDefinition(name, description, taskNoInputSchema), Handler: func(ctx context.Context, raw json.RawMessage) (json.RawMessage, error) {
		var input map[string]json.RawMessage
		if err := decodeTaskInput(raw, &input); err != nil || len(input) != 0 {
			return nil, invalidTaskArguments()
		}
		task, err := t.Get(scope, taskID)
		if err != nil {
			return nil, err
		}
		switch name {
		case "task.context.get":
			return json.Marshal(task.Workspace)
		case "task.todo.list":
			return json.Marshal(struct {
				Todos []Todo `json:"todos"`
			}{task.Workspace.Todos})
		case "task.plan.list":
			return json.Marshal(struct {
				Plans []TaskPlan `json:"plans"`
			}{task.Workspace.WorkingPlans})
		default:
			return nil, &intelligence.ToolError{Code: "tool_failed", Message: "task tool is unavailable"}
		}
	}}
}

func taskDefinition(name, description string, input json.RawMessage) intelligence.ToolDefinition {
	return intelligence.ToolDefinition{Name: name, Version: "v1", Description: description, InputSchema: input, OutputSchema: taskOutputSchema}
}

func decodeTaskInput(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func invalidTaskText(text string) bool {
	return strings.TrimSpace(text) == "" || len(text) > maxTaskText
}
func validTodoState(state TodoState) bool {
	return state == TodoStateOpen || state == TodoStateDoing || state == TodoStateDone || state == TodoStateBlocked || state == TodoStateCanceled
}
func invalidTaskArguments() error {
	return &intelligence.ToolError{Code: "invalid_arguments", Message: "arguments do not match the task tool schema"}
}
func taskLimitError(limit string) error {
	return &intelligence.ToolError{Code: "task_limit", Message: "task " + limit + " limit reached"}
}
```
