---
title: "Execute Ω-019 — Complete the Project Agent and Task/Run runtime"
packet_id: "Ω-019"
status: "ready-for-execution"
wave: "Wave 1 — Close the Project runtime"
depends_on: "Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016, Ω-017"
source_mirror: "docs/current-docs/notion/work-packets/omega-019-complete-the-project-agent-and-task-run-runtime.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-019 — Complete the Project Agent and Task/Run runtime

## Mission

Complete the Project execution runtime for Ask, Plan, Action, and steerable background Tasks. A caller can create a Project task, choose an authorized Personality, add bounded ephemeral per-turn Context, receive a plan or answer, accept execution, observe durable runs/tool effects, answer Agent questions, steer/pause/resume/cancel/retry where valid, and recover after disconnect or server restart. Every user-initiated tool runs through the caller's named `(UserID, ProjectID)` Project Subcell with current admission, revision preconditions, usage budgets, and visible effects. This packet completes Project-scoped execution only. Personalities are called “personalities” on the frontend and may remain `persona` internally. User-level Personality/Context/Template libraries and cross-Project Agent Activity belong to Wave 5. Revisioned Chat migration remains Ω-025–Ω-026.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016, Ω-017**.

Source dependency statement: Ω-008 through Ω-017.

No later-packet integration gate was detected in the source dependency statement.

Start only after every hard predecessor is present on `main`. If a predecessor is intentionally being developed in parallel, do not guess across its contract: stop until it lands on `main` or request an agreed interface.

## Authority order

When sources disagree, use this order:

1. The latest explicit product decision from the user.
2. The current Primary documents under `docs/current-docs/notion/primary/`.
3. This execution directive and the packet-specific implementation specification below.
4. Current code, tests, migrations, and as-built architecture records on the actual starting `main`.
5. Supporting documents and frozen historical links.

`AGENTS.md` remains authoritative for repository workflow. The SHA in this file is the planning baseline, not an instruction to reset: always begin from the latest approved `main` that contains the required predecessors, and record the actual starting SHA.

## Required reading before editing

- `AGENTS.md` — repository rules; this is authoritative for workflow, validation, and documentation records.
- `docs/current-docs/README.md` — authority model and corpus layout.
- `docs/current-docs/notion/work-packets/omega-019-complete-the-project-agent-and-task-run-runtime.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-user-cell-and-project-subcell-runtime--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-chat-capability-and-runtime-contract--3abb6410e502.md`
- `docs/current-docs/notion/primary/workstreams-taurus-product-completion--3acb6410e502.md`
- `core/capability/agent/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/agent/tools/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/chat/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/contexts/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/document/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/knowledge/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/persona/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/agent/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/chat/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/sqlite_agent*.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `dev-test/agent/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

Follow links inside the embedded specification when they resolve to additional local mirrors. Search the current repository for every type, route, table, tool, and invariant named below; do not rely on an old path or assume absence without checking.

## Preflight

Before changing code:

1. Record the starting `main` HEAD SHA, merged predecessor packets, and relevant existing records.
2. Reproduce or characterize the current gap with a focused test, probe, route inventory, or schema inspection.
3. Compare the packet against current code. Preserve correct partial implementations and delete or migrate only what the specification makes obsolete.
4. Identify the capability owner, its inbound ports, outbound ports, adapters, durable state, authorization point, transaction boundary, and observability boundary.
5. Confirm every proposed third-party dependency is free/open-source, pinned, and compatible with product distribution. Prefer the standard library or existing dependencies.
6. Write the smallest ordered implementation plan that can land without leaving accepted-but-unusable intermediate states.

If the gap is already fully closed, do not manufacture changes. Prove it with the required tests/evidence, reconcile stale documentation, and produce the normal change record and a verified commit on `main`.

## Execution contract

