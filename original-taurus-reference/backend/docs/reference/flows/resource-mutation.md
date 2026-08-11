# Resource mutation flow

## Outcome

A User or Agent invokes one explicit versioned command against a Resource in a
bound Cell. The owning capability decides domain validity and concurrency. The
handler supplies current authority, canonical loading, idempotency, a fresh
one-use mutation permit, one Project transaction, required Audit, and any
durable job record. Success returns the canonical committed version.

This is a shared environmental flow, not a generic Resource model. Documents,
Workbooks, Decks, Boards, Chats, and Files retain distinct state, operations,
errors, persistence, and reconciliation.

## Command envelope

An admitted command has transport-neutral metadata similar to:

```go
type CommandRequest struct {
    Operation      OperationName    // e.g. documents.submit_changes.v1
    ResourceID     ResourceID
    Expected       VersionCondition // family-specific
    IdempotencyKey IdempotencyKey
    Payload        any              // exact registered input type
}
```

The runtime injects, rather than accepts from the payload:

- bound `CellKey{UserID, ProjectID}`;
- the trusted effect-authority source and every current dependency generation;
- actor and delegation chain (User and, when explicitly sponsored, Agent);
- request/trace identity, deadline, budget, and cancellation;
- registered operation descriptor and risk/effect class; and
- nested-dispatch depth and cycle guard.

An unknown operation/version or payload type fails before capability code.
`ProjectID`, `UserID`, placement, database, credentials, fence, and permit are
never caller-controlled fields.

## Mutation sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant Cell as Bound Cell
    participant H as Handler
    participant Ctrl as Control
    participant DB as Project DB

    C->>Cell: versioned command + expected version + idempotency
    Cell->>Ctrl: current exact request/effect authority
    Ctrl-->>Cell: allow or deny
    Cell->>H: admitted typed invocation
    H->>DB: load canonical family state + idempotency
    Note over H: call owning capability operation
    H->>Ctrl: fresh exact one-use mutation permit
    H->>DB: begin UoW; validate/consume permit
    H->>DB: persist effect + idempotency + Audit + jobs
    DB-->>H: commit canonical version
    H->>Ctrl: settle permit from exact Project proof
    Ctrl->>DB: typed read-only proof re-read
    H-->>C: bounded canonical result
