---
title: "Execute Ω-038 — Build the user-owned library, grant, and lineage kernel"
packet_id: "Ω-038"
status: "ready-for-execution"
wave: "Wave 5 — Complete the control plane"
depends_on: "Ω-009, Ω-011, Ω-014, Ω-015, Ω-019"
source_mirror: "docs/current-docs/notion/work-packets/omega-038-build-the-user-owned-library-grant-and-lineage-kernel.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-038 — Build the user-owned library, grant, and lineage kernel

## Mission

Omega has one control-plane library kernel for every user-level Personality, Context, and Template. The kernel is reachable after sign-in without selecting a Project. It owns stable asset identity, user ownership, metadata, lifecycle, effective permissions, User/Organization grants, protected lineage, usage, idempotent capture/materialization, durable job status, caller-filtered search, and audit-safe projections. Typed capability packages own version content; they do not invent parallel owners, grants, or ACLs. This is the minimum stable control plane required by the completed Project backend. It is intentionally narrower than the full future enterprise surface.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-009, Ω-011, Ω-014, Ω-015, Ω-019**.

Source dependency statement: Ω-009, Ω-011, Ω-014, Ω-015, and Ω-019.

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
- `docs/current-docs/notion/work-packets/omega-038-build-the-user-owned-library-grant-and-lineage-kernel.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-enterprise-control-plane--3acb6410e502.md`
- `docs/current-docs/notion/primary/architecture-taurus-layered-application-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-control-plane-user-cell-and-project-subcell-integration--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-user-agents-and-personality-library--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-user-context-library--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-user-template-library--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-identity-organization-project-ownership-and-access--3acb6410e502.md`
- `docs/current-docs/notion/supporting/experience-organization-administration--3acb6410e502.md`

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

Source mirror: `docs/current-docs/notion/work-packets/omega-038-build-the-user-owned-library-grant-and-lineage-kernel.md`