- Stay inside this packet's scope and explicit prerequisites. Do not opportunistically implement later packets.
- Preserve the modular-monolith, ports-and-adapters boundary. User Cells and per-user Project Subcells are logical runtime scopes; durable database state, revisions, CAS/idempotency, jobs, and outbox/change streams are correctness authorities.
- Enforce authorization at the owning application service/store boundary, not only in HTTP handlers. Reads, listings, search, events, history, jobs, and model/tool hydration must be caller-aware.
- Make durable mutations atomic at the stated aggregate boundary. Couple canonical state and required outbox/audit/idempotency writes in one transaction where the specification requires it.
- Keep retries, pagination, resource limits, concurrency, shutdown, and failure behavior explicit and bounded. No correctness may depend on sticky routing or one in-memory cell.
- Add or update typed errors and stable wire mappings without leaking hidden resource existence or secrets.
- Prefer focused tests first, then implementation, then broader integration, race, recovery, and load evidence required by the specification.
- Do not add placeholder handlers, no-op adapters, unbounded defaults, silent fallbacks, or TODO-only completion.
- Do not create companion `.go.md` files; that convention is retired. Add the numbered change record required by `AGENTS.md`.

## Decision authority

You may decide internal naming, package decomposition, private helper design, migration mechanics, indexes, test fixtures, and the exact FOSS library when the packet leaves those open. Choose the smallest production-grade option consistent with existing conventions. Record every material choice and rejected alternative in the change record.

Stop and ask for direction before proceeding if any choice would:

- contradict a settled Product/Primary architecture decision or another merged packet;
- weaken tenant, user, organization, project, or resource privacy boundaries;
- introduce destructive or irreversible migration without a tested rollback/restore path;
- add a non-FOSS, source-available-only, or materially costly external dependency/service;
- change a public contract outside this packet or make a later packet impossible;
- require guessing an unmerged predecessor's interface; or
- make an acceptance criterion impossible or only cosmetically satisfied.

## Validation and evidence

Run the narrowest relevant tests while iterating. Before commit, run the repository gates from `AGENTS.md`:

```bash
./scripts/check-format.sh
go build ./...
go test ./...
```

Also run every packet-specific test, race test, integration test, migration test, recovery test, load test, or live-provider certification required below. Live-provider tests may be skipped only when the required credential is unavailable; report the skip, fixture coverage, token/cost estimate where applicable, and the exact command for a credentialed rerun. Never claim a skipped gate passed.

Review the final diff for secret leakage, hidden-resource inference, unsafe logs, accidental broad scope, stale generated files, and unclassified dependencies.

## Required deliverables

1. Production implementation and migrations/adapters required by the specification.
2. Focused and broad automated tests proving the acceptance criteria.
3. API/schema/error/operations documentation actually changed by the implementation.
4. One new numbered `docs/records/NNNN-<slug>.md` record describing baseline, decisions, files, tests, operational effects, and remaining risks.
5. A commit scoped to this packet, pushed directly to `origin/main`.

The change record and completion handoff must state:

- actual baseline SHA and prerequisite packet status;
- outcome and user-visible/operational behavior;
- architecture and data-model decisions;
- migrations, compatibility, rollback, and rollout notes;
- security/privacy analysis;
- tests and exact commands/results, including skips;
- observability and operator impact;
- unresolved risks or follow-up packets; and
- a checklist mapping every acceptance criterion below to code/tests/evidence.

## Completion response

Return a concise handoff containing: commit SHA, changed areas, test results, migration/rollout notes, record path, and any explicit residual risk. Do not report this packet complete while an acceptance criterion is unproven or a required gate is failing.

---

## Embedded implementation specification

Source mirror: `docs/current-docs/notion/work-packets/omega-019-complete-the-project-agent-and-task-run-runtime.md`

<callout icon="🤖" color="blue_bg">
	**Frozen-baseline tool correction.** Agent scope must retain the initiating User ID and current Project admission. Expose Knowledge semantic search and Resource exact reading as independent ports/tools: `knowledge.search` discovers indexed evidence; `resource.find/list/read` resolves and reads canonical current or version-pinned content. Remove model-facing `knowledge.list/read` after a compatibility period. A restricted same-Project Resource must never be listed, read, cited, traced, or sent to a model.
