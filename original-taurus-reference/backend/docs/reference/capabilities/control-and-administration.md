# Control and administration domains

## Purpose

Control establishes who a User is, the one Organization they belong to, which
Projects exist, who solely owns and may access each Project, which capabilities
are entitled, where Project truth is placed, and whether a protected operation
may commit now. Administration exposes those truths through scoped, explicit,
audited operations.

Control is an authoritative application domain rather than an optional Product
capability library. It still follows the same specification discipline: typed
state, explicit operations, stable errors, current authority, durable
persistence, and headless proof.

## Owns

- exact external identity links and verified profile attributes;
- one-use OIDC login attempts and encrypted PKCE verifier material;
- opaque session families, rotations, replay, expiry, and revocation;
- Users and exactly-one-Organization assignment;
- Organizations, their lifecycle, administrators, policy defaults, and
  entitlements;
- Projects, single owner, home Organization, direct User grants, private
  Project pins, signed-in share links, duplication workflow, and lifecycle;
- enterprise identity-provider policy, authenticators, step-up and governed
  account recovery;
- Organization subscription truth, finite provider-usage reservations,
  immutable normalized usage ledger, and provider reconciliation;
- access action registry, policy/entitlement decisions and generations;
- trusted Project placement, provisioning, relocation, retirement;
- external connector connection/consent identity and credential `SecretRef`s;
- fresh one-use Project-effect permit issuance, dependency indexing,
  settlement, revocation/quiescence;
- exact durable-work authorities, finite standing-work delegations and typed
  finalizer placement for accepted non-Agent jobs;
- Agent authority principals, Agent/tool-grant generations, exact durable Task
  sponsorships, and bounded standing Routine delegations;
- Control mutation idempotency, required Audit, and bounded retained
  `SemanticFact` inputs for declared user-visible Control effects; and
- scoped administration settings whose truth is not owned elsewhere.

## Does not own

- Project Resource content or per-User Project workspace;
- provider tokens as Taurus sessions;
- Project-side connector subscriptions, mappings, continuation, or intake
  state; provider tokens themselves remain behind managed SecretRefs;
- family-specific templates, comments, Memory, Knowledge, Activity, or search;
- Project-local Agent configuration, Persona/tool declarations, Task/Plan/
  Attempt state, or Routine configuration;
- Project-local required Audit for Project mutations;
- Product runtime database/operator credentials in the same authority domain;
- per-Project private Resource/Data favorites or workspace layout; and
- browser-only state.

## Feature inventory

| Area | Supported behavior |
| --- | --- |
| Identity providers | Provider catalog; Google and Microsoft OIDC initially; enterprise OIDC/SAML configuration later through the same exact-subject boundary; exact issuer/subject links; explicit account-link ceremony; verified display/email profile only |
| Login attempts | Authorization Code + PKCE S256; state/nonce; one-use consume; encrypted verifier; bounded return route/expiry |
| Sessions and step-up | Opaque browser credential; server-side durable record; idle/absolute expiry; rotation; predecessor replay family revoke; current-family/everywhere sign-out; device/session listing and revoke; WebAuthn/passkey primary step-up, TOTP/recovery-code fallback, and governed recovery in the production administration stage |
| User | Profile; one Organization; active/disabled/deleted lifecycle; identity links; Account settings/export/delete policy |
| Organization | Profile; owner/admin authority; Users/invites; entitlement/provider/connector/security/retention defaults; billing subscription and usage administration |
| Project | Create/provision/search/filter/sort/group/pin/list/get/rename/leave/archive/restore/duplicate/relocate/delete; exactly one owner and home Organization |
| Sharing | Direct User grants including cross-Organization Users; role/action changes; revoke; Organization-share snapshot to explicit Users; signed-in expiring share links that materialize direct User grants |
| Ownership | Sole owner protection; owner-only final delete; self-service transfer unavailable until Q002 defines its verified ceremony |
| Access | Registered actions; current session/User/Organization/Project/grant/entitlement/policy evaluation; deny unknown/error |
| Mutation authority | Fresh exact one-use permit; Project-local consumption/fence; replay/expiry/scope/generation checks; strong revocation effective semantics |
| Durable work authority | Exact accepted Work/Job receipt; pending→active acknowledgement; bounded effects/budgets/expiry; finite periodic delegation; exact non-widening terminal finalizer |
| Agent authority | Canonical Agent principal/status and tool-grant generations; exact Task sponsorship; bounded standing Routine delegation; deny-first cancellation/expiry/revocation |
| Entitlements | Capability/quota/provider availability independent from Project permission; explicit unavailable/limit results |
| Billing and usage | Organization subscription/plan state, immutable usage ledger, bounded cross-Project usage reservations, provider receipt reconciliation and discrepancy review; billing never grants Project access |
| Connector authority | External data-consent ceremony, admitted scopes/tenant, connection generation, credential SecretRef and revocation; never Project intake state |
| Placement | Trusted Project→database/credential/schema/fence/generation descriptor; Bridge/Silo tier; no request substitution |
| Provisioning | Durable allocate→migrate→verify→activate state; retry/failure/retire; least-privilege Product principal |
| Settings | Account, Project, Organization sections with scope/inheritance/effective version/consequence/reversibility |
| Audit and activity facts | Atomic Control-local security attribution plus a separate bounded `SemanticFact` for each declared user-visible Control effect; governed Audit query/export; no secret/resource bodies |

## Core models

### External identity and login

`ExternalIdentity{Issuer, Subject, UserID, Profile, LinkedAt}` treats issuer and
subject as exact opaque case-sensitive values. `LoginAttempt` contains hashes or
encrypted material for state, nonce, PKCE verifier, provider, safe return
target, expiry, and consumed state. Email never links accounts.

### Session

`SessionFamily` groups rotations and replay fate. `Session` contains selector,
key-versioned verifier/MAC state, User/family IDs, issued/rotated/idle/absolute
times, predecessor, revocation, and authority generations. Cookies carry only
opaque credentials.

`Authenticator` is a closed union of federated reauthentication metadata,
WebAuthn credential metadata, TOTP enrollment metadata, or a recovery-code
generation; it never stores provider credentials, a raw private key, a TOTP
seed after managed-secret sealing, or a plaintext recovery code. Stage 02 can
use a fresh provider/OIDC ceremony as the initial federated reauthentication
method. WebAuthn/passkeys become the preferred production method in Stage 14,
with TOTP and one-use recovery codes as governed fallbacks. Step-up ceremonies
are one-use, session/browser bound, operation-class bound, short-lived, replay
protected and record only bounded evidence. A
managed enterprise identity provider is an immutable versioned OIDC or SAML
configuration with exact issuer/entity, tenant/domain admission, signing-key
policy and lifecycle. Okta is configured through one of those standards, not a
bespoke trust path. Taurus does not store or verify first-party passwords in
the accepted product; any future password login requires a separate decision
and mature identity-provider boundary.

### User and Organization

`User{ID, OrganizationID, Status, ProfileVersion}` has one non-null
Organization while active. Organization membership changes cannot orphan
Project ownership or silently retain live grants.

