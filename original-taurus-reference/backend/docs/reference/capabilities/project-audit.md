# Project Audit administration

## Purpose and ownership

Required Project Audit is canonical security attribution written in the same
Project transaction as each protected Project effect. Project Audit
administration owns the strictly Project-scoped safe search, inspection,
export-artifact, delivery, retention-enforcement and legal-hold behavior for
that Audit data. It does so without moving Audit to Control, joining databases,
exposing Resource bodies, or treating Activity/logs as security history.

The Project Database owns `ProjectAuditRecord`, bounded query indexes, governed
export records, and delivery records for exactly its Project. Control separately
owns current User/Project authorization, trusted placement, durable-work
authority and fresh effect-permit issuance/revocation. Project-local receipts
do not replace that Control authority. No capability may rewrite required
Audit.

## Does not own

- required-Audit append semantics, which stay in each owning Project UoW;
- Control Audit or Control export artifacts;
- Resource/change history, Activity, search, logs, telemetry or realtime;
- general Project Files, Product archive/package export, or operator backup;
- Project grants/policy/placement, object-store credentials or delivery URLs;
- retention/legal-hold policy definition; this contract enforces the exact
  admitted revision and fails closed when it is unknown.

## Supported features

| Feature | Contract |
| --- | --- |
| Search | Bounded filter/page over safe metadata at an exact Project Audit cutoff; current authority on every page |
| Record inspection | One safe authorized record projection with actor/delegation/operation/target/policy/outcome identities and redacted fields |
| Export | Frozen authorized filter/cutoff/schema/policy rendered by a durable job into an encrypted governed artifact |
| Delivery | Fresh step-up, current exact Project scope, short-lived one-use delivery; no durable URL/object ref |
| Retention/legal hold | Policy-shaped expiry, tombstone and legal-hold behavior; never guessed deletion timing |
| Isolation | Separate typed exact-Project reader/export role; no Control Audit, Resource content, other Project, raw SQL, or write access |

## Models and states

```text
ProjectAuditRecord {
  AuditID, ProjectID, OccurredAt, ActorUserID, ActingAgentID?,
  DelegationChainDigest?, SessionOrAuthorityKind, Operation,
  Action, TargetKind, TargetID?, PolicyRevision, Decision,
  Outcome, IdempotencyRef?, CorrelationID, SafeDetails, SchemaVersion
}

ProjectAuditExportArtifact {
  ExportID, ProjectID, RequesterUserID, AuthorizedFilterDigest,
  SourceCutoff, PolicyVersion, ContentSchemaVersion, State,
  SealedObjectRef?, ByteSize?, Digest?, EnvelopeKeyVersion?,
  CreatedAt, ReadyAt?, ExpiresAt?, LegalHoldState,
  FailureCategory?, Revision, WorkerGeneration
}

ProjectAuditExportDelivery {
  DeliveryID, ExportID, RequesterUserID, SessionFamilyID,
  StepUpEvidenceRef, IssuedAt, ExpiresAt, UsedAt?, RevokedAt?
}
```

Artifact states are `queued`, `building`, `ready`, `failed`, `expired`,
`deletion_pending`, or `deleted`. Terminal state never returns to `ready`; a
retry creates a new Attempt under the same frozen filter/cutoff. Delivery is
`issued -> used` once, or `issued -> expired | revoked`.

Safe details use a registered closed schema and exclude Resource bodies,
prompts/source/provider payloads, secrets, credentials, SQL/database identity,
cookies, tokens and raw errors. Unknown schema versions fail closed.

## Canonical operations

| Operation | Kind | Behavior |
| --- | --- | --- |
| `project_audit.search.v1` | Bound Project query | Rechecks current `project.audit.read` authority and returns one bounded safe page at an exact cutoff; inaccessible existence is hidden |
| `project_audit.records.get.v1` | Bound Project query | Returns one exact safe record projection after current Project/auditor reauthorization |
| `project_audit.export.request.v1` | Bound Project durable command | Step-up freezes an admitted filter/cutoff/schema/policy and admits one exact export Work/Job authority |
| `project_audit.export.status.get.v1` | Bound Project query | Returns current-authority safe state/digest/size/expiry metadata; never an object reference |
| `project_audit.export.delivery.create.v1` | Bound Project command | Fresh step-up creates one short-lived one-use audited delivery after exact scope/retention/legal-hold recheck |

