---
title: "Work Packet — Ω-041 — Implement user/project settings, administration, entitlements, and audit"
notion_page_id: "3acb6410e502810d884cd50770f5352d"
notion_url: "https://app.notion.com/3acb6410e502810d884cd50770f5352d"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:49:09Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-041 — Implement user/project settings, administration, entitlements, and audit

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

### Outcome
Omega exposes the minimum stable account, Project, and Organization management
surface needed to operate the completed backend. User/account settings,
Project metadata/access/defaults, Organization administration, bounded
entitlements, administrative audit, and transactional outbox are production
safe and remain outside Project capability implementations. High-risk changes
are versioned, step-up protected, impact-previewed, audited, and recoverable.
### Reviewed evidence
- [Settings — User & Project](https://app.notion.com/p/3acb6410e5028122ab96eed1434bb897)
- [Experience — Organization Administration](https://app.notion.com/p/3acb6410e502815c8782cb126c93b787)
- [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Implementation — Control Plane, User Cell & Project Subcell Integration](https://app.notion.com/p/3acb6410e50281b2999bce58d559d902)
These Supporting experience/settings pages refine, but do not override, the
Primary identity and architecture boundaries.
### Scope
Account:
- Profile, preferences, sessions/devices, security/recovery status, external
	identity summaries, and effective plan/entitlement view.
- Managed-account fields separated from locally editable fields.
Project:
- Metadata, OwnerRef, grants/invites/share-link policy, defaults, connector
	inventory, retention/export policy, archive/delete/restore, and ownership
	transfer entry points.
- Explicit ProjectID and admission; no ambient selected Project.
Organization:
- Root/unit tree, people/invitations/offboarding preview, Projects/custody,
	access reviews, security/policy configuration, plan/usage projection, audit,
	and danger-zone workflows.
- SSO/SCIM configuration records and adapter seams may exist, but a complete
	third-party IdP/SCIM integration is not required for V1 certification unless
	separately introduced as a feature.
Platform:
- Plan assignments and operation-relevant entitlement snapshots/usage.
- Append-only safe control audit and transactional outbox with idempotent
	consumers.
### Non-goals
- A billing engine, tax/invoicing, sales workflow, or capability packages
	calling a payment provider.
- Implicit Organization admin content access.
- Distributed placement administration.
- Organization-owned library masters.
- Hard-delete without a documented retention/recovery process.
- Returning secrets, raw identity assertions, raw policy documents, or content
	in admin projections/audit.
### Invariants
1. Account and Organization admin routes do not activate a Project Cell.
2. A Project management route uses control-plane authority; opening content is a
	separate admitted action.
3. Entitlements are concrete feature/limit snapshots, not plan-name branches in
	capabilities.
4. User-owned Project entitlements resolve from the owning User; Organization-
	owned Project entitlements resolve from the governing root. Organization
	policy can restrict managed users and cannot be overridden by personal plan.
5. Submission validates quota/policy and records version; protected execution
	reauthorizes; accepted usage commits through a dedicated port without
	content.
6. Every high-risk mutation has a named permission, recent authentication or
	step-up, impact preview, expected version, idempotency key, audit, outbox,
	and recovery window where feasible.
7. Audit is append-only and redacted. Outbox is transactional with canonical
	state and consumers are idempotent.
8. Lists, “used in,” people, Projects, usage, audit, grants, and search are
	caller-filtered before projection.
### Target packages, ports, and schema
```plain text
core/control/account/
core/control/projectsettings/
core/control/organizationadmin/
core/control/entitlement/
core/control/audit/
core/control/outbox/
core/platform/storage/{sqlite,postgres}/control/
core/transport/http/settings/
core/transport/http/admin/
```
```go
type EntitlementSnapshot struct {
    Source        PrincipalRef
    PlanCode      string
    PolicyVersion string
    Features      map[string]bool
    Limits        map[string]int64
    EffectiveAt   time.Time
    ExpiresAt     time.Time
}

type EntitlementPort interface {
    ResolveForProject(context.Context, Actor, string) (EntitlementSnapshot, error)
    Reserve(context.Context, UsageRequest) (UsageReservation, error)
    Commit(context.Context, UsageReservation, UsageAccepted) error
    Release(context.Context, UsageReservation) error
}
```
```sql
CREATE TABLE user_settings (
    user_id        TEXT PRIMARY KEY,
    version        BIGINT NOT NULL,
    profile_json   TEXT NOT NULL,
    preferences_json TEXT NOT NULL,
    updated_at     TIMESTAMP NOT NULL
);

CREATE TABLE project_settings (
    project_id       TEXT PRIMARY KEY,
    version          BIGINT NOT NULL,
    defaults_json    TEXT NOT NULL,
    connector_policy_json TEXT NOT NULL,
    retention_json   TEXT NOT NULL,
    export_policy_json TEXT NOT NULL,
    updated_at       TIMESTAMP NOT NULL
);

CREATE TABLE organization_policies (
    organization_id TEXT PRIMARY KEY,
    version         BIGINT NOT NULL,
    policy_json     TEXT NOT NULL,
    updated_by      TEXT NOT NULL,
    updated_at      TIMESTAMP NOT NULL
);

CREATE TABLE plan_assignments (
    subject_kind  TEXT NOT NULL,
    subject_id    TEXT NOT NULL,
    plan_code     TEXT NOT NULL,
    status        TEXT NOT NULL,
    starts_at     TIMESTAMP NOT NULL,
    ends_at       TIMESTAMP,
    version       BIGINT NOT NULL,
    PRIMARY KEY (subject_kind, subject_id)
);

CREATE TABLE entitlement_usage (
    id                 TEXT PRIMARY KEY,
    subject_kind       TEXT NOT NULL,
    subject_id         TEXT NOT NULL,
    project_id         TEXT,
    feature_code       TEXT NOT NULL,
    units              BIGINT NOT NULL,
    idempotency_key    TEXT NOT NULL,
    policy_version     TEXT NOT NULL,
    accepted_at        TIMESTAMP NOT NULL,
    UNIQUE (subject_kind, subject_id, idempotency_key)
);

CREATE TABLE control_audit_events (
    sequence           BIGINT PRIMARY KEY,
    root_organization_id TEXT,
    actor_user_id      TEXT NOT NULL,
    acting_kind        TEXT,
    acting_id          TEXT,
    action             TEXT NOT NULL,
    target_kind        TEXT NOT NULL,
    target_id          TEXT NOT NULL,
    outcome            TEXT NOT NULL,
    safe_before_json   TEXT,
    safe_after_json    TEXT,
    request_id         TEXT NOT NULL,
    created_at         TIMESTAMP NOT NULL
);

CREATE TABLE control_outbox_events (
    id               TEXT PRIMARY KEY,
    aggregate_kind   TEXT NOT NULL,
    aggregate_id     TEXT NOT NULL,
    aggregate_version BIGINT NOT NULL,
    event_kind       TEXT NOT NULL,
    schema_version   TEXT NOT NULL,
    safe_payload_json TEXT NOT NULL,
    status           TEXT NOT NULL,
    attempts         INTEGER NOT NULL,
    available_at     TIMESTAMP NOT NULL,
    claimed_by       TEXT,
    lease_until      TIMESTAMP,
    created_at       TIMESTAMP NOT NULL
);
```
JSON settings fields require versioned typed codecs and validation; they are
not generic unvalidated property bags.
### HTTP surface
```plain text
GET/PATCH /me
GET/PATCH /me/settings
GET/DELETE /me/sessions/{sessionID}
GET        /me/entitlements

GET/PATCH /projects/{projectID}/settings
GET       /projects/{projectID}/access
GET/POST  /projects/{projectID}/invitations
GET       /projects/{projectID}/connectors
POST      /projects/{projectID}/archive
POST      /projects/{projectID}/restore
POST      /projects/{projectID}/deletion-previews
POST      /projects/{projectID}/delete

GET/PATCH /organizations/{organizationID}/settings
GET       /organizations/{organizationID}/people
POST      /organizations/{organizationID}/offboarding-previews
POST      /organizations/{organizationID}/offboard
GET       /organizations/{organizationID}/projects
GET       /organizations/{organizationID}/access-reviews
GET/PATCH /organizations/{organizationID}/policies
GET       /organizations/{organizationID}/usage
GET       /organizations/{organizationID}/audit
```
All mutations use typed commands, not a generic JSON Patch over sensitive
state.
### Sequential tasks
1. Freeze typed account/Project/Organization setting schemas, named actions,
	managed-field rules, redaction, step-up, preview, retention, and recovery.
2. Implement account/profile/preferences/session projections and expected-
	version updates.
3. Implement Project settings/access/invitation/connector/retention/archive/
	delete projections over Ω-040 authority without activating content.
4. Implement Organization people/Project/custody/access-review projections and
	offboarding/danger workflows with impact previews.
5. Implement plan assignment, entitlement resolution, reservation/commit/
	release, and operation-relevant snapshots.
6. Implement transactional audit/outbox stores and idempotent consumers for
	revocation, cache invalidation, notifications, and operational projections.
7. Add policy/plan/settings version to admission and queued protected work.
8. Implement keyset pagination, exportable audit projections, redaction tests,
	retention/reaping, and P1 PostgreSQL adapter.
9. Complete backend-only administration, failure, load, and recovery proof.
### Security, privacy, concurrency, idempotency, and observability
Password/security changes require existing credential proof or recovery flow
and invalidate relevant sessions. High-risk Project/Organization actions
require `StepUpUntil`, expected version, and typed impact token bound to the
previewed state. Offboarding cannot orphan root ownership or Project custody.
Delete is recoverable during policy window and must not be a broad cascading
SQL operation.
Settings updates serialize by aggregate version. Usage is idempotent and does
not double-charge on job retry. Outbox claims are leased and deduplicated by
event ID/version. A delayed consumer does not change canonical authorization;
request-time epoch checks remain authoritative.
Audit and metrics contain safe IDs/action/outcome/version/count data only.
Metrics cover settings conflicts, step-up failures, preview expirations,
offboarding counts, access review state, entitlement denials/reservations/
usage, audit append latency, outbox lag/retry/dead-letter, session revocation
lag, archive/restore/delete age, and admin-query latency.
### Tests and failure drills
- Managed versus local account fields, concurrent settings edits, session
	revocation, recovery, and non-disclosing session/device projections.
- User-owned/Organization-owned Project settings and entitlement resolution;
	personal plan cannot override root restriction.
- Admin can inventory custody/manage grants but cannot read content without a
	grant.
- Offboarding preview/execute with last-owner, owned Projects, direct grants,
	shared library grants, active tasks, and stale preview/version.
- High-risk action without step-up/permission/version/idempotency; replay and
	concurrent admin mutations.
- Audit redaction, total ordering, pagination, export, and inaccessible target
	filtering.
- Outbox crash after commit, duplicate delivery, lease loss, poisoned event,
	consumer outage, backlog recovery, and revocation correctness.
- Entitlement reserve/commit/release under retry, cancellation, expiration,
	concurrent limits, and policy outage.
### Migration, rollback, and completion evidence
Backfill typed defaults explicitly and report invalid/unknown fields; do not
invent enterprise policy. Existing sessions/settings continue through adapters
until parity tests pass. Introduce audit/outbox before routing high-risk new
commands. One write authority exists for each setting. Rollback reverts route
adapters while new data remains readable; destructive actions wait until the
rollback-safe implementation and restore drills pass.
Completion requires backend-only user, Project, and Organization admin
demonstrations; entitlement enforcement without capability billing imports;
step-up/preview/version proof; no-admin-content-access proof; redacted audit and
outbox recovery reports; and SQLite/PostgreSQL store parity.
### Dependencies
Depends on Ω-038 through Ω-040 and the Project admission/job contracts. Blocks
Ω-042 through Ω-044.
### Linked sources
- [Deployment — Taurus Topology & Scaling Model](https://app.notion.com/p/3acb6410e502816585d9e96ff02921d8)
- [Implementation — User Agents & Personality Library](https://app.notion.com/p/3acb6410e50281229fe9eec53047607c)
- [Implementation — User Context Library](https://app.notion.com/p/3acb6410e502814e928ae1f10eac6f75)
- [Implementation — User Template Library](https://app.notion.com/p/3acb6410e50281d4a4d8ee542f91d595)

