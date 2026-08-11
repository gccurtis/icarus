# Agent capability integration — implementation checklist

Each entry in the plan ([`docs/plans/agent-capability-integration.md`](../plans/agent-capability-integration.md))
gets a detailed checklist here. All new code comes from `remotes/origin/feature/quarterback-ask`.
Integration points are hand-wired into our current main — never replacing files.

---

## Phase A: Port new packages (take from branch as-is)

### Agent capability (`core/capability/agent/`)

- [x] Copy `core/capability/agent/ask.go` from branch to main. Defines `Scope`,
      `AskRequest`, `Limits`, `Citation`, `Evidence`, `Response`, `Intelligence`
      interface, `Knowledge` interface, `PersonaResolver` interface, `Ask`
      service with `Run` method.
- [x] Copy `core/capability/agent/runner.go` from branch to main. Defines
      `Prompts`, `Schemas`, `Policy` with `DefaultPolicy()` and `effective()`,
      `reasoningEvidenceRunner` with 4-phase `run()` pipeline.
- [x] Copy `core/capability/agent/task.go` from branch to main. Defines
      `TaskMode`, `TaskState`, `TodoState`, `Todo`, `TaskPlan`, `PlanDraft`,
      `PlanStep`, `PlanRisk`, `PlanRevision`, `TaskWorkspace`, `TaskRun`,
      `Task`, `RunPayload`, `TaskStore` interface, `Tasks` service with
      `Create`/`Get`/`List`/`ListByPersona`/`AcceptPlan`/`BeginRun`/`FinishRun`
      /`ToolBindings`, `MemoryTaskStore`.
- [x] Copy `core/capability/agent/task_tools.go` from branch to main. Defines
      8 task-local tool bindings: `contextTool`, `noteTool`, `todoListTool`,
      `todoCreateTool`, `todoUpdateTool`, `planListTool`, `planGetTool`,
      `planCreateTool`. All close over Project/Task scope.
- [x] Copy `core/capability/agent/document_tools.go` from branch to main.
      Defines `documentGetTool` and `documentAppendTool`. Fixed `AppendChanges`
      → `SubmitChanges` (done in Phase A since it blocks build).
- [x] Copy `core/capability/agent/workflow.go` from branch to main. Defines
      `ExecutionReport`, `Workflows` service with `CreatePlan`/`CreateAction`/
      `RunJob`, internal `run`/`finishPlan`/`finishAction` with plan and
      execution validation including cycle detection.

### Persona capability (`core/capability/persona/`)

- [x] Copy `core/capability/persona/persona.go` from branch to main. Defines
      `Scope`, `Definition`, `Persona`, `Version`, `Snapshot`, `Selection`,
      `Record`, `Default`, `CreateRequest`, `UpdateRequest`, `Store` interface,
      `Personas` service with full lifecycle, `MemoryStore`.

### Handlers

- [x] Copy `core/handlers/agent/agent.go` from branch to main. 5 endpoints:
      List, CreatePlan, CreateAction, Get, AcceptPlan.
- [x] Copy `core/handlers/persona/persona.go` from branch to main. 11 endpoints:
      List, Create, Revise, Update, Delete, Get, GetVersion, Versions,
      Default, SetDefault, Tasks.

### Test files

- [x] Copy `core/capability/agent/ask_test.go` from branch to main.
- [x] Copy `core/capability/agent/task_tools_test.go` from branch to main.
- [x] Copy `core/capability/agent/workflow_test.go` from branch to main.
- [x] Copy `core/capability/persona/persona_test.go` from branch to main.

### Dev-test suite

- [x] Copy `dev-test/agents/manual.md` from branch to main.
- [x] Copy `dev-test/agents/run.sh` from branch to main (made executable).

### Additional edge case tests

- [x] `agent_edge_test.go` — 45 additional tests covering:
      create rejections (invalid mode, empty objective, empty requester,
      empty scope, invalid persona, oversized context/objective),
      cross-project isolation (Get, document tools), state machine guards
      (BeginRun twice, FinishRun on queued, wrong run IDs, AcceptPlan
      on Action task, nonexistent/accepted plans), tool limits (todo
      overflow, note overflow), constructor nil checks (all 5 constructors
      + empty casts, nil store), plan validation edge cases (empty steps,
      duplicate IDs, self-dependency, bad dependency), report validation
      edge cases (nonexistent tool, duplicate operations), action without
      documents, RunJob invalid/null payload, nonexistent task, persona
      nil store.

---

## Phase B: Hand-wire integration points

### B1: SQLite store (`core/platform/storage/sqlite/sqlite.go`)

