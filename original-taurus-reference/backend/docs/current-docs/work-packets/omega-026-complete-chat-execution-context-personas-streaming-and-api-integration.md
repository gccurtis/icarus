---
title: "Execute Ω-026 — Complete Chat execution, context, personas, streaming, and API integration"
packet_id: "Ω-026"
status: "ready-for-execution"
wave: "Wave 2 — Implement every resource capability"
depends_on: "Ω-009, Ω-014, Ω-015, Ω-019, Ω-020, Ω-025"
source_mirror: "docs/current-docs/notion/work-packets/omega-026-complete-chat-execution-context-personas-streaming-and-api-integration.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-026 — Complete Chat execution, context, personas, streaming, and API integration

## Mission

Chat is a complete Project backend: it executes durable Turns using explicit Context, Personality/Persona versions, attachments, and caller-authorized Agent tools; streams resumable public events; supports cancel, retry, fork, and needs-user-input; exposes all bounded projections Alpha needs; and publishes canonical Chat text to the Text lattice.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-009, Ω-014, Ω-015, Ω-019, Ω-020, Ω-025**.

Source dependency statement: Ω-009, Ω-014, Ω-015, Ω-019, Ω-020, Ω-025.

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
- `docs/current-docs/notion/work-packets/omega-026-complete-chat-execution-context-personas-streaming-and-api-integration.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/agent` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/chat` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/context` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/file` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/knowledge` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/persona` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-026-complete-chat-execution-context-personas-streaming-and-api-integration.md`

**Type:** Supporting  
**Wave:** 2 — Implement every resource capability  
**Gate:** Project Backend Complete  
**Depends on:** Ω-009, Ω-014, Ω-015, Ω-019, Ω-020, Ω-025  
**Unblocks:** Ω-027, Ω-028, Ω-031, Ω-039
## Outcome
Chat is a complete Project backend: it executes durable Turns using explicit
Context, Personality/Persona versions, attachments, and caller-authorized Agent
tools; streams resumable public events; supports cancel, retry, fork, and
needs-user-input; exposes all bounded projections Alpha needs; and publishes
canonical Chat text to the Text lattice.
## Scope
- Version-pinned Persona and Context bindings.
- Attachment/reference policy and prompt assembly.
- Durable run/tool/public-event log and resumable SSE.
- Cancel, retry, fork, answer-needs-input, and safe failure recovery.
- Agent tool registry, token/cost budgets, evidence records.
- Text-lattice projection of the selected canonical branch.
- Complete Resource/Activity/History/Workspace/API integration.
## Non-goals
- No chain-of-thought exposure.
- No audio/video/image-understanding inside Chat V1; images may be referenced as
	Media artifacts after Ω-030/Ω-031.
- No user-level library migration; Ω-039.
- No WebSocket requirement; SSE plus ordinary commands is sufficient.
## Governing invariants
1. A Run captures immutable versions of Persona, Context resolution, model
	route, tool policy, and source branch.
2. Prompt assembly includes only caller-authorized content.
3. Retrieval evidence is re-authorized at retrieval and hydration.
4. Tool arguments never supply trusted Project/user scope.
5. Public events are durable, monotonically sequenced per Chat, resumable, and
	safe to deliver at least once.
6. Only final canonical response content enters the Chat aggregate/Text lattice;
	transient chunks do not.
7. Cancellation is cooperative and durable; a late worker cannot finalize.
8. Needs-user-input suspends without losing the Run and can be answered once
	idempotently.
9. Streaming never exposes provider prompts, hidden instructions, credentials,
	raw internal errors, or reasoning.