## Capability API and consumed ports

The pure `projectaudit` package validates safe query filters, record
projections, export manifests, state transitions, retention decisions and
delivery transitions. It receives plain values only. Handler-owned ports are
narrow and exact-Project:

```go
type SafeRecordReader interface {
    Search(context.Context, ProjectID, SearchFilter, Cutoff, Page) (RecordPage, error)
    Get(context.Context, ProjectID, AuditID) (SafeRecord, error)
}

type ExportRepository interface {
    Create(context.Context, NewExport) (ProjectAuditExportArtifact, bool, error)
    Get(context.Context, ProjectID, ExportID) (ProjectAuditExportArtifact, error)
    ClaimBuild(context.Context, ExportID, ExpectedRevision, WorkerGeneration) (ProjectAuditExportArtifact, error)
    MarkReady(context.Context, ReadyExport) (ProjectAuditExportArtifact, error)
    MarkFailed(context.Context, FailedExport) (ProjectAuditExportArtifact, error)
    MarkExpired(context.Context, ExportID, ExpectedRevision) (ProjectAuditExportArtifact, error)
    MarkDeletionPending(context.Context, ExportID, ExpectedRevision) (ProjectAuditExportArtifact, error)
    MarkDeleted(context.Context, ExportID, ExpectedRevision, DeletedObjectDigest) (ProjectAuditExportArtifact, error)
    CreateDelivery(context.Context, NewDelivery) (ProjectAuditExportDelivery, bool, error)
    ConsumeDelivery(context.Context, DeliveryID, ExpectedUnusedRevision) (ProjectAuditExportDelivery, error)
    RevokeDelivery(context.Context, DeliveryID, ExpectedRevision) (ProjectAuditExportDelivery, error)
}

type ExportObjectStore interface {
    PutSealed(context.Context, ProjectID, ExportID, DataKeyLease, BoundedPlaintext) (SealedObjectMetadata, error)
    OpenSealed(context.Context, ProjectID, SealedObjectRef, DataKeyLease) (VerifiedPlaintextStream, error)
    DeleteSealed(context.Context, ProjectID, SealedObjectRef, ExpectedDigest) error
}

type ExportKeyProvider interface {
    CreateDataKey(context.Context, ProjectID, ExportID) (DataKeyLease, WrappedDataKeyRef, KeyVersion, error)
    UnwrapDataKey(context.Context, ProjectID, ExportID, WrappedDataKeyRef, KeyVersion) (DataKeyLease, error)
}
```

Every transition names expected artifact/delivery revision and exact Project;
`ClaimBuild` also fences stale workers. `MarkReady` accepts only the sealed
object metadata, wrapped-key reference/version, byte count and verified digest
produced for that ExportID. `ConsumeDelivery` is the sole `issued -> used`
transition. `DataKeyLease`, plaintext and open streams are non-printable,
bounded, closeable handler values and are never serialized into domain state.

Authority, `DurableWorkAuthority`, idempotency, Unit of Work, typed placement,
jobs, required Audit for export/delivery Commands, object encryption and
transport are handler responsibilities. The capability neither imports Control
nor opens SQL/object storage.

## Persistence, authority, security, and failure

Search and get resolve a `ProjectAuditTarget` containing only a typed
`ProjectAuditCredentialRef` for the already authorized exact Project. The
credential can execute schema-owned bounded query/export routines and cannot
enumerate Project databases, read Resource/permit/job tables, alter Audit, or
perform DDL. Request input cannot supply placement or credential identity.

`project_audit.search.v1`, `project_audit.records.get.v1`, and
`project_audit.export.status.get.v1` are strictly read-only Queries. They do not
append an “Audit of Audit,” idempotency, Activity, Job or any other state. Export
request and delivery creation are Commands and atomically append their required
Project Audit. If future policy requires canonical Audit for each read, it must
introduce a new explicitly Command-class operation version rather than making a
Query effectful.

`project_audit.export.request.v1` preselects Export/Work/Job IDs. Control creates
an exact `DurableWorkAuthority{PendingProjectReceipt}`; one session-permitted
Project transaction freezes the export filter/cutoff, job, non-authoritative
receipt, idempotency and required Project Audit; trusted acknowledgement
activates work. The worker reads only the frozen safe projection, writes an
envelope-encrypted object in a Project-audit namespace, and uses fresh work-
sourced permits for canonical status/artifact effects. Its precommitted
finalizer may only settle/fail/delete that exact export record after authority
loss; it cannot read another filter, create a delivery, or reopen work.

