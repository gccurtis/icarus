---
title: "Work Packet — Ω-026 — Complete Chat execution, context, personas, streaming, and API integration"
notion_page_id: "3acb6410e5028166993cc73270ff625e"
notion_url: "https://app.notion.com/3acb6410e5028166993cc73270ff625e"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:59:38Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-026 — Complete Chat execution, context, personas, streaming, and API integration

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

