# workflow.go

See repo conventions (AGENTS.md).

## Code breakdown

```go
package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/notification"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/platform/job"
)

// Notifier is the narrow port the workflow uses to tell a task's requester how
// their durable task settled. The real *notification.Notifications satisfies it
// without an adapter; a nil Notifier disables toasts. The workflow never reads
// notifications back, so this stays a one-way, fire-and-forget dependency.
type Notifier interface {
	Push(userID string, toast notification.Toast)
}

// DocumentAuthorizer reports whether a user may access a document, so an agent's
// document tools honor the same per-resource access scope the HTTP routes do — a
// task run for a user scoped out of a document cannot read or edit it through the
// agent. Wiring injects an adapter over the resource access resolver; the agent
// never imports the resource capability. A nil authorizer disables the check.
type DocumentAuthorizer interface {
	CanAccessDocument(userID, projectID, documentID string) (bool, error)
}

// ExecutionReport is the final structured Action result. Operations reference
// concrete current-run tool calls, so model prose cannot invent an effect.
type ExecutionReport struct {
	Summary       string               `json:"summary"`
	Outcome       string               `json:"outcome"`
	Operations    []ExecutionOperation `json:"operations"`
	OpenQuestions []string             `json:"openQuestions"`
	NextSteps     []string             `json:"nextSteps"`
	Citations     []Citation           `json:"citations"`
}

type ExecutionOperation struct {
	ToolCallID string     `json:"toolCallId"`
	Summary    string     `json:"summary"`
	Outcome    string     `json:"outcome"`
	Citations  []Citation `json:"citations"`
}

// DocumentEditor is the slice of the document capability an agent's document
// tools need: read a document, and submit a change set to it. The agent declares
// this port rather than depending on the whole *document.Documents service, so
// its reach into another capability is exactly the two operations it uses.
//
// The canonical Documents service satisfies it directly, so wiring injects that
// service with no adapter — the same way notification satisfies Notifier. The
// document value types in the signatures are deliberate: an agent's document
// tools author document content, so they must speak the document model. What
// goes through a port is behaviour, not types.
type DocumentEditor interface {
	Get(projectID, documentID string) (document.Document, error)
	SubmitChanges(projectID, id, authorID string, submission document.ChangeSubmission, actorNames ...string) (document.ChangeSet, error)
}

// Workflows runs durable Plan and Action tasks through the shared reasoning
// evidence runner. Task-specific output validation and tools live here.
type Workflows struct {
	tasks      *Tasks
	personas   PersonaResolver
	documents  DocumentEditor
	runner     reasoningEvidenceRunner
	notifier   Notifier
	authorizer DocumentAuthorizer
	enqueuer   job.Enqueuer
}

type WorkflowOptions struct {
	Tasks        *Tasks
	Intelligence Intelligence
	Knowledge    Knowledge
	Personas     PersonaResolver
	// Documents is the document capability, injected as the narrow DocumentEditor
	// port. Nil leaves the document tools unbound.
	Documents    DocumentEditor
	PlanningCast intelligence.Cast
	DefaultCast  intelligence.Cast
	Limits       Limits
	ToolLimits   intelligence.ToolLimits
	Policy       Policy
	// Notifier, when set, receives a toast for the requester each time a task
	// settles into a terminal state. Nil disables task notifications.
	Notifier Notifier
	// Authorizer, when set, gates the document tools by the requester's access to
	// each target document. Nil disables the check (document tools stay
	// Project-gated only).
	Authorizer DocumentAuthorizer
	// Enqueuer, when set, backs the document.prompt.resolve Action tool (it
	// enqueues a resolve job). Nil leaves that tool unbound; the other prompt
	// tools do not need it.
	Enqueuer job.Enqueuer
}

func NewWorkflows(opts WorkflowOptions) (*Workflows, error) {
	if opts.Tasks == nil || opts.Personas == nil {
		return nil, errors.New("agent workflow: Tasks and Personas are required")
	}
	runner, err := newReasoningEvidenceRunner(opts.Intelligence, opts.Knowledge, opts.PlanningCast, opts.DefaultCast, opts.Limits, opts.ToolLimits, opts.Policy)
	if err != nil {
		return nil, err
	}
	return &Workflows{tasks: opts.Tasks, personas: opts.Personas, documents: opts.Documents, runner: runner, notifier: opts.Notifier, authorizer: opts.Authorizer, enqueuer: opts.Enqueuer}, nil
}

// authorizeDocument denies an agent tool acting on a document the task's
// requester may not access. A nil authorizer (access scoping not configured)
// always permits. The denial is a ToolError so the model gets a clean signal.
func (w *Workflows) authorizeDocument(requesterID, projectID, documentID string) error {
	if w.authorizer == nil {
		return nil
	}
	allowed, err := w.authorizer.CanAccessDocument(requesterID, projectID, documentID)
	if err != nil {
		return err
	}
	if !allowed {
		return &intelligence.ToolError{Code: "access_denied", Message: "you do not have access to this document"}
	}
	return nil
}

func (w *Workflows) CreatePlan(scope Scope, requesterID, objective string, items []ContextItem, selection persona.Selection, targetDocumentID string) (Task, error) {
	snapshot, err := w.personas.Resolve(persona.Scope{ProjectID: scope.ProjectID}, selection)
	if err != nil {
		return Task{}, err
	}
	return w.tasks.Create(scope, requesterID, TaskModePlan, objective, items, snapshot, targetDocumentID)
}

func (w *Workflows) CreateAction(scope Scope, requesterID, objective string, items []ContextItem, selection persona.Selection, targetDocumentID string) (Task, error) {
	snapshot, err := w.personas.Resolve(persona.Scope{ProjectID: scope.ProjectID}, selection)
	if err != nil {
		return Task{}, err
	}
	return w.tasks.Create(scope, requesterID, TaskModeAction, objective, items, snapshot, targetDocumentID)
}

// RunJob is the registered durable job handler. It loads scope from the stored
// task, so the queue payload cannot redirect execution to another Project.
// Business failures (model output, validation) are recorded on the task as
// failed; infrastructure failures (DB down, timeout) are returned so the job
// pool retries.
func (w *Workflows) RunJob(ctx context.Context, raw json.RawMessage) error {
	var payload RunPayload
	if err := decodeStructured(raw, &payload); err != nil || payload.TaskID == "" || payload.RunID == "" {
		return ErrInvalidTask
	}
	task, err := w.tasks.store.TaskByID(payload.TaskID)
	if err != nil {
		return err
	}
	scope := Scope{ProjectID: task.ProjectID}
	task, _, err = w.tasks.BeginRun(scope, payload)
	if err != nil {
		return err
	}
	if err := w.run(ctx, scope, task, payload.RunID); err != nil {
		_ = w.settle(scope, task, payload.RunID, TaskStateFailed, nil, Usage{}, err.Error())
		// Return infrastructure errors so the job pool retries; absorb business
		// errors that were already recorded on the task.
		if isInfrastructureError(err) {
			return err
		}
	}
	return nil
}

func isInfrastructureError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrInvalidModelOutput) || errors.Is(err, ErrUnknownCitation) || errors.Is(err, ErrMissingCitation) || errors.Is(err, ErrInvalidTask) || errors.Is(err, ErrInvalidRequest) || errors.Is(err, ErrInvalidScope) || errors.Is(err, ErrTaskNotRunnable) || errors.Is(err, ErrTaskProjectScope) {
		return false
	}
	return true
}

func (w *Workflows) run(ctx context.Context, scope Scope, task Task, runID string) error {
	// Bump heartbeat every 15 seconds while executing so the reaper does not
	// consider this task stale during a long tool loop.
	hbCtx, hbCancel := context.WithCancel(ctx)
	defer hbCancel()
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-hbCtx.Done():
				return
			case <-ticker.C:
				_ = w.tasks.store.BumpHeartbeat(task.ID, time.Now())
			}
		}
	}()

	working, err := taskWorkingContext(task)
	if err != nil {
		return err
	}
	bindings := knowledgeTools(w.runner.knowledge, scope.ProjectID)
	bindings = append(bindings, w.tasks.ToolBindings(scope, task)...)
	if task.Mode == TaskModeAction && w.documents != nil {
		bindings = append(bindings, w.documentGetTool(scope, task), w.documentEditTool(scope, task),
			w.documentPromptCreateTool(scope, task), w.documentPromptUpdateTool(scope, task))
		// The resolve tool needs the job queue; bind it only when configured.
		if w.enqueuer != nil {
			bindings = append(bindings, w.documentPromptResolveTool(scope, task))
		}
	}
	prompt, schema := w.runner.policy.Prompts.Plan, w.runner.policy.Schemas.Plan
	if task.Mode == TaskModeAction {
		prompt, schema = w.runner.policy.Prompts.Action, w.runner.policy.Schemas.Action
	}
	result, err := w.runner.run(ctx, runnerRequest{
		Scope: scope, Prompt: task.Objective, Context: task.Context, WorkingContext: working,
		Persona: task.Persona, SystemPrompt: prompt, Schema: schema, Bindings: bindings,
	})
	if err != nil {
		return err
	}
	switch task.Mode {
	case TaskModePlan:
		return w.finishPlan(scope, task, runID, result.JSON, result.Evidence, result.Usage)
	case TaskModeAction:
		return w.finishAction(ctx, scope, task, runID, result.JSON, result.Evidence, result.ToolResults, result.Usage)
	default:
		return ErrInvalidTask
	}
}

func taskWorkingContext(task Task) (json.RawMessage, error) {
	context, err := json.Marshal(struct {
		Persona   PersonaSnapshot `json:"persona"`
		Workspace TaskWorkspace   `json:"workspace"`
		Context   []ContextItem   `json:"context"`
	}{task.Persona, task.Workspace, task.Context})
	if err != nil {
		return nil, err
	}
	return context, nil
}

func (w *Workflows) finishPlan(scope Scope, task Task, runID string, raw json.RawMessage, evidence []Evidence, usage Usage) error {
	var draft PlanDraft
	if err := decodeStructured(raw, &draft); err != nil {
		return fmt.Errorf("%w: PlanDraft: %v", ErrInvalidModelOutput, err)
	}
	if err := validatePlanDraft(draft, evidence); err != nil {
		return err
	}
	now := time.Now().UTC()
	task.Plans = append(task.Plans, PlanRevision{ID: newTaskID(), Revision: len(task.Plans) + 1, Draft: draft, State: "draft", CreatedAt: now})
	if err := w.tasks.store.UpdateTask(task); err != nil {
		return err
	}
	return w.settle(scope, task, runID, TaskStateCompleted, raw, usage, "")
}

func (w *Workflows) finishAction(ctx context.Context, scope Scope, task Task, runID string, raw json.RawMessage, evidence []Evidence, results []intelligence.ToolResult, usage Usage) error {
	state, err := decodeAndValidateReport(raw, evidence, results)
	// Corrective re-asks. By this point the action's tool work has already run —
	// its effects are in the store — so a report the model fumbled (an unknown
	// toolCallId, a bogus outcome) must not discard real completed work. Each
	// re-ask is tool-free: it hands the model the executed calls, the rejected
	// draft, and the reason, and asks only for corrected paperwork; no side
	// effect can run twice. Bounded at two — the second attempt exists because
	// the first re-ask can itself draw a bad sample, and by then the model holds
	// the exact call IDs; a report invalid three times fails the task.
	draft := raw
	for attempt := 0; err != nil && attempt < maxReportReasks; attempt++ {
		corrected, correctiveUsage, reaskErr := w.reaskReport(ctx, task, draft, results, err)
		if reaskErr != nil {
			return err
		}
		usage.Answer.PromptTokens += correctiveUsage.PromptTokens
		usage.Answer.CompletionTokens += correctiveUsage.CompletionTokens
		usage.Answer.TotalTokens += correctiveUsage.TotalTokens
		draft = corrected
		state, err = decodeAndValidateReport(corrected, evidence, results)
		if err == nil {
			raw = corrected
		}
	}
	if err != nil {
		return err
	}
	return w.settle(scope, task, runID, state, raw, usage, "")
}

// maxReportReasks bounds the corrective report re-asks. Two, not more: the
// second exists because the first re-ask can itself draw a bad sample; past
// that, an invalid report is systematic and must surface as a failure.
const maxReportReasks = 2

func decodeAndValidateReport(raw json.RawMessage, evidence []Evidence, results []intelligence.ToolResult) (TaskState, error) {
	var report ExecutionReport
	if err := decodeStructured(raw, &report); err != nil {
		return "", fmt.Errorf("%w: ExecutionReport: %v", ErrInvalidModelOutput, err)
	}
	return validateReport(report, evidence, results)
}

// reaskReport asks the model once, without tools, for a corrected
// ExecutionReport: the executed tool calls (the only valid toolCallId values),
// the rejected draft, and why it was rejected.
func (w *Workflows) reaskReport(ctx context.Context, task Task, invalid json.RawMessage, results []intelligence.ToolResult, cause error) (json.RawMessage, intelligence.Usage, error) {
	type executedCall struct {
		ToolCallID string `json:"toolCallId"`
		Name       string `json:"name"`
		OK         bool   `json:"ok"`
	}
	calls := make([]executedCall, 0, len(results))
	for _, result := range results {
		calls = append(calls, executedCall{ToolCallID: result.CallID, Name: result.Name, OK: result.OK})
	}
	callsJSON, err := json.Marshal(calls)
	if err != nil {
		return nil, intelligence.Usage{}, err
	}
	prompt := fmt.Sprintf(
		"Your previous execution report was rejected: %v\n\nObjective: %s\n\nTool calls actually executed — the only valid toolCallId values:\n%s\n\nRejected report:\n%s\n\nProduce a corrected report for the SAME already-completed work. Reference only the toolCallId values listed above, and set outcome to \"completed\" only if every referenced call has \"ok\": true.",
		cause, task.Objective, callsJSON, invalid)
	result, err := w.runner.intelligence.ReasonJSON(ctx, intelligence.ReasonRequest{
		Cast: w.runner.defaultCast,
		Messages: []intelligence.Message{
			{Role: "system", Content: w.runner.policy.Prompts.Action},
			{Role: "user", Content: prompt},
		},
	}, w.runner.policy.Schemas.Action)
	if err != nil {
		return nil, intelligence.Usage{}, err
	}
	return result.JSON, result.Usage, nil
}

// settle records the run's terminal (or waiting) result, then tells the task's
// requester how it finished. Notification is best-effort: the task state is the
// durable outcome, and a lost toast never fails the run.
func (w *Workflows) settle(scope Scope, task Task, runID string, state TaskState, raw json.RawMessage, usage Usage, failure string) error {
	if err := w.tasks.FinishRun(scope, task.ID, runID, state, raw, usage, failure); err != nil {
		return err
	}
	w.notifySettled(task, state, failure)
	return nil
}

// notifySettled pushes one toast to the requester describing how the task ended.
// It fires only for terminal outcomes — a task that merely paused to wait for
// input is not an outcome worth toasting — and is a no-op without a Notifier.
func (w *Workflows) notifySettled(task Task, state TaskState, failure string) {
	if w.notifier == nil {
		return
	}
	toast, ok := settledToast(task, state, failure)
	if !ok {
		return
	}
	w.notifier.Push(task.RequesterID, toast)
}

// settledToast maps a settled task to its requester-facing toast. The second
// result is false for non-terminal states, which produce no toast.
func settledToast(task Task, state TaskState, failure string) (notification.Toast, bool) {
	noun := "Task"
	if task.Mode == TaskModePlan {
		noun = "Plan"
	}
	toast := notification.Toast{ProjectID: task.ProjectID, Body: task.Objective}
	switch state {
	case TaskStateCompleted:
		toast.Level, toast.Title = notification.LevelSuccess, noun+" complete"
	case TaskStatePartiallyCompleted:
		toast.Level, toast.Title = notification.LevelWarning, noun+" partially complete"
	case TaskStateFailed:
		toast.Level, toast.Title, toast.Body = notification.LevelError, noun+" failed", failure
	default:
		return notification.Toast{}, false
	}
	return toast, true
}

func validatePlanDraft(draft PlanDraft, evidence []Evidence) error {
	if invalidTaskText(draft.Title) || invalidTaskText(draft.Objective) || len(draft.Steps) == 0 {
		return ErrInvalidModelOutput
	}
	ids := map[string]bool{}
	for _, step := range draft.Steps {
		if invalidTaskText(step.ID) || invalidTaskText(step.Title) || len(step.Description) > maxTaskText || len(step.Rationale) > maxTaskText || ids[step.ID] {
			return ErrInvalidModelOutput
		}
		ids[step.ID] = true
	}
	for _, step := range draft.Steps {
		for _, dependency := range step.DependsOnStepIDs {
			if !ids[dependency] || dependency == step.ID {
				return ErrInvalidModelOutput
			}
		}
		if _, err := validateCitations(answerOutput{Citations: step.Citations, InsufficientEvidence: true}, evidence); err != nil {
			return err
		}
	}
	for _, risk := range draft.Risks {
		if invalidTaskText(risk.Description) || len(risk.Mitigation) > maxTaskText {
			return ErrInvalidModelOutput
		}
	}
	visiting, visited := map[string]bool{}, map[string]bool{}
	byID := make(map[string]PlanStep, len(draft.Steps))
	for _, step := range draft.Steps {
		byID[step.ID] = step
	}
	var visit func(string) error
	visit = func(id string) error {
		if visiting[id] {
			return ErrInvalidModelOutput
		}
		if visited[id] {
			return nil
		}
		visiting[id] = true
		for _, dependency := range byID[id].DependsOnStepIDs {
			if err := visit(dependency); err != nil {
				return err
			}
		}
		delete(visiting, id)
		visited[id] = true
		return nil
	}
	for _, step := range draft.Steps {
		if err := visit(step.ID); err != nil {
			return err
		}
	}
	_, err := validateCitations(answerOutput{Citations: draft.Citations, InsufficientEvidence: true}, evidence)
	return err
}

func validateReport(report ExecutionReport, evidence []Evidence, results []intelligence.ToolResult) (TaskState, error) {
	if strings.TrimSpace(report.Summary) == "" {
		return "", ErrInvalidModelOutput
	}
	available := map[string]bool{}
	for _, result := range results {
		available[result.CallID] = result.OK
	}
	seen := map[string]bool{}
	for _, operation := range report.Operations {
		ok, exists := available[operation.ToolCallID]
		if operation.ToolCallID == "" || !exists || seen[operation.ToolCallID] {
			return "", ErrInvalidModelOutput
		}
		seen[operation.ToolCallID] = true
		if report.Outcome == "completed" && !ok {
			return "", ErrInvalidModelOutput
		}
		if _, err := validateCitations(answerOutput{Citations: operation.Citations, InsufficientEvidence: true}, evidence); err != nil {
			return "", err
		}
	}
	if _, err := validateCitations(answerOutput{Citations: report.Citations, InsufficientEvidence: true}, evidence); err != nil {
		return "", err
	}
	switch report.Outcome {
	case "completed":
		return TaskStateCompleted, nil
	case "blocked":
		return TaskStateWaiting, nil
	case "failed":
		return TaskStateFailed, nil
	default:
		return "", ErrInvalidModelOutput
	}
}
```

