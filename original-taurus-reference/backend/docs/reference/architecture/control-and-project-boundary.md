# Control, access, and Project boundary

## Authority domains

The Control Database owns identity and authority:

- exact external OIDC/SAML subject links and versioned enterprise trust policy;
- login attempts and encrypted PKCE verifier material;
- WebAuthn/TOTP/recovery authenticator metadata, one-use step-up/recovery
  ceremonies and managed-secret references;
- opaque Taurus session families, rotation, replay, idle/absolute expiry, and
  User/session epochs;
- Users and exactly-one-Organization assignment;
- Organizations and administrative ownership;
- Projects, sole owner, home Organization, explicit User grants, private pins,
  signed-in share links, duplication workflow, and lifecycle;
- entitlements, quotas, provider policy, action policy revisions, subscription
  truth, usage reservations/ledger, and provider reconciliation;
- trusted Project placement and provisioning state;
- one-use mutation permits and durable revocation/quiescence state; and
- Agent authority principals, tool-grant generations, bounded Task
  sponsorships, and standing Routine delegations; and
- Control-local required Audit.

The Project Database owns Project-local canonical resources, idempotency,
required Audit, consumed permits/authority fence, and jobs whose effects belong
to that Project.

## Identity

OIDC proves an external identity. Taurus links accounts only by the exact,
case-sensitive `(issuer, subject)` tuple, or a provider-specific stable subject
that has been validated under that issuer's documented rules. Email is profile
data, never an account-linking key.

Initial provider adapters support Google and Microsoft/Outlook accounts through
Authorization Code with PKCE and mature OIDC/OAuth libraries. Login requests
only identity scopes. Outlook Mail/Calendar and Microsoft Graph permissions are
separate connector consent, token, audit, and revocation domains.

Enterprise providers use versioned standards-based OIDC or SAML configuration;
Okta is one possible configured issuer, not a bespoke protocol path. Taurus
does not own first-party passwords in the accepted model. WebAuthn/passkeys are
the preferred production step-up method, with TOTP, one-use recovery codes and
policy-admitted fresh federated reauthentication as explicit methods. Recovery
cannot move a User between Organizations, transfer Project ownership, or
restore revoked sessions/work.

## Sessions

Browser sessions are opaque selector/secret credentials backed by durable
server records. They support:

- secure, HTTP-only, same-site cookie policy appropriate to deployment;
- CSRF protection and strict origin/host rules;
- idle and absolute expiration;
- rotation and predecessor-replay family revocation;
- current-family sign-out;
- sign-out everywhere by revoking every family, every User-sponsored durable-
  work authority/standing-work delegation, every Task sponsorship, and every
  standing Routine delegation; and
- managed, versioned secret/MAC keys with rotation and recovery.

Provider tokens never become Taurus sessions.

## Projects and sharing

A Project has one owner and one home Organization. Only the owner can perform
final deletion. Delegated roles can be operation-specific, but cannot silently
replace/demote the current owner. A User must be active in their single
Organization before receiving Project access.

Project access is granted directly to Users, including Users from other
Organizations. An Organization-share action expands to explicit User grants at
a recorded point in time; Project authorization still evaluates User grants.

Private Project pins affect only pre-Cell listing order. Signed-in expiring
share links materialize bounded direct User grants after current authority and
policy checks; the link itself is never anonymous Project access. Leaving
revokes a non-owner caller's own grant. Project duplication creates a new
Project identity and coordinates separately authorized source export and
destination import; it never copies a database or shares credentials.

Commercial state is not access authority. Usage is reserved under an exact
Organization/Project/User intent before provider-backed work, normalized into
an immutable Control ledger, and reconciled against authenticated minimized
provider receipts. A subscription, checkout redirect, invoice, webhook, or
usage reservation cannot grant Project visibility or authorize a mutation.

## Trusted placement

`ProjectID` may come from a route, but the database, cluster, credential,
schema, placement generation, and identity fence come only from trusted Control
state. Product and authority-fence workers receive different typed placement
views; there is no generic credential-bearing placement passed between roles.
Illustrative views:

