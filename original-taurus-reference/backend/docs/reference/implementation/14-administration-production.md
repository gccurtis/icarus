# Stage 14 — Administration and production promotion

## Outcome

Complete scoped Settings/admin behavior and prove the assembled product under
live production-shaped identity, databases, object storage, providers,
browsers, failures, load, backup/restore, relocation, key rotation, and
rollback. Production startup remains fail closed until every enabled role and
feature has its evidence.

## Non-goals

- declaring the whole product production-grade from automated checks or source
  review
- enabling an unproved capability, provider, format, deployment role or region
- exposing secrets after write or using Product credentials for operator work
- weakening isolation/recovery evidence to meet a release date

## Target tree and files

```text
internal/control/admin/                 scoped Settings commands/queries
internal/control/identity/enterprise/   versioned OIDC/SAML provider policy
internal/control/security/              authenticators, step-up, recovery
internal/control/billing/               subscriptions, reservations, ledger
internal/integrations/billing/          narrow provider verification adapters
internal/control/exports/               governed Control export records/delivery
internal/control/exports/mysql/         export request/artifact/delivery repository
internal/control/jobs/exports/          bounded account/Audit export workers/reaping
internal/capabilities/projectaudit/     safe query/export models and validation
internal/cell/handlers/projectaudit/admin/
internal/host/jobs/projectaudit/        exact Project-Audit export work
internal/transport/http/{bootstrap,product}/settings/
internal/wiring/production/             enabled-role graph and readiness
cmd/taurus-operator/                    separately credentialed privileged jobs
cmd/taurus-migrate/                     operator-only schema plan/verify/apply
configs/{policy,production}/            versioned schemas/examples, no secrets
deploy/                                 production manifests and rollout policy
migrations/control/*_governed_exports.sql
migrations/control/*_enterprise_identity_security.sql
migrations/control/*_billing_usage.sql
migrations/project/*_project_audit_exports.sql
test/{security,recovery,performance,acceptance}/
docs/runbooks/                           backup, restore, rotation, rollback
```

## Versioned contracts and schemas

Settings is a presentation/action registry over canonical owner operations,
not a generic backend aggregate. Every surfaced Account/Project/Organization
entry names its owner operation, scope, effective/default/override/lock state,
expected revision, authority, consequence and reversibility. Release
declarations and readiness reports are versioned artifacts naming source/
build/config/schema/provider and evidence versions. Unknown setting, policy or
deployment-role versions fail closed. Operator jobs use a separate runner/
credential set and are never claimable by Product Hosts. `taurus-migrate` is an
operator-only one-shot tool:
it has no Product listener or Cell graph and accepts only short-lived,
schema-scoped authority. It cannot run with a Product Host or Control-worker
credential.

## Stage 14 operation slice and authority boundaries

