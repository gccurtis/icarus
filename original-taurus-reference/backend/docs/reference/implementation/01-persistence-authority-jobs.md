# Stage 01 — Persistence, mutation authority, Audit, and jobs

## Outcome

Build the durable substrate shared by later Control and Project domains:
verified MySQL connectivity, checksummed schemas, trusted Project handles,
bounded transactions, idempotency, required Audit, strong one-use mutation
permits and Project-local fences, durable jobs, object storage, and recovery
proofs.

The stage proves mechanisms with dedicated test aggregates. It does not invent
a generic Resource repository or implement identity/Project product behavior.

## Non-goals

- OIDC/session/User/Organization/Project workflows
- Documents or any other Resource family
- cross-database distributed transactions
- production enumeration of every Project Database
- provider inference or web UI

## Target tree

```text
cmd/taurus-migrate/                  operator-only schema verify/plan/apply
cmd/taurus-control-worker/
cmd/taurus-operator/
internal/platform/
  mysql/
  migrations/
  uow/
  idempotency/
  jobs/
  objectstore/
  crypto/
  telemetry/
  health/
internal/control/
  authority/
    permitsettlement/
    receiptproof/
    receiptbootstrap/
  workauthority/
  workdelegations/
  audit/
  jobs/
internal/host/
  projectstores/
  jobs/
  finalizers/{durablejob,task,intelligence,agentdisable,routine,projectauditexport}/
internal/cell/handlers/projectaudit/
internal/cell/handlers/finalization/
internal/operator/{provisioning,migrations,relocation,backuprestore}/
migrations/
  control/
  project/
test/{integration,security,recovery,performance}/
```

## Database baseline

Use the current supported MySQL LTS line selected in the supply-chain document
and its latest pinned patch. Connections require verified TLS in production,
bounded lifetimes/idle limits, timeouts, safe DSN handling, and redacted errors.

Separate roles:

- Control runtime: DML only on Control application schema;
- one Product role per Project Database: exact DML only on that database;
- one permit-settlement proof role per Project Database: execute only the exact
  keyed immutable permit-consumption-proof read routine; no enumeration, raw
  tables, Resource, Audit, job, receipt, fence, write, or DDL authority;
- one receipt-proof role per Project Database: execute only the exact keyed
  `AuthorityReceiptProof` read routine for the admitted Work/Task/standing-work/
  Routine/Agent-principal kinds; no enumeration, raw tables, Resource, Audit,
  permit, fence, write, or DDL authority;
- one non-interchangeable finalizer role per closed registry kind and Project
  Database: execute only that kind's schema-owned exact transition routine for
  a precommitted record; no raw table, provider, Resource, job-creation, permit,
  receipt-proof, settlement, fence, or DDL authority;
- one Project-Audit administration role per Project Database: execute only on
  schema-owned bounded safe query/export routines for that exact Project; no
  raw Audit mutation, Control state, Resource, permit, job, fence or DDL access;
- Control worker: Control-job DML plus a typed fence-only credential per target
  that can execute only a schema-owned bounded transition which locks/updates
  the sole authority-fence row and inserts its bounded Project Audit record in
  the same transaction; no raw Resource-content, consumed-permit, general-
  Audit, job, or DDL table access;
- migration/provisioning operator: short-lived DDL/database/account authority,
  unavailable to Product and Control-worker processes; and
- backup/restore operator: separately governed and audited.

The Product Host, Control worker, and privileged operator are separate wiring
graphs and entrypoints. The operator has no Product listener or Cells. Local
development may launch all roles from one script, but it may not collapse their
credentials or dependencies.