```

### 1. Transport and admission

Transport enforces method, content type, body and field limits, Host/origin,
cookie/CSRF, decompression, timeouts, and DTO parsing. It maps the public route
to one registered operation and cannot select a handler by arbitrary input.

For interactive traffic, the Host resolves the attachment and current durable
session. For an admitted durable job, trusted worker routing reconstructs the
exact work or Task authority and matching Project receipt; a serialized job
cannot select either. The Cell checks that routed scope equals its immutable
key, applies queue/deadline/budget limits, looks up the exact operation version,
verifies input/output types, and rejects overload before accepting work.

### 2. Current durable request authority

Every protected command checks current Control state before domain work. The
trusted source is exactly one of:

- `SessionAuthority{SessionFamilyID, SessionGeneration}` for an interactive
  User command;
- `DurableWorkAuthority{WorkAuthorityID, WorkGeneration, JobID}` for an exact
  accepted non-Agent durable job; or
- `TaskSponsorshipAuthority{SponsorshipID, SponsorshipGeneration, TaskID}` for
  an exact durable Agent Task effect.

The check includes:

- active session family and User;
- User belongs to the expected single Organization;
- effective direct Project grant and action policy;
- entitlement/quota needed to attempt the operation;
- active Project lifecycle and placement generation; and
- actor/delegation/tool grant if an Agent is acting; and
- for either durable arm, the exact active Control authority plus its matching
  Project Job/Task receipt, current Project state and remaining bounded budget.

This check authorizes the request to proceed. It is not the mutation permit and
cannot be cached as one.

### 3. Idempotency preflight and canonical load

The handler resolves the trusted Project handle and checks an operation-scoped
idempotency record. Exact replay returns the original committed response and
version. Reuse with a different operation, Resource, actor, or request hash is
a stable idempotency conflict.

If this is a new command, the handler loads exactly the canonical state required
by the family repository. It does not reconstruct truth from browser state,
search, Activity, cache, realtime, or another Project.

### 4. Capability operation

The handler converts repository records into plain capability values and calls
the owning operation. Capability code:

- validates domain invariants and the family-specific expected version/head;
- performs deterministic transformations;
- returns a proposed new aggregate, ChangeSet, immutable record, transition,
  or no-op result appropriate to the family;
- for a registered change-bearing operation, returns bounded component change
  metadata and the family diff/inverse capability classification without
  inventing a universal inverse payload;
- declares any required follow-up intent in domain vocabulary; and
- returns a stable domain error on invalid/conflicting input.

Capability code does not authorize, open SQL, issue permits, log, submit jobs,
call provider SDKs, or inspect HTTP.

If the capability needs another capability, it owns a narrow consumer port.
The handler supplies an adapter that invokes a registered operation through
bounded nested dispatch. Nested work inherits scope, deadline, budget,
delegation, cycle detection, authority, and observability. A nested mutation
still follows its owning mutation flow; nested calls do not create an implicit
cross-capability transaction.

### 5. Fresh one-use permit

Immediately before the effect, the handler asks Control for a permit bound to:

- exact User/actor and Project;
- exact action and operation version;
- exact Resource or permitted creation scope;
- exactly one of the three trusted authority sources above;
- User, Organization, grant, entitlement, policy, placement, Project-fence,
  approval/delegation and applicable Agent/tool generations;
- request/idempotency identity where appropriate; and
- a unique nonce/permit identity and an expiry no later than the minimum source,
  approval, delegation, policy and operation deadline.

Control locks every revocable dependency in deterministic `(kind, stable ID)`
order, re-evaluates them, and records the permit, one `PermitDependency` index
row per dependency generation, and the trusted Project/placement target in one
Control transaction. Any dependency revoker therefore either discovers the
issued nonterminal permit through the index or wins its dependency lock and
makes issuance fail. Permit failure ends the command without a Project effect.
Long inference, upload, rendering, or Agent work must not hold a permit; it
obtains a new one only when ready to commit.

Control mutations do not recursively obtain Project effect permits. They lock
and re-evaluate Control authority and atomically write the Control effect,
idempotency, required Control Audit and any declared Control `SemanticFact` in
one Control UoW.

### 5A. Admitting durable follow-up work

If the proposed effect needs a later non-Agent job that can create another
canonical Product effect, the handler preselects stable `WorkAuthorityID` and
`JobID` values and asks Control to create an exact
`DurableWorkAuthority{PendingProjectReceipt}`. It is bounded to the sponsor,
Project, initiating operation, later operations/targets, budgets, generations
and expiry. The initiating Project transaction must store the exact job and a
non-authoritative receipt. Only an idempotent post-commit acknowledgement may
move the Control authority to `Active`; a lost acknowledgement is reconciled
by re-reading the exact `AuthorityReceiptProof` through a Project/placement-
bound `ReceiptProofCredentialRef`, while an absent Project record leaves an
unusable orphan that expires/revokes. A conflicting kind, ID, generation,
digest, or placement fails closed. Product, settlement, fence, and finalizer
credentials cannot substitute for the receipt-proof credential.

An Agent Task job instead remains under its exact active Task sponsorship and
matching Task receipt. Neither kind of job receives ambient Project authority,
and a job payload cannot manufacture a receipt. Periodic external triggers need
their own explicitly accepted finite standing-work delegation; a timer or
webhook is only a hint.

Normal session-started Work, Task, Routine, standing-work, and Agent-principal
admission uses an ordinary session-sourced effect permit. Only an active
standing-work or Routine delegation admitting a no-session trigger receives a
separately typed one-use `ReceiptBootstrapCredential`. It may create only the
preselected exact absent Job/Task, matching receipt, and prescribed admission
bookkeeping. It is not an effect permit and does not add a fourth authority
source.

### 6. One Project Unit of Work

The handler begins one Project transaction and, in an order that prevents
time-of-check/time-of-use gaps:

1. validates immutable Project identity and current placement generation;
2. takes a shared lock on the Project-local mutable authority fence;
3. verifies permit signature/key, scope, action, Resource, generations, expiry,
   and one-use status;
4. records permit consumption plus an immutable `PermitConsumptionProof`
   binding permit digest, Project/placement generation, effect/idempotency
   commit identity, and commit time;
5. rechecks the family's canonical concurrency condition;
6. persists the family effect;
7. stores the exact idempotency result/response identity;
8. for a registered change-bearing operation, appends the family's immutable
   canonical change/history record and component/address lineage;
9. appends required Project Audit;
10. appends a registered bounded `SemanticFact` when the operation is declared
    user-visible;
11. enqueues any durable Project-owned jobs and matching non-authoritative work
    receipts required by the committed effect;
12. when terminal bookkeeping may be needed after authority loss, creates an
    exact `FinalizationRecord` for one kind and transition in the closed v1
    registry: durable Job, Task, Intelligence reservation/call generation,
    Agent disable, Routine lifecycle, or Project Audit export lifecycle.

All twelve are atomic when applicable: visible together or not at all.
Activity/search project from the retained fact; realtime hints and telemetry
remain optional later signals. None participates in domain correctness, and
the fact is never used as a command bus. A transaction cannot call Control or
an external provider while holding Project locks.

`FinalizationRecord` is not an effect permit. Each registry kind has an exact
transition set and non-interchangeable typed credential. Unknown kind/version,
kind/credential mismatch, unlisted transition, or state/generation/input digest
mismatch fails closed. No finalizer can obtain a permit, call or retry a
provider/tool, create or mutate Resource output, enqueue work, widen authority,
or resurrect a source.

### 7. Commit and response

After commit, the handler calls the trusted idempotent
`control.mutation_permits.settle.v1` contract. Control resolves the permit-
ledger target and re-reads only the exact `PermitConsumptionProof` through
`ProjectPermitSettlementTarget` and `PermitSettlementCredentialRef`. An exact
repeat returns the same terminal settlement; a lost acknowledgement is
reconciled by that same re-read. Absence remains retryable/nonterminal, and a
conflicting proof is rejected so revocation must fence the target. The
settlement credential is read-only and cannot substitute for the separately
typed fence credential; neither can use the other's routine.

The handler then returns a bounded canonical result containing the
family's identity/version/head, applied operation/result, relevant conflict or
staleness state, and safe follow-up/job references. It never returns secrets,
placement, database identities, permit material, raw provider payloads, or
unbounded canonical state.

The browser applies the response only if its current session/Project/Resource
generation still matches. Otherwise it discards it and may query again. A lost
response is safe to retry with the same idempotency key.

## Query variation

A query follows transport, bound scope, current durable authority, operation
registration, bounds, and canonical repository loading. It does not request or
consume a mutation permit and does not write required Audit unless the query is
a separately designated audited access. It may return a bounded projection,
exact canonical version, and a reconciliation token suitable for the next
family command.

## History, review, and undo variation

An operation marked change-bearing names an owner history-schema version and
registers narrow history-reader, safe-diff and revert-planner adapters. The
family's canonical history record contains or can produce attribution,
command/group lineage, exact base/result versions or states, stable component/
address identities and bounded before/after metadata. Documents use Document
ChangeSets; other owners retain their declared versions, transitions or
operation histories. There is no universal change table. A bounded
`ChangeSummary` returned by the owner adapter is not Audit, Activity, a
`SemanticFact`, an outbox, or an event-sourced copy of the whole Resource.

`changes.diff.get.v1` and `undo.preview.v1` are currently authorized queries.
They load the exact historical change and current owner version, then ask the
owner adapter for a safe diff and one of: an exact typed inverse command, an
exact compensation command, a conflict requiring a new proposal, or
`not_revertible`. Preview has no permit and no effect. Its result includes a
digest over the target change, current versions, planned owner operations,
ordering and irreversible/partial consequences.

`undo.request.v1` binds that preview digest and expected group review revision.
Each accepted row becomes a new ordinary owner mutation with its own
idempotency identity, current authority check and fresh one-use permit. Group
execution normally proceeds newest-first, stops according to the approved
failure policy, and records per-row resulting OwnerChangeRef, conflict,
not-revertible or compensation failure. Already committed rows remain
canonical; a partial group reports `partially_reverted` and never claims a
distributed rollback. A later component change forbids blind before-image
restore and requires `undo.conflicts.resolve.v1` to create a new explicit
resolution proposal.

After a change-bearing commit, its registered redacted `SemanticFact` may feed
Activity and notification projectors. Notification creation/delivery is
idempotent downstream work and cannot affect mutation commit, authorize a
review/revert, or replace canonical history or required Audit.

## Family-specific concurrency

The environmental flow never imposes universal event sourcing, locking, or
last-write-wins.

| Family/domain | Expected concurrency shape |
| --- | --- |
| Document | Base + ordered Document ChangeSets + head; capability-defined merge/reconcile/conflict. |
| Workbook | Revisions plus cell/range/table constraints and dependency-aware updates. |
| Deck | Aggregate/element revisions and explicit ordering/layout conflicts. |
| Board | Object/region revisions and family-defined concurrent geometry policy. |
| Chat | Immutable message append plus explicit edit/tombstone/version rules. |
| File | Immutable versions, conditional metadata revisions, multipart finalize state. |
| Workspace | Optimistic per-User/per-Project snapshot revision. |
| Formula names | Conditional registry revision and dependency-cycle checks. |
| Task/job | Explicit state machine, leases, attempts, and fencing. |

For Documents, two ChangeSets that touch independent stable targets may be
reconciled against the latest head and appended in either canonical order.
Conflicting operations produce an explicit conflict the User or Agent must
resolve. The Project Database copy is always canonical. There is no global
application lock and no silent loss of a committed change.

## Create, archive, restore, and delete

- **Create** uses a permitted creation scope and atomically creates family-owned
  canonical content plus that family's own Resource identity/lifecycle record,
  idempotency, and Audit in one Project UoW. `resources/` is taxonomy only; no
  generic Resource repository owns the metadata row.
  It does not create an empty metadata record followed by an ungoverned family
  write.
- **Archive/restore** are explicit family/Resource lifecycle commands with
  optimistic conditions, attribution, and index/projection follow-up jobs.
- **Delete** distinguishes reversible archive, retention-bound deletion, and
  Project final deletion. Unknown retention/legal-hold policy fails closed.
- Resource deletion never grants permission to delete a Project; only the sole
  Project owner can perform the separately governed final Project action.

## Stable failure classes

Handlers map specific errors into bounded public categories without erasing
domain meaning:

- unauthenticated, unauthorized, entitlement denied;
- Project inactive, stale placement, or scope mismatch;
- unknown operation version or unsupported representation;
- invalid input or domain invariant;
- Resource not found (without inaccessible-resource disclosure);
- family version/head conflict or reconciliation required;
- idempotency conflict;
- overload, deadline, cancellation, or dependency budget exhausted;
- permit unavailable/expired/replayed/stale/revoked;
- transient dependency unavailable; and
- internal failure with redacted correlation identity.

The handler must not retry a non-idempotent external effect blindly. Database
deadlock/serialization retry is bounded around the entire idempotent UoW and
must re-load state and obtain a fresh permit if the prior permit outcome is not
known.

## Headless example

```text
1. Create/open Project through Host bootstrap.
2. Query documents.get.v1 -> head H7 and Markdown/JSON projection.
3. Submit documents.submit_changes.v1:
     Resource R, expected H7, ChangeSet CS8, idempotency I8.