### Outcome
Omega has one control-plane library kernel for every user-level Personality,
Context, and Template. The kernel is reachable after sign-in without selecting
a Project. It owns stable asset identity, user ownership, metadata, lifecycle,
effective permissions, User/Organization grants, protected lineage, usage,
idempotent capture/materialization, durable job status, caller-filtered search,
and audit-safe projections. Typed capability packages own version content; they
do not invent parallel owners, grants, or ACLs.
This is the minimum stable control plane required by the completed Project
backend. It is intentionally narrower than the full future enterprise surface.
### Reviewed evidence
The three typed library specifications repeat the same envelope and are
reconciled here:
- [Implementation — User Agents & Personality Library](https://app.notion.com/p/3acb6410e50281229fe9eec53047607c)
- [Implementation — User Context Library](https://app.notion.com/p/3acb6410e502814e928ae1f10eac6f75)
- [Implementation — User Template Library](https://app.notion.com/p/3acb6410e50281d4a4d8ee542f91d595)
The authority boundary comes from
[Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22),
[Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f),
and [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf).
Current Omega has project Personas, Contexts, Templates, Resource access, and
durable jobs, but no single user-library authority. No existing Project content
is therefore assumed to be a library master.
### Scope
- User-owned canonical asset envelopes for `personality`, `context`, and
	`template`.
- `use` and `edit` grants to User or Organization principals.
- Dynamic effective-permission resolution through current Organization
	membership.
- Owner-only grant management, trash/restore, and lifecycle authority.
- Immutable safe origin/lineage and append-only successful usage.
- Capture from a Project under current authorization and export-governance
	policy.
- Materialize an exact version into an explicit writable Project as an
	independent copy.
- Durable receipts/jobs, metadata-version CAS, and idempotency.
- Caller-filtered list/search/detail/share/usage projections.
### Non-goals
- Organization-owned library masters in V1.
- Ownership transfer, deny grants, public links, anonymous access, or
	organization-wide implicit edit.
- A live pointer from a library asset to Project content or from a Project copy
	back to its master.
- Automatic Project-to-library promotion, bulk migration of project assets, or
	inferred ownership based on creator/name/role.
- Typed Personality, Context, or Template payload tables; Ω-039 owns those.
- Billing, SSO, SCIM, or distributed control-plane deployment.
### Invariants
1. Every canonical master has exactly one `owner_user_id`.
2. An Organization is a grant principal and administrative principal, not an
	authenticating shared user and not a V1 library owner.
3. `use` permits reading an exact usable version and materializing a copy.
	`edit` additionally permits typed revisions and metadata edits. Neither
	permits share management, trash/restore, or ownership mutation.
4. The strongest currently effective grant wins. Organization-derived access
	disappears as soon as membership or the grant is revoked.
5. A materialized Project copy is independently authorized and revised. Later
	master edits or revocation do not rewrite or delete that copy.
6. Lineage is protected provenance, never an authorization shortcut. Hidden
	source names, grants, and Project data are access-filtered in projections.
7. Capture is a governed export: current Project read, exact source revision,
	governing Organization/policy, and export approval are resolved and checked
	in one plan. Unknown or unavailable governance fails closed.
8. Lists and search filter before pagination/projection. Unauthorized asset IDs
	are non-disclosing.
9. Metadata, grants, lifecycle, lineage, materialization, usage, receipt, audit,
	and outbox mutations commit atomically where one action changes them.
10. Library services may ask a narrow Project export/materialization port; they
	cannot open Project stores directly or activate a Project merely to list a
	library.
### Target packages and interfaces
```plain text
core/control/library/
  model.go          Asset, Grant, permissions, lineage, lifecycle
  service.go        commands and caller-filtered queries
  authorize.go      owner/grant/Organization resolution
  capture.go        governed Project export orchestration
  materialize.go    exact-version Project copy orchestration
  jobs.go           control-plane durable work
  audit.go          safe event projection
core/control/library/ports/
core/platform/storage/sqlite/library/     D0 adapter
core/platform/storage/postgres/library/   P1 adapter, completed in Ω-042
core/transport/http/library/
```
```go
type AssetKind string
const (
    AssetPersonality AssetKind = "personality"
    AssetContext     AssetKind = "context"
    AssetTemplate    AssetKind = "template"
)

type Asset struct {
    ID              string
    Kind            AssetKind
    OwnerUserID     string
    Name            string
    Description     string
    Status          string // active | trashed
    HeadVersion     uint64
    MetadataVersion uint64
    CreatedAt       time.Time
    UpdatedAt       time.Time
    TrashedAt       *time.Time
}

type Grant struct {
    AssetID     string
    Subject     PrincipalRef // user | organization
    Permission  string       // use | edit
    GrantedBy   string
    Version     uint64
}

type EffectivePermissions struct {
    Use          bool
    Edit         bool
    ManageGrants bool
    TrashRestore bool
    Paths        []PermissionPath
    AccessEpoch  uint64
}

type PayloadAdapter interface {
    Kind() AssetKind
    Head(ctx context.Context, assetID string) (uint64, error)
    ExportProjectVersion(ctx context.Context, req CapturePlan) (SafePayload, error)
    MaterializeProjectCopy(ctx context.Context, req MaterializationPlan) (ProjectCopyRef, error)
}
```
### Persistence
Use portable logical DDL with PostgreSQL as the managed P1 authority and SQLite
as D0:
```sql
CREATE TABLE library_assets (
    id                TEXT PRIMARY KEY,
    kind              TEXT NOT NULL,
    owner_user_id     TEXT NOT NULL,
    name              TEXT NOT NULL,
    description       TEXT NOT NULL,
    status            TEXT NOT NULL,
    head_version      BIGINT NOT NULL,
    metadata_version  BIGINT NOT NULL,
    created_at        TIMESTAMP NOT NULL,
    updated_at        TIMESTAMP NOT NULL,
    trashed_at        TIMESTAMP,
    CHECK (kind IN ('personality','context','template')),
    CHECK (status IN ('active','trashed'))
);

CREATE INDEX library_assets_owner_kind
    ON library_assets(owner_user_id, kind, status, id);

CREATE TABLE library_asset_grants (
    asset_id      TEXT NOT NULL,
    subject_kind  TEXT NOT NULL,
    subject_id    TEXT NOT NULL,
    permission    TEXT NOT NULL,
    granted_by    TEXT NOT NULL,
    version       BIGINT NOT NULL,
    created_at    TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP NOT NULL,
    PRIMARY KEY (asset_id, subject_kind, subject_id),
    CHECK (subject_kind IN ('user','organization')),
    CHECK (permission IN ('use','edit'))
);

CREATE INDEX library_grants_subject
    ON library_asset_grants(subject_kind, subject_id, asset_id);

CREATE TABLE library_asset_lineage (
    asset_id             TEXT NOT NULL,
    ordinal              INTEGER NOT NULL,
    source_kind          TEXT NOT NULL,
    source_project_id    TEXT,
    source_resource_kind TEXT,
    source_resource_id   TEXT,
    source_revision      BIGINT,
    source_digest        TEXT NOT NULL,
    policy_version       TEXT,
    safe_metadata_json   TEXT NOT NULL,
    created_at           TIMESTAMP NOT NULL,
    PRIMARY KEY (asset_id, ordinal)
);

CREATE TABLE library_materializations (
    id                    TEXT PRIMARY KEY,
    asset_id              TEXT NOT NULL,
    asset_version         BIGINT NOT NULL,
    actor_user_id         TEXT NOT NULL,
    target_project_id     TEXT NOT NULL,
    target_kind           TEXT NOT NULL,
    target_id             TEXT,
    semantic_fingerprint  TEXT NOT NULL,
    status                TEXT NOT NULL,
    safe_error_code       TEXT,
    created_at            TIMESTAMP NOT NULL,
    updated_at            TIMESTAMP NOT NULL,
    UNIQUE (actor_user_id, semantic_fingerprint)
);

CREATE TABLE library_asset_usage (
    materialization_id TEXT PRIMARY KEY,
    asset_id           TEXT NOT NULL,
    asset_version      BIGINT NOT NULL,
    actor_user_id      TEXT NOT NULL,
    target_project_id  TEXT NOT NULL,
    target_kind        TEXT NOT NULL,
    target_id          TEXT NOT NULL,
    created_at         TIMESTAMP NOT NULL
);

CREATE TABLE library_mutation_receipts (
    actor_user_id       TEXT NOT NULL,
    client_request_id   TEXT NOT NULL,
    operation_kind      TEXT NOT NULL,
    target_id           TEXT NOT NULL,
    result_version      BIGINT,
    result_json         TEXT NOT NULL,
    created_at          TIMESTAMP NOT NULL,
    PRIMARY KEY (actor_user_id, client_request_id)
);
```
Control-plane `library_jobs` may reuse a general control job/outbox substrate if
it provides the same actor, access epoch, lease, retry, and idempotency
semantics. It must not use Project jobs without an explicit adapter or fabricate
a Project scope.
### HTTP surface
```plain text
GET    /me/library-assets?kind=&query=&owner=&limit=&cursor=
GET    /me/library-assets/{assetID}
GET    /me/library-assets/{assetID}/shares
PUT    /me/library-assets/{assetID}/shares/{subjectKind}/{subjectID}
DELETE /me/library-assets/{assetID}/shares/{subjectKind}/{subjectID}
DELETE /me/library-assets/{assetID}
POST   /me/library-assets/{assetID}/restore
GET    /me/library-materializations/{materializationID}
GET    /me/library-jobs/{jobID}
```
Typed routes in Ω-039 remain the primary product API. These neutral endpoints
may be internal or used for common status/share components. Mutations carry
`expectedMetadataVersion` and `clientRequestId`; lists use keyset cursors.
### Sequential tasks
1. Freeze Asset/Grant/permission/lifecycle/lineage/materialization semantics and
	the non-disclosure threat model.
2. Add shared D0 schema, store contracts, permission evaluator, keyset queries,
	CAS, and mutation receipts.
3. Introduce `PayloadAdapter` and register no-op test adapters for all three
	kinds; prove the kernel never decodes typed payload.
4. Implement owner and User/Organization grant evaluation through the identity
	port, including access-epoch invalidation.
5. Implement owner-only grants and trash/restore with audit/outbox.
6. Implement exact-version materialization plans, durable status, idempotency,
	Project reauthorization, and append-only usage.
7. Implement governed Project capture with fail-closed policy resolution and
	protected safe lineage.
8. Add caller-filtered list/search/detail/share/usage projections and common
	HTTP error/cursor contracts.
9. Implement P1 PostgreSQL adapter in Ω-042, performance indexes, retention,
	metrics, and operational tooling.
### Security, privacy, concurrency, idempotency, and observability
By-ID reads return access-filtered absence unless a safe management surface may
distinguish denial. Grant subject existence is verified without exposing users
or Organizations the actor cannot manage. Editing content cannot escalate to
sharing. Origin displays “unavailable source” when lineage remains but source
metadata is no longer visible.
Metadata/grant commands use expected metadata version. Payload publication in
Ω-039 uses a typed head revision. Materialization fingerprints include actor,
asset/version, target Project, operation/slot, mapping version, and client key.
Workers or retries reauthorize both library `use` and target Project write
before commit. Revocation prevents a new materialization but does not revoke an
already independent Project copy.
Audit records contain actor/subject/asset IDs, kind, permission, versions,
policy decision, safe digest, and outcome—not definitions, Context leaves,
template prompts/content, hidden Project names, or generated payload. Metrics
cover owned/shared assets, grant paths, permission denials, search latency,
CAS conflicts, captures/materializations, retries, policy-unknown failures,
revocation lag, and orphaned job/attempt age.
### Tests and failure drills
- Owner/use/edit/none permission matrix, strongest-path composition, nested
	Organization membership, revoked membership/grant, trashed asset, and owner
	invariants.
- Non-disclosing lists, search, detail, shares, usage, lineage, errors, and
	cursor stability under concurrent changes.
- Store contracts on SQLite and PostgreSQL, uniqueness, CAS races, concurrent
	grants, concurrent trash/revise, and transaction rollback.
- Capture fails closed for stale source, lost Project access, unresolved
	governing Organization, policy outage/deny, stale approval, or changed digest.
- Materialization replays after queue duplication, lease expiry, process crash,
	target Project revocation, source grant revocation, and commit-ack loss.
- An existing Project copy survives master trash/revision/grant removal and
	does not expose the master.
- Load tests cover large personal libraries, many Organization grant paths,
	bounded “used in” projections, and indexed keyset pagination.
### Migration, rollback, and completion evidence
Create empty library tables. Do not backfill project Personas, Contexts, or
Templates and do not infer masters. Existing Project capabilities continue
unchanged until Ω-039 enables explicit capture/materialization. Rollback
disables user-library routes and adapters; Project copies remain independent.
Never cascade-delete Project content from library tables. Additive tables remain
through the rollback window.
Completion evidence includes shared-kernel contract tests for all asset kinds,
authorization/adversarial report, CAS/idempotency/race results, Project
capture/materialization demonstration, audit-redaction proof, SQLite/PostgreSQL
store parity, and schema inspection proving no typed capability created a
parallel owner/grant table.
### Dependencies
Depends on Ω-009, Ω-011, Ω-014, Ω-015, and Ω-019. Consume the current
identity/Organization membership behavior only through a narrow port; Ω-040
replaces and hardens that adapter without changing this kernel. Blocks Ω-039
and contributes to Ω-041 and Ω-044.
### Linked sources
- [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf)
- [Implementation — Control Plane, User Cell & Project Subcell Integration](https://app.notion.com/p/3acb6410e50281b2999bce58d559d902)
- [Experience — Organization Administration](https://app.notion.com/p/3acb6410e502815c8782cb126c93b787)

