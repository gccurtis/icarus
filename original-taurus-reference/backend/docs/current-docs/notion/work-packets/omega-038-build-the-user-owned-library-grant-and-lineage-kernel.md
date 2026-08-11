---
title: "Work Packet — Ω-038 — Build the user-owned library, grant, and lineage kernel"
notion_page_id: "3acb6410e5028112b3d7e37e3daa31d0"
notion_url: "https://app.notion.com/3acb6410e5028112b3d7e37e3daa31d0"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:49:09Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-038 — Build the user-owned library, grant, and lineage kernel

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