`OrganizationInvitation{InvitationID, OrganizationID, InviteeConstraint,
RoleCeiling, TokenDigest, State, ExpiresAt, Generation}` stores no plaintext
token. Its states are `pending`, `consumed`, `revoked`, and `expired`; only an
exact current `pending` generation may be consumed or revoked.

An Organization invitation is consumed only as part of the first verified
identity/login transaction: the invited Organization wins before personal-
Organization fallback. A collision, expired invite, or already assigned active
User fails closed. Direct User transfer between Organizations is unavailable
until Q009's separate verified ceremony is decided; invitation acceptance is
not transfer.

### Project and grant

`Project{ID, HomeOrganizationID, OwnerUserID, Name, Description, Lifecycle,
ProfileVersion, AuthorityVersion}` and
`ProjectGrant{ProjectID, UserID, Role/Actions, Status, Generation}` keep sole
ownership distinct from delegated management.

```text
ProjectOrganizationShareSnapshot {
  SnapshotID, ProjectID, OrganizationID, RequestedByUserID,
  RequestedRoleActions, OrganizationRevision, OrganizationUserSetDigest,
  ProjectAuthorityVersion, RequesterGrantGeneration, PolicyRevision,
  JobID, State, TotalUsers, PendingCount, AppliedCount, UnchangedCount,
  SkippedCount, FailedCount, SafeFailure?, Revision, CreatedAt, CompletedAt?
}

ProjectOrganizationShareOutcome {
  SnapshotID, UserID, ObservedUserOrganizationRevision,
  PriorGrantGeneration?, Outcome, ResultGrantGeneration?, SafeFailure?
}
```

An Organization share is an explicit immutable snapshot, never a live
Organization ACL. Its request transaction freezes the exact current eligible
User identities, requested role/actions, relevant Project/requester/policy
generations, and User-set digest under a bounded policy limit. Per-User outcome
identity is `(SnapshotID, UserID)`, so crash/retry cannot create anonymous or
duplicate grants. Snapshot states are `queued`, `applying`, `completed`,
`partial`, or `failed`; terminal results never rewrite history. Repeating the
share with a new idempotency identity creates a new snapshot/diff against the
then-current Organization Users and direct grants.

`ProjectPin{UserID, ProjectID, Rank, Revision}` is a private Control preference
because it is needed before a Cell exists. It never grants visibility. Project
listing accepts bounded search, lifecycle/role/ownership filters, allowlisted
group/sort, stable cursor and page size; pinned Projects appear in explicit rank
order within the selected grouping, followed by the requested stable sort.

`ProjectShareLink{ShareLinkID, ProjectID, TokenDigest, GrantCeiling,
AllowedOrganizationID?, CreatedBy, State, MaxAccepts, AcceptCount, ExpiresAt,
Generation}` is signed-in invitation authority, never anonymous Project access.
Only the opaque token leaves Control; logs, URLs after acceptance, Audit and
stored state retain no plaintext token. Acceptance rechecks the current User,
Project, creator authority, expiry/count/generation and optional Organization
restriction, then atomically creates or narrows to an explicit direct
`ProjectGrant` plus required Control Audit. Revocation prevents all later
acceptance but does not silently remove already materialized grants.

Leaving a Project atomically revokes only the caller's non-owner direct grant
and fences its derived authority. The sole owner cannot leave. Project
duplication is an explicit durable Host/Control workflow: it creates a new
sole-owner destination Project, provisions it, then coordinates an exact
source archive/export and destination import under separate Project authority
and transactions. No cross-Project transaction, generic database copy, or
source credential is reused. Partial failure leaves a visible retryable copy
status and never changes the source.

### Billing, subscriptions, and usage

`BillingSubscription{OrganizationID, PlanID, PlanVersion, ProviderRef,
State, EffectiveAt, RenewalAt?, CancelAt?, EntitlementRevision,
ProviderGeneration, Revision}` is Control truth for the Organization's
admitted commercial state. Provider checkout/customer/subscription identifiers
are opaque references; payment data and provider credentials are never stored
in Taurus Product state.

`UsageReservation{UsageIntentID, OrganizationID, ProjectID, UserID,
Capability, Operation, ProviderClass, UnitCeiling, CostCeiling,
PolicyGeneration, State, ExpiresAt, Revision}` reserves a finite ceiling before
provider-backed work. `UsageLedgerEntry{EntryID, UsageIntentID, Kind,
NormalizedUnits, NormalizedCost, Currency, SourceReceiptDigest,
OccurredAt, RecordedAt}` is immutable. `ProviderUsageReconciliation` freezes a
provider window/cutoff, compares minimized provider receipts with the ledger,
and records explicit matched/missing/extra/disputed outcomes without silently
rewriting usage.

Organization-wide usage reservation is independent from the Project-local
Intelligence call reservation. Both share one trusted `UsageIntentID`: Control
first reserves the Organization ceiling; the Project transaction then admits
the exact call. Failure before Project admission cancels the Control
reservation. Exact provider settlement idempotently terminalizes both ledgers;
lost acknowledgement is reconciled by receipt digest. A billing or entitlement
change denies new reservations but never rewrites historical usage. Neither a
subscription, reservation, invoice nor provider webhook grants Project access,
Cell scope, a mutation permit, or provider credential access.

### Placement

Trusted placement is exposed as separate typed Product, permit-settlement,
receipt-proof, fence-target, finalizer-target and Project-Audit-target views.
They contain only `ProductCredentialRef`, `PermitSettlementCredentialRef`,
`ReceiptProofCredentialRef`, `FenceCredentialRef`, one sealed kind-matched
finalizer credential, or `ProjectAuditCredentialRef`, respectively. Every view
includes trusted opaque cluster/database references, engine, Project identity
fence, schema/placement generation, lifecycle, region/tier, and policy—not SQL
identifiers supplied by callers. Operator credentials appear in none of them,
and the credential types are not interchangeable.

### Permit and revocation

A one-use permit binds issuer/key version, unique ID, User, Project, exactly
one authority source, every dependency generation, exact action/
operation and optional Resource, issued/expiry, trusted placement target, and
nonce/digest. `SessionAuthority` binds a session family/generation;
`DurableWorkAuthority` binds an exact Work generation and JobID; and
`TaskSponsorshipAuthority` binds an exact sponsorship generation and TaskID.
`Permit.ExpiresAt` is no later than every source, approval, delegation, policy
and operation deadline. Issuance writes a `PermitDependency` index for every
locked revocable dependency so any dependency revoker discovers all affected
nonterminal permits.
The consuming Project transaction writes
`PermitConsumptionProof{PermitID, PermitDigest, ProjectID,
PlacementGeneration, EffectCommitID, IdempotencyIdentity, CommittedAt}`
atomically with the effect. After commit,
`control.mutation_permits.settle.v1` resolves the ledger-selected
`ProjectPermitSettlementTarget`, which binds Permit ID/digest, Project, and
placement generation, and uses its read-only credential to re-read that exact
row. Exact replay is idempotent; lost acknowledgement is reconciled
by the same read; absence remains nonterminal and conflicting proof is rejected.
Fence acknowledgement cannot settle a permit. Expiry by itself is not
settlement. Revocation has a durable cutoff/generation and reports effective
only when older permits cannot commit.