## Run snapshot and event model
```go
type RunSnapshot struct {
    RunID              string
    ChatRevision       int64
    ParentTurnID       string
    PersonaVersionRef  *VersionRef
    ContextSnapshotRef *VersionRef
    AttachmentRefs     []AuthorizedRef
    ModelRoute         string
    ToolPolicyVersion  string
    MaxInputTokens     int
    MaxOutputTokens    int
    MaxToolCalls       int
}

type PublicChatEvent struct {
    ChatID    string
    Sequence  int64
    RunID     string
    TurnID    string
    Kind      string // run_started | response_delta | tool_status |
                     // needs_input | completed | failed | cancelled
    Payload   json.RawMessage
    CreatedAt time.Time
}
```
Persist:
```sql
CREATE TABLE chat_public_events (
  project_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  run_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(project_id, chat_id, sequence)
);

CREATE INDEX idx_chat_events_run
  ON chat_public_events(project_id, chat_id, run_id, sequence);
```
Retention may compact response deltas after completion only when the canonical
response remains and reconnect semantics are preserved.
## HTTP additions
```javascript
POST /chats/:chatID/runs/:runID/cancel
POST /chats/:chatID/runs/:runID/answer
GET  /chats/:chatID/runs/:runID
GET  /chats/:chatID/events?after=:sequence
PUT  /chats/:chatID/persona
PUT  /chats/:chatID/context
POST /chats/:chatID/attachments
GET  /chats/:chatID/attachments
DELETE /chats/:chatID/attachments/:attachmentID
```
SSE uses `id: <sequence>` and supports `Last-Event-ID`. Authorization is checked
at connection, on replay pages, and when serving referenced content.
## Ordered implementation tasks
1. Freeze prompt-assembly, RunSnapshot, tool-policy, event, and error schemas.
2. Implement narrow Persona, Context, File, Resource, Knowledge, and Agent tool
	ports in wiring; leaf capabilities do not import one another.
3. Implement durable worker lease/retry/cancel/needs-input state machine.
4. Add provider streaming adapter and persist sanitized public events before
	delivery.
5. Add resumable SSE with bounded replay, heartbeat, backpressure, and event
	compaction.
6. Add attachment/reference authorization and immutable run snapshots.
7. Add caller-aware tools/evidence, budgets, cost telemetry, and safe audit.
8. Publish completed active-branch text through Ω-016/Ω-028 translator.
9. Complete routes, projections, operation map, Alpha fixtures, and live suites.
## Security, concurrency, jobs, and observability
- Treat all source text, retrieved data, file names, and tool output as
	untrusted prompt content; system/tool policy remains structurally separated.
- Enforce resource access at snapshot time and immediately before every read.
- Do not store raw provider request bodies when they contain private context.
- Per-run and per-Project concurrency, token, duration, tool-call, and output
	limits are typed.
- Reconnect cannot bypass access revoked after event creation.
- Emit queue/lease lag, first-token/complete latency, reconnects, replay count,
	backpressure disconnects, tool calls, tokens/cost, cancellation latency,
	retrieval kinds, and redacted failure class.
## Verification
- Prompt snapshots remain stable when Persona/Context later changes.
- Restricted resources never enter prompts, evidence, events, or Text lattice.
- Event persistence precedes delivery; disconnect/reconnect yields ordered
	at-least-once replay without gaps.
- Cancel/finalize and answer/timeout races.
- Provider timeout/rate-limit/failure and process crash recovery.
- Prompt-injection fixtures cannot alter trusted scope/tool policy.
- Load: concurrent chats, slow subscribers, bounded replay/event retention.
- Backend E2E: bind persona/context, attach, post, stream, tool, ask user,
	answer, complete, retrieve branch after restart.
## Migration and rollback
Add run snapshot/event tables after Ω-025. Existing migrated Turns have no
public delta log and remain readable. Streaming can be disabled independently
while canonical runs continue. Derived event rows may be compacted or discarded
after canonical response commit; Run snapshots/evidence are not discardable
until retention policy allows.
## Completion evidence
- Full Chat contract and Alpha request fixtures pass.
- Negative-security and reconnect/recovery tests are attached.
- A backend-only live demonstration completes a grounded Chat through restart.
- Metrics show bounded concurrency and cost.
## Sources
- Taurus Yesod Model — Chat capability
- Chat Context/Inspector Panel pages
- `core/capability/chat`
- `core/capability/agent`
- `core/capability/persona`
- `core/capability/context`
- `core/capability/knowledge`
- `core/capability/file`
---