</callout>
## Outcome
Complete the Project execution runtime for Ask, Plan, Action, and steerable
background Tasks. A caller can create a Project task, choose an authorized
Personality, add bounded ephemeral per-turn Context, receive a plan or answer,
accept execution, observe durable runs/tool effects, answer Agent questions,
steer/pause/resume/cancel/retry where valid, and recover after disconnect or
server restart. Every user-initiated tool runs through the caller's named
`(UserID, ProjectID)` Project Subcell with current admission, revision
preconditions, usage budgets, and visible effects.
This packet completes Project-scoped execution only. Personalities are called
“personalities” on the frontend and may remain `persona` internally. User-level
Personality/Context/Template libraries and cross-Project Agent Activity belong
to Wave 5. Revisioned Chat migration remains Ω-025–Ω-026.
## As-built evidence
Omega already exposes substantial Agent and Chat behavior: create Plan/Action
tasks, list/get tasks, accept a plan, Ask turns, persona selection, attachments,
Knowledge retrieval, tools, usage, and durable jobs. Project-local personas and
the Agent/persona foundation are largely present.
Open Alpha requests and product decisions define the missing closure:
- optional per-turn `context[]`, each at most 16 KiB and 32 KiB total, treated as
	untrusted prompt material, additive to attachments, and not persisted or
	cited as evidence;
- optional per-turn Personality override resolved for that turn without mutating
	the Chat default, with resolved id/version recorded on the Agent turn;
- a durable steering exchange while a task is queued/running/waiting;
- Agent questions and user responses;
- visible Project-safe Task/Run progress and reliable Ask failure behavior;
- current permissions on every tool read/write.
## Scope
- Freeze Task, Run/attempt, exchange, question, plan, effect, usage, and terminal
	state models.
- Complete Project-scoped create/list/get and Plan acceptance.
- Add steering messages, question responses, pause/resume/cancel/retry where
	state and handler safety allow.
- Add optional per-turn Context and Personality override to Ask/Plan/Action.
- Persist resolved Personality identity/version and the durable conversation/
	steering exchange, but not ephemeral Context values.
- Execute through Ω-014 durable jobs/change publication and Ω-013 User Cell / Project Subcell scope; job leases fence attempts while revision/CAS fences accepted content.
- Validate, authorize, idempotently execute, and visibly report every Agent
	tool.
- Emit durable Task/Run events and support polling.
- Close Ask reliability using Ω-008 and automatic Document evidence using Ω-016.
- Provide a backend-only Agent demonstration.
## Non-goals
- No user-owned library persistence or sharing.
- No cross-Project `/agents/activity` aggregation; the control plane may compose
	it later from authorized Project summaries.
- No Chat turn-tree/revision rewrite.
- No autonomous privilege escalation, hidden long-running work, or unbounded
	recurring Agent.
- No arbitrary code/shell/network tool.
- No persistence or citation of per-turn ephemeral Context.
- No claim that a queued Task retains authority after the initiator loses access.
## Runtime model
```go
type Task struct {
    ID              string
    ProjectID       string
    CreatedBy       string
    Mode            TaskMode // ask, plan, action
    Objective       string
    State           TaskState
    Personality     ResolvedPersonality
    CurrentRunID    string
    AcceptedPlanRev *int64
    Revision        int64
    CreatedAt       time.Time
    UpdatedAt       time.Time
}

type TaskState string

const (
    TaskQueued      TaskState = "queued"
    TaskRunning     TaskState = "running"
    TaskWaitingUser TaskState = "waiting_user"
    TaskPaused      TaskState = "paused"
    TaskSucceeded   TaskState = "succeeded"
    TaskFailed      TaskState = "failed"
    TaskCancelled   TaskState = "cancelled"
)

type Run struct {
    ID            string
    TaskID        string
    Attempt       int
    State         RunState
    LeaseVersion  int64
    ModelIdentity string
    StartedAt     *time.Time
    FinishedAt    *time.Time
    Usage         Usage
    FailureCode   string
}
```
Only one active run owns the task lease. A retry creates a new Run; it does not
rewrite the failed attempt.
```go
type ExchangeItem struct {
    ID          string
    TaskID      string
    Kind        string // user_steering, agent_ack, agent_question, user_answer
    AuthorID    string
    Body        string
    CreatedAt   time.Time
    ConsumedRun string
}

type AgentQuestion struct {
    ID         string
    TaskID     string
    Prompt     string
    Schema     json.RawMessage
    State      string // open, answered, withdrawn
    AnsweredAt *time.Time
}
```
Question schemas permit bounded text, choice, boolean, and structured fields
needed by current tasks; they are not executable UI definitions.
## Turn input contracts
```go
type TurnContextItem struct {
    Label string `json:"label"`
    Text  string `json:"text"`
}

type AgentInput struct {
    Objective     string
    Context       []TurnContextItem
    PersonalityID string
    Attachments   []AttachmentRef
    IdempotencyKey string
}
```
Validation:
- each Context item ≤ 16 KiB UTF-8 bytes;
- all Context items together ≤ 32 KiB;
- item count and label bytes have small explicit limits;
- Context is delimited as untrusted user-provided material, is not inserted into
	Knowledge, does not create citations, is not stored in task/chat/usage/logs,
	and disappears after the turn/run input is assembled;