```go
type ProductProjectPlacement struct {
    ProjectID             ProjectID
    Engine                Engine
    ClusterRef            SecretlessClusterRef
    DatabaseRef           OpaqueDatabaseRef
    ProductCredentialRef  ProductCredentialRef
    SchemaVersion         SchemaVersion
    ProjectFence          ProjectFence
    Generation            PlacementGeneration
    Lifecycle             ProjectLifecycle
}

type AuthorityFenceTarget struct {
    ProjectID           ProjectID
    Engine              Engine
    ClusterRef          SecretlessClusterRef
    DatabaseRef         OpaqueDatabaseRef
    FenceCredentialRef  FenceCredentialRef
    SchemaVersion       SchemaVersion
    ProjectFence        ProjectFence
    Generation          PlacementGeneration
}

type ProjectPermitSettlementTarget struct {
    PermitID                      PermitID
    ExpectedPermitDigest          Digest
    ProjectID                     ProjectID
    Engine                        Engine
    ClusterRef                    SecretlessClusterRef
    DatabaseRef                   OpaqueDatabaseRef
    PermitSettlementCredentialRef PermitSettlementCredentialRef
    SchemaVersion                 SchemaVersion
    Generation                    PlacementGeneration
}

type ProjectReceiptProofTarget struct {
    ReceiptKind                ReceiptKind
    ControlAuthorityID         ControlAuthorityID
    ControlGeneration         Generation
    ExpectedReceiptDigest     Digest
    ProjectID                  ProjectID
    Engine                     Engine
    ClusterRef                 SecretlessClusterRef
    DatabaseRef                OpaqueDatabaseRef
    ReceiptProofCredentialRef  ReceiptProofCredentialRef
    SchemaVersion              SchemaVersion
    Generation                 PlacementGeneration
}

type ProjectFinalizerTarget struct {
    ProjectID               ProjectID
    Engine                  Engine
    ClusterRef              SecretlessClusterRef
    DatabaseRef             OpaqueDatabaseRef
    Kind                    FinalizationTargetKind
    Credential              FinalizerCredential // sealed kind-matched union
    SchemaVersion           SchemaVersion
    Generation              PlacementGeneration
}

type ProjectAuditTarget struct {
    ProjectID                  ProjectID
    Engine                     Engine
    ClusterRef                 SecretlessClusterRef
    DatabaseRef                OpaqueDatabaseRef
    ProjectAuditCredentialRef  ProjectAuditCredentialRef
    SchemaVersion              SchemaVersion
    Generation                 PlacementGeneration
}
```

Only an `Active` Project can produce a Cell or Product store handle. Product
wiring can resolve only `ProductCredentialRef`; Control reconciliation wiring
can resolve only the read-only `PermitSettlementCredentialRef` and
`ReceiptProofCredentialRef`; Control fence wiring can resolve only
`FenceCredentialRef`; a Project job supervisor's finalizer graph can resolve
only the exact kind-matched finalizer credential; and the separately authorized
Project-Audit administration graph can resolve only
`ProjectAuditCredentialRef`. Operator credentials are absent from all four
security/runtime views and are resolved only inside the separately composed
operator runner. Product, settlement, receipt-proof, fence, finalizer and Audit
credential types cannot substitute for one another.

## Strong mutation authority

The User-facing contract is deliberately simple:

1. Every protected request evaluates current durable authority.
2. Immediately before a protected Project Product effect, Control issues a
   fresh, bounded, signed one-use effect permit for exact User, Project,
   action, Resource/operation, policy generation, authority source, and expiry.
3. The Project transaction locks or orders against the mutable Project-local
   authority fence, validates the permit and current generation, records its
   one-use consumption and an exact `PermitConsumptionProof`, performs the
   effect, stores required Audit and idempotency, and commits atomically.
4. After Project commit, trusted Control settlement re-reads the exact proof
   through a typed read-only settlement target and idempotently settles the
   permit ledger. Lost acknowledgement follows the same re-read; absent or
   conflicting proof keeps the permit nonterminal.