The [Control capability's canonical operation table](../capabilities/control-and-administration.md#canonical-versioned-control-operations)
is the naming authority. Stage 14 completes the administration surface with:

- Account identity/profile/session and governed lifecycle:
  `users.current.get.v1`, `users.current.profile.update.v1`,
  `identity.links.list.v1`, `sessions.user.list.v1`,
  `users.current.export.request.v1`,
  `users.current.export.status.get.v1`,
  `users.current.export.delivery.create.v1`, and
  `users.current.deletion.request.v1`;
- enterprise identity, authenticators, step-up and recovery:
  `identity.enterprise_providers.list.v1`,
  `identity.enterprise_providers.create.v1`,
  `identity.enterprise_providers.update.v1`,
  `identity.enterprise_providers.disable.v1`,
  `security.authenticators.list.v1`,
  `security.webauthn.registration.begin.v1`,
  `security.webauthn.registration.complete.v1`,
  `security.totp.enrollment.begin.v1`,
  `security.totp.enrollment.complete.v1`,
  `security.authenticators.revoke.v1`,
  `security.recovery_codes.rotate.v1`,
  `security.step_up.begin.v1`, `security.step_up.complete.v1`,
  `identity.recovery.begin.v1`, and `identity.recovery.complete.v1`;
- Project General and access: `projects.profile.get.v1`,
  `projects.profile.update.v1`, `projects.grants.list.v1`, and the exact grant/
  lifecycle operations owned by Control;
- Organization profile, Users, policy, and entitlements:
  `organizations.current.get.v1`,
  `organizations.current.profile.update.v1`,
  `organizations.policy.get.v1`, `organizations.policy.update.v1`,
  `entitlements.get.v1`, and `entitlements.update.v1`;
- Organization billing and normalized usage:
  `billing.current.get.v1`,
  `billing.subscription.change.request.v1`,
  `billing.subscription.status.get.v1`, `billing.usage.list.v1`,
  `billing.provider_reconciliation.start.v1`, and
  `billing.provider_reconciliation.status.get.v1`; provider-backed work uses
  the internal exact `billing.usage_reservations.create.v1`,
  `billing.usage_reservations.settle.v1`, and
  `billing.usage_reservations.cancel.v1` contracts rather than a public bypass;
- governed infrastructure lifecycle: `projects.status.get.v1`,
  `projects.provisioning.retry.v1`, `projects.relocation.begin.v1`, and
  `projects.retirement.begin.v1`; and
- governed Control evidence access: `audit.search.v1`, `audit.export.v1`,
  `audit.export.status.get.v1`, and
  `audit.export.delivery.create.v1`; and
- governed exact-Project evidence access from the
  [Project Audit contract](../capabilities/project-audit.md#canonical-operations):
  `project_audit.search.v1`, `project_audit.records.get.v1`,
  `project_audit.export.request.v1`,
  `project_audit.export.status.get.v1`, and
  `project_audit.export.delivery.create.v1`.

Project General reads and writes `Name`, `Description`, and exact
`ProfileVersion` through `projects.profile.get.v1` and
`projects.profile.update.v1`; it does not use a generic Project PATCH.
Sole-owner Project deletion/retirement, relocation, account deletion,
entitlement expansion, security-policy changes, and Audit export require the
operation-specific step-up, expected version, consequence disclosure, durable
status, and required Audit declared by the canonical contract. There are no
generic `settings.*` or `policies.*` mutation aliases that can bypass those
owners.

Enterprise identity configuration stores immutable, versioned trust policy,
not provider sessions or passwords. Google/Microsoft OIDC remain admitted
standards adapters; Organization administrators may configure exact enterprise
OIDC or SAML identity providers, including Okta through those standards.
Provider disable denies new ceremonies but does not silently disable Users.
WebAuthn/passkeys are the preferred high-assurance step-up method. TOTP and
one-use recovery codes are governed fallbacks; federated reauthentication from
Stage 02 remains available only where current Organization policy admits it.
Every challenge is browser/session/operation-class bound, short-lived, one-use
and replay protected. Recovery is non-enumerating and cannot transfer
Organization membership, Project ownership, or revive old authority.

Billing is an Organization administration domain, not authorization. Taurus
stores a versioned subscription projection, finite pre-admission usage
reservations, an immutable normalized usage ledger and explicit provider
reconciliation results. Checkout redirects and webhooks are untrusted inputs
until authenticated and re-read through the narrow provider adapter. Payment
instrument data and provider SDK payloads never enter canonical Control state.
An active plan may enable entitlements only through the explicit reconciled
subscription-to-entitlement policy; neither a plan, invoice, webhook nor usage
reservation grants Project or Resource access.

Production promotion also proves that the already-defined internal Agent
principal/tool-grant, exact sponsorship, standing-delegation, mutation-permit,
revocation, placement, and lifecycle-result operations remain unreachable from
the public administration transport. Privileged DDL, backup/restore, key
ceremonies, and infrastructure mutation are operator-runner contracts, not
additional Control Product operations.

### Project Audit principal rollout

Stage 14 extends the checked Project Schema Contract with Project Audit safe
query/export routines and provisions a separate query/export-only database
principal represented by `ProjectAuditCredentialRef`. Every newly provisioned
Project Database receives and passes live positive/negative grant verification
before activation. An idempotent operator-governed rollout creates or upgrades
the same routines/principal for every existing Active or safely drainable
Project Database, records its schema/credential generation result in trusted
placement, and leaves any unverified Project's Audit administration disabled
and unready rather than falling back to Product credentials.

That schema rollout uses the existing closed `durable_work@1` receipt proof for
the exact Project-Audit export Work/Job and installs the
`project_audit_export@1` closed-kind finalizer with its matching
`ProjectAuditExportFinalizerCredentialRef`. It adds no capability-specific
receipt kind, does not widen receipt proof or
the generic Product principal, and no other finalizer kind can terminalize a
Project-Audit export.

Production administration wiring composes
`control.project_placements.audit_target.resolve.v1` to return only a
`ProjectAuditTarget` for the already authorized exact Project. The separately
wired Project-Audit graph can resolve that target; Product, fence, receipt-
proof, permit-settlement, finalizer and operator graphs cannot substitute for
it. Negative grants prove the Project Audit principal cannot access Control,
Resource bodies, permit/job/fence tables, arbitrary Audit mutation, another
Project, account administration or DDL. Rollout/retry/rotation is generation-
fenced and never creates two accepted credential generations for one placement.

## Governed Control export artifacts and delivery

Account and Control-Audit exports are Control-owned evidence products. They are
not ordinary Project Files, Project archive packages, database backups, or
object-store URLs. Both use one versioned record shape:

```text
ControlExportArtifact {
  ExportID, Kind(account|control_audit), RequesterUserID,
  AuthorizedScope, FilterDigest, SourceCutoff, PolicyVersion,
  ContentSchemaVersion, State, SealedObjectRef?, ByteSize?, Digest?,
  EnvelopeKeyVersion?, CreatedAt, ReadyAt?, ExpiresAt?,
  LegalHoldState, FailureCategory?, Revision
}

ControlExportDelivery {
  DeliveryID, ExportID, RequesterUserID, SessionFamilyID,
  StepUpEvidenceRef, IssuedAt, ExpiresAt, UsedAt?, RevokedAt?
}
```

Artifact states are exactly `queued`, `building`, `ready`, `failed`, `expired`,
`deletion_pending`, and `deleted`. Transitions use expected revision and worker
generation; no terminal state returns to `ready`. Retry after a retryable build
Attempt keeps the artifact `building`, records a new Attempt under the same
identity, and cannot change the frozen source cutoff/filter. `failed` is set
only after the admitted retry policy is exhausted or the failure is terminal.
Delivery states are `issued`, `used`, `expired`, and `revoked`; only `issued`
may transition to `used`, exactly once.

`SealedObjectRef` is an application-encrypted opaque reference stored only in
Control. The object is envelope-encrypted under a managed per-artifact data key
and a versioned Control export key; neither key material nor an unsealed object
reference enters the database, response, job payload, log, Audit, or Activity.
The object-store role is limited to the Control-export namespace and cannot
read Project File objects. A delivery record contains no object ref or key.

`users.current.export.request.v1` snapshots the current User export scope and
policy. It includes only policy-admitted account/profile, exact Organization
assignment, Project-grant/settings references, connector/identity-link display
metadata, and other explicitly registered User-owned records. It excludes
provider credentials, session credentials/verifiers, CSRF material, permit or
delegation secrets, internal placement/database references, and unrelated
Users. `audit.export.v1` freezes one authorized bounded filter, Control Audit
cutoff, redaction policy, and output schema; it cannot export Project Audit or
Resource bodies through the Control route.

The request command re-evaluates live authority, requires operation-specific
step-up, and atomically commits the request, exact snapshot/filter digest,
durable Control job, idempotency, and required Control Audit. The worker reads
only fields admitted by the export schema, serializes deterministically,
envelope-encrypts a staging object, verifies its size/digest, and then advances
the Control record to `ready` with the sealed object reference. A crash before
the ready commit leaves a collectible staging object; a crash after it returns
the same status. Stable request and artifact identities prevent duplicate
outputs. A failed notification never hides a ready export because status is
queryable.

Delivery requires a current authorized session and fresh operation-specific
step-up even if request creation was stepped up. The delivery command issues a
short-lived one-use delivery capability or immediately binds one stream; the
transport resolves the sealed reference server-side. Creation, use, denial,
expiry, and administrative access are attributed in Control Audit. Raw object
URLs, references, keys, and decrypted content never log. Revocation, User
disable/deletion state, scope loss, export expiry, or policy/legal-hold change
is checked again before bytes are opened.

Retention is policy/type-specific and remains explicit rather than guessed.
Once an artifact is expired or revoked, no new delivery succeeds even if
physical deletion is retrying. A fenced cleanup job deletes ciphertext and
retains only the minimum tombstone, digest, policy/version, and required Audit
metadata; legal hold blocks deletion but never grants delivery. Account and
Audit export policies may differ, and neither may weaken canonical Control
retention.

## Settings scope

### Account

Profile; sign-in identities and sessions/devices; appearance/accessibility;
notifications; AI/privacy; connected accounts; export/delete controls.

### Project

General through the exact Project-profile operations; owner/members/sharing;
focus/conventions; Project Agent; Knowledge and Sources; AI/Memory; connectors;
retention/export; archive/delete danger zone.

### Organization

Profile; Users; roles/access policy; Project defaults; entitlements/billing;
AI providers/model policy; connector policy; OIDC/security; retention/residency;
Audit access; data export; deletion danger zone. Groups remain unavailable
unless separately accepted.

Every entry identifies its canonical owner operation, scope, inheritance/
default/override/policy lock, required authority, effective version,
consequence, application timing, and reversibility. Project Agent, Knowledge,
Source, connector, AI/Memory, Resource retention/export/archive and similar
entries invoke those capabilities' registered commands; the Settings surface
does not own or rewrite their state. Secrets are write-only. Unsupported
entries are visibly unavailable rather than accepted by a generic map.

Control-owned effects commit with Control Audit; capability-owned Project
effects consume their own fresh permit and commit with Project Audit through
the owning Project transaction. No Audit appender opens a second database
transaction. High-risk asynchronous work records durable status and generation;
crash/retry resumes idempotently, while stale policy/authority or revocation
prevents a new permit/commit.

## Production composition

- managed secrets/keys with rotation, recovery, and access Audit;
- supported Go/MySQL/Node lines and pinned dependency/artifact provenance;
- verified TLS and least-privilege Control/Project/object/provider roles;
- verified Project-Audit query/export-only principals for every new and
  existing promoted Project placement, with the typed audit-target resolver
  composed only into the administration graph;
- Bridge and Silo Project placement, connection budgets, provisioning,
  relocation, retirement, backup, restore, schema rollout;
- multi-Host job discovery/claiming without credential enumeration;
- provider policy, regional/compliance/budget/outage behavior;
- rate/size/time/concurrency/spend limits at all external boundaries;
- bounded logs/telemetry, required Audit access/retention, alerting/runbooks;
- safe rollout, feature activation, rollback, and disaster recovery; and
- explicit production health/readiness by enabled capability.

Operator backup/restore and Product portability are separate systems.
Operator recovery restores an exact Control or Project Database plus governed
object inventory, keys, placement identity and recovery metadata under stated
RPO/RTO. A Product Project archive or native package instead crosses an
application trust boundary, is inspected and validated, and is restored only
as an authorized import into a selected destination identity. It cannot restore
sessions, grants, permits, credentials, Audit identity or infrastructure state,
and it is never accepted as a database backup.

## Proof matrix

The cross-product evidence matrix is:

### Isolation and security

- at least two Users, Organizations, Projects, Hosts, Cells, and browser tabs;
- cross-Project database/object/cache/search/realtime/provider leakage attacks;
- OIDC/session/cookie/CSRF/origin/redirect/key rotation/provider outage;
- enterprise OIDC/SAML metadata/signing-key rollover, domain/tenant admission,
  disable races, WebAuthn origin/RP/counter/credential uniqueness, TOTP clock
  window, recovery-code one-use, authenticator loss, step-up replay and
  governed recovery non-enumeration;
- owner/grant/entitlement/policy/revocation races and strong effective fencing;
- billing provider redirect/webhook forgery, duplicate/out-of-order delivery,
  subscription-generation races, exact usage reserve/settle/cancel,
  over-ceiling admission, immutable ledger, receipt conflict, frozen-window
  reconciliation and proof that commercial state cannot grant Project access;
- injection, parser/archive, SSRF, deserialization, resource exhaustion, secret
  leakage, dependency vulnerabilities, and operator separation.

### Reliability and recovery

- process/Host/database/object/provider/network failure at every commit/job
  boundary;
- operator Control and per-Project database/object backup/restore with stated
  RPO/RTO;
- Product archive/package export and restore-as-import, with explicit proof
  that it cannot act as database recovery or an authorization snapshot;
- Bridge single-Project extraction/restore and Silo restore;
- placement relocation without two writable truths and stale-handle fencing;
- migration expand/contract/version windows and rollback;
- key/secret rotation and lost-key recovery policy;
- account/Audit export crash at request, object write, ready commit, delivery,
  expiry, and reap boundaries; exactly one artifact, no orphan delivery, and
  truthful status after notification failure;
- projection/index/realtime rebuild from canonical truth.

### Performance and scale

- representative and adversarial Resource sizes;
- interactive latency/throughput/fairness under concurrent Cells/Hosts;
- database connection and job polling fleet budgets;
- prompt/provider queue, token/spend, and cancellation limits;
- browser startup/bundle/edit/render/virtualization/a11y performance;
- separately measured operator backup/restore, Product import/export, and large
  object throughput; and
- capacity model with alert thresholds and safe overload behavior.

### Product acceptance

- canonical journeys in `docs/product/user-journeys.md` across real components;
- headless and browser results agree on canonical versions;
- all promoted capability features have stable errors, support/runbook, and
  explicit unavailable behavior outside their boundary;
- Data/Activity/Search/Memory/Audit distinctions remain visible and enforceable;
- import/export fidelity/loss is truthful; and
- destructive/agent/external actions satisfy review and consequence UX.

### Governed export security

- account export cannot include another User, provider/session secrets,
  authority credentials, raw object refs, or internal placement information;
- Control-Audit export enforces exact authorized scope/filter/cutoff and cannot
  expose Project Audit or Resource bodies;
- Project-Audit query/export remains inside one bound Project and cannot expose
  Control Audit, Resource bodies or another Project; its typed credential is
  query/export-only and cannot alter Audit or canonical capability state;
- both a newly provisioned and a pre-existing upgraded Project Database pass
  live Project-Audit positive/negative grants, target-resolution/substitution,
  credential rotation and stale-generation tests before promotion;
- request and delivery each require current authority and their declared
  step-up; delivery capability is one-use, short-lived, and replay-safe;
- Control DB stores only a sealed object ref and versioned integrity/encryption
  metadata; ciphertext/object roles cannot cross into Project Files;
- every export access path is bounded, attributed, redacted, rate-limited, and
  tested across disable/revocation/expiry/legal-hold races; and
- crash/retry, key rotation, backup/restore, deletion/reaping, and failure logs
  never disclose plaintext, credentials, or unsealed references.

## Promotion declaration

A release declaration names exact source/artifact/config/schema/provider
versions, enabled features, test environments/results, known residual risks,
rollback/recovery procedures, owners, and expiry/review date. Green checks from
unit checks alone are not production certification.

## Production and test composition

The production graph is assembled only from managed secrets, least-privilege
roles, durable stores, admitted providers and exact enabled capability
versions. Readiness is role/capability specific and fails closed. Local/test
graphs may substitute deterministic adapters but must be unmistakably typed
and excluded from production source reachability. Recovery and rollback are
executed against production-shaped infrastructure, not inferred from mocks.

## Completion boundary

There is no blanket “Omega is production grade.” Each enabled capability and
deployment profile is promoted against named evidence. Unproven roles or
features remain disabled and fail closed.

## Consequential decisions and source grounding

- **Promotion is per capability and deployment profile.** There is no blanket
  production-grade label.
- **Operator work has a separate runner.** Product credentials cannot perform
  provisioning, DDL, database restore, relocation or key ceremonies;
  `taurus-migrate` is part of this operator boundary.
- **Audit follows transaction authority.** Control effects append Control
  Audit; Project effects append Project Audit atomically.

Grounding: [Control and administration](../capabilities/control-and-administration.md),
[Control/Project boundary](../architecture/control-and-project-boundary.md),
[jobs/Audit/observability](../architecture/jobs-audit-observability.md), and
[canonical user journeys](../product/user-journeys.md).