### Durable work and finalization

`DurableWorkAuthority` binds one sponsoring User, Project, `WorkAuthorityID`,
`JobID`, initiating receipt digest, allowed operations/targets, budgets,
dependency generations, expiry and state. It begins
`PendingProjectReceipt`; only an exact trusted re-read of the Project Job/
receipt proof can activate it. A pending orphan cannot issue an ordinary effect
permit.

`StandingWorkDelegation` is an explicitly accepted finite authority ceiling for
one exact non-Agent Project subscription/periodic Product job (for example,
connector polling). Agent Routines use the separate `StandingDelegation` model.
It binds sponsor,
subscription, trigger class, operations/targets, per-run and cumulative
budgets, run count, generations and expiry. It also uses pending Project receipt
and acknowledgement before activation. Each accepted trigger atomically
consumes allowance and creates one pending exact `DurableWorkAuthority` plus a
separately typed one-use `ReceiptBootstrapCredential` for the exact absent Work/
Job and matching receipt. It is not an ordinary effect permit, cannot authorize
a later effect, and does not add a fourth permit source. A timer or webhook is
only a hint and grants nothing.

Cross-domain activation uses
`AuthorityReceiptProof{ReceiptKind, ControlAuthorityID, ControlGeneration,
ProjectID, PlacementGeneration, LocalObjectID, ReceiptDigest,
InitialStateDigest, ProjectCommitID, CommittedAt}`. The closed receipt kinds are
`durable_work@1`, `task_sponsorship@1`, `standing_work@1`,
`standing_routine@1`, and `agent_principal@1`. A Project transaction writes the
proof atomically with its exact
local object/receipt. Activation and lost-ack recovery use only a
`ProjectReceiptProofTarget`/`ReceiptProofCredentialRef` exact keyed read. The
target itself binds receipt kind, Control identity/generation/digest, Project,
and placement generation; caller
claims and Product/settlement/fence/finalizer credentials are not proof.

Project-owned `FinalizationRecord` is not Control authority or an effect permit.
Its `FinalizationTargetKind` is a member of this closed versioned registry:

| Kind | Typed credential | Exact transition set |
| --- | --- | --- |
| `durable_job@1` | `DurableJobFinalizerCredentialRef` | `queued`, `leased`, `running`, or `cancel_requested` -> `canceled` or `failed`; `completion_pending` -> `succeeded` only with a prebound settled permit-consumption proof. |
| `task@1` | `TaskFinalizerCredentialRef` | `running` or `cancel_requested` -> `canceled` or `failed`; `completion_pending` -> `completed` only with a prebound committed result/ChangeGroup proof. |
| `intelligence_reservation_call@1` | `IntelligenceAccountingFinalizerCredentialRef` | exact reservation `reserved` -> `settled` or `canceled` together with exact call generation `admitted`, `provider_in_flight`, or `receipt_pending` -> `succeeded`, `failed`, or `canceled`; success records only the already-returned minimized receipt. |
| `agent_disable@1` | `AgentDisableFinalizerCredentialRef` | `disable_requested -> disabled`. |
| `routine_lifecycle@1` | `RoutineLifecycleFinalizerCredentialRef` | `enable_pending -> enabled` only with the prebound active Control-delegation receipt proof; `disable_requested -> disabled`. |
| `project_audit_export@1` | `ProjectAuditExportFinalizerCredentialRef` | `building` -> `ready`, `failed`, or `canceled` for an already-built sealed artifact; `ready` -> `expired` or `deletion_pending`; `deletion_pending` -> `deleted`. |

Unknown kind/version, kind/credential mismatch, unlisted transition, or exact
input/state/generation mismatch fails closed. No finalizer can obtain a permit,
invoke a provider/tool, create or change Resource output, enqueue work, widen
scope/budget/authority, or resurrect authority.

Capability-owned run records (including File derivation, connector sync,
Knowledge ingestion, Resolution, analytics, Chat reply, Board refresh, and
Translation) are not registry extensions. Their canonical state/output changes
still require a fresh ordinary permit; `durable_job@1` may close only their
associated generic Job bookkeeping.

### Governed Control exports

`ControlExportArtifact{ExportID, Kind, RequesterUserID, AuthorizedScope,
FilterDigest, SourceCutoff, PolicyVersion, ContentSchemaVersion, State,
SealedObjectRef?, ByteSize?, Digest?, EnvelopeKeyVersion?, CreatedAt, ReadyAt?,
ExpiresAt?, LegalHoldState, FailureCategory?, Revision}` owns account and
Control-Audit export state. It is separate from Project Files, Product archive
packages and operator backup. Bytes are envelope encrypted; only an application-
sealed opaque object reference is durable.

`ControlExportDelivery{DeliveryID, ExportID, RequesterUserID, SessionFamilyID,
StepUpEvidenceRef, IssuedAt, ExpiresAt, UsedAt?, RevokedAt?}` grants one short-
lived, one-use delivery after fresh authority, scope and step-up checks. Status
queries expose safe metadata only. Revocation, scope loss or expiry denies new
delivery even while ciphertext cleanup is retrying.

Artifact states are `queued`, `building`, `ready`, `failed`, `expired`,
`deletion_pending`, or `deleted`; terminal state never returns to `ready`, and a
retry is a new Attempt under the same frozen cutoff/filter. Delivery is
`issued -> used` exactly once or `issued -> expired | revoked`.

### Agent authority and sponsorship

`AgentAuthorityPrincipal` and `AgentToolGrant` are Control-owned security
records. A new principal and its exact initial grant-set digest begin
`PendingProjectReceipt`; only an exact receipt-proof re-read of the Project
Agent configuration/receipt activates them. Project-local Agent configuration refers
to their exact IDs and generations but cannot activate or widen them. A
`TaskSponsorship` binds one
sponsoring User, Project, Agent, TaskID, permitted operations/targets, budget,
Agent/tool/policy generations, expiry, and status. A Project Task stores only a
non-authoritative receipt/digest for that exact sponsorship.

`StandingDelegation` is separately bounded by RoutineID, trigger class,
operation/target scope, per-run/cumulative budgets, maximum runs, generations,
and expiry. It can mint a fresh exact Task sponsorship per admitted trigger;
it is never itself a Project-effect credential.

## Canonical versioned Control operations

This is the single authoritative operation inventory for the Control and
administration domain. Transport specifications map these names to routes but
do not create aliases. **Public bootstrap** operations work before a bound Cell;
**public self-service** and **public administration** operations require a
current Taurus session; **Host internal**, **Control internal**, and **operator
internal** operations are typed wiring contracts and are never exposed as a
general Product HTTP surface. Every command declares its idempotency,
expected-version, authority, step-up, and Audit requirements in its request
schema. Ordinary protected Project effects declare a permit contract;
Control-local commands instead declare the exact Control locks and single-UoW
atomicity they require.