- [x] Add `personas` CREATE TABLE to `migrate()`.
- [x] Add `persona_versions` CREATE TABLE to `migrate()`.
- [x] Add `persona_defaults` CREATE TABLE to `migrate()`.
- [x] Add `agent_tasks` CREATE TABLE to `migrate()` (with `requester_name`
      and `heartbeat_at` columns).
- [x] Add `CREATE INDEX IF NOT EXISTS idx_personas_project_name` to `migrate()`.
- [x] Add `CREATE INDEX IF NOT EXISTS idx_agent_tasks_project` to `migrate()`.
- [x] Add `CREATE INDEX IF NOT EXISTS idx_agent_tasks_persona_created` to `migrate()`.
- [x] Add migration ALTERs for `requester_name` and `heartbeat_at` columns.
- [x] Add import:.*agent"`.
- [x] Add import:.*persona"`.
- [x] Add import: `"encoding/json"` (if not already present).
- [x] Implement `CreatePersona(persona.Persona, persona.Version) error`.
- [x] Implement `UpdatePersonaVersion(persona.Persona, persona.Version, int) error`.
- [x] Implement `DeletePersona(string, string) error`.
- [x] Implement `PersonaByID(string, string) (persona.Persona, error)`.
- [x] Implement `PersonaVersion(string, string, int) (persona.Version, error)`.
- [x] Implement `PersonaVersions(string, string) ([]persona.Version, error)`.
- [x] Implement `PersonasByProject(string) ([]persona.Persona, error)`.
- [x] Implement `DefaultPersona(string, string) (persona.Default, error)`.
- [x] Implement `SetDefaultPersona(persona.Default) error`.
- [x] Implement `CreateTask(agent.Task) error`.
- [x] Implement `TaskByID(string) (agent.Task, error)`.
- [x] Implement `TasksByProject(string) ([]agent.Task, error)`.
- [x] Implement `TasksByPersona(string, string) ([]agent.Task, error)`.
- [x] Implement `UpdateTask(agent.Task) error`.
- [x] Implement `decodeTask(rowScanner) (agent.Task, error)` helper.
- [x] Add compile-time assertions:
      `var _ agent.TaskStore = (*Store)(nil)` and
      `var _ persona.Store = (*Store)(nil)`.

### B2: Config (`core/platform/config/config.go`)

- [x] Add `Agents Agents` field to `Config` struct with yaml tag.
- [x] Define `Agents` struct: `DefaultPersona AgentPersona`, `Prompts AgentPrompts`,
      `Schemas AgentSchemas` (all with yaml tags).
- [x] Define `AgentPersona` struct: `Name`, `Description`, `Focus`, `Instructions`
      (yaml: `instructions`), `ContextReferences`, `DefaultVerification`,
      `OutputPreferences`.
- [x] Define `AgentPrompts` struct: `RetrievalPlan`, `Ask`, `Plan`, `Action`.
- [x] Define `AgentSchemas` struct: `RetrievalPlan`, `Ask`, `Plan`, `Action`.
- [x] Add `Agents` defaults in `Default()` function matching the branch's
      `DefaultPolicy()` prompts and schemas.

### B3: Transport (`core/transport/transport.go`)

- [x] Add import:.*agent"`.
- [x] Add import:.*persona"`.
- [x] Add import:.*agent"`.
- [x] Add import:.*persona"`.
- [x] Add `AgentTasks *agent.Tasks` to `Options` struct.
- [x] Add `AgentWorkflows *agent.Workflows` to `Options` struct.
- [x] Add `Personas *persona.Personas` to `Options` struct.
- [x] Add agent route block (5 routes, gated on `opts.AgentTasks != nil &&
      opts.AgentWorkflows != nil`).
- [x] Add persona route block (11 routes, gated on `opts.Personas != nil &&
      opts.AgentTasks != nil`).

### B4: Wiring (`core/wiring/wiring.go`)

- [x] Add import:.*agent"`.
- [x] Add import:.*persona"`.
- [x] Add persona construction after intelligence/knowledge block and before
      resource catalog.
- [x] Add `agent.NewTasks()` construction.
- [x] Add `agent.NewWorkflows()` construction.
- [x] Register `agent.JobTypeRun` in job registry.
- [x] Add `configuredAgentPolicy(cfg config.Agents) agent.Policy` helper function.
- [x] Pass `AgentTasks`, `AgentWorkflows`, `Personas` to `transport.Options`.
- [x] Handle error returns from persona/tasks/workflows constructors (log.Fatalf).
- [x] Add new imports for `agent` and `persona`.

### B5: Config YAML (`etc/config.yaml`)

- [x] Add `agents:` section below `knowledge:`.
- [x] Set `default_persona` with name, description, focus, instructions,
      context_references, default_verification, output_preferences.
