# Agent capability integration plan

Port the AI agent and persona capabilities from `remotes/origin/feature/quarterback-ask`
into current main. The branch adds a full agentic reasoning pipeline (Ask / Plan / Action
workflows) with durable tasks, task-local tools, document-authoring tools, and a
versioned persona system. We take the new packages whole and hand-wire them into our
current codebase at the integration points.

## What we're adding

### Agent capability (`core/capability/agent/`)

Three reasoning workflows composed over existing ports (intelligence, knowledge, persona):

- **Ask** — synchronous, stateless, read-only Q&A. Four-phase pipeline: structured
  retrieval planning → evidence gathering → grounded prompt assembly → tool-enabled
  structured reasoning. Returns citations validated against retrieved evidence.
- **Plan** — durable, job-backed workflow producing reviewable `PlanRevision` with
  step dependencies, risk analysis, and citations. Cycle detection via DFS.
- **Action** — durable, job-backed workflow producing `ExecutionReport` with document
  read/edit tool access and tool result reconciliation.

Shared infrastructure:
- `reasoningEvidenceRunner` — shared 4-phase pipeline: plan queries → retrieve →
  build prompt → reason with tools. Used by all three modes.
- `Policy` — deployment-owned prompts and JSON schemas per mode. Editable via
  `etc/config.yaml`.
- `TaskStore` — interface for durable task persistence. Task carries a `PersonaSnapshot`
  so later persona revisions can't rewrite historical behavior.
- `MemoryTaskStore` — in-memory implementation for tests.

**Tool library:** `knowledge.search` (all modes), 8 task-local tools (context, note,
todo list/create/update, plan list/get/create — Plan/Action modes), `document.get`
and `document.append_changes` (Action mode only). All handlers close over Project/Task
identity; model input cannot escape scope.

### Persona capability (`core/capability/persona/`)

Versioned behavioral overlays — reusable, Project-local agent identities:

- **Persona** — stable identity with `CurrentVersion` pointer
- **Version** — immutable `Definition` (focus, behavioral guidance, context
  references, verification preferences, output preferences)
- **Snapshot** — denormalized copy embedded into Tasks so later revisions can't
  rewrite historical behavior
- **General** — config-driven, system-managed, lazy-materialized per-Project on
  first access. Cannot be deleted or revised by users.
- **Defaults** — per-user, per-project persona preference. Falls back to General.

Optimistic concurrency via `expectedVersion` guard. Full lifecycle: Create,
Revise, Update, Delete, List, Versions, SetDefault, DefaultForUser, Resolve.

### Handlers

| Method | Route | Handler |
|---|---|---|
| GET | `/agent/tasks` | agent.List |
| POST | `/agent/plans` | agent.CreatePlan |
| POST | `/agent/actions` | agent.CreateAction |
| GET | `/agent/tasks/:taskID` | agent.Get |
| POST | `/agent/tasks/:taskID/plans/:planID/accept` | agent.AcceptPlan |
| GET | `/personas` | persona.List |
| POST | `/personas` | persona.Create |
| GET | `/personas/default` | persona.Default |
| PUT | `/personas/default` | persona.SetDefault |
| GET | `/personas/:personaID` | persona.Get |
| PUT | `/personas/:personaID` | persona.Update |
| DELETE | `/personas/:personaID` | persona.Delete |
| POST | `/personas/:personaID/revisions` | persona.Revise |
| GET | `/personas/:personaID/versions` | persona.Versions |
| GET | `/personas/:personaID/versions/:version` | persona.GetVersion |
| GET | `/personas/:personaID/tasks` | persona.Tasks |

All routes are project-scoped via `requireProject` middleware. Writes require
Owner or Edit role.

---

## Integration points

These are the files in our current main that need additions — never deletions.
The branch's versions of these files are far behind and must not replace ours.

### 1. SQLite store (`core/platform/storage/sqlite/sqlite.go`)

