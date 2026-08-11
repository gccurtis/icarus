---
title: "Work Packet — Ω-025 — Migrate Chat to a revisioned turn-tree aggregate"
notion_page_id: "3acb6410e502819daf6ac7c1a67c5165"
notion_url: "https://app.notion.com/3acb6410e502819daf6ac7c1a67c5165"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:59:38Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-025 — Migrate Chat to a revisioned turn-tree aggregate

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