5. Revocation first stops new permit issuance and advances authority.
6. Revocation reports effective only when every older permit has settled or is
   fenced so it cannot commit.

Permit replay, wrong scope/action/resource, expiry, stale generation, stale
placement, and revocation all fail closed. A valid permit with a stale Resource
version remains a Resource conflict, not an authorization failure.

Permits are internal commit credentials, never bearer credentials returned to
a browser or provider. Their lifetime is short and bounded. Control alone owns
permit issuance keys; Product runtimes receive only the versioned verification
material they need. An unknown or retired key version fails closed.

Control mutations do not recursively issue a permit to issue a permit. A
Control handler locks and re-evaluates current Control authority, expected
versions and idempotency in the same Control transaction that writes its
effect, required Control Audit and any declared `SemanticFact`.

### Permit authority sources

Every effect permit names exactly one durable Control-owned authority source:

```text
SessionAuthority {
  SessionFamilyID, SessionGeneration
}

DurableWorkAuthority {
  WorkAuthorityID, WorkGeneration, JobID
}

TaskSponsorshipAuthority {
  SponsorshipID, SponsorshipGeneration, TaskID
}
```

A session source requires the exact session family, User, grant, entitlement,
policy, and Project authority to remain active. A durable-work source requires
an active exact accepted Work/Job receipt and its bounded operations, targets,
budget and expiry. A Task-sponsorship source requires
an active bounded `TaskSponsorship` for the exact sponsor User, Project, Agent,
   Task, permitted operations/targets, Agent and tool-grant generations, budget,
   and expiry. The Project handler additionally requires the matching Project-
   local Task sponsorship receipt and an effect-compatible Task state. A caller
   cannot choose or substitute any source from request data.

There are no other ordinary permit-source arms. In particular, a Project
receipt, a standing delegation, and a `ReceiptBootstrapCredential` are not
effect-permit authority. Session-started Work, Task, Routine, standing-work and
Agent-principal admission uses an ordinary `SessionAuthority` permit. Only an
already-active standing-work or Routine delegation may admit a no-session
trigger and issue a separately typed, one-use `ReceiptBootstrapCredential`.
That credential is usable only for the preselected exact absent Job or Task and
matching receipt/digest at one Project placement generation. It cannot
authorize any later effect or any other operation.

Authority records form an explicit generation/dependency graph rooted at the
User security authority. Session-family rotation, durable-work/Task-
sponsorship/standing-delegation issuance, and permit issuance all lock every
revocable dependency—User root, session or delegation source, Organization,
Project grant, entitlement/policy, placement and any Agent/tool grant—in a
deterministic `(dependency kind, stable ID)` order. The permit transaction
writes a `PermitDependency` index row for each locked generation. Any revoker
locks its dependency row and snapshots every nonterminal permit found through
that index, so a grant/tool/policy revocation cannot race issuance on a
different row. Current-family sign-out serializes against sponsorship
creation from that family: a sponsorship committed before sign-out wins is an
independent durable authority; one attempted after the family enters
`Revoking` is denied. Sign-out everywhere and User disable/removal first lock
and advance the User root, preventing any new family, sponsorship, delegation,
work authority, or permit while descendant revocations and fences complete.

`Permit.ExpiresAt` is no later than the minimum deadline of its authority
source, approval, delegation, policy admission and operation maximum. A
Project transaction checks it after taking the shared fence lock and before
the bounded effect. A transaction admitted before that instant may settle only
under the shared-lock/exclusive-fence ordering below; expiry alone is never
terminal proof.

Current-session-family sign-out revokes and fences only permits sourced by that
family. It does not silently cancel independently sponsored durable Tasks.
`SignOutEverywhere`, User disable/removal, Project-grant loss, Agent/tool-grant
revocation, Task cancellation, and explicit durable-work/sponsorship revocation
deny new permits immediately and run D007 fencing for affected sources
before reporting security completion. Sponsorship expiry is a scheduled
revocation boundary, not a wall-clock garbage-collection shortcut: issuance
denies at the boundary and the source becomes terminal only after its
nonterminal permits settle or are fenced.

