---
title: "Execute Ω-014 — Make jobs, collaboration, and live delivery subcell-safe"
packet_id: "Ω-014"
status: "ready-for-execution"
wave: "Wave 1"
depends_on: "Ω-009, Ω-010, Ω-011, Ω-012, Ω-013"
source_mirror: "docs/current-docs/notion/work-packets/omega-014-make-jobs-collaboration-and-live-delivery-subcell-safe.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-014 — Make jobs, collaboration, and live delivery subcell-safe

## Mission

Every accepted Project mutation publishes one durable, cursor-addressable change in the same transaction as canonical state. Active Project Subcells receive post-commit wake-ups and catch up from that stream. Durable jobs execute independently of interactive cells, and presence remains bounded ephemeral state.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-009, Ω-010, Ω-011, Ω-012, Ω-013**.

Source dependency statement: - Ω-009/Ω-010 caller-aware access and wire contracts.
- Ω-011 explicit Project admission.
- Ω-012 Workspace revision/cursor behavior.
- Ω-013 User Cell and Project Subcell registries.

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
- `docs/current-docs/notion/work-packets/omega-014-make-jobs-collaboration-and-live-delivery-subcell-safe.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/activity/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/changefeed/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/presence/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/changes/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/live/inprocess.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/live/postgres_notify.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/postgres/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/architecture/runtime-model.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/architecture/transport.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-014-make-jobs-collaboration-and-live-delivery-subcell-safe.md`

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

