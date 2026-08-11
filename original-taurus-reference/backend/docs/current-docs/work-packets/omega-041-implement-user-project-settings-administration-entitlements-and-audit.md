---
title: "Execute Ω-041 — Implement user/project settings, administration, entitlements, and audit"
packet_id: "Ω-041"
status: "ready-for-execution"
wave: "Wave 5 — Complete the control plane"
depends_on: "Ω-038, Ω-039, Ω-040"
source_mirror: "docs/current-docs/notion/work-packets/omega-041-implement-user-project-settings-administration-entitlements-and-audit.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-041 — Implement user/project settings, administration, entitlements, and audit

## Mission

Omega exposes the minimum stable account, Project, and Organization management surface needed to operate the completed backend. User/account settings, Project metadata/access/defaults, Organization administration, bounded entitlements, administrative audit, and transactional outbox are production safe and remain outside Project capability implementations. High-risk changes are versioned, step-up protected, impact-previewed, audited, and recoverable.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-038, Ω-039, Ω-040**.

Source dependency statement: Ω-038 through Ω-040 and the Project admission/job contracts

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
- `docs/current-docs/notion/work-packets/omega-041-implement-user-project-settings-administration-entitlements-and-audit.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-enterprise-control-plane--3acb6410e502.md`
- `docs/current-docs/notion/primary/architecture-taurus-layered-application-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/deployment-taurus-topology-and-scaling-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-control-plane-user-cell-and-project-subcell-integration--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-user-agents-and-personality-library--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-user-context-library--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-user-template-library--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-identity-organization-project-ownership-and-access--3acb6410e502.md`
- `docs/current-docs/notion/supporting/experience-organization-administration--3acb6410e502.md`
- `docs/current-docs/notion/supporting/settings-user-and-project--3acb6410e502.md`

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

Source mirror: `docs/current-docs/notion/work-packets/omega-041-implement-user-project-settings-administration-entitlements-and-audit.md`

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