### Executable revocation protocol

Each revocable authority record has a monotonically increasing generation and
one of these states:

```text
Active -> Revoking -> Fencing -> Effective
```

Only `Active` passes a protected-request check or permits issuance. `Revoking`,
`Fencing`, and `Effective` all deny immediately. Re-enabling authority creates
a deliberate new active generation; it does not move an old revoked generation
backward.

1. **Serialize issuance and revocation.** Permit issuance locks every revocable
   dependency in the canonical order above, rechecks every one as `Active`, and
   records the permit, dependency-index rows and trusted `(ProjectID, placement
   generation)` target in that same Control transaction. `BeginRevocation`
   locks its affected dependency row. If issuance locks it first, revocation
   waits and then finds the permit through the dependency index; if revocation
   locks it first, issuance wakes to a non-`Active` dependency and denies.
   There is no check-then-issue gap on session, User, grant, entitlement,
   policy, placement, work, sponsorship, Agent or tool authority.
2. **Begin in Control.** While holding the affected dependency lock, one
   Control transaction changes `Active` to `Revoking`, advances its generation,
   records the revocation identity, and snapshots exact fence targets from
   **every nonterminal permit ledger row indexed to the affected dependency
   generation**, even when a permit's wall-clock expiry has passed. A permit
   whose Project commit began before expiry may still hold a shared fence lock;
   expiry alone is not proof it settled. A target is `(ProjectID, placement
   generation)` and never a request-supplied database location.
3. **Order ordinary Project commits.** Every protected Project mutation takes a
   shared row lock on that Project Database's single authority-fence row. While
   holding the short-lived lock, it validates the internal permit signature,
   key version, authority and placement generations, exact actor/delegation,
   action and target, expiry, and one-use identity. The same Project transaction
   consumes the permit, writes an immutable `PermitConsumptionProof` binding the
   permit digest, Project and placement generation, effect/idempotency commit
   identity and commit time, applies the effect, records idempotency and Project
   Audit, and commits. Ordinary mutations never take the exclusive fence lock.
4. **Settle a committed permit.** After commit, the Product handler calls the
   trusted idempotent `control.mutation_permits.settle.v1` contract with the
   exact permit identity. Control resolves the ledger-selected
   `ProjectPermitSettlementTarget` and re-reads only that permit's immutable
   proof using `PermitSettlementCredentialRef`; it never trusts a browser,
   handler-supplied commit claim, or fence acknowledgement. An exact duplicate
   proof returns the existing terminal settlement. An absent proof remains
   retryable/nonterminal. A mismatched permit digest, Project, placement
   generation, commit identity or previously recorded proof is a conflicting-
   proof failure and leaves the permit nonterminal for fencing. Lost post-commit
   acknowledgement is recovered by the same exact re-read. The settlement
   credential can execute only the exact proof-read routine and cannot advance
   a fence, read Resource/Audit/job tables, or write Project state.
5. **Fence each target.** A separately composed Control authority worker opens
   the trusted target placement and takes an exclusive lock on its authority-
   fence row. The lock waits behind Project mutations that already hold the
   shared lock. The worker advances the Project-local authority generation and
   revocation identity and appends a bounded Project Audit record in that same
   Project transaction. It then records an acknowledgement for that exact
   `(ProjectID, placement generation)` in Control. A mutation that starts after
   this commit sees the newer fence and rejects an older permit. The fence-only
   principal may execute only a schema-owned bounded fence transition (or an
   equivalently restrictive database mechanism) that locks/updates the sole
   fence row and inserts the validated fence Audit record atomically. It has no
   raw table privileges that could read or mutate Resource tables, consumed
   permits, jobs, arbitrary Audit rows, schema objects, or accounts.
6. **Finish only after proof.** Control moves from `Revoking` to `Fencing` while
   targets remain, and to `Effective` only when every target is acknowledged.
   A timeout, unavailable Project Database, lost worker lease, or partial fanout
   leaves authority denied in `Revoking`/`Fencing`; the idempotent worker keeps
   retrying. It never reports a best-effort success.