**New tables** (add to `migrate()` after main's existing CREATE TABLE statements):

```sql
CREATE TABLE IF NOT EXISTS personas (
    project_id      TEXT NOT NULL REFERENCES projects(id),
    id              TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    current_version INTEGER NOT NULL,
    created_by      TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS persona_versions (
    project_id TEXT NOT NULL,
    persona_id TEXT NOT NULL,
    version    INTEGER NOT NULL,
    definition TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (project_id, persona_id, version),
    FOREIGN KEY (project_id, persona_id) REFERENCES personas(project_id, id)
);

CREATE TABLE IF NOT EXISTS persona_defaults (
    project_id TEXT NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users(id),
    persona_id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id, persona_id) REFERENCES personas(project_id, id)
);

CREATE TABLE IF NOT EXISTS agent_tasks (
    id             TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL REFERENCES projects(id),
    requester_id   TEXT NOT NULL DEFAULT '',
    requester_name TEXT NOT NULL DEFAULT '',
    persona_id     TEXT NOT NULL DEFAULT '',
    state          TEXT NOT NULL,
    content        TEXT NOT NULL,
    heartbeat_at   TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
);
```

**New migration ALTERs** (for databases created before new columns existed):

```
ALTER TABLE agent_tasks ADD COLUMN requester_name TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_tasks ADD COLUMN heartbeat_at TEXT NOT NULL DEFAULT '';
```

**New imports:** `agent`, `persona`, `encoding/json`.

**New store methods** (14 total, extracted from the branch's sqlite.go):

Persona store (9 methods):
- `CreatePersona(persona.Persona, persona.Version) error`
- `UpdatePersonaVersion(persona.Persona, persona.Version, int) error`
- `DeletePersona(string, string) error`
- `PersonaByID(string, string) (persona.Persona, error)`
- `PersonaVersion(string, string, int) (persona.Version, error)`
- `PersonaVersions(string, string) ([]persona.Version, error)`
- `PersonasByProject(string) ([]persona.Persona, error)`
- `DefaultPersona(string, string) (persona.Default, error)`
- `SetDefaultPersona(persona.Default) error`

Agent task store (5 methods):
- `CreateTask(agent.Task) error`
- `TaskByID(string) (agent.Task, error)`
- `TasksByProject(string) ([]agent.Task, error)`
- `TasksByPersona(string, string) ([]agent.Task, error)`
- `UpdateTask(agent.Task) error`

Plus helper `decodeTask(rowScanner) (agent.Task, error)` — deserializes
task content from JSON blob in the `content` column.

**Compile-time assertions:**
```go
var _ agent.TaskStore = (*Store)(nil)
var _ persona.Store = (*Store)(nil)
```

### 2. Config (`core/platform/config/config.go`)

Add `Agents Agents` field to the `Config` struct. Keep all existing fields and
structs (especially `Documents` with `Layout` and `Prompt`).

New types to add after the existing config types:
- `Agents` struct: `DefaultPersona AgentPersona`, `Prompts AgentPrompts`, `Schemas AgentSchemas`
- `AgentPersona`: `Name`, `Description`, `Focus`, `Instructions` (yaml tag: `instructions`), `ContextReferences`, `DefaultVerification`, `OutputPreferences`
- `AgentPrompts`: `RetrievalPlan`, `Ask`, `Plan`, `Action`
- `AgentSchemas`: `RetrievalPlan`, `Ask`, `Plan`, `Action`

Add defaults in `Default()` matching the branch's `DefaultPolicy()` values.

### 3. Transport (`core/transport/transport.go`)

**New imports:**
```go
"github.com/gccurtis/taurus-omega/core/capability/agent"
"github.com/gccurtis/taurus-omega/core/capability/persona"
agentapp "github.com/gccurtis/taurus-omega/core/handlers/agent"
personaapp "github.com/gccurtis/taurus-omega/core/handlers/persona"
```

**New Options fields:**
```go
AgentTasks     *agent.Tasks
AgentWorkflows *agent.Workflows
Personas       *persona.Personas
```

**Route registrations** (after document routes and before dev routes, project-scoped,
gated behind nil checks):

```go
if opts.AgentTasks != nil && opts.AgentWorkflows != nil {
    agents := agentapp.NewHandlers(opts.AgentTasks, opts.AgentWorkflows)
    scoped.GET("/agent/tasks", s.adaptScoped(agents.List))
    scoped.POST("/agent/plans", s.adaptScoped(agents.CreatePlan))
    scoped.POST("/agent/actions", s.adaptScoped(agents.CreateAction))
    scoped.GET("/agent/tasks/:taskID", s.adaptScoped(agents.Get))
    scoped.POST("/agent/tasks/:taskID/plans/:planID/accept", s.adaptScoped(agents.AcceptPlan))
}
if opts.Personas != nil && opts.AgentTasks != nil {
    personas := personaapp.NewHandlers(opts.Personas, opts.AgentTasks)
    scoped.GET("/personas", s.adaptScoped(personas.List))
    scoped.POST("/personas", s.adaptScoped(personas.Create))
    scoped.GET("/personas/default", s.adaptScoped(personas.Default))
    scoped.PUT("/personas/default", s.adaptScoped(personas.SetDefault))
    scoped.GET("/personas/:personaID", s.adaptScoped(personas.Get))
    scoped.PUT("/personas/:personaID", s.adaptScoped(personas.Update))
    scoped.DELETE("/personas/:personaID", s.adaptScoped(personas.Delete))
    scoped.POST("/personas/:personaID/revisions", s.adaptScoped(personas.Revise))
    scoped.GET("/personas/:personaID/versions", s.adaptScoped(personas.Versions))
    scoped.GET("/personas/:personaID/versions/:version", s.adaptScoped(personas.GetVersion))
    scoped.GET("/personas/:personaID/tasks", s.adaptScoped(personas.Tasks))
}
```

Note: agent/persona routes use `s.adaptScoped()` directly — they don't use the
`dispatchScoped` / `operationSync` pattern.

### 4. Wiring (`core/wiring/wiring.go`)

After the knowledge/intelligence block and before the resource catalog:

```go
personas, err := persona.New(store, persona.Options{
    GeneralName:        cfg.Agents.DefaultPersona.Name,
    GeneralDescription: cfg.Agents.DefaultPersona.Description,
    GeneralDefinition: persona.Definition{
        Focus:               cfg.Agents.DefaultPersona.Focus,
        BehavioralGuidance:  cfg.Agents.DefaultPersona.Instructions,
        ContextReferences:   cfg.Agents.DefaultPersona.ContextReferences,
        DefaultVerification: cfg.Agents.DefaultPersona.DefaultVerification,
        OutputPreferences:   cfg.Agents.DefaultPersona.OutputPreferences,
    },
})

agentPolicy := configuredAgentPolicy(cfg.Agents)
tasks, err := agent.NewTasks(store, agent.TaskOptions{Enqueuer: queue})
workflows, err := agent.NewWorkflows(agent.WorkflowOptions{
    Tasks: tasks, Intelligence: intel, Knowledge: know,
    Personas: personas, Documents: docs,
    PlanningCast: intelligence.Cast{Strength: "low", Speed: "high", Cost: "low"},
    DefaultCast:  intelligence.Cast{Strength: "low", Speed: "high", Cost: "low"},
    ToolLimits:   intelligence.DefaultToolLimits(),
    Policy:       agentPolicy,
})
registry.Register(agent.JobTypeRun, workflows.RunJob)
```

Add `configuredAgentPolicy` helper (translates config → agent.Policy).

Pass `AgentTasks`, `AgentWorkflows`, `Personas` to `transport.Options`.

### 5. Config YAML (`etc/config.yaml`)

Add `agents:` section below `knowledge:`:
```yaml
agents:
  default_persona:
    name: General
    description: General-purpose Project assistant
    instructions: Act as Taurus's general Project assistant. Work from evidence, use task tools to organize multi-step work, report uncertainty, and never claim a tool effect that did not occur.
  prompts:
    retrieval_plan: "Plan up to three concise semantic retrieval queries..."
    ask: "Answer the user's question from the supplied source material..."
    plan: "Produce an actionable but reviewable plan..."
    action: "Complete the task using only available tools..."
  schemas:
    retrieval_plan: '{"type":"object",...}'
    ask: '{"type":"object",...}'
    plan: '{"type":"object",...}'
    action: '{"type":"object",...}'
```

### 6. `document_tools.go` — critical fix

The branch's `documentAppendTool` calls `w.documents.AppendChanges(...)` which
does not exist in main. Replace with `SubmitChanges`:

```go
// Read revision, then submit against it.
doc, err := w.documents.Get(scope.ProjectID, input.DocumentID)
if err != nil {
    return nil, &intelligence.ToolError{Code: "tool_failed", Message: err.Error()}
}
submission := document.ChangeSubmission{
    SubmissionID:     newTaskID(),
    ExpectedRevision: doc.Revision,
    Operations:       input.Ops,
}
cs, err := w.documents.SubmitChanges(scope.ProjectID, input.DocumentID, task.RequesterID, submission)
if err != nil {
    return nil, &intelligence.ToolError{Code: "tool_failed", Message: err.Error()}
}
return json.Marshal(struct {
    DocumentID  string `json:"documentId"`
    ChangeSetID string `json:"changeSetId"`
    Seq         int64  `json:"seq"`
}{input.DocumentID, cs.ID, cs.Seq})
```

---

## Testing strategy

### Unit tests (no provider needed)

**Agent tests** (from branch, run as they are):
- `ask_test.go` — fake intelligence, fake knowledge. Tests: citation validation,
  evidence merging, context encoding, limit tightening, normalized queries.
- `task_tools_test.go` — MemoryTaskStore. Tests: tool handlers are closed over
  Task/Project identity; cross-project reads are rejected.
- `workflow_test.go` — fake providers via `scriptedProvider` and
  `actionLoopProvider`. Tests: plan task lifecycle, action task lifecycle, cyclic
  dependency rejection, persona snapshot immutability, document tool loop.
- `persona_test.go` — MemoryStore. Tests: General lazy materialization, version
  conflict, delete clears defaults, snapshot immutability.

**SQLite store tests** (new):
- Persona round-trip: `CreatePersona` + `PersonaByID`
- Version lifecycle: `UpdatePersonaVersion` with correct and stale expectedVersion
- `DeletePersona` cascades: defaults and versions removed
- Task round-trip: `CreateTask` + `TaskByID` with persona snapshot
- `TasksByProject` ordering, `TasksByPersona` filtering
- `SetDefaultPersona` validates persona exists (currently a gap)

### Integration tests (real provider required — OpenRouter key is set)

**Transport tests:**
- Agent route round-trip: POST `/agent/plans` → task created with `state: queued`,
  GET `/agent/tasks` shows it, POST `/agent/tasks/:id/plans/:id/accept` marks
- Persona CRUD: POST `/personas` → GET list shows it → PUT update →
  DELETE → 404
- Persona defaults: PUT `/personas/default` → GET `/personas/default` returns it
- Rejections: missing objective, unauthenticated, cross-project

**Dev-test suite** (`dev-test/agents/run.sh` — from branch):
- Runs against a live Omega server with real model provider
- Verifies: plan task creation → job execution → completed state
- Reports usage cost via `track_usage` / `usage_summary`

### Known gaps (post-merge)

1. **Task state race** — `BeginRun`/`FinishRun` do read-then-write without atomic
   CAS. Two workers could claim the same task. Fix: make `BeginRun` atomic in SQLite
   (UPDATE ... WHERE state = 'queued' RETURNING *).

2. **Crash recovery** — tasks stuck in `running` after process restart. Fix:
   `heartbeat_at` column exists (added in migration), add reaper job that
   transitions stale tasks back to `queued`.

3. **RunJob always returns nil** — transient infrastructure failures (DB down,
   timeout) are masked. Fix: return errors for non-business failures so job
   pool retries.

4. **SetDefaultPersona** — SQLite store doesn't validate persona existence (unlike
   MemoryStore). Fix: add existence check before upsert.

---

## Interface compatibility

All interfaces should satisfy without changes:

| Interface | Concrete | Required methods |
|---|---|---|
| `agent.Intelligence` | `*intelligence.Intelligence` | `ReasonJSON`, `ReasonWithToolsJSON` |
| `agent.Knowledge` | `*knowledge.Knowledge` | `Retrieve(ctx, projectID, query, topK) (RetrieveResult, error)`, `SearchTool(projectID) ToolBinding` |
| `agent.PersonaResolver` | `*persona.Personas` | `Resolve(Scope, Selection) (Snapshot, error)` |
| `agent.TaskStore` | `*sqlite.Store` | `CreateTask`, `TaskByID`, `TasksByProject`, `TasksByPersona`, `UpdateTask` |
| `persona.Store` | `*sqlite.Store` | 9 methods |

The `Knowledge` interface's `Retrieve` signature is `(ctx, projectID, query, topK)` —
check our current `knowledge.Knowledge.Retrieve` signature for exact match.

---

## What this does NOT address from the frontend integration plan

The agent capability provides the engine. The frontend integration plan's Phase 2
requires additional wiring:

- **Phase 2a** (tool-loop endpoint): the agent uses `ReasonWithToolsJSON` directly
  via its `Intelligence` interface. Alpha's client-side agent still needs
  `POST /intelligence/reason/tools` as a standalone HTTP route.
- **Phase 2b** (identity resolution): persona profiles need a unified batch
  resolver. The `PublicUser` enrichment from Phase 1b provides per-user identity;
  a `POST /identities/resolve` endpoint would add batch efficiency.