Control returns a `ProductProjectPlacement` containing only a typed
`ProductCredentialRef` to Product wiring, and a separate
`AuthorityFenceTarget` containing only a typed `FenceCredentialRef` to the
Control worker, a `ProjectPermitSettlementTarget` containing only
`PermitSettlementCredentialRef` plus the exact Permit ID/digest to the proof reconciler, a
`ProjectReceiptProofTarget` containing only `ReceiptProofCredentialRef` to the
activation reconciler and bound receipt kind/Control identity/generation/digest,
plus a `ProjectFinalizerTarget` containing one sealed
kind-matched typed finalizer credential to the Project job-supervisor graph, and a
`ProjectAuditTarget` containing only a typed `ProjectAuditCredentialRef` to the
separately authorized Audit administration graph. Negative
compile/wiring fixtures and live grants prove no role can resolve another's
credential type. Operator credentials are never present in these descriptors.

## Schema contracts

Control foundation tables:

- schema/checksum history;
- Control-local idempotency, required Audit, and retained semantic facts;
- permit dependency index, issuance/revocation/settlement state sufficient for
  strong fencing, bounded pending/active durable-work authority, and finite
  standing-work delegation;
- trusted Project placement/provisioning primitives introduced only as needed
  for tests; and
- optional job table for Control-owned workflows.

Project foundation tables:

- immutable Project identity fence and placement generation;
- mutable authority generation/quiescence state and consumed permits;
- immutable keyed `PermitConsumptionProof` rows and closed-kind
  `AuthorityReceiptProof` rows;
- Project-local idempotency, required Audit, and retained semantic facts;
- durable jobs, non-authoritative work receipts, and exact closed-registry
  finalization records;
  and
- schema/checksum history.

Capability tables do not belong in this stage.

## Internal authority operation slice