| Operation | Surface and kind | Authority and behavior |
| --- | --- | --- |
| `identity.providers.list.v1` | Public bootstrap query | Lists admitted identity providers and safe display metadata. |
| `identity.login.begin.v1` | Public bootstrap command | Creates one bounded one-use OIDC/PKCE attempt. |
| `identity.login.complete.v1` | Public bootstrap command | Consumes the attempt, verifies identity, atomically applies an exact invitation for a first User before personal-Organization fallback, links or creates the User, and issues a Taurus session. |
| `identity.links.list.v1` | Public self-service query | Lists safe identity-link metadata for the current User; never tokens or provider subject values not needed for display. |
| `identity.links.begin.v1` | Public self-service command | Begins a step-up, browser-bound ceremony to add one provider identity to the current User. |
| `identity.links.complete.v1` | Public self-service command | Consumes the link ceremony once and creates an exact issuer/subject link after collision checks. |
| `identity.links.remove.v1` | Public self-service command | Step-up removes one expected link while enforcing last-identity and managed-account policy. |
| `identity.enterprise_providers.list.v1` | Public administration query | Lists safe versioned enterprise OIDC/SAML provider metadata and lifecycle; never signing/decryption secrets. |
| `identity.enterprise_providers.create.v1` | Public administration command | Step-up validates and creates one immutable provider version under exact issuer/entity, tenant/domain and signing-key policy. |
| `identity.enterprise_providers.update.v1` | Public administration command | Publishes a replacement provider version under expected generation; it cannot rewrite retained login evidence. |
| `identity.enterprise_providers.disable.v1` | Public administration command | Denies new login/link ceremonies for the expected provider generation without treating provider disable as User disable. |
| `sessions.current.get.v1` | Public bootstrap query | Resolves the current session family and bounded User/Organization projection. |
| `sessions.current.rotate.v1` | Public self-service command | Rotates the current opaque session under expected family/generation and replay rules. |
| `sessions.current.sign_out.v1` | Public bootstrap command | Revokes the current session family and completes its authority fence without canceling independently admitted durable-work authorities, standing-work delegations, Task sponsorships, or standing Routine delegations. |
| `sessions.user.list.v1` | Public self-service query | Lists the current User's safe active/recent session-family metadata for security review. |
| `sessions.family.revoke.v1` | Public self-service command | Step-up revokes one selected session family owned by the current User and completes its fence. |
| `sessions.user.sign_out_everywhere.v1` | Public bootstrap command | Step-up revokes every User session family, durable-work authority/delegation, Task sponsorship, and standing Routine delegation and completes the User-wide authority fence. |
| `security.authenticators.list.v1` | Public self-service query | Lists safe WebAuthn/TOTP/recovery-code generation metadata for the current User. |
| `security.webauthn.registration.begin.v1` | Public self-service command | Begins one browser/session-bound WebAuthn registration with exact RP/origin, challenge and expiry. |
| `security.webauthn.registration.complete.v1` | Public self-service command | Consumes the challenge once, validates attestation/credential uniqueness and stores only safe public credential metadata. |
| `security.totp.enrollment.begin.v1` | Public self-service command | Step-up creates one short-lived enrollment backed by a managed sealed seed; the seed is never returned after confirmation. |
| `security.totp.enrollment.complete.v1` | Public self-service command | Consumes the enrollment once after current-code verification and activates the authenticator. |
| `security.authenticators.revoke.v1` | Public self-service command | Step-up revokes one expected authenticator while enforcing recovery/last-authenticator policy. |
| `security.recovery_codes.rotate.v1` | Public self-service command | Step-up invalidates the prior generation and returns a new bounded one-time code set exactly once; only verifiers are stored. |
| `security.step_up.begin.v1` | Public self-service command | Begins a short-lived operation-class-bound challenge using an admitted authenticator. |
| `security.step_up.complete.v1` | Public self-service command | Consumes one exact challenge and returns bounded server-side evidence bound to the current session and operation class. |
| `identity.recovery.begin.v1` | Public bootstrap command | Begins a rate-limited, non-enumerating governed recovery ceremony under Organization/provider policy. |
| `identity.recovery.complete.v1` | Public bootstrap command | Completes only the exact verified ceremony, revokes exposed sessions/authenticators as policy requires, and never bypasses one-Organization or sole-owner review. |
| `users.current.get.v1` | Public self-service query | Returns the current User's bounded profile, lifecycle, Organization reference, and effective versions. |
| `users.current.profile.update.v1` | Public self-service command | Updates editable profile fields under the expected profile version; identity attributes remain provider-derived. |
| `users.current.export.request.v1` | Public self-service durable command | Step-up requests the policy-shaped account export and returns durable status rather than inline data. |
| `users.current.export.status.get.v1` | Public self-service query | Rechecks current authority and returns safe state/digest/size/expiry metadata for the exact account export; never an object reference. |
| `users.current.export.delivery.create.v1` | Public self-service command | Fresh step-up creates one short-lived one-use audited delivery for the exact ready account artifact after scope and retention recheck. |
| `users.current.deletion.request.v1` | Public self-service durable command | Step-up begins governed account deletion only after sole-ownership, retention, and active-authority preconditions pass. |
| `organizations.current.get.v1` | Public self-service query | Returns the current User's one Organization and bounded effective administrative metadata. |
| `organizations.current.profile.update.v1` | Public administration command | Organization owner/admin updates editable profile fields under expected version. |
| `organizations.users.list.v1` | Public administration query | Returns an authorized bounded User directory without external identity secrets. |
| `organizations.invites.list.v1` | Public administration query | Returns bounded safe pending/consumed/revoked/expired invitation metadata under admitted state/time filters; never plaintext tokens or identity secrets. |
| `organizations.invites.create.v1` | Public administration command | Organization owner/admin creates one bounded, expiring invitation under one-Organization policy. |
| `organizations.invites.revoke.v1` | Public administration command | Idempotently revokes one exact unconsumed invitation generation with expected version and required Audit; consumed/expired invitations are not rewritten. |
| `organizations.invites.accept.v1` | Public bootstrap command | Binds one exact unconsumed invitation to a one-use login attempt; first verified login consumes it atomically before personal-Organization fallback. An already assigned active User is rejected until an explicit transfer ceremony exists. |
| `organizations.users.role.update.v1` | Public administration command | Organization owner/admin changes an expected role without bypassing sole-owner or last-admin invariants. |
| `organizations.users.disable.v1` | Public administration command | Step-up denies new User authority, revokes sponsored authority, and completes required fences. |
| `organizations.users.enable.v1` | Public administration command | Organization owner/admin re-enables an eligible User without reviving old sessions, permits, sponsorships, or delegations. |
| `organizations.users.remove.v1` | Public administration command | Step-up removes the User only after Project ownership and retention preconditions; no grant remains live. |
| `organizations.policy.get.v1` | Public administration query | Returns authorized Organization policy, inheritance, locks, and exact effective revision. |
| `organizations.policy.update.v1` | Public administration command | Organization owner/admin changes Control-owned policy under expected revision and consequence disclosure. |
| `projects.list.v1` | Public bootstrap query | Lists currently visible Projects from effective direct User grants under bounded search/filter/group/sort/cursor input, with private pin rank applied deterministically. |
| `projects.create.v1` | Public bootstrap command | Creates the sole-owner Project record and starts idempotent provisioning. |
| `projects.pins.set.v1` | Public self-service command | Creates or moves the current User's private pin for one still-visible Project under expected pin-set revision; it grants nothing. |
| `projects.pins.remove.v1` | Public self-service command | Removes the current User's expected private Project pin without changing access. |
| `projects.pins.reorder.v1` | Public self-service command | Conditionally reorders only the current User's visible pinned Project IDs. |
| `projects.profile.get.v1` | Public self-service query | Returns the exact Project name, description, profile version, owner, caller grant, lifecycle, and safe effective versions used by Workspace Overview. |
| `projects.profile.update.v1` | Public administration command | Project owner/authorized manager changes name and description under the expected profile version. |
| `projects.status.get.v1` | Public bootstrap query | Returns safe Project lifecycle, provisioning, relocation, or retirement status. |
| `projects.select.v1` | Host internal command | Revalidates authority and trusted Product placement, then attaches one immutable User/Project Cell. |
| `projects.archive.v1` | Public administration command | Project owner/authorized manager archives an expected active Project without deleting canonical truth. |
| `projects.restore.v1` | Public administration command | Project owner/authorized manager restores an eligible archived Project under expected version. |
| `projects.leave.v1` | Public self-service command | Revokes and fences the caller's own non-owner grant; the sole owner and a User without a direct live grant fail closed. |
| `projects.duplicate.request.v1` | Public self-service durable command | Creates a new sole-owner destination and coordinates exact source archive/destination import after independent current authority checks; source truth never changes. |
| `projects.delete.v1` | Public administration durable command | Sole Project owner only; step-up plus exact-name confirmation begins final governed deletion/retirement. |
| `projects.grants.list.v1` | Public administration query | Lists authorized direct User grants and generations; Organization shares remain explicit snapshots. |
| `projects.grants.create.v1` | Public administration command | Owner/authorized manager creates one direct User grant under current Organization/User and owner invariants. |
| `projects.grants.update.v1` | Public administration command | Owner/authorized manager changes one non-owner grant under expected generation. |
| `projects.grants.revoke.v1` | Public administration command | Owner/authorized manager revokes one non-owner grant and completes affected authority fencing. |
| `projects.grants.organization_snapshot.create.v1` | Public administration idempotent durable command | Preselects Snapshot/Job identity and atomically freezes an Organization's bounded current eligible User set, requested grant, exact security generations and immutable auditable snapshot before per-User application; repeating with a new idempotency identity is the explicit refresh and creates no implicit Organization grant. |
| `projects.grants.organization_snapshot.status.get.v1` | Public administration query | Returns one exact snapshot's immutable request digest, Job/state, progress counts, relevant generations and bounded safe failure without changing work or grants. |
| `projects.grants.organization_snapshot.outcomes.list.v1` | Public administration query | Returns an authorized cursor-bounded page of exact per-User created/updated/unchanged/skipped/failed outcomes and resulting grant generations for one snapshot. |
| `projects.share_links.create.v1` | Public administration command | Step-up creates one expiring, bounded, signed-in share link whose grant ceiling cannot include owner-only actions. |
| `projects.share_links.list.v1` | Public administration query | Lists safe link metadata, ceiling, expiry/count and state; never plaintext tokens. |
| `projects.share_links.revoke.v1` | Public administration command | Revokes the expected link generation and prevents later acceptance without silently removing existing direct grants. |
| `projects.share_links.accept.v1` | Public self-service command | Consumes/reuses the opaque link under current signed-in User and policy checks and atomically materializes the bounded direct User grant. |
| `projects.provisioning.retry.v1` | Public administration durable command | Owner/authorized Organization admin retries an eligible failed idempotent provisioning state machine; no operator credential crosses the boundary. |
| `projects.relocation.begin.v1` | Public administration durable command | Sole owner plus admitted infrastructure policy and step-up begin a fenced relocation with one writable truth. |
| `projects.retirement.begin.v1` | Public administration durable command | Sole owner or governed deletion workflow begins irreversible infrastructure retirement after retention preconditions. |
| `access.explain.v1` | Public self-service query | Re-evaluates current authority and returns a redacted allow/deny explanation safe for the caller. |
| `entitlements.get.v1` | Public administration query | Returns authorized capability, quota, provider, and limit state with exact revision. |
| `entitlements.update.v1` | Public administration command | Organization owner/entitlement admin uses step-up to change admitted grants or limits under expected revision. |
| `billing.current.get.v1` | Public administration query | Returns safe Organization plan/subscription status, effective entitlements, aggregate usage and discrepancy state; never payment data or provider secrets. |
| `billing.subscription.change.request.v1` | Public administration durable command | Step-up requests one plan/subscription transition through an admitted provider flow and returns durable status; provider success is reconciled rather than trusted from redirect input. |
| `billing.subscription.status.get.v1` | Public administration query | Returns one exact change request and current reconciled subscription generation. |
| `billing.usage.list.v1` | Public administration query | Lists bounded normalized immutable usage ledger entries and reservations by admitted filters/cursor. |
| `billing.usage_reservations.create.v1` | Control internal command | Atomically reserves one finite Organization ceiling for an exact UsageIntent/Project/User/capability/operation before provider-backed Project admission. |
| `billing.usage_reservations.settle.v1` | Control internal command | Idempotently settles one exact reservation from a minimized authenticated provider/Project receipt digest and rejects conflicting reuse. |
| `billing.usage_reservations.cancel.v1` | Control internal command | Releases one unspent expected reservation generation; it cannot cancel already settled usage. |
| `billing.provider_reconciliation.start.v1` | Public administration durable command | Step-up starts a frozen-window provider-versus-ledger reconciliation under admitted billing scope. |
| `billing.provider_reconciliation.status.get.v1` | Public administration query | Returns safe matched/missing/extra/disputed counts and exact frozen cutoff without raw provider payloads. |
| `audit.search.v1` | Public administration query | Authorized auditor searches bounded Control Audit metadata; inaccessible scopes and secret/resource bodies are excluded. |
| `audit.export.v1` | Public administration durable command | Step-up creates a governed, bounded Audit export with durable status, retention, and access attribution. |
| `audit.export.status.get.v1` | Public administration query | Rechecks auditor scope and returns safe state/digest/size/expiry metadata for one exact Control-Audit export. |
| `audit.export.delivery.create.v1` | Public administration command | Fresh step-up and exact scope recheck create one short-lived one-use audited delivery for the ready Control-Audit artifact. |
| `control.agent_principals.list.v1` | Control internal query | Lists bounded canonical Agent authority principals for an exact authorized Project scope. |
| `control.agent_principals.create.v1` | Control internal command | Creates one `PendingProjectReceipt` Agent authority principal and exact initial tool-grant set with owner/creator/admin metadata, preselected IDs/config digest, and Organization/Project generations; the session-started Project Agent/receipt creation uses an ordinary session permit, never a receipt-bootstrap credential. |
| `control.agent_principals.activate.v1` | Control internal command | Idempotently activates one pending principal/grant generation only after re-reading the exact Project Agent configuration/receipt proof through `ReceiptProofCredentialRef`; absence remains pending and conflicting proof fails. |
| `control.agent_principals.get.v1` | Control internal query | Resolves one exact principal and current status/generation without exposing Project-local Agent configuration. |
| `control.agent_principals.update.v1` | Control internal command | Changes bounded authority metadata under an explicit expected-generation protocol; it cannot be called by ordinary Project configuration update or widened by Project-local state. |
| `control.agent_principals.disable.v1` | Control internal command | Denies new Agent authority and fences all affected sponsorship/delegation permit sources. |
| `control.agent_tool_grants.list.v1` | Control internal query | Lists safe tool-grant identities, scopes, budgets, status, and generations for one principal. |
| `control.agent_tool_grants.create.v1` | Control internal command | Creates one exact bounded tool grant under current sponsor/policy authority. |
| `control.agent_tool_grants.update.v1` | Control internal command | Narrows or explicitly re-authorizes a grant under expected generation; Project state cannot widen it. |
| `control.agent_tool_grants.revoke.v1` | Control internal command | Denies new use and fences permits sourced through the revoked tool-grant generation. |
| `control.agent_sponsorships.issue.v1` | Control internal command | Idempotently creates one `PendingProjectReceipt` sponsorship bound to preselected TaskID, sponsor, digests, targets, operations, budget, generations, and expiry. Session-started Task creation uses an ordinary session permit; a Routine trigger receives the separate receipt-bootstrap credential from trigger admission. |
| `control.agent_sponsorships.activate.v1` | Control internal command | Idempotently activates one pending sponsorship only after re-reading the exact Project Task/receipt proof through `ReceiptProofCredentialRef`. |
| `control.agent_sponsorships.status.get.v1` | Control internal query | Returns safe exact sponsorship state, limits, generation, expiry, and fence progress. |
| `control.agent_sponsorships.revoke.v1` | Control internal command | Denies new permits and reports terminal only after every older sponsorship-sourced permit settles or is fenced. |
| `control.agent_standing_delegations.issue.v1` | Control internal command | Creates one `PendingProjectReceipt` bounded Routine delegation with trigger, scope, budget, run-count, generations, and expiry. |
| `control.agent_standing_delegations.activate.v1` | Control internal command | Idempotently activates the delegation only after exact Routine/receipt proof re-read through `ReceiptProofCredentialRef`. |
| `control.agent_standing_delegations.status.get.v1` | Control internal query | Returns safe delegation state, remaining bounded allowance, generation, expiry, and fence progress. |
| `control.agent_standing_delegations.trigger.admit.v1` | Control internal command | Atomically deduplicates one exact trigger delivery, consumes current run/cumulative allowance, and creates the fresh pending Task sponsorship plus a one-use `ReceiptBootstrapCredential` usable only for that exact absent Task and receipt. |
| `control.agent_standing_delegations.revoke.v1` | Control internal command | Denies new Task sponsorships and fences older delegated authority before terminal status. |
| `control.work_authorities.issue.v1` | Control internal command | Creates one exact `PendingProjectReceipt` non-Agent work authority bound to stable Work/Job IDs, sponsor, receipt digest, operation/target ceiling, budgets, generations and expiry. |
| `control.work_authorities.activate.v1` | Control internal command | Idempotently activates one pending work authority only after exact Project Job/receipt proof re-read through `ReceiptProofCredentialRef`. |
| `control.work_authorities.status.get.v1` | Control internal query | Returns bounded exact work-authority state, generation, budget, expiry and fence progress. |
| `control.work_authorities.revoke.v1` | Control internal command | Denies new work-sourced permits and reports terminal only after every older permit settles or is fenced. |
| `control.work_delegations.issue.v1` | Control internal command | Creates one finite `PendingProjectReceipt` standing-work delegation for an exact subscription, trigger, scope, operations/targets, budgets, run count, generations and expiry. |
| `control.work_delegations.activate.v1` | Control internal command | Idempotently activates one standing-work delegation only after exact subscription/receipt proof re-read through `ReceiptProofCredentialRef`. |
| `control.work_delegations.status.get.v1` | Control internal query | Returns bounded state, remaining allowance, generation, expiry and fence progress. |
| `control.work_delegations.trigger.admit.v1` | Control internal command | Atomically consumes one active delegation allowance and creates one exact pending Work/Job authority plus a one-use `ReceiptBootstrapCredential` usable only for that absent Job and receipt; duplicate trigger delivery returns the same identity. |
| `control.work_delegations.revoke.v1` | Control internal command | Denies new trigger admissions and fences every affected derived work source before terminal status. |
| `control.mutation_permits.issue.v1` | Control internal command | Issues one fresh exact one-use Project-effect permit from exactly one live session, durable-work, or Task-sponsorship authority source, locking and indexing every revocable dependency. |
| `control.mutation_permits.settle.v1` | Control internal command | Idempotently settles one committed permit only after resolving its ledger-selected `ProjectPermitSettlementTarget` and re-reading the exact immutable Project consumption proof through `PermitSettlementCredentialRef`; absent/conflicting proof cannot settle. |
| `control.mutation_permits.status.get.v1` | Control internal query | Returns bounded settlement/fence status for an exact permit to trusted Control components only. |
| `control.revocations.begin.v1` | Control internal command | Locks the exact authority root, denies new permits, advances generation, and snapshots every nonterminal target. |
| `control.revocations.status.get.v1` | Control internal query | Reports target acknowledgements and remains non-effective while any older permit can commit. |
| `control.revocations.settle.v1` | Control internal command | Records trusted Project fence acknowledgements and marks revocation effective only after complete proof. |
| `control.project_placements.product.resolve.v1` | Host internal query | Returns only the typed least-privilege Product placement view for one currently authorized Project. |
| `control.project_placements.fence_target.resolve.v1` | Control internal query | Returns only the typed fence-worker target view; it cannot be used as a Product placement. |
| `control.project_placements.permit_settlement_target.resolve.v1` | Control internal query | Returns the ledger-selected exact Project/placement target with only the read-only `PermitSettlementCredentialRef` for one keyed permit-consumption proof. |
| `control.project_placements.receipt_proof_target.resolve.v1` | Control internal query | Returns the exact Project/placement target with only `ReceiptProofCredentialRef` for one keyed Work/Task/standing-work/Routine/Agent-principal receipt proof. |
| `control.project_placements.finalizer_target.resolve.v1` | Control internal query | Returns only the sealed exact registry kind and its matching typed credential for one precommitted transition; unknown kinds and cross-kind credentials fail closed. |
| `control.project_placements.audit_target.resolve.v1` | Control internal query | After exact `project.audit.*` authorization, returns only a typed exact-Project Audit query/export target; it cannot read Resource or Control state or mutate Audit. |
| `control.semantic_facts.read_project_page.v1` | Control internal query | Returns one bounded retained page of safe Control `SemanticFact`s filtered to an exact authorized Project and cursor; never Audit, secrets, provider payloads, or Resource bodies. |
| `control.project_lifecycle.result.record.v1` | Operator internal command | Records one authenticated bounded provisioning/relocation/retirement result so Control can advance the expected state machine generation. |

