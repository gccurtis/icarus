---
title: "Execute Ω-025 — Migrate Chat to a revisioned turn-tree aggregate"
packet_id: "Ω-025"
status: "ready-for-execution"
wave: "Wave 2 — Implement every resource capability"
depends_on: "Ω-008, Ω-010, Ω-011, Ω-015, Ω-020"
source_mirror: "docs/current-docs/notion/work-packets/omega-025-migrate-chat-to-a-revisioned-turn-tree-aggregate.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-025 — Migrate Chat to a revisioned turn-tree aggregate

## Mission

Chat becomes a first-class revisioned Resource. Its canonical unit is a Turn: one user prompt plus its assistant response state. Turns form a stable-ID tree so retry, edit/fork, and branch selection never rewrite history. A prompt and pending run are reserved atomically before model work; success or failure is durably finalized. Provider failure can no longer leave an unexplained unmatched message.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-008, Ω-010, Ω-011, Ω-015, Ω-020**.

Source dependency statement: Ω-008, Ω-010, Ω-011, Ω-015, Ω-020.

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
- `docs/current-docs/notion/work-packets/omega-025-migrate-chat-to-a-revisioned-turn-tree-aggregate.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/chat/chat.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/chat` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/sqlite_chat.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-025-migrate-chat-to-a-revisioned-turn-tree-aggregate.md`

<callout icon="📖" color="blue_bg">
	**Exact-read family requirement.** Register revisioned Chat with Ω-015's readable-family contract. A deterministic `chat-transcript/v1` representation carries stable Chat/Turn/Prompt/Response IDs, branch/parent metadata, accepted revision, and bounded paging. Access and exact reading do not depend on whether any turn was published to Knowledge.
</callout>
**Type:** Supporting  
**Wave:** 2 — Implement every resource capability  
**Gate:** Project Backend Complete  
**Depends on:** Ω-008, Ω-010, Ω-011, Ω-015, Ω-020  
**Unblocks:** Ω-026, Ω-027, Ω-028, Ω-031
## Outcome
Chat becomes a first-class revisioned Resource. Its canonical unit is a Turn:
one user prompt plus its assistant response state. Turns form a stable-ID tree
so retry, edit/fork, and branch selection never rewrite history. A prompt and
pending run are reserved atomically before model work; success or failure is
durably finalized. Provider failure can no longer leave an unexplained unmatched
message.
## Current evidence
- `core/capability/chat/chat.go` stores a Chat and an ordered stream of individual
	messages.
- `PostTurn` currently inserts the user turn, invokes the engine, inserts the
	assistant turn, and touches the chat in separate operations.
- There is no Chat revision, ChangeSet, idempotency key, transaction spanning
	prompt/run reservation, branch model, or retry/fork structure.
- Concurrent posts may interleave, and an engine failure can leave a lone user
	message.
- Chat is not registered as a Resource family.
## Before and after
```plain text
Before
agent_chats + linear agent_chat_turns
PostTurn: insert → model call → insert

After
core/capability/chat/
  model.go operations.go apply.go service.go
  execution.go store.go history.go projection.go errors.go
chat aggregate + turn tree + durable run reservation
Resource family + revision/CAS/idempotency
```
## Scope
- Revisioned Chat/Turn model and active branch.
- Atomic prompt + pending-run reservation.
- Retry/fork/edit-title/archive/delete operations.
- ChangeSets, idempotency, history, migration of current chats.
- Resource family, bounded projections, and core HTTP surface.
## Non-goals
- Full context/persona/tool execution and streaming are Ω-026.
- No hidden chain-of-thought storage or exposure.
- No cross-chat branch merge.
- No audio/video messages.
## Governing invariants
1. Turn IDs are stable; branch position is derived from parent links.
2. A Turn contains one prompt and at most one canonical response for its Run.
3. Retry creates a sibling Turn/Run branch; it never overwrites the prior
	response.
4. The active leaf must be reachable from a root and determines the displayed
	branch.
5. Prompt reservation and Run creation commit atomically at revision N+1.
6. Provider work happens outside the aggregate transaction.
7. Finalization targets one pending Run and uses revision/status CAS.
8. Failure and cancellation are durable typed states with safe diagnostics.
9. Idempotent replay never starts a second provider Run.
10. Hidden prompts, reasoning, credentials, and raw tool secrets are not
	canonical Chat content.
## Core model
```go
type Chat struct {
    ID            string
    ProjectID     string
    Name          string
    Revision      int64
    SchemaVersion int
    RootTurnIDs   []string
    ActiveLeafID  string
    Turns         map[string]Turn
    ArchivedAt    *time.Time
    CreatedAt     time.Time
    UpdatedAt     time.Time
}