Permit issuance and settlement records remain nonterminal until Control has
durable proof re-read from the exact Project permit-consumption row or the
applicable fence target is
acknowledged; wall-clock expiry alone never removes a target. Records are
retained at least through fence completion plus the required audit/recovery
horizon. Signing-key verification versions remain available until every permit
under that version is terminal and every related fence is acknowledged.
Emergency key retirement first denies issuance and runs the same generation/
fencing protocol.

Placement changes participate in the protocol. A replacement placement cannot
become writable until its fence is initialized at least to the current Control
generation. If relocation begins during revocation, Control adds the new
placement generation as a target before activation; an obsolete placement is
never reactivated without re-fencing. Acknowledgements are generation-specific
and therefore cannot accidentally bless a replacement database.

This is not a distributed transaction. It is a deny-first, idempotent state
machine whose completion condition is durable proof from every affected
Project placement.

## Durable Product work and terminal finalization

Cross-domain activation uses one closed Project proof vocabulary:

```text
AuthorityReceiptProof {
  ReceiptKind, ControlAuthorityID, ControlGeneration,
  ProjectID, PlacementGeneration, LocalObjectID,
  ReceiptDigest, InitialStateDigest, ProjectCommitID, CommittedAt
}

ReceiptKind = durable_work@1 | task_sponsorship@1 |
              standing_work@1 | standing_routine@1 |
              agent_principal@1
```

The Project transaction writes the proof atomically with the exact local object
and non-authoritative receipt. `ProjectReceiptProofTarget` is bound to one
receipt kind, Control identity/generation/digest, Project and placement
generation; `ReceiptProofCredentialRef` may execute only that exact keyed proof
read and cannot enumerate receipts or read Resource, Audit,
job, permit, or fence state. Activation compares every field to pending Control
state. Exact replay is idempotent, absence remains pending, and any kind/ID/
generation/digest/placement conflict fails closed. This is the only activation
and lost-ack proof path for Work, Task, standing-work, Routine, and Agent-
principal protocols.

No worker has ambient Project authority. A user-accepted import, Resolution,
render, extraction, analytic run or other effectful durable job uses this
cross-domain admission protocol:

1. The handler preselects stable `WorkAuthorityID` and `JobID` values. Under a
   live session, Control validates current dependencies and creates a bounded
   `DurableWorkAuthority{PendingProjectReceipt}` with exact sponsor User,
   Project, operation/target ceiling, budgets, generations, expiry and the
   initiating session identity. Control does not create a bootstrap credential
   for this session-started admission.
2. The initiating Project transaction consumes an ordinary session-sourced
   effect permit, commits the
   canonical intent/effect, exact job, non-authoritative work receipt,
   exact `AuthorityReceiptProof`, idempotency, required Project Audit and any
   declared `SemanticFact`.
3. An idempotent commit acknowledgement moves Control authority to `Active`
   only after re-reading that exact proof through a
   `ProjectReceiptProofTarget` using `ReceiptProofCredentialRef`. If the Project
   commit succeeded but acknowledgement was lost, reconciliation performs the
   same exact read and activates it. Caller assertions and Product, settlement,
   fence or finalizer credentials are not proof. If
   the Project record is absent, the pending Control orphan cannot authorize a
   job effect and expires/revokes; a conflicting kind/ID/generation/digest/
   placement proof fails closed.
4. Each later canonical job effect obtains a fresh permit sourced by that exact
   active `DurableWorkAuthority`; Project handling requires the matching Job/
   receipt, expected job generation, allowed operation/target and remaining
   budget. Child jobs inherit a narrowed lineage rather than ambient authority.

Current-family sign-out preserves explicitly admitted durable work. Sign-out
everywhere, User disable/removal, Project-grant/policy/entitlement loss, work
cancel, expiry or explicit revoke denies new permits and fences outstanding
ones through D007. Periodic connector work requires an independently accepted,
finite standing work delegation with exact subscription, trigger, operations,
budgets, run limits and expiry; a webhook is only a hint and grants nothing.