- attachments remain authorized references with their own provenance;
- Personality override is optional, access-checked, version-resolved once for
	the turn, and recorded on the resulting Agent turn/Task. It never changes the
	Chat's configured default.
## Project API
```plain text
POST /projects/:projectID/agent/tasks
GET  /projects/:projectID/agent/tasks?state=&cursor=&limit=
GET  /projects/:projectID/agent/tasks/:taskID
POST /projects/:projectID/agent/tasks/:taskID/accept-plan
POST /projects/:projectID/agent/tasks/:taskID/messages
POST /projects/:projectID/agent/tasks/:taskID/questions/:questionID/answer
POST /projects/:projectID/agent/tasks/:taskID/pause
POST /projects/:projectID/agent/tasks/:taskID/resume
POST /projects/:projectID/agent/tasks/:taskID/cancel
POST /projects/:projectID/agent/tasks/:taskID/retry
```
Retain established route spellings where compatible. Steering messages are
accepted only while queued/running/waiting/paused according to a documented
matrix. A settled Task returns `409 task.settled`; an unsafe tool phase may
acknowledge that steering will apply at the next checkpoint. Plan acceptance is
revisioned and idempotent.
## Tool contract
```go
type ToolContext struct {
    Scope        ProjectScope
    TaskID       string
    RunID        string
    LeaseVersion int64
    Budget       ToolBudget
}

type Tool interface {
    Descriptor() ToolDescriptor
    Validate(json.RawMessage) error
    Execute(context.Context, ToolContext, json.RawMessage) (ToolResult, error)
}
```
Every read uses Ω-009 caller-aware scope. Every write uses the target
capability's expected revision/idempotency and returns a Resource/Activity
effect. A model's tool call cannot supply Project/caller identity, arbitrary
path, raw SQL, or unrestricted URL. Before a write commits, the runner verifies
the active lease/fence, cancellation state, current initiator authority, target
access, and remaining budget.
## Likely paths
- `core/capability/agent/`
- `core/capability/agent/tools/`
- `core/capability/chat/`
- current durable job/worker package
- `core/capability/persona/`
- `core/capability/contexts/`
- `core/capability/knowledge/`
- `core/capability/document/`
- `core/handlers/agent/`
- `core/handlers/chat/`
- `core/platform/storage/sqlite/sqlite_agent*.go`
- `dev-test/agent/`
## Ordered implementation
1. Inventory all current Agent/Chat task routes, tables, job handlers, state
	values, tools, persona/context/attachment flows, and tests. Freeze the target
	state-transition and authorization matrices before schema changes.
2. Add versioned Task, Run, exchange, question, plan, effect, and usage
	persistence. Migrate current tasks without rewriting successful history;
	mark ambiguous states with an explicit terminal/migration code.
3. Move execution onto Ω-014 Project jobs and Ω-013 cells. One run holds the
	lease; every external/model/tool boundary is a cancellation and steering
	checkpoint; stale attempts are fenced from commit.
4. Complete create/list/get with Ω-010 cursors/redaction and explicit task
	visibility. Do not return objectives, exchanges, tool arguments, or failures
	to a caller lacking the task/target access.
5. Implement per-turn Context validation and prompt delimiting. Prove it is
	absent from persistence, retrieval sources, citations, logs, traces, events,
	and retry payloads after prompt assembly.
6. Implement per-turn Personality override. Resolve caller-visible current
	version, snapshot the versioned behavior needed for reproducibility, record
	identity/version, and leave Chat default untouched.
7. Complete Ask through Ω-008: normal answer, insufficient evidence, one bounded
	output repair, typed failure, usage, citations, and no orphan turns.
8. Complete Plan production and idempotent revision-aware acceptance. An
	accepted plan becomes immutable input to an Action run; later steering is a
	separate exchange, not silent plan mutation.
9. Implement durable steering messages and Agent acknowledgements. Drain them in
	order at safe checkpoints; record which Run consumed each. Enforce byte/rate
	limits and settled-state `409`.