- [x] Set `prompts` with retrieval_plan, ask, plan, action prompt text.
- [x] Set `schemas` with retrieval_plan, ask, plan, action JSON schemas.

---

## Phase C: Fix, build, test

### C1: Fix `document_tools.go`

- [x] Replace `w.documents.AppendChanges(scope.ProjectID, input.DocumentID,
      task.RequesterID, input.Ops)` with `SubmitChanges` pattern:
      read document via `Get()` to get revision, build `ChangeSubmission`,
      call `SubmitChanges(projectID, documentID, authorID, submission)`.
- [x] Import `"crypto/rand"` and `"encoding/hex"` if needed for `newTaskID()`.
      Or reuse the `agent.newTaskID()` function from the package.

### C2: Build and fix compilation

- [x] Run `go build ./...`. Fix any compilation errors:
  - [ ] Import cycle between agent ↔ persona (should be fine — agent imports
        persona directly, persona does not import agent).
  - [ ] Missing method signatures on concrete types vs interfaces.
  - [ ] Changed type signatures in our current main vs what the branch expects.
  - [ ] Check `knowledge.Knowledge.Retrieve` signature matches
        `agent.Knowledge.Retrieve(ctx, projectID, query, topK)`.
- [x] Run `go vet ./...`. Fix any vet warnings.

### C3: Run existing tests

- [x] Run `go test ./core/capability/agent/...` — unit tests with fake providers.
- [x] Run `go test ./core/capability/persona/...` — unit tests with MemoryStore.
- [x] Run `go test ./...` — full suite, verify no regressions from ported code.

### C4: Integration testing with real provider

- [x] Start Omega server with `go run ./cmd/omega`.
- [x] Run `bash dev-test/agents/run.sh` — verifies agent plan/action pipeline
      with real model provider. Note: this spends real money; usage is reported
      at the end via `track_usage`.
- [x] Verify the dev-test exits cleanly and reports cost.

---

## Phase D: Known-issue fixes (deferred — separate commits)

- [x] **Task state race** — make `BeginRun` atomic in SQLite:
      `UPDATE agent_tasks SET state = 'running' WHERE id = ? AND state = 'queued' RETURNING *`.
- [x] **Crash recovery** — add heartbeat reaper:
      `UPDATE agent_tasks SET state = 'stale', heartbeat_at = '' WHERE state = 'running'
       AND heartbeat_at < ?`. Register as periodic job.
- [x] **RunJob error classification** — return actual error from `RunJob` for
      infrastructure failures (not business failures).
- [x] **SetDefaultPersona validation** — add existence check in SQLite
      `SetDefaultPersona` before upsert.

---

## Interface compatibility verification

- [x] Verify `*intelligence.Intelligence` satisfies `agent.Intelligence`:
  - [x] `ReasonJSON(ctx, ReasonRequest, json.RawMessage) (Result, error)` matches.
  - [x] `ReasonWithToolsJSON(ctx, ToolRequest, json.RawMessage) (ToolResponse, error)` matches.
- [x] Verify `*knowledge.Knowledge` satisfies `agent.Knowledge`:
  - [x] `Retrieve(ctx, projectID string, query string, topK int) (RetrieveResult, error)` matches.
  - [x] `SearchTool(projectID string) intelligence.ToolBinding` matches.
- [x] Verify `*persona.Personas` satisfies `agent.PersonaResolver`:
  - [x] `Resolve(Scope, Selection) (Snapshot, error)` matches.
- [x] Verify `*sqlite.Store` satisfies `agent.TaskStore` — confirmed by
      compile-time assertion added in B1.
- [x] Verify `*sqlite.Store` satisfies `persona.Store` — confirmed by
      compile-time assertion added in B1.
- [x] Verify `*sqlite.Store` satisfies `persona.Store` — confirmed by
      compile-time assertion added in B1.

### Additional handler tests

- [x] `core/handlers/agent/agent_test.go` — 11 tests: create plan/action, reader rejection, missing objective/persona, empty list, get not found, cross-project isolation, accept plan on action task, accept plan reader rejected, list with tasks.
- [x] `core/handlers/persona/persona_test.go` — 11 tests: create+list, get, get not found, update, delete, cannot delete general, default flow (General → Custom), versions, tasks history, revise, reader rejected.

### Additional transport tests

- [x] `TestAgentTaskEndpoints` — route round-trip: list, create plan (state="queued"), get, list after create, create action, cross-project get returns 404.
- [x] `TestPersonaEndpoints` — route round-trip: list, default, create, get, update (version 2), versions list, version get, tasks, set default, verify default, delete, get after delete returns 404.
