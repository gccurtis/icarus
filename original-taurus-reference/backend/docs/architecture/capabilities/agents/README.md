# AGENT — Quarterback plans, actions, and ask

AGENT is the application-level layer that composes the other capabilities —
[intelligence](../intelligence.md), [knowledge](../knowledge/README.md),
[persona](../persona.md), and [documents](../documents/README.md) — into
model-driven work. It owns **no provider, store, or authority of its own**; it
orchestrates the ones those capabilities already expose, behind narrow ports.

It offers two shapes of work:

- **Ask** — a transient, read-only "Quarterback" question-and-answer path: plan
  retrieval, gather project-scoped evidence, return a cited answer with
  uncertainty. It creates nothing and mutates nothing. *Built as library code and
  unit-tested, but not yet routed over HTTP* — see [ask.md](ask.md).
- **Task** — a durable, project-local unit of work run in one of two **modes**:
  **Plan** (produce a reviewable plan draft) or **Action** (execute changes using
  tools). *Fully wired and reachable over HTTP* at `/agent/*`.

Both are driven by one shared **runner** — a four-phase engine: plan retrieval →
retrieve grounded evidence → assemble structurally-separated messages → produce a
tool-enabled structured answer. The runner always calls Intelligence's bounded
[tool-use loop](../intelligence/tool-use.md) (`ReasonWithToolsJSON`); the agent
capability is that loop's first production caller.

- **Domain** — [`core/capability/agent`](../../../../core/capability/agent):
  `ask.go`, `runner.go`, `task.go`, `workflow.go`, and the tool bindings in
  `task_tools.go` / `document_tools.go`.
- **Application handlers** —
  [`core/handlers/agent`](../../../../core/handlers/agent/agent.go).

## The task model

```go
type Task struct {
	ID, ProjectID, RequesterID string     // set by app code, never model input
	Mode      TaskMode                     // "plan" | "action"
	State     TaskState
	Objective string
	Context   []ContextItem
	Persona   PersonaSnapshot              // stamped at creation, immutable thereafter
	Workspace TaskWorkspace                // notes, todos, working plans — the agent's scratch space
	Plans     []PlanRevision              // reviewable plan drafts (plan mode)
	Runs      []TaskRun                    // one per execution attempt
	CreatedAt, UpdatedAt time.Time
}
```

**Lifecycle.** A task's state moves `queued → running → {completed |
partially_completed | failed | canceled}`, with `waiting` for an action that
blocked. `Create` writes the task and a first `queued` run and enqueues a durable
job; a worker atomically claims it (`queued → running`, guarded so two workers
cannot both run it); the run settles into a terminal or `waiting` state. A
crash-recovery **reaper** returns tasks stuck in `running` past a staleness window
back to `queued`. Each resume is a fresh `TaskRun`, not a revived model
conversation.

**Plan output.** A plan-mode run produces a `PlanDraft` (title, objective,
summary, assumptions, open questions, success criteria, ordered `Steps`, `Risks`,
citations) stored as a `PlanRevision`. Validation rejects empty steps, duplicate
step IDs, dependency cycles (the steps must form a DAG), and citations not
grounded in the retrieved evidence. `AcceptPlan` flips one revision from `draft`
to `accepted` — it is **explicitly not** an execution trigger; running the work is
a separate Action task.

**Action output.** An action-mode run produces an `ExecutionReport` (summary,
`outcome` ∈ `completed | partially_completed | blocked | failed`, the operations
it performed, open questions, next steps, citations). Every operation must
reference a real tool call from the current run, and a `completed` outcome
requires that call to have succeeded — the report cannot claim effects the tools
did not produce.

The `TaskWorkspace` (notes, todos, working plans, open questions) is the agent's
own working material and is distinct from the reviewable `PlanRevision`.

## Composition — the tools a run is given

The runner assembles an immutable `ToolSet` per run from the capabilities that
are wired:

- **Knowledge search** — a project-scoped retrieval tool (the project id is
  captured in a closure, so the model cannot retarget another project).
- **Task-local tools** — eight bindings for the agent's own workspace:
  `task.context.get`, `task.note.append`, `task.todo.list/create/update`,
  `task.plan.list/get/create`.
- **Document tools** *(Action only, when Documents are wired)* — `document.get`
  and `document.append_changes`, the latter submitting a validated document
  change submission.

The resolved **persona** instructions are prepended to every system message.
Tool use is bounded by frozen limits (max rounds, calls per round, total calls,
and total tokens) so no run can escalate its own budget.

## HTTP surface

All routes are **project-scoped** and register only when both the task store and
the workflow executor are wired (`opts.AgentTasks != nil && opts.AgentWorkflows
!= nil`). Writes require role owner or edit; reads are open to any member.

| Method & path | Handler | Purpose | Dispatch |
|---|---|---|---|
| `POST /agent/plans` | `CreatePlan` | Create a plan-mode task. Body `{objective, context:[{label,content}], persona:{id,version}}`. → `201` + the `queued` `Task`. | **async** — enqueues `agent.task.run`; the draft appears later in `task.plans[]`. |
| `POST /agent/actions` | `CreateAction` | Create an action-mode task (same body). → `201` + the `queued` `Task`. | **async** — the run settles the report and state later. |
| `GET /agent/tasks` | `List` | The project's tasks, creation order. | sync read |
| `GET /agent/tasks/:taskID` | `Get` | One task (project-scope checked) — poll this for async results. | sync read |
| `POST /agent/tasks/:taskID/plans/:planID/accept` | `AcceptPlan` | Mark a plan revision `accepted`. **Does not execute anything.** | sync state change |

Because Plan and Action tasks execute on the background job pool, a client
`POST`s to create the task, then polls `GET /agent/tasks/:taskID` until the run
reaches a terminal state. Business errors (invalid model output, failed
validation) are recorded on the task; only infrastructure errors are retried.

## Ports and wiring

The runner's ports — `Intelligence` (`ReasonJSON`, `ReasonWithToolsJSON`),
`Knowledge` (`Retrieve`, `SearchTool`), and `PersonaResolver` (`Resolve`) — are
satisfied directly by the real services in [`wiring`](../../../../core/wiring/wiring.go),
with no adapter. The task side adds a durable `TaskStore` (SQLite; a
`MemoryTaskStore` for tests), a `job.Enqueuer` (the queue), and `*document.Documents`
for Action tools. The workflow executor is registered as the handler for the
`agent.task.run` job type, and the reaper is started with a fixed interval.

## Persistence

Tasks live in the one SQLite [store](../../persistence.md), in `agent_tasks`
(`persona_id` attributes the task; the full task — persona snapshot, plans, runs —
is the `content` JSON aggregate), indexed by project and by `(project, persona,
created_at)`.

## Status

- **Plan / Action tasks: fully wired and reachable over HTTP today**, executing
  asynchronously through the job pool.
- **Ask: library-only.** The service and its citation-validated pipeline are
  implemented and unit-tested, and its prompt/schema are even loaded into the
  agent policy — but `agent.New` is never called in wiring, there is no handler,
  and no route. It runs only from Go code and tests. See [ask.md](ask.md).

## Related

- [Intelligence](../intelligence.md) & its [tool-use loop](../intelligence/tool-use.md) — the engine every run drives.
- [Persona](../persona.md) — resolved and snapshotted onto each task.
- [Knowledge](../knowledge/README.md) — the retrieval tool bound into every run.
- [Documents](../documents/README.md) — mutated through Action-mode document tools.
- [Ask](ask.md) — the read-only Quarterback answer path (design + built library shape).