Queries always re-evaluate current durable authority. Cached positive decisions
cannot outlive revocation, and unauthorized Project/User existence is not
disclosed. Permit validation and consumption remain Project-transaction
operations through the exact Control/Project contract, not callable bypasses.
Sponsorship and work issuance are idempotently bound to preselected Task/Work/
Job identities and receipt digests; a pending orphan cannot authorize an
ordinary effect and is expired or revoked by reconciliation.

`control.semantic_facts.read_project_page.v1` accepts only a
`ControlFactProjectorCredential` bound to one exact Project. Control requires
the requested Project to equal that scope and filters in SQL. Its role can read
only safe fact fields plus that Project's ordinal/chain/retention metadata; it
cannot enumerate Projects, read Audit/identity/session/credential/policy state,
or write Control. The opaque page cursor is projection pagination, not an event
ordering or authority token.

Current-family sign-out fences that family's outstanding permits while already
admitted independent work authorities, work delegations, Task sponsorships and
Routine delegations continue. Everywhere sign-out and User disable/removal
revoke all of those authorities sponsored by that User and report security
completion only after D007 fencing proves that older permits cannot commit.
Session rotation, work/sponsorship/delegation creation, and permit issuance
check the User security root and every relevant child dependency under the
canonical lock order.

## Provider and repository ports