type Turn struct {
    ID           string
    ParentTurnID string
    Prompt       Message
    Response     *Message
    RunID        string
    Status       string // pending | running | complete | failed | cancelled | needs_input
    Error        *PublicFailure
    CreatedBy    string
    CreatedAt    time.Time
    CompletedAt  *time.Time
}

type Message struct {
    Parts []MessagePart // text | file_ref | resource_ref; image/audio excluded here
}

type ChatRun struct {
    ID             string
    ChatID         string
    TurnID         string
    Attempt        int
    Status         string
    IdempotencyKey string
    InputHash      string
    LeaseOwner     string
    LeaseUntil     *time.Time
    CreatedAt      time.Time
    UpdatedAt      time.Time
}
```
## Persistence
```sql
CREATE TABLE chats_v2 (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  active_leaf_id TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE chat_turns_v2 (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  parent_turn_id TEXT,
  prompt_json TEXT NOT NULL,
  response_json TEXT,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL,
  public_error_json TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(chat_id) REFERENCES chats_v2(id) ON DELETE CASCADE
);

CREATE TABLE chat_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  lease_owner TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, chat_id, idempotency_key)
);
```
Add `chat_changesets` and `chat_submissions` with the same revision/idempotency
contract as other aggregates. Keep large run/tool event payloads outside the
canonical snapshot.
## HTTP surface
```javascript
POST   /chats
GET    /chats
GET    /chats/:chatID
PATCH  /chats/:chatID
DELETE /chats/:chatID
POST   /chats/:chatID/turns
POST   /chats/:chatID/turns/:turnID/retry
POST   /chats/:chatID/turns/:turnID/fork
PUT    /chats/:chatID/active-leaf
GET    /chats/:chatID/history
POST   /chats/:chatID/changes/:changeSetID/undo
POST   /chats/:chatID/changes/:changeSetID/redo
```
## Ordered implementation tasks
1. Freeze schema, state machine, operation union, error codes, and limits.
2. Implement pure tree validation/apply/inverse and branch projections.
3. Implement atomic reserve/finalize/fail/cancel store methods with CAS,
	idempotency, lease, and recovery tests.
4. Add v2 SQLite tables and migrate linear chat fixtures.
5. Add Resource family, lifecycle, history, and bounded active-branch/tree
	projections.
6. Add routes, centralized access guard, serial keys, and operation map.
7. Adapt the existing engine behind the run worker while retaining current
	behavior.
8. Add backend live/migration/recovery suites and companions.
## Security, concurrency, jobs, and observability
- Post permission and every referenced File/Resource are checked before
	reservation and again before use.
- Run workers lease rows and publish only while the lease and pending state
	remain valid.
- Two simultaneous posts at one leaf either form explicit sibling branches or
	one conflicts by declared policy; they never silently interleave.
- Public errors contain stable codes; provider causes stay in redacted logs.
- Emit run state/duration/attempt/lease recovery, branch count, revision
	conflicts, idempotent replay, token usage, and safe failure class.
## Verification
- Tree acyclicity/reachability and active-leaf properties.
- Atomic failure injection at every reservation/finalization statement.
- Concurrent post/retry/fork and stale worker publish.
- Provider failure produces a visible failed Turn, not an orphan prompt.
- Migration: pair alternating legacy user/assistant rows; preserve unmatched user
	rows as failed/pending-recovery turns with explicit status.
- Negative authorization and reference access.
- Backend E2E: post, fail, retry sibling, switch branch, reload/restart, history,
	undo/redo.
## Migration and rollback
Dual-read migration:
1. create v2 tables;
2. migrate each Chat atomically in stable timestamp/ID order;
3. compare linear active-branch projections;
4. switch writes to v2;
5. park legacy tables through the rollback window.
Do not dual-write two different concurrency models. Rollback before cutover
uses legacy data; after v2-only writes, restore backup or use a reviewed
down-projection that explicitly drops branches—never silently.
## Completion evidence
- Migration reconciliation accounts for every legacy chat/message.
- Run failure/recovery/race/idempotency suites pass.
- Chat Resource and active-branch backend E2E pass.
- No hidden reasoning is stored or returned.
## Sources
- `core/capability/chat/chat.go`
- `core/platform/storage/sqlite/sqlite_chat.go`
- `core/handlers/chat`
- Taurus Yesod Model — Chat capability
- Chat Context/Inspector Panel pages
---