4. Assert response head H8 and exact applied operations.
5. Repeat byte-identical I8 -> exact H8 response, no second effect/Audit.
6. Reuse I8 with different payload -> idempotency conflict.
7. Apply independent CS9 from H7 -> reconcile or explicit policy result.
8. Apply conflicting CS10 from H7 -> stable conflict with current head H9.
9. Revoke grant during a delayed command -> no commit after revocation effective.
10. Render canonical Document from a fresh Host with caches disabled.
11. Query changes.diff.get.v1 -> family-rendered safe CS8/current-head diff.
12. Query undo.preview.v1 -> exact typed inverse or explicit conflict/not-revertible.
13. Submit undo.request.v1 with preview digest -> new owner ChangeSet CS11.
14. Retry the request -> same UndoAttempt and result, no second inverse effect.
15. Apply a later conflicting edit before another preview-bound request ->
    preview stale/conflicted; no blind before-image restore.
```

## Proof obligations

- hostile payloads cannot replace User, Project, placement, actor, operation,
  or permit scope;
- every protected request reconstructs exactly one trusted session, durable-
  work or Task-sponsorship authority source and checks it currently;
- every ordinary protected Project effect consumes exactly one fresh permit
  atomically with its effect;
- issuance locks and indexes every revocable dependency, caps permit expiry at
  all source deadlines, and independently wins-or-loses races with every kind
  of revocation;
- after revocation reports effective, no earlier permit commits;
- effect, idempotency, applicable family-owned canonical history, required
  Audit, declared SemanticFact, and required job are atomic;
- exact retry returns the original result and conflicting reuse fails;
- capability conflicts remain domain conflicts, not authorization errors;
- cross-Project credentials and cache state cannot read or mutate another
  Project, including across independent Hosts;
- failure at every transaction step leaves no partial canonical effect;
- pending durable-work admission, lost acknowledgement, orphan expiry,
  restart, cancel and revocation converge without ambient worker authority;
- finalizers prove both allowed exact terminal settlement and denied Resource,
  provider, tool, job-enqueue and unrelated-record access;
- jobs and projections can be replayed/rebuilt without duplicating effects; and
- diff/undo queries reauthorize history, owner-specific preview never mutates,
  stale previews cannot execute, and partial group revert is reported exactly;
- all important mutations and renderings work from CLI/integration tests with
  no browser or instance affinity.

## Implementation map

```text
internal/transport/http/product/       route and DTO mapping
internal/host/routing/                 attachment and bound routing
internal/cell/{access,dispatch,scheduler}/
internal/cell/handlers/<family>/       environmental mutation/query envelope
internal/capabilities/<family>/        domain operation and concurrency rules
internal/control/access/               current request authority
internal/control/authority/            one-use permit issuance/revocation
internal/control/workauthority/        durable-work/delegation admission
internal/host/projectstores/           trusted scoped handle
internal/platform/{idempotency,uow,jobs}/
internal/cell/handlers/projectaudit/   Project-UoW required Audit port
internal/cell/handlers/finalization/   typed exact terminal transitions
```

## Grounding

Omega authority: D003, D005–D009,
[`request-dispatch.md`](../architecture/request-dispatch.md),
[`persistence-and-concurrency.md`](../architecture/persistence-and-concurrency.md),
and [`jobs-audit-observability.md`](../architecture/jobs-audit-observability.md).

Taurus target: [SOL X 00](https://app.notion.com/p/39ab6410e5028158b555c9a34752e292)
and the [Taurus Construction database](https://app.notion.com/p/377b6410e50280228b00c11b957c5d43),
with its event/runtime mechanisms superseded.

Nova evidence: optimistic Document mutations in
[`internal/document/service.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/service.go),
durable Project fencing/provisioning in
[`internal/project/runtime`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/project/runtime),
and durable platform primitives summarized in
[`../nova-evidence.md`](../nova-evidence.md). Nova does not
prove the complete Omega mutation flow.