- provider-neutral OIDC verifier/exchanger per enabled provider;
- managed secret/key service and cryptographic random/clock;
- narrow repositories for identity, login attempts, sessions, Users,
  Organizations, Projects/grants, entitlements/policy, placement/provisioning,
  Project pins/share links/copy workflows, authenticators/step-up/recovery,
  subscriptions/usage reservations/ledger/reconciliation, connector
  connections/consent, Agent authority/tool grants, work authorities/standing-
  work delegations, sponsorships/standing Routine delegations, authority/
  permits/dependency index, idempotency, Audit, governed export artifacts, and
  retained semantic facts;
- narrow billing-provider adapters for authenticated checkout/change intent,
  webhook/receipt verification and frozen-window usage reads; no provider SDK
  model crosses into Control state;
- durable provisioning request/result contract consumed by the separately
  wired operator runner; the privileged provisioner/migrator/credential
  manager is injected only into that runner;
- notification/email delivery as an outbox-backed adapter when invitations or
  security notices exist; and
- safe profile decoration/directory queries.

Control domain services do not import Resource capabilities. Wiring injects
technical platform adapters. Operator implementations/credentials never enter
Product Host or Control-worker graphs.

## Persistence and concurrency

Control invariants use one Control transaction where possible: first User/
Organization bootstrap, sole owner and grant updates, session rotation/replay,
entitlement/policy revisions, permit issuance/revocation, and required Audit.
Expected aggregate versions and uniqueness/foreign-key constraints close
concurrent races.

