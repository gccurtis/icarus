---
title: "Architecture — User Cell & Project Subcell Runtime"
notion_page_id: "3acb6410e5028147909ef7214406baad"
notion_url: "https://app.notion.com/3acb6410e5028147909ef7214406baad"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 22:22:55Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — User Cell & Project Subcell Runtime

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="⬡" color="purple_bg">
	**Physical topology clarification.** `UserCell(UserID)` and `ProjectSubcell(UserID, ProjectID)` are logical, disposable façades hosted inside an Omega replica. A same-Project collaborator gets a different subcell because the User key differs. A user with multiple devices shares the logical key while retaining separate `ConnectionID` presence/delivery state. Cells never own private stores, workers, provider clients, or deployables; durable revision/CAS, idempotency, Workspace state, jobs, and Project outbox cursors make eviction, failover, and duplicate physical incarnations safe.
</callout>
<callout icon="🧬" color="blue_bg">
	**Runtime identity:** `UserCell(UserID) → ProjectSubcell(UserID, ProjectID)`. A Project Subcell represents one User's work in one Project. Shared Project truth converges through revisioned persistence and a durable change stream, not through one shared in-memory Project process.
</callout>
## Purpose
This page defines the logical runtime boundary, acquisition rules, lifecycle, synchronization, and scaling behavior for Taurus Omega.
## Identity and cardinality
```go
type UserCellKey struct {
    UserID string
}

type ProjectSubcellKey struct {
    UserID    string
    ProjectID string
}
```
For each active User:
- there is one logical User Cell;
- the User Cell contains at most one logical Project Subcell for each Project;
- multiple devices and tabs for that User attach to the same logical subcell;
- another User on the same Project receives a different Project Subcell.
Example:
```plain text
UserCell(Alice)
  ├─ ProjectSubcell(Alice, Helios)
  └─ ProjectSubcell(Alice, Vanguard)

UserCell(Bob)
  └─ ProjectSubcell(Bob, Helios)
```
Alice and Bob share Helios data through canonical stores, but they do not share runtime Workspace state, undo visibility, presence connections, subscriptions, or caches.
## What a User Cell owns
- User-scoped library facades for Personalities, Context, and Templates.
- User-level Agent activity, questions, answers, and steering.
- A bounded Project Subcell registry.
- User connection/session fanout and user-level event subscriptions.
- Runtime budgets, idle timers, and observability labels.
It does not cache access forever. Every operation is admitted against current control-plane state.
## What a Project Subcell owns
- fixed `SubjectUserID` and `ProjectID`;
- typed Workspace aggregate access and local projection;
- open tabs, selected tab, panel lens state, and durable Workspace cursor;
- command dispatch into Project capabilities;
- resource subscriptions and durable change cursor;
- presence connections for that User in that Project;
- bounded revision-tagged caches;
- coordination required to reveal a closed resource before user-visible undo.
The subcell is a façade and coordinator. Resource aggregates, revisions, jobs, Activity, and binary objects remain in canonical stores.
## Acquisition
```go
type UserCellRegistry interface {
    Acquire(ctx context.Context, userID UserID) (*UserCell, Release, error)
}

type UserCell struct {
    userID   UserID
    projects ProjectSubcellRegistry
    // bounded user-scoped facades and connections
}

type ProjectSubcellRegistry interface {
    Acquire(
        ctx context.Context,
        admission ProjectAdmission,
    ) (*ProjectSubcell, Release, error)
}
```
Acquisition order:
1. authenticate the User;
2. acquire the logical User Cell by `UserID`;
3. resolve fresh `ProjectAdmission` for the named `ProjectID` and `Action`;
4. acquire the User's Project Subcell by `ProjectID`;
5. execute with the bounded admission;
6. release request references while long-lived subscriptions retain their own lease.
The registry does not use existence as authorization and does not return a subcell before admission.
## Suggested in-process structure
```go
type Registry struct {
    mu    sync.Mutex
    users map[UserID]*userEntry
}

type userEntry struct {
    cell        *UserCell
    refs        int
    lastUsedAt  time.Time
}

type UserCell struct {
    mu       sync.Mutex
    userID   UserID
    projects map[ProjectID]*projectEntry
}

type projectEntry struct {
    subcell     *ProjectSubcell
    refs        int
    lastUsedAt  time.Time
}
```
Construction must be single-flight within a process. Registry maps are bounded by idle eviction and hard limits. An acquired reference prevents eviction; long work must not hold a registry mutex.
## Lifecycle
Logical states:
```plain text
absent → activating → warm → idle → evicted
                    ↘ draining → evicted
```
- **Activating:** rebuild bounded projections and durable cursors from stores.
- **Warm:** serving requests or subscriptions.
- **Idle:** no active references; eligible for eviction after TTL.
- **Draining:** reject new local subscriptions, finish bounded work, flush no canonical state because accepted state was already committed.
- **Evicted:** memory released; next acquisition rehydrates.
Eviction does not close the Project or sign out the User.
## Shared-data concurrency
Two subcells may read the same revision and attempt a change. The store decides:
```go
type AggregateStore[T any] interface {
    Load(ctx context.Context, projectID ProjectID, id ResourceID) (T, Revision, error)
    Commit(
        ctx context.Context,
        scope ProjectScope,
        id ResourceID,
        expected Revision,
        commandID CommandID,
        changes ChangeSet,
    ) (Revision, ChangeCursor, error)
}
```
`Commit` must be atomic across:
- aggregate revision/state;
- immutable ChangeSet;
- idempotency receipt;
- Activity;
- project change/outbox row.
A stale expected revision returns a typed conflict. The caller refreshes and deliberately retries or rebases; Omega never silently overwrites.
## Live convergence
```go
type ProjectChangeSource interface {
    ListAfter(
        ctx context.Context,
        projectID ProjectID,
        after ChangeCursor,
        limit int,
    ) ([]ProjectChange, error)
    Subscribe(ctx context.Context, projectID ProjectID) (<-chan Wakeup, error)
}
```
Correct sequence:
1. commit state and outbox row in one transaction;
2. after commit, emit a wake-up signal;
3. every interested subcell lists durable changes after its cursor;
4. apply only contiguous, authorized changes;
5. persist/ack the cursor at the appropriate Workspace or connection boundary;
6. on gaps, reconnect, or missed wake-up, query again;
7. if history is no longer retained, fetch a fresh snapshot and cursor.
Wake-up signals may be in-process initially. On multiple nodes, use PostgreSQL `LISTEN/NOTIFY` or an open-source broker adapter as a hint. Never treat a notification as the durable event.
## Jobs without resident cells
```go
type JobEnvelope struct {
    JobID            JobID
    ProjectID        ProjectID
    ActorUserID      *UserID
    SystemActor      *SystemActor
    Action           Action
    AccessEpoch      int64
    IdempotencyKey   string
    InputRef         ObjectRef
}
```
- A job is durable and outlives any User Cell or Project Subcell.
- A user-initiated job reauthorizes the recorded User and Action before publishing.
- System work uses an explicit service/system principal, never a fabricated User.
- Job leases prevent concurrent attempt ownership; idempotency and aggregate CAS prevent duplicate accepted effects.
- Progress and completion publish to Activity/outbox so the User's current or future cell can catch up.
## Horizontal deployment
P1 may keep all logical cells in one modular-monolith process. P2 may run several Omega nodes:
- route by authenticated `UserID` for best-effort affinity;
- acquire/rehydrate the User Cell on the chosen node;
- use shared PostgreSQL, object storage, job store, and durable outbox;
- use an ephemeral cross-node wake-up adapter;
- allow retry on another node without a correctness lease.
Strict global singleton leasing for a User Cell is unnecessary until a measured feature requires unique ephemeral ownership. If introduced, it is a User-placement optimization—not a Project placement model and not a data-integrity mechanism.
## Observability and limits
Measure:
- active/idle User Cells and Project Subcells;
- acquisitions, reuses, activation latency, evictions, and rebuild latency;
- subscriptions and connections per User/Subcell;
- cache bytes and revision staleness;
- outbox lag, cursor gaps, snapshot fallbacks, and delivery retries;
- CAS conflict and explicit rebase rates;
- admission denials and access-epoch mismatches;
- job reauthorization failures and stale-result rejection.
Enforce:
- maximum active subcells per User and per node;
- maximum long-lived subscriptions/connections;
- bounded caches and result pages;
- idle TTL and graceful drain deadline;
- per-User, per-Project, and per-provider rate limits;
- global backpressure before memory or database pools saturate.
## Acceptance tests
1. Alice opens the same Project on two devices and both attach to one logical `(Alice, Project)` subcell.
2. Bob opens that Project and receives a distinct `(Bob, Project)` subcell.
3. Alice commits revision 8; Bob observes revision 8 through the durable cursor even if the wake-up signal is dropped.
4. Alice and Bob race from revision 8; one commit succeeds and the other receives a typed conflict.
5. A User Cell and its subcells are evicted; reacquisition restores Workspace and resource state without lost accepted work.
6. A request lands on a different node; it rehydrates and catches up from the durable cursor.
7. Revocation prevents a new command and prevents an already-running job from publishing.
8. A duplicate job or command cannot double-apply accepted state.
9. No test requires one shared Project runtime or a distributed Project placement directory.
## References
- [PostgreSQL: NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL: LISTEN](https://www.postgresql.org/docs/current/sql-listen.html)
- [PostgreSQL: Concurrency Control](https://www.postgresql.org/docs/current/mvcc.html)
- [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

