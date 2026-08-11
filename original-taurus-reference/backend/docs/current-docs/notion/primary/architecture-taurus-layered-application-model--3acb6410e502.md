---
title: "Architecture — Taurus Layered Application Model"
notion_page_id: "3acb6410e502812bb4e0ff2c91ff753f"
notion_url: "https://app.notion.com/3acb6410e502812bb4e0ff2c91ff753f"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 22:22:55Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — Taurus Layered Application Model

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🔒" color="green_bg">
	**Frozen baseline — 30 July 2026.** Treat Omega main [`50efd184`](https://github.com/gccurtis/taurus-omega/commit/50efd18413cc47935033889e51d58e9c828733e2) as current truth. The target is a modular monolith with enforceable hexagonal/ports-and-adapters boundaries. Capability domains own policy/types/ports; handlers and Agent tool schemas are inbound adapters; concrete database, job, logging, HTTP, filesystem, provider, and model integrations remain outside. Current imports that violate this target are migration work in Ω-004, not evidence that the boundary is optional. Knowledge owns semantic search; Resource/application owns canonical exact reading.
</callout>
<callout icon="🏛️" color="blue_bg">
	**Governing application architecture.** Taurus is split into a control plane and a user-bound project execution plane. Alpha is an optimistic projection of Omega. Omega remains authoritative. Runtime cells organize execution and resource ownership; they never replace durable authorization, database revisions, or canonical storage.
</callout>
## Architectural outcome
The production model is:
```plain text
Taurus Alpha
  └─ authenticated requests + optimistic projections
       └─ Taurus Omega control plane
            ├─ identity, sessions, organizations, licenses, entitlements
            ├─ project discovery and per-operation admission
            └─ User Cell registry
                 └─ User Cell (UserID)
                      ├─ user libraries, agent activity, user orchestration
                      └─ Project Subcell (UserID, ProjectID)
                           ├─ workspace and open-session state
                           ├─ user-bound project commands and projections
                           ├─ live subscriptions and durable cursors
                           └─ capability calls scoped to UserID + ProjectID

Canonical data plane
  ├─ PostgreSQL revisions, change sets, grants, jobs, activity, outbox
  └─ object storage for immutable and derived binary objects
```
Alice and Bob working in the same Project do **not** share a runtime Project Cell. Alice uses `(Alice, Project A)` and Bob uses `(Bob, Project A)`. Their accepted changes converge because both subcells read and write the same Project-owned aggregates through expected-revision/CAS contracts and consume the same durable Project change stream.
## Layer 1 — Taurus Alpha
Alpha owns presentation and immediate interaction:
- render authoritative snapshots and incremental changes from Omega;
- apply bounded optimistic changes with client operation IDs;
- reconcile accepted, rejected, superseded, and stale results;
- maintain temporary view state that has no product meaning;
- never invent authorization, revisions, canonical history, or durable resource state.
Alpha may keep multiple browser connections. All connections for one User address the same logical User Cell, and all connections for the same `(UserID, ProjectID)` address the same logical Project Subcell. Physical affinity is an optimization, not a correctness requirement.
## Layer 2 — Enterprise control plane
The control plane owns identity and permission to enter or act:
- a User is the authenticating human;
- Organizations are ownership, policy, grant, and administration principals, not shared login identities;
- sessions establish `SubjectUserID`;
- every Project operation names `ProjectID` and `Action` explicitly;
- admission resolves current ownership, membership, grants, policy, license, entitlement, and access epoch;
- revocation blocks new operations immediately; long work reauthorizes before publication;
- capabilities receive a bounded access context, not the full enterprise model.
The control plane does not own document editing, spreadsheet formulas, slide operations, chat turns, Knowledge ingestion, or other Project capability behavior.
## Layer 3 — User Cell
A User Cell is the logical runtime root for one authenticated User.
```go
type UserCellKey struct {
    UserID UserID
}

type UserCell interface {
    UserID() UserID
    Project(ctx context.Context, admission ProjectAdmission) (ProjectSubcell, error)
    Libraries() UserLibraryFacade
    Agents() UserAgentFacade
}
```
The User Cell:
- owns the registry of that User's active Project Subcells;
- coordinates user-level Personality, Context, and Template libraries;
- exposes user-level Agent activity and question/steering interactions;
- bounds connection, subscription, and in-memory cache use;
- is disposable and rehydrates from canonical stores after restart or eviction.
One User may have several physical client connections but one logical User Cell. Implementations may temporarily instantiate more than one physical copy during retry, failover, or horizontal routing; correctness must not depend on process uniqueness.
## Layer 4 — Project Subcell
A Project Subcell is a user-bound execution context:
```go
type ProjectSubcellKey struct {
    UserID    UserID
    ProjectID ProjectID
}

type ProjectSubcell interface {
    Scope() ProjectScope
    Execute(ctx context.Context, admission ProjectAdmission, command Command) (Result, error)
    Subscribe(ctx context.Context, after ChangeCursor) (ChangeStream, error)
    Close(ctx context.Context) error
}
```
It owns the runtime concerns specific to one User's work in one Project:
- typed Workspace state and open tab/panel restoration;
- user-visible undo coordination;
- project command dispatch with fixed `UserID` and `ProjectID`;
- live subscriptions, presence connections, and durable change cursors;
- bounded caches and adapters for Project capabilities.
It does not own shared Project truth in memory. It may cache snapshots only with their revision and must invalidate or refresh them when the durable stream advances.
## Layer 5 — Capabilities and canonical data
Capability services remain independently testable and accept explicit scope:
```go
type ProjectScope struct {
    SubjectUserID UserID
    ProjectID     ProjectID
    AccessEpoch   int64
    RequestID     string
}

type RevisionedCommand struct {
    CommandID       string
    ExpectedRevision int64
    Payload          json.RawMessage
}
```
Every accepted mutation:
1. checks current admission and action;
2. validates the expected aggregate revision;
3. commits canonical state, immutable ChangeSet, Activity, and Outbox record atomically;
4. returns the accepted revision and durable cursor;
5. signals live consumers only after commit.
Process-local keyed mutexes may reduce contention, but database revision/CAS is the concurrency authority.
## Synchronization model
Revisioned persistence prevents conflicting writes. It does not deliver committed changes to another active subcell. Taurus therefore uses a durable change/outbox stream:
```sql
CREATE TABLE project_change_outbox (
    cursor          BIGSERIAL PRIMARY KEY,
    project_id      UUID NOT NULL,
    aggregate_type  TEXT NOT NULL,
    aggregate_id    UUID NOT NULL,
    revision        BIGINT NOT NULL,
    change_set_id   UUID NOT NULL UNIQUE,
    actor_user_id   UUID,
    committed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload_ref     TEXT
);

CREATE INDEX project_change_outbox_project_cursor
    ON project_change_outbox(project_id, cursor);
```
The outbox row is the durable record. An in-process signal on one node, PostgreSQL `NOTIFY`, or a later open-source pub/sub adapter is only a wake-up hint. Consumers resume by cursor, query missed rows, and fall back to a snapshot if their cursor is older than retained history.
## Scalability properties
- **Application nodes:** stateless HTTP nodes can scale horizontally because durable truth is outside the cell.
- **Affinity:** routing a User to one node reduces duplicate warm state, but retries may land elsewhere safely.
- **Shared projects:** collaborators do not contend on a shared runtime cell; only simultaneous writes to the same aggregate serialize through CAS.
- **Database:** tables and indexes carry `project_id` and/or `user_id`; Project-owned data may later be partitioned or sharded by `project_id` behind store ports.
- **Jobs:** durable jobs carry `ProjectID`, actor/service identity, idempotency key, and authorization version. They execute without requiring an interactive cell to remain resident.
- **Presence:** ephemeral TTL state is keyed by `(ProjectID, UserID, ConnectionID)` and never becomes canonical authorization or resource truth.
## Governing invariants
1. Alpha is a projection; Omega is authoritative.
2. A User Cell is keyed by `UserID`.
3. A Project Subcell is keyed by `(UserID, ProjectID)`.
4. Different Users never share a Project Subcell.
5. The same User does not create independent logical subcells for separate devices.
6. Project data is canonical in revisioned stores, not cell memory.
7. Every Project operation is explicitly scoped and freshly admitted.
8. Database CAS/idempotency protects writes; durable cursors/outbox protect convergence and catch-up.
9. Cell eviction, restart, failover, or duplicate physical instantiation cannot lose accepted work.
10. Control-plane evolution does not change capability internals; capability evolution does not bypass the control plane.
## Rejected alternatives
- **One shared Project Cell per Project:** contradicts the intended user-first topology, concentrates all collaborators in a runtime bottleneck, and unnecessarily couples Project placement to correctness.
- **One Project Subcell per browser tab or device:** duplicates user-bound Workspace state and makes undo/session continuity ambiguous.
- **Session-selected Project as authorization:** navigation state is not an access decision.
- **Cells as canonical stores:** process loss would become data loss and horizontal scaling would require distributed memory coordination.
- **Notifications as the change log:** live signals may be delayed, duplicated, or lost; the committed outbox/cursor remains authoritative.
## Related governing pages
- Architecture — User Cell & Project Subcell Runtime
- Architecture — Enterprise Control Plane
- Deployment — Taurus Topology & Scaling Model
- Implementation — Control Plane, User Cell & Project Subcell Integration
- Program — Taurus Omega Backend Completion Work Packets