### Why `partially_completed` is not a reportable outcome

The Action schema offers `completed | blocked | failed` — no partial. A half-done
task is not a state anyone can act on: the caller cannot use half a document, and
recording "some of it worked" lets an incomplete job settle as a success-ish
outcome that nothing follows up.

The removal is not merely cosmetic. A model that has done part of the work now
has to choose: `completed` (and be wrong, which the report validation and the
suites can catch), `blocked` (naming the input it needs), or `failed`. Each of
those is actionable. "Partially completed" was the one answer that ended the task
while telling us nothing to do about it — and a live run used it to report
delivering one of two requested items, which the suite then accepted as a pass.

An outcome outside the enum fails `validateReport`, which routes into the bounded
corrective re-ask rather than failing outright.

### A run's provider calls are charged to its task

```go
ctx = intelligence.WithSubject(ctx, "task:"+task.ID)
```

Set once, at the top of the job handler, so every call the run makes — the
retrieval-planning call, the tool loop, and any corrective report re-ask — is
attributed to the same task id. That is what makes one run's true spend a single
filter on the telemetry log rather than a correlation by timestamp, which is
wrong whenever two job workers run concurrently.

The placement matters: it wraps `w.run`, so a call made anywhere beneath it
inherits the attribution without being passed anything. An Ask invoked inside the
run keeps the task's subject rather than replacing it with its own, because
`WithSubject` keeps the outermost attribution — otherwise one run's cost would be
split across two subjects and both would under-report.