That non-Agent `StandingWorkDelegation` uses the same cross-domain proof as a
Routine delegation without becoming a permit source: Control creates
`PendingProjectReceipt`, an ordinary session-permitted Project transaction
stores the exact subscription/receipt and `AuthorityReceiptProof`, and trusted
proof re-read activates it. Each
accepted timer/webhook delivery atomically consumes one allowance and creates a
pending exact `DurableWorkAuthority` plus a one-use
`ReceiptBootstrapCredential` for one exact absent Work/Job and matching receipt.
The credential is a closed security transition, not an ordinary effect permit:
it may create only the preselected Job, receipt, admission Audit/fact and exact
predeclared finalization record. The Project proof/ack protocol above then
applies.
Duplicate delivery returns the same identity; pending orphans cannot act.
Current-family sign-out preserves an explicitly accepted delegation, while
User-wide, grant/policy, subscription, connection-generation or explicit
revocation denies/fences it and all affected derived work.

Some state must still converge after all effect authority is denied: a spent
provider call must record usage, a canceled Task/job must become terminal, and
a revoked reservation must settle or cancel. The initiating Project
transaction therefore may create an exact `FinalizationRecord` bound to one
closed registry kind, target identity, expected generation, input/evidence
digest and allowed next state. This record is **not** an effect permit.

`FinalizationTargetKind` is a closed versioned registry. V1 accepts only:

| Kind | Typed credential | Exact allowed transitions |
| --- | --- | --- |
| `durable_job@1` | `DurableJobFinalizerCredentialRef` | `queued`, `leased`, `running`, or `cancel_requested` -> `canceled` or `failed`; `completion_pending` -> `succeeded` only when the record already binds a settled permit-consumption proof for the committed effect. |
| `task@1` | `TaskFinalizerCredentialRef` | `running` or `cancel_requested` -> `canceled` or `failed`; `completion_pending` -> `completed` only when the prebound result/ChangeGroup already committed under a settled permit. |
| `intelligence_reservation_call@1` | `IntelligenceAccountingFinalizerCredentialRef` | exact reservation `reserved` -> `settled` or `canceled` together with exact call generation `admitted`, `provider_in_flight`, or `receipt_pending` -> `succeeded`, `failed`, or `canceled`; success may only record the already-returned minimized provider receipt. |
| `agent_disable@1` | `AgentDisableFinalizerCredentialRef` | exact Project Agent configuration `disable_requested -> disabled`. |
| `routine_lifecycle@1` | `RoutineLifecycleFinalizerCredentialRef` | `enable_pending -> enabled` only with the prebound exact active Control-delegation receipt proof; `disable_requested -> disabled`. Project status is non-authoritative. |
| `project_audit_export@1` | `ProjectAuditExportFinalizerCredentialRef` | `building` -> `ready`, `failed`, or `canceled` for an already-built sealed artifact; `ready` -> `expired` or `deletion_pending`; `deletion_pending` -> `deleted`. It cannot build, upload, deliver, or broaden an export. |

The sealed `FinalizerCredential` union contains exactly the credential arm named
by its registry kind. Unknown versions, unknown kinds, kind/credential mismatch,
unlisted source/target transitions, or input/state/generation mismatch fail
closed. A Project job supervisor's separate finalizer graph can execute only
the matched schema-owned transition and atomically append required Project
Audit plus a declared terminal/restrictive `SemanticFact`. No finalizer may
obtain an effect permit, create or change Resource output, start or retry a
provider/tool call, enqueue new work, widen scope/budget/authority, or resurrect
authority. Finalization is idempotent and remains possible after revocation or
outage; negative database and application tests prove every credential is
incapable of invoking another kind or accessing unrelated rows.

File derivations, connector syncs, Knowledge ingestions, Resolution runs,
analytic runs, Chat replies, Board refreshes, Translation jobs, and other
capability-owned run records are deliberately not extra finalization kinds.
Changing their canonical capability state or output remains an ordinary
Project effect requiring one of the three authority sources and a fresh permit.
After authority loss, only the associated generic durable Job bookkeeping may
close through `durable_job@1`; that transition cannot alter the capability run
or its output.

