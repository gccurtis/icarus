# Persistence and concurrency

## Data topology

Omega begins with:

- one Control Database for identity and authority;
- one logical Project Database per Project;
- an object store for large immutable/versioned artifacts;
- optional derived indexes and projections that can be rebuilt from canonical
  state; and
- no canonical state held only in a Cell or browser.

In MySQL, a separately named database is the logical isolation boundary. An
initial Bridge topology may place multiple Project Databases on one managed
cluster under distinct least-privilege principals. A Silo placement can move a
Project to a dedicated instance/cluster without changing the capability model.

## Project identity and schema contract

Every Project Database contains:

- immutable `project_identity` fence;
- mutable authority-fence generation, consumed permits, immutable permit-
  consumption proofs, and exact cross-domain receipt proofs;
- Project-local idempotency and required Audit;
- Project-bound durable jobs where needed;
- schema version/checksum truth; and
- capability-owned tables.

A handle verifies expected Project identity, placement generation, and
supported schema window before readiness and never changes scope. The client
cannot select an SQL identifier or credential.

## Capability-owned repositories

There is no generic Resource repository or generic event store. Each handler
owns the narrow repository interface required by its capability and its MySQL
adapter. Platform database code supplies connection, transaction, TLS, bounds,
and error mechanics only.

Examples:

- Documents: base snapshot, ordered ChangeSets, head, checkpoint metadata.
- Workbooks: aggregate/table/range revisions and formula/data bindings.
- Files: immutable content versions and metadata lifecycle.
- Agents: task/run/step state machines and proposals.
- Workspace: conditional replace of a compact User–Project snapshot.
- Knowledge: immutable artifacts, lineage, staleness, and index projections.

## Document canonical model

For one Document:

```text
verified base at B
  + ChangeSet B -> B+1
  + ChangeSet B+1 -> B+2
  + ...
  = canonical head H
```

A read loads one consistent base/stack/head view, validates contiguous
transitions and schema compatibility, and folds changes deterministically.
Gaps, forks, duplicates, corrupt digests, or incompatible representation fail
closed.

An edit proposes a ChangeSet against its observed head. The transaction appends
only against the canonical head. If another Cell advanced it, Documents reloads
intervening changes and attempts capability-defined semantic reconciliation.
Non-conflicting work is rebased and appended once; incompatible work produces
an explicit conflict with bounded context for user resolution. Silent
last-write-wins is forbidden.

Checkpointing can create a verified new base at an existing head. It may not
change reconstructed content or discard history required by product, Audit,
retention, or recovery policy.

## Other concurrency protocols

Each capability selects and documents one or more:

- aggregate revision plus conditional update;
- immutable insert with uniqueness constraints;
- normalized row constraints and short row locks;
- state transition from an expected state/generation;
- lease and fencing token;
- capability-specific operation history; or
- explicitly replaceable fields with tested last-write-wins semantics.

There is no application-wide lock, database-wide edit lock, global change
cursor, or assumption that ordering matters the same way for every Resource.

## Transactions

A Unit of Work is a technical transaction handle. The handler defines the
product invariant. A protected Project Product-effect mutation normally commits
together:

- shared-lock ordering against the exact Project authority-fence row;
- one-use authority permit validation/consumption;
- exact immutable permit-consumption proof for post-commit Control settlement;
- canonical capability state;
- idempotency result;
- required Audit;
- a bounded registered `SemanticFact` for a declared user-visible effect; and
- durable job/outbox fact if follow-up work is required.

Control and Project are separate transaction domains. Cross-domain workflows
use explicit durable state machines, fencing, and compensation—not an
unavailable distributed transaction.

After Project commit, `control.mutation_permits.settle.v1` resolves the exact
ledger-selected Project/placement target and re-reads the immutable consumption
proof using `PermitSettlementCredentialRef`. Exact repeat is idempotent; a lost
acknowledgement is reconciled by the same read; absent or conflicting proof
leaves the Control permit nonterminal. This read-only credential cannot advance
the authority fence, and `FenceCredentialRef` cannot settle a permit.

## Durable jobs

Jobs are stored in the same transaction domain as their triggering intent. A
job has stable identity, operation version, trusted scope reference, bounded
payload, state/generation, schedule, attempt policy, cancellation, lease,
fencing token, and redacted failure summary.

Workers claim under a lease and must prove current fencing before each effect.
Lease loss prevents stale completion. Retry is safe through idempotency and the
owning capability's transaction protocol. Poison work reaches a bounded
terminal state; it is not retried forever.

Effectful jobs use an exact Control-owned `DurableWorkAuthority` or Task
sponsorship plus a Project receipt; each later effect consumes a fresh permit.
Job process identity and leases never confer Product authority. Admission and
Project receipt activation are idempotent cross-domain state machines, not a
distributed transaction. Work, Task, standing-work, Routine, and Agent-
principal activation re-read an exact Project `AuthorityReceiptProof` through a
Project/placement-bound `ReceiptProofCredentialRef`. The credential exposes one
exact keyed proof only; absence remains pending and conflicting proof fails
closed. Session-started admission uses an ordinary session-sourced effect
permit. Only standing-work/Routine trigger admission can create a one-use
`ReceiptBootstrapCredential` for the exact absent Job/Task and receipt; it is
not an ordinary permit source.

Admission may also create an exact `FinalizationRecord`. Its kind is one member
of the closed versioned v1 registry: durable Job, Task, Intelligence
reservation/call generation, Agent disable, Routine activation/disable, or
Project Audit export lifecycle. Each kind has one non-interchangeable execute-
only credential and exact transition set. Unknown kinds, credential mismatch,
and unlisted transitions fail closed. A finalizer cannot create or change a
Resource, invoke a provider/tool, enqueue work, widen scope/budget/authority, or
reactivate authority. This is how revoked/crashed work settles without weakening
“no new effect permit after revocation.”

## Object storage

Objects are addressed through opaque durable references and integrity metadata.
Writes use staged upload, size/type bounds, digest verification, immutable
finalization, and cleanup/reconciliation for failed database commits. Download
authorization is resolved through canonical Project metadata; bucket keys or
presigned URLs never establish Product authority.

## Caches and notifications

Caches are optional, bounded, instance-local, and version keyed. Correctness
must pass with caches disabled. Notifications are hints that cause an
authorized canonical read; missed, duplicated, reordered, or delayed hints do
not change correctness.

## Required live proofs

- transaction atomicity across crash-before/after-commit boundaries;
- idempotency replay and mismatched-input conflict;
- schema checksum/version enforcement and expand/contract rollout windows;
- per-Project credential isolation and hostile placement substitution;
- concurrent multi-Host/multi-Cell behavior for every capability protocol;
- lease loss, restart, cancellation, retry, and stale-worker fencing;
- durable-work admission/ack/orphan/revocation and exact post-revocation
  finalization denial tests;
- permit-consumption proof settlement, lost-ack re-read, conflicting-proof
  rejection, and settlement/fence credential-substitution tests;
- exact Work/Task/standing-work/Routine/Agent-principal receipt-proof activation
  and role-substitution tests; and
- closed finalization-kind/transition/credential matrix tests, including unknown
  kind and cross-kind denial;
- backup/restore of Control and individual Bridge/Silo Projects;
- object upload/orphan cleanup and integrity failure;
- connection budgets across multiple Hosts; and
- recovery produces exactly the same canonical head/projections.