The [Control capability's canonical table](../capabilities/control-and-administration.md#canonical-versioned-control-operations)
defines the typed internal surface exercised by this substrate:

- `control.work_authorities.issue.v1`,
  `control.work_authorities.activate.v1`,
  `control.work_authorities.status.get.v1`, and
  `control.work_authorities.revoke.v1`;
- `control.work_delegations.issue.v1`,
  `control.work_delegations.activate.v1`,
  `control.work_delegations.status.get.v1`,
  `control.work_delegations.trigger.admit.v1`, and
  `control.work_delegations.revoke.v1`;
- `control.mutation_permits.issue.v1`,
  `control.mutation_permits.settle.v1`, and
  `control.mutation_permits.status.get.v1`;
- `control.revocations.begin.v1`, `control.revocations.status.get.v1`, and
  `control.revocations.settle.v1`; and
- `control.project_placements.product.resolve.v1`,
  `control.project_placements.fence_target.resolve.v1`, and
  `control.project_placements.permit_settlement_target.resolve.v1`,
  `control.project_placements.receipt_proof_target.resolve.v1`, and
  `control.project_placements.finalizer_target.resolve.v1`; and
- `control.project_placements.audit_target.resolve.v1`.

These are not public Product routes. Stage 01 proves them over synthetic
authority roots; Stage 02 composes real session/User/Organization/Project
dependencies.

## Mutation transaction contract

```text
authorize/issue exact one-use effect permit in Control
  -> lock every revocable dependency in deterministic kind/ID order
  -> recheck all Active; cap expiry by every source/delegation deadline
  -> record permit + dependency index + trusted target in same Control commit
  -> begin Project transaction
  -> take shared lock on exact authority-fence row
  -> verify signature, scope, action/resource, generation, expiry
  -> insert one-use consumption (unique)
  -> apply test aggregate effect under expected version
  -> write idempotency result
  -> append required Audit
  -> append bounded SemanticFact when effect is declared user-visible
  -> enqueue any durable follow-up job
  -> write immutable exact PermitConsumptionProof
  -> commit
  -> settle Control permit by exact typed proof re-read
```

`control.mutation_permits.settle.v1` never trusts a caller-supplied commit
claim. It resolves the Project/placement stored in the Control permit ledger,
uses only `PermitSettlementCredentialRef` to re-read that exact immutable proof,
and compares permit digest, Project, placement generation, effect/idempotency
commit identity, and commit time. Exact replay is idempotent; a lost ack follows
the same read; absence remains nonterminal; conflicting proof fails closed and
leaves revocation to fence the target. `FenceCredentialRef` cannot read/settle a
permit, and the settlement role cannot advance the fence.

Revocation is implemented, not mocked, as this state machine:

```text
Control Active dependency
  -> issuance and BeginRevocation serialize on every affected dependency row
  -> one transaction: Revoking + generation advance + issuance denied
     + dependency-indexed targets from every nonterminal permit,
       including expired-but-unsettled
  -> Control authority worker takes each target's exclusive fence-row lock
     (waiting behind already-running shared-lock mutations)
  -> advances Project-local fence + appends bounded Project Audit atomically
  -> acknowledges exact target in Control
  -> Fencing while any target remains
  -> Effective only after every target acknowledges
```

Every authority check accepts only `Active`; therefore new requests and permit
issuance fail as soon as revocation begins. Ordinary mutations never take the
exclusive fence lock. A failed or unreachable target leaves revocation denied
and retryable, never falsely effective. Placement changes add a generation-
specific target before a replacement becomes writable. Permit verification
keys remain available until every permit is terminal and related fences
acknowledge; expiry alone cannot settle a permit or remove its target. Crash and
retry at every boundary must produce one effect or none.

Control commands themselves do not recursively obtain Project effect permits.
They lock/re-evaluate current Control authority and atomically write Control
state, idempotency, required Control Audit and any declared fact in one Control
Unit of Work.

## Durable job contract

Jobs have stable operation versions, trusted scope references, bounded payload,
schedule, state/generation, attempt policy, cancellation, lease, fencing, and
safe result/error summaries. Claims use server/database time. Stale workers
cannot settle or perform fenced effects after lease loss. Cancellation and
retry behavior is explicit by operation.

Any job that may later create a canonical Product effect has a Control-owned
`DurableWorkAuthority` and matching Project receipt. Admission preselects the
Work/Job IDs and bounded operations/targets/budget/expiry; Control creates a
pending authority, the initiating session-permitted Project transaction stores
intent/job/receipt, and an idempotent exact receipt-proof re-read activates it.
Activation and lost-ack recovery re-read an exact `AuthorityReceiptProof`
through `ProjectReceiptProofTarget` using only `ReceiptProofCredentialRef`.
This same closed proof path covers Work, Task, standing-work, Routine, and
Agent-principal activation. Missing receipts leave harmless expiring Control
orphans; conflicting kind/ID/generation/digest/placement proof fails closed.
Each later effect
uses a fresh work-sourced permit and exact Job receipt/generation.

A periodic subscription is inert until a live session admits a finite
`StandingWorkDelegation`, the exact Project subscription/receipt commits, and a
trusted exact receipt-proof re-read activates it. Each timer/webhook hint must call the
trigger-admission operation, which consumes bounded allowance and creates one
pending exact Work/Job authority plus a separately typed one-use
`ReceiptBootstrapCredential`. It may create only that preselected exact absent
Job and matching receipt/bookkeeping; it is not an ordinary effect permit or a
fourth source. Normal session-started Work/Task/Routine/standing-work/Agent-
principal admission uses an ordinary session-sourced permit. Duplicate
delivery returns the same identity. Sign-out everywhere/User disable/revoke
denies the delegation and all derived work; current-family sign-out preserves
already accepted independent work.

Every admitted target that can require terminal bookkeeping creates an exact
Project `FinalizationRecord` under one kind in the closed v1 registry:

| Kind | Credential | Transition set |
| --- | --- | --- |
| `durable_job@1` | `DurableJobFinalizerCredentialRef` | cancel/fail queued, leased, running, or cancel-requested; succeed only `completion_pending` with prebound settled effect proof |
| `task@1` | `TaskFinalizerCredentialRef` | cancel/fail running or cancel-requested; complete only `completion_pending` with prebound committed result proof |
| `intelligence_reservation_call@1` | `IntelligenceAccountingFinalizerCredentialRef` | settle/cancel exact reservation and terminalize exact admitted call generation from already-returned receipt |
| `agent_disable@1` | `AgentDisableFinalizerCredentialRef` | `disable_requested -> disabled` |
| `routine_lifecycle@1` | `RoutineLifecycleFinalizerCredentialRef` | exact proof-bound `enable_pending -> enabled`; `disable_requested -> disabled` |
| `project_audit_export@1` | `ProjectAuditExportFinalizerCredentialRef` | close an already-built export to ready/failed/canceled, then expire/delete through the exact lifecycle |

Each role executes only its schema-owned routine. Unknown kinds, credential
substitution, unlisted transitions, or state/generation/input mismatch fail
closed. No finalizer may obtain a permit, start/retry provider or tool work,
create/change Resource output, enqueue work, widen authority, or resurrect a
source. Thus revocation prevents all new effects while crash/outage recovery can
still close admitted state.

Do not register capability-run kinds in this substrate. File derivation,
connector sync, Knowledge ingestion, Resolution, analytics, Chat reply, Board
refresh, and Translation state/output remain ordinary capability effects under
a fresh permit. `durable_job@1` terminalizes only the generic Job record.

The lab runner operates on an explicit trusted set of Project placements; it
does not enumerate credentials. Fleet discovery/placement management remains a
later production boundary.

## Object store contract

- immutable content addressed or integrity-bound by digest/size/type;
- staged upload then verified finalization;
- bounded streaming without whole-object buffering;
- metadata/effect transaction references only finalized objects;
- orphan cleanup and reconciliation are bounded/retryable;
- download authority comes from Project metadata; and
- provider cancellation/cleanup calls are time bounded even if an adapter
  misbehaves.

## Proof matrix

- clean MySQL LTS bootstrap and checksum drift failure;
- TLS CA/hostname/downgrade/plaintext negative cases;
- Project A credential cannot discover/read/write Project B;
- runtime roles cannot DDL, administer accounts, read system secrets, or use
  operator functions;
- request data cannot substitute database/credential/fences;
- Product, permit-settlement, receipt-proof, fence-only, per-kind finalizer,
  operator, and Project-Audit credential references cannot be interchanged;
  Product cannot advance fences, the settlement/proof roles can read only one
  exact proof kind, the fence worker cannot access Resource content, finalizers
  cannot invoke another kind or perform Product effects, and the Audit role
  cannot mutate Audit or read capability state;
- Unit-of-Work commit/rollback and crash boundaries;
- exact idempotency replay and key/input mismatch;
- required Audit/effect atomicity and safe-field validation;
- permit replay, expiry, wrong actor/Project/action/resource/generation,
  every-dependency issuance-vs-revocation race, minimum-deadline expiry,
  expired-but-running mutations,
  shared/exclusive fence ordering, partial target fanout, placement relocation,
  key rotation, fence/Audit atomicity, and effective fencing;
- post-commit `PermitConsumptionProof` settlement exact replay, lost ack,
  absent/conflicting proof, relocation generation, and settlement-vs-fence role
  substitution;
- exact receipt-proof activation/lost-ack/absence/conflict for Work, Task,
  standing-work, Routine, and Agent-principal protocols, including every other
  role denied;
- durable-work and standing-work pending/ack/lost-ack/orphan/revoke/trigger-
  replay, job lease loss/restart/cancel/retry/poison/fencing, and post-revocation
  finalization closed kind/transition/credential matrix, unknown-kind and
  cross-kind denial;
- object corruption, incomplete upload, commit failure, and cleanup;
- connection budget across multiple Host simulations;
- backup/restore produces identical foundation state; and
- Product and Control-worker principals cannot perform operator steps, while
  the operator exposes no Product listener or Resource-content API; and
- race, fault-injection, and bounded performance evidence.

## Completion boundary

This stage establishes technical durability and strong commit authority. It
does not yet know real Users or Projects. Production Product traffic remains
fail closed until Stage 02 composes Control identity, grants, provisioning, and
trusted placement.