Projection rebuild, orphan cleanup and other jobs that change no canonical
Product effect use similarly closed maintenance/finalization operations. Any
job that produces a new canonical Product effect requires an active session,
durable-work authority or Task sponsorship and a fresh effect permit.

## Durable Agent sponsorship

Control owns Agent authority identity, active/revoked status, Agent/tool-grant
generations, `TaskSponsorship`, and `StandingDelegation`. The Project Agents
capability owns only Project-local Agent configuration, Persona and tool
declarations, Task/Plan/Attempt state, and a non-authoritative sponsorship
receipt/digest. A Project record cannot grant authority by itself.

Agent-principal creation follows the same receipt-proof contract. Control first
creates the exact principal and initial tool-grant generation as
`PendingProjectReceipt`. Under an ordinary session-sourced effect permit, the
Project transaction creates only the exact absent Agent configuration, matching
non-authoritative receipt, `AuthorityReceiptProof`, required Project Audit and
declared fact. Control activates the principal only after an exact trusted
receipt-proof re-read; lost acknowledgement repeats that read. No receipt-
bootstrap credential is issued for session-started Agent creation, and Project
configuration can neither activate nor widen Control authority.

Creating durable Action/Plan work is an explicit cross-domain state machine:

1. The caller selects a collision-resistant `TaskID` and exact initial Task
   digest. Under a live sponsoring session—or an active standing delegation for
   a Routine trigger—Control validates current User, Project grant, Agent/tool
   authority, policy, entitlement, budget and trigger. One Control transaction
   creates an exact, expiring `TaskSponsorship{PendingProjectReceipt}` and
   required Control Audit. A session-started Task uses an ordinary session-
   sourced effect permit; only a Routine trigger receives the separately typed
   `ReceiptBootstrapCredential`. Sponsorship creation is
   security plumbing and does not emit the ordinary Task-created
   `SemanticFact`.
2. The Project transaction consumes either that ordinary session permit or,
   only for a Routine-admitted no-session trigger, the one-use receipt-bootstrap
   credential. The latter is usable only for `tasks.create.v1` with the exact
   absent `TaskID`, Project, sponsorship digest and initial Task digest. The
   transaction creates the Task, non-authoritative sponsorship receipt, exact
   `AuthorityReceiptProof`, finalization record and first job, and appends
   required Project Audit plus the single Task-created `SemanticFact`.
3. An idempotent Project commit acknowledgement moves the Control sponsorship
   to `Active`. Before acknowledgement it cannot issue an ordinary effect
   permit. If the Project commit succeeded but acknowledgement was lost,
   reconciliation re-reads the exact receipt using the dedicated receipt-proof
   target and activates it; if the Task is absent, a session-started caller may
   retry with a fresh ordinary session permit while a Routine trigger may retry
   only the same receipt-bootstrap identity/input; otherwise the
   orphan expires/revokes. It can never authorize another Task or operation.
4. Every later protected Task effect obtains a fresh permit from Control under
   `TaskSponsorshipAuthority`. Control rechecks the sponsorship and all
   referenced User/Project/Agent/tool/policy generations; the Project handler
   rechecks the matching receipt, current Task state/generation, operation/
   target, and remaining budget. Project-owned Task generation is never copied
   into the Control sponsorship.
5. An explicit Task cancel first uses current session authority, when
   available, to move the Project Task to `cancel_requested`; Control then
   begins deny-first sponsorship revocation and D007 fencing. User-wide
   revocation may skip the first step. After fencing, the Task's exact
   precommitted finalizer can only move that Task to `canceled` and append its
   bounded Audit/terminal fact. If the Project Database is unavailable,
   authority remains denied and status converges after recovery without
   resurrecting a permit source.

Enabling a recurring Routine creates a bounded Control
`StandingDelegation{PendingProjectReceipt}` with exact sponsor, Project,
Agent/tool generations, trigger class, allowed operations/targets, per-run and
cumulative budgets, run limit, and expiry. A Project transaction under an
ordinary session-sourced permit creates the exact Routine configuration,
non-authoritative receipt and exact `AuthorityReceiptProof`; only trusted proof
re-read through `ReceiptProofCredentialRef` activates the delegation. A
missing Project receipt leaves an unusable pending orphan that expires/revokes.