Project pins and signed-in share links are Control-local aggregates because
they must work before a Cell exists. Pin mutation locks only the current User's
pin-set revision. Link acceptance locks the exact link generation and current
Project/User policy, increments bounded acceptance count, materializes the
direct grant and writes required Audit in one transaction. Project duplication
is a durable multi-authority workflow; each source export and destination
import remains an independently permitted Project transaction, so Control
never attempts a cross-database atomic commit.

Organization-share admission is entirely Control-local. One authorized
request transaction freezes the bounded User membership rows, input/generation
digest, `ProjectOrganizationShareSnapshot`, exact Job, idempotency result and
required Control Audit. The Control worker may invoke only the exact snapshot's
grant action. Before each bounded page it rechecks the requester, Project,
Organization, grant, entitlement and policy generations; loss or narrowing of
authority prevents every remaining row. Each page atomically records its
per-User outcomes, direct-grant changes, required Audit/facts and snapshot
counts. Restart resumes from `(SnapshotID, UserID)` outcomes, uncertain commits
are reread before retry, and partial completion is reported rather than rolled
back. No Project permit, Product credential, timer, Organization membership
row, or snapshot receipt is itself grant authority.

Usage reservation and normalized ledger insertion are Control transactions
under exact `UsageIntentID` and expected generation. Provider callbacks and
polls are authenticated hints: they enqueue or resume reconciliation but do
not mutate subscription or ledger truth before exact provider identity,
generation, receipt digest, currency/unit normalization and idempotency checks.
The Project-side provider call remains a distinct Project transaction linked by
the same intent ID; crash recovery can cancel an unadmitted Control reservation
or settle both exact ledgers from the retained minimized receipt without a
distributed transaction.

When a Control mutation is declared user-visible, its bounded registered
`SemanticFact` commits in that same Control transaction. It is a retained
Activity/search projection input, never authorization, Audit, or a command bus.

Permit issuance locks every revocable dependency in deterministic `(kind,
stable ID)` order and writes a `PermitDependency` row for every exact generation
plus its trusted Project/placement target. Any dependency revoker locks its row
and snapshots every indexed nonterminal target regardless of wall-clock expiry.
This makes “no new permit after revocation begins” and eventual effective
fencing executable across User, session/work/sponsorship, grant, entitlement,
policy, placement, Agent and tool-grant races rather than a check-then-act
assumption.

Work authority, Task sponsorship and either standing-delegation kind use the
same pending-receipt, generation and deny-first rules. Expiry is scheduled as
revocation: no new permit is issued at or after the deadline, and a source is
terminal only after all older permits settle or are fenced. Project receipt
acknowledgement activates a pending source only after an exact proof re-read
through `ProjectReceiptProofTarget`; absence remains pending and conflicting
proof fails closed. A recurring trigger consumes allowance and mints the exact
pending Work authority or Task sponsorship plus one separately typed
`ReceiptBootstrapCredential` atomically in Control. The exact Project Job/Task
transaction consumes that credential only for the preselected absent object and
matching receipt/proof. Normal session-started admission instead consumes an
ordinary session permit. Crash/lost-ack/orphan reconciliation is idempotent
without distributed commit.

Project provisioning/relocation/deletion cross infrastructure and use durable
fenced state machines. Project mutation permits cross Control and one Project
Database without distributed transactions: Control orders issuance/revocation;
the Project transaction validates/consumes against the mirrored mutable fence;
after commit, trusted settlement re-reads the exact immutable consumption proof;
revocation waits/fences prior permits before becoming effective. Exact replay
is idempotent, lost acknowledgement re-reads, and conflicting proof never marks
a permit settled.

## Stable failures

