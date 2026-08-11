---
title: "Work Packet — Ω-014 — Make jobs, collaboration, and live delivery subcell-safe"
notion_page_id: "3adb6410e50281618bc7f02bda0e3670"
notion_url: "https://app.notion.com/3adb6410e50281618bc7f02bda0e3670"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 00:01:21Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-014 — Make jobs, collaboration, and live delivery subcell-safe

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="⚙️" color="orange_bg">
	**Frozen-baseline addendum.** Keep one shared durable worker pool, but every job carries Project ID, initiating User/system actor, authorization/action identity, idempotency/correlation, entitlement/budget snapshot, and reauthorization policy. Presence/live delivery distinguishes `ConnectionID` from logical `(UserID, ProjectID)`; closing one device cannot close all of that user's connections. Pass cancellation through read/embed/provider/store boundaries. Add an optional provider-neutral offline `BatchEmbedder` for large durable ingests; synchronous micro-batching remains the fallback and all partial usage is durable.
</callout>
<callout icon="🔄" color="blue_bg">
	**Queued — Wave 1.** Make collaboration correct across distinct User×Project subcells by combining revision/CAS with a durable Project change/outbox cursor. Repair jobs, presence, and live delivery without requiring a shared Project runtime.
</callout>
## Outcome
Every accepted Project mutation publishes one durable, cursor-addressable change in the same transaction as canonical state. Active Project Subcells receive post-commit wake-ups and catch up from that stream. Durable jobs execute independently of interactive cells, and presence remains bounded ephemeral state.
## Dependencies
- Ω-009/Ω-010 caller-aware access and wire contracts.
- Ω-011 explicit Project admission.
- Ω-012 Workspace revision/cursor behavior.
- Ω-013 User Cell and Project Subcell registries.
## Scope
- common `ProjectChange`/outbox schema and store;
- atomic state + ChangeSet + Activity + idempotency + outbox publication;
- durable Project cursor and `ListAfter`;
- local wake-up hub and reconnect/catch-up protocol;
- snapshot fallback after retained history;
- durable job envelope, leases, retries, reauthorization, idempotent publication;
- presence keyed by Project, User, Connection with TTL;
- live progress/completion delivery through Activity/outbox;
- dropped, duplicate, out-of-order, restart, and revocation proof.
## Non-goals
- No notification-only canonical event system.
- No shared Project Cell.
- No distributed Project placement/fencing.
- No requirement for a multi-node broker in P1.
- No durable presence.
- No chain-of-thought or provider-secret event payloads.
## Core persistence
```sql
CREATE TABLE project_change_outbox (
    cursor          BIGSERIAL PRIMARY KEY,
    project_id      UUID NOT NULL,
    aggregate_type  TEXT NOT NULL,
    aggregate_id    UUID NOT NULL,
    revision        BIGINT NOT NULL,
    change_set_id   UUID NOT NULL UNIQUE,
    actor_user_id   UUID,
    action          TEXT NOT NULL,
    committed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload_ref     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX project_change_outbox_project_cursor
    ON project_change_outbox(project_id, cursor);
```
SQLite uses an equivalent monotonic cursor contract. Migration and store-contract tests prove parity.
```go
type ProjectChange struct {
    Cursor        ChangeCursor
    ProjectID     ProjectID
    AggregateType string
    AggregateID   string
    Revision      int64
    ChangeSetID   string
    ActorUserID   *UserID
    Action        Action
    CommittedAt   time.Time
    PayloadRef    *ObjectRef
}

type ProjectChangeStore interface {
    ListAfter(ctx context.Context, projectID ProjectID, after ChangeCursor, limit int) ([]ProjectChange, error)
    Latest(ctx context.Context, projectID ProjectID) (ChangeCursor, error)
}

type WakeupPublisher interface {
    PublishAfterCommit(ctx context.Context, projectID ProjectID, cursor ChangeCursor) error
}
```
## Atomic mutation rule
```go
func CommitResourceChange(ctx context.Context, tx Tx, cmd Command) (Accepted, error) {
    // 1. lock/read expected aggregate revision
    // 2. reject stale revision with typed conflict
    // 3. apply canonical state + immutable ChangeSet
    // 4. persist idempotency receipt
    // 5. append Activity
    // 6. append project_change_outbox and obtain cursor
    // 7. commit
    // 8. emit wake-up hint after commit
}
```
If wake-up emission fails after commit, the accepted response still contains the durable cursor and background/local polling retries. The change is not rolled back or lost.
## Consumer protocol
```go
for {
    changes := store.ListAfter(projectID, cursor, pageSize)
    for _, change := range changes {
        applyIdempotently(change)
        cursor = change.Cursor
    }
    waitForWakeupOrPoll()
}
```
- Cursor order is durable Project order, not a guarantee that unrelated aggregates share one revision number.
- Consumers validate per-aggregate revision continuity.
- Duplicate changes are ignored by ChangeSet ID/cursor.
- A gap triggers another durable read, never guesswork.
- If `after` precedes retained history, return `snapshot_required` with a current snapshot/cursor contract.
- Reconnection sends last acknowledged cursor.
## Wake-up adapters
P1:
- in-process fanout keyed by Project ID;
- bounded subscriber buffers;
- slow consumer closes with resume cursor rather than unbounded buffering;
- periodic catch-up protects against missed local signals.
P2:
- PostgreSQL `LISTEN/NOTIFY` or an open-source broker adapter;
- payload contains only Project/cursor key;
- subscribers still query the outbox;
- listener startup establishes `LISTEN`, commits, then reads durable state to close the initial race.
## Job model
```go
type JobEnvelope struct {
    JobID          JobID
    ProjectID      ProjectID
    ActorUserID    *UserID
    SystemActor    *SystemActor
    Action         Action
    AccessEpoch    int64
    IdempotencyKey string
    InputRef       ObjectRef
    Attempt        int
}

type JobHandler interface {
    Type() JobType
    Execute(context.Context, ProjectScope, JobEnvelope) (JobResult, error)
}
```
- jobs are store-backed and survive cell eviction/restart;
- workers claim by lease/version and renew to a bounded deadline;
- retry classification and budget are typed;
- external provider calls use idempotency where offered and Taurus receipts otherwise;
- user jobs reauthorize before publishing;
- stale/revoked results are retained diagnostically but not published;
- accepted completion writes state/Activity/outbox atomically;
- progress is throttled and not used as canonical content.
## Presence
```go
type PresenceKey struct {
    ProjectID   ProjectID
    UserID      UserID
    ConnectionID string
}
```
Presence contains safe display/projection fields only, has a TTL/heartbeat, and is removed on disconnect/expiry. Caller-aware reads redact unauthorized identities. Presence never grants access and is not replayed as canonical Project history.
## Transport
- WebSocket/SSE subscribe route includes explicit Project ID and resume cursor.
- First response states accepted cursor/snapshot revision.
- Overflow/slow-consumer close includes stable `resume_required`.
- Access epoch change terminates or reauthorizes the subscription.
- Mutating 2xx requests already update session activity; do not add a redundant observer.
- REST polling of `changes?after=` remains available for deterministic tests and recovery.
## Likely paths
- `core/capability/changefeed/`
- current aggregate store transaction paths
- `core/platform/storage/sqlite/`
- `core/platform/storage/postgres/`
- `core/platform/live/inprocess.go`
- `core/platform/live/postgres_notify.go`
- current job/worker packages
- `core/capability/presence/`
- `core/capability/activity/`
- `core/transport/`
- `core/handlers/changes/`
- `docs/architecture/runtime-model.md`
- `docs/architecture/transport.md`
## Ordered implementation
1. Inventory every mutation and current Activity/job/live path.
2. Define cursor/change contracts and stable errors.
3. Add schema/migrations and SQLite/PostgreSQL store contracts.
4. Integrate atomic outbox writes into the shared mutation boundary.
5. Build in-process wake-up hub and durable consumer protocol.
6. Add transport resume, overflow, reauthorization, and snapshot fallback.
7. Refactor jobs to durable scoped envelopes and idempotent publication.
8. Implement bounded presence.
9. Add P2 wake-up adapter behind a port only if needed for production test topology.
10. Run failure injection, race, recovery, authorization, and load proof.
## Required proof
- Alice commits through Alice×Project; Bob×Project catches up.
- dropping every wake-up for a period still converges after durable polling/reconnect.
- duplicate and out-of-order wake-ups do not double-apply or skip changes.
- two concurrent expected-revision writes produce one success and one typed conflict.
- database rollback produces neither accepted state nor outbox row.
- commit succeeds but wake-up fails; the row remains discoverable and delivery recovers.
- slow subscriber memory is bounded and receives a resume cursor.
- cell and process restart resume from durable cursor.
- job worker death, lease loss, duplicate retry, and revocation cannot double-publish.
- presence expires and cannot reveal inaccessible users/resources.
## Completion evidence
Record schema and migration IDs, contract tests on both stores, failure-injection commands, live/resume traces, job/revocation proof, load/cursor-lag measurements, baseline/completion commits, and remaining risks.