10. Implement Agent questions and user answers with typed schema validation,
	transition to/from `waiting_user`, idempotent answer, withdrawal on cancel,
	timeout policy, Project event, and polling.
11. Implement pause/resume/cancel/retry only for handlers that declare safe
	checkpoints/idempotency. Cancellation stops provider requests and prevents
	later fenced writes; retry creates a new attempt with an explicit policy for
	prior exchanges and evidence revision.
12. Audit every tool. Add schema/size limits, capability authorization,
	idempotency, revision preconditions, resource effect projection, usage/time
	budget, timeout, and negative tests. Remove or disable any unrestricted tool.
13. Emit Ω-014 events for state, progress, question, acknowledgement, effect,
	usage summary, and terminal result. Keep payloads minimal/caller-aware and
	polling fully correct.
14. Build backend-only demos and live reliability/cost suites. Update Alpha
	contracts, backend guide, companions, baseline, migration/rollback notes,
	and record.
## Security, concurrency, persistence, and observability
The initiator's current authority is checked at enqueue and before protected
reads/writes. Project membership is not enough for restricted Resources. If
access is removed, the run stops at its next boundary and cannot use a cached
cell or evidence. Retrieved evidence is rechecked before model delivery and
citations.
Treat objective, steering, ephemeral Context, attachments, retrieved text, and
tool output as untrusted data. Delimit them from system/personality/tool
instructions. Validate model tool arguments exactly and allowlist tools per
mode. Secrets are injected only by server adapters and never shown to the model
unless a specific tool contract requires a redacted capability—not raw value.
Task commands use revision/idempotency and serialize by Project+Task. The durable
Run lease fences old workers; external calls record usage even if validation
later fails. Tool effect records and target mutations use one transaction/outbox
or idempotent reconciliation so a crash cannot hide or duplicate work.
Metrics include bounded mode/state/tool/failure/model labels, queue/run/wait
latency, steering lag, question age, tool duration, token/embedding usage,
repair/citation outcomes, cancellation, and fenced commits. Logs carry ids and
codes, not objectives, messages, Context, evidence, prompts, answers, or tool
payloads.
## Tests and gates
- State-machine property tests for every valid/invalid transition.
- Store contract for task/run/exchange/question/plan/effect/usage, migration,
	restart, idempotency, leases, fences, and crash recovery.
- Per-turn Context boundary tests at item/total/item-count/UTF-8 limits and byte
	scans proving zero persistence/log/event/citation retention.
- Personality default, override, version, access removal, and no-Chat-mutation
	tests.
- Ask deterministic failure matrix from Ω-008 and live 30-run terse-persona
	reliability/cost sample.
- Steering before start, during provider call, between tools, waiting, paused,
	settled, concurrent messages, rate limit, and acknowledgement order.
- Question answer schema, duplicate answer, timeout, cancel/withdraw, restart,
	and two-client tests.
- Pause/resume/cancel/retry at every effect boundary; stale worker cannot commit.
- Tool contract suite: hidden target, cross-Project id, revision conflict,
	idempotent replay, oversized arguments/output, timeout, prompt injection, and
	access revoked mid-run.
- SSE disconnect/reconnect and polling equivalence.
- Backend E2E: create evidence Document → automatic publication → Ask/cite →
	Plan → accept → Action edits Document → question/answer → steering →
	cancel/retry → restart/recover → inspect Activity/history/effects.
- Race detector, provider usage/cost output, and standard gates.
## Completion evidence
- Project Ask/Plan/Action and Task control require no Alpha or dev endpoint.
- Tasks survive restart, expose honest progress, and never commit from stale or
	unauthorized runs.
- Per-turn Context and Personality override satisfy the exact Alpha contracts.
- Every tool has capability authorization, revision/idempotency, budget, and
	negative-security evidence.
- The canonical Agent demo completes with visible, reversible Resource effects.
## Dependencies
Depends on Ω-008 through Ω-017. It supplies Task summaries consumed by Ω-018,
which must re-certify its Task section after this packet lands. It blocks the
final Project-backend demonstration and later revisioned Chat/cross-lattice
Agent work. User-library migration remains Wave 5.
## Sources
- [Alpha backend-request index](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/README.md)
- [Omega Agent capability](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/agent)
- [Model — Chat](https://app.notion.com/p/3abb6410e50281258d89d5719fa851fc)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Workstreams — Taurus Product Completion](https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd)