Unknown/disabled/misconfigured provider; invalid/consumed/expired login,
linking, authenticator, step-up or recovery ceremony; provider issuer/audience/
nonce/tenant/authorized-party/signing-policy failure; identity or credential
conflict; session invalid/expired/replayed/revoked; CSRF/origin/host failure;
User/Organization inactive; owner required/transfer required; grant, pin,
share-link, Organization-share snapshot, leave or duplication precondition
invalid; action unknown;
forbidden; entitlement unavailable/limit; Project non-active; placement stale;
provisioning/copy failed; billing provider unavailable; subscription transition
stale/declined/disputed; usage reservation exhausted/expired/conflicting;
provider receipt missing/duplicate/conflicting; reconciliation discrepancy;
permit unavailable/replayed/expired/stale; version conflict; Agent authority/
sponsorship/delegation inactive, stale, exhausted, or mismatched; permit
settlement proof absent/conflicting; receipt proof absent/conflicting;
finalization kind/credential/transition unknown or mismatched; integrity/
required-Audit/storage unavailable. External errors are redacted.

## Security invariants

- official/mature OIDC/OAuth libraries; no invented protocol cryptography;
- provider credentials/tokens, PKCE verifier, cookies, secrets, placement and
  database credentials never log or enter domain projections;
- strict redirect allowlist, cookie, CSRF, Host, Origin, DNS-rebinding and body/
  rate bounds;
- every protected request checks current authority; every ordinary protected
  Project effect obtains and consumes a fresh permit from exactly one of the
  three trusted sources;
- `ReceiptBootstrapCredential` is not a permit source and exists only for exact
  standing-work/Routine trigger creation of an absent Job/Task plus receipt;
- post-commit settlement and pending-authority activation use separate exact
  read-only Project proof credentials; neither can be replaced by Product,
  fence, finalizer, Audit, or caller-supplied evidence;
- Project-local Agent state cannot create or widen authority, and every
  sponsorship-sourced permit must match an active exact Control record plus the
  Project Task receipt/state;
- Project A runtime credential cannot discover or access Project B;
- Product, settlement, receipt-proof, fence-only, per-kind finalizer, and Audit
  credential types cannot be interchanged; the fence
  principal can execute only the bounded schema-owned fence-plus-Audit
  transition and has no raw Project table authority;
- managers cannot change the current owner; only owner can delete;
- a Project pin, share-link token, billing subscription, usage reservation, or
  provider webhook can never grant more authority than the current explicit
  User grant and policy permit;
- recovery and authenticator ceremonies cannot move a User between
  Organizations, transfer Project ownership, or revive revoked sessions/work;
- provider billing data is authenticated, minimized, idempotently reconciled,
  and cannot directly rewrite entitlement or historical usage truth;
- Organization removal/disable immediately affects grants and permit issuance;
- required Audit, any declared `SemanticFact`, and the Control effect are
  atomic; and
- high-risk admin changes show exact consequence, expected version, step-up/
  approval where required, and durable status.

## Headless proof

1. Deterministic OIDC server performs discovery/JWKS/code exchange and exact
   claim validation; separate operator-run live Google/Microsoft callbacks.
2. Session restart, rotate, predecessor replay, idle/absolute expiry, current
   sign-out and everywhere sign-out over live Control MySQL.
3. Concurrent one-Organization bootstrap and sole-owner/grant mutations.
4. Two Users/two Organizations/two Projects including cross-Organization grant,
   Organization-share immutable request/status and paged per-User outcomes,
   membership/grant-change races, partial crash/retry, private pin ordering,
   signed-in expiring link acceptance/revocation, leave refusal for the owner,
   and isolated Project duplication with source unchanged.
5. Provision crash/retry at every state, trusted Active placement, hostile
   substitution and per-Project credential isolation.
6. Permit issuance races independently against every indexed dependency;
   expiry is capped by all source deadlines and no older permit commits after
   revocation reports effective.
7. Permit settlement exact-replay/lost-ack/absent/conflicting-proof tests prove
   the Project consumption row is required and the fence role cannot substitute.
8. Pending/ack/lost-ack/orphan/restart tests cover Work/Job, Task and both
   standing-delegation sagas; current-family sign-out preserves explicitly
   admitted durable sources while sign-out-everywhere/User disable fences all
   User-sponsored sources. Work, Task, standing-work, Routine and Agent-
   principal activation each prove exact receipt-proof-only behavior.
9. Enterprise OIDC/SAML configuration versioning, federated reauthentication,
   WebAuthn registration/assertion, TOTP/recovery fallback, credential loss and
   account recovery prove browser/operation binding, replay resistance,
   non-enumeration, key rotation and no authority resurrection.
10. Billing tests prove reservation before provider-backed admission, exact
   settle/cancel idempotency, allowance races, webhook authenticity, provider
   redirect distrust, receipt conflict, frozen-window reconciliation,
   entitlement-change races, and no Project-access implication.
11. Required Audit/effect/declared-SemanticFact atomicity, redaction, typed
   Product/settlement/receipt-proof/fence/per-kind-finalizer credentials, and
   least-privilege grants, including negative substitution across every role and
   finalization registry unknown-kind/cross-kind/provider/tool/Resource/enqueue
   denial.
12. Production graph uses durable stores/managed secrets and fails closed when
   any mandatory real adapter is absent.

## Source grounding

- [Original Authentication construction](https://app.notion.com/p/377b6410e502812da5f4dad969db3af6)
- [Original Project construction](https://app.notion.com/p/377b6410e5028179be33df4a838a528c)
- [SOL X Master Blueprint and complete manifest](https://app.notion.com/p/39ab6410e5028158b555c9a34752e292)
- [SOL X 14 — Project Selection](https://app.notion.com/p/39ab6410e5028114883af87b51fccc3b)
- [SOL X 20 — Organizations, Identity & Sessions](https://app.notion.com/p/39ab6410e50281b0b809d2cce095584d)
- [SOL X 21 — Access, Projects & Sharing](https://app.notion.com/p/39ab6410e502814babc4e727a3437c9b)
- [SOL X 22 — Entitlements, Billing & Admin](https://app.notion.com/p/39ab6410e50281feae0ad70b715220a7)
- [SOL X 65 — Settings and sharing surfaces](https://app.notion.com/p/39ab6410e5028132925cd75b41046788)
- [Omega Control boundary](../architecture/control-and-project-boundary.md)
- [Nova implementation evidence](../nova-evidence.md)

Current Omega decisions on cardinality, Project databases, Cells, permits, and
revocation supersede older Taurus/Nova model choices.

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
Nova working durable evidence includes
[`internal/identity`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/identity),
[`session/runtime`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/session/runtime),
[`access`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/access),
[`project/runtime`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/project/runtime),
and the [live MySQL durable-composition test](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/test/integration/durable_composition_integration_test.go).
They prove OIDC/PKCE, encrypted attempts, opaque session rotation/replay,
deny-by-default access, provisioning/fences, restart and isolation. Nova's
multi-Organization User, multiple-owner Project, shared database and weaker
permit model are explicitly superseded; live provider callbacks, Omega D004/
D005/D007 semantics and production key recovery remain unproved.