An active standing delegation cannot authorize an ordinary Project effect
directly. Each accepted trigger atomically consumes a run allowance and creates
a fresh pending Task sponsorship plus exact one-use
`ReceiptBootstrapCredential`; the exact Task protocol
above then applies without a browser session. Expiry, revocation, exhausted
limits, or a stale generation pauses the Routine. Editing Project-local Routine
configuration cannot widen Control authority. The standing delegation is an
authority ceiling, not per-run approval: external, destructive, security,
irreversible or material-spend steps still pause for explicit exact current
approval unless the product later defines and accepts a bounded per-run
approval contract.

## Required Audit

Audit is canonical security attribution and must commit in the same transaction
as the effect:

- Control mutation → Control Audit row in the Control transaction.
- Project mutation → Project Audit row in the Project transaction.

Separately, a mutation declared user-visible writes its bounded registered
`SemanticFact` in that same owning transaction (Control or Project). A fence-
mirror update is security plumbing and writes its required Project Audit but
does not invent a second user-visible fact; the initiating Control revocation
owns any declared revocation fact.

A central audit-search projection may consume these records later, but cannot
replace the local atomic record. Activity, logs, and telemetry are distinct and
cannot satisfy required Audit.

Control and Project Audit may share a small bounded record vocabulary and safe-
field validators. They do not share a transaction appender. Control handlers
receive a Control-transaction appender; bound-Cell handlers receive a Project-
transaction appender. Neither appender may open a second database transaction.

## Provisioning

Project creation crosses Control and external database administration, so it is
an idempotent durable state machine rather than a distributed transaction:

```text
Provisioning -> Migrating -> Verifying -> Active
       |             |           |
       +-----------> Failed <-----+
```

Operator-only authority allocates the Project Database, applies the Project
Schema Contract, creates immutable identity and mutable authority fences,
provisions a least-privilege Product principal, verifies TLS/identity/schema,
provisions separate exact read-only permit-settlement and receipt-proof
principals, an execute-only fence principal, and one execute-only principal per
closed finalization kind plus the Project-Audit administration principal,
verifies TLS/identity/schema,
and activates the trusted placement. Partial or failed Projects remain
unavailable to Product traffic and can be safely retried or retired.

Provisioning executes in a separately wired operator runner with no Product
listener, no Cells, and no Resource-content authority. Product Hosts cannot
perform DDL, allocate databases, create accounts, relocate placements, or run
backup/restore. A Control worker may advance the provisioning state machine and
perform authority-fence fanout, but it also has no DDL or Resource-content
credential. The operator runner performs only the privileged step requested by
the durable state machine and reports a bounded result back to Control.

## Isolation proofs

- request-supplied database, credential, Project fence, or placement generation
  cannot influence handle construction;
- Project A's Product principal cannot discover, read, or mutate Project B;
- runtime principals have no DDL, global privileges, account administration,
  file access, or operator credentials;
- finalizer credentials can execute only exact precommitted monotonic terminal
  or registry-approved lifecycle transitions and cannot read/mutate Resource
  content or start work;
- permit settlement and receipt activation require exact Project proof rows;
  lost acknowledgement re-reads, conflicting proof rejects, and no Product,
  fence, finalizer, Audit, or operator credential can substitute;
- same User/different Project and different User/same Project cases are tested
  across independent Hosts/Cells with caches disabled;
- revocation races prove that no pre-revocation permit commits after effective;
- durable-work admission/ack/orphan, Task/Routine bootstrap, provider-late-
  settlement and post-revocation finalization converge without ambient
  authority;
- standing-trigger receipt bootstrap remains a separately typed exact absent-
  Job/Task transition and never appears as an ordinary permit source;
- unknown finalization kinds, unlisted transitions, and every cross-kind
  credential substitution fail closed;
- owner and Organization invariants hold under concurrent mutations; and
- required Audit and the effect are visible together or neither is visible.