The database stores only an application-sealed opaque object reference. Object
keys/URLs never enter records, responses, jobs, logs or Audit. Delivery requires
fresh current authority and step-up; bytes are opened only after the one-use
delivery transition succeeds. Scope loss, revocation, expiry or policy/legal-
hold change denies new delivery even while ciphertext deletion retries.

Control Audit and Project Audit exports are separate artifacts and operations.
Neither is a Project File, Product archive, Activity feed, log export, or
operator database backup.

## Stable failures

| Code | Kernel category | Meaning |
| --- | --- | --- |
| `project_audit_filter_invalid` | `invalid_argument` | Unsupported field/operator, unsafe bound, or inconsistent cutoff |
| `project_audit_not_found` | `not_found` | Record/export absent or hidden by current authority |
| `project_audit_scope_denied` | `forbidden` | Current exact Project auditor action/step-up is absent |
| `project_audit_schema_unsupported` | `unsupported_version` | Record/export schema is unknown and cannot be silently dropped |
| `project_audit_export_conflict` | `conflict` | Expected artifact/delivery revision, cutoff or idempotency digest differs |
| `project_audit_export_not_ready` | `precondition_failed` | Artifact is not ready, is expired/revoked, or legal/policy state denies delivery |
| `project_audit_integrity_failure` | `integrity_failure` | Ciphertext size/digest/key/reference verification failed |
| `project_audit_unavailable` | `temporarily_unavailable` | Exact database/object/key dependency is unavailable; no partial result |

## Proof obligations

- two Projects with colliding record/export IDs cannot discover or read each
  other through queries, artifacts, object refs, caches or credentials;
- exact current `project.audit.read`/`export` actions, step-up, cutoff, bounds,
  redaction and inaccessible-existence behavior;
- Project effect and required Audit atomicity remains unchanged by readers;
- search/get/status are zero-write Queries; export request/delivery Commands
  append their exact required access Audit;
- query credential negative grants prove no Control/Resource/permit/job/write/
  DDL access and Product/fence/finalizer/operator credentials cannot substitute;
- pending Work/Job commit/ack/lost-ack/orphan/revoke, worker lease/retry and
  finalizer allowlist/denial at every crash boundary;
- envelope encryption, sealed-ref redaction, digest verification, one-use
  delivery, expiry/revoke/legal-hold/cleanup and no durable delivery URL;
- bounded pagination remains stable at the frozen cutoff while new Audit rows
  append; and
- headless export contents match authorized search results at the same cutoff.

## Headless walkthrough

```text
1. Commit two ordinary Resource mutations in Project A and one in Project B.
2. project_audit.search.v1 in A at cutoff C -> exactly A's two safe records.
3. Request an export for the same filter/cutoff -> pending Work/Job receipt.
4. Crash before and after Project commit/Control acknowledgement/object finalize;
   retry -> one encrypted ready artifact and one required export-Audit lineage.
5. Step up, create one delivery with its own required Audit, consume it once,
   verify digest and exact rows.
6. Replay delivery -> denied; revoke Project grant -> no new delivery.
7. Attempt A query/export with B credential/ID/object ref -> hidden or denied.
8. Restore Project A and verify canonical Audit plus export status consistency;
   operator restore never treats the Product export as a backup.
```

## Source grounding

- [Control and Project boundary](../architecture/control-and-project-boundary.md)
- [Jobs, Audit, and observability](../architecture/jobs-audit-observability.md)
- [Administration and production promotion](../implementation/14-administration-production.md)
- [Nova Audit evidence](../nova-evidence.md#jobs-audit-activity-and-realtime)
- [Original Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0)
- [SOL X Master Blueprint](https://app.notion.com/p/39ab6410e5028158b555c9a34752e292)

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
Nova supplies typed immutable Audit primitives under
[`internal/audit`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/audit)
and distinguishes them from user-facing
[`internal/activity`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/activity).
This is primitive evidence, not a complete Project-auditor journey.

This Project-
scoped read/export contract, typed credential and exact durable-work/finalizer
protocol are Omega target design, not migrated behavior.
