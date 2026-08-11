# Stage 02 — Identity, sessions, Organizations, Projects, and access

## Outcome

Build the complete durable pre-Project journey: Google and Microsoft OIDC,
opaque browser sessions, one Organization per User, Projects with one owner and
explicit User grants, entitlement/action authorization, strong sign-out,
Project provisioning, trusted placement, and bound-Cell bootstrap.

## Non-goals

- Outlook Mail/Calendar or other connector data access
- Groups or multi-Organization Users
- Project content/Resource APIs
- billing UI or enterprise directory synchronization
- hiding production gaps behind in-memory stores or allow-all gates

## Target domains

```text
internal/control/
  identity/{oidc,providers}/
  security/stepup/       # federated reauthentication contract in this stage
  sessions/
  users/
  organizations/
  projects/{pins,sharelinks,copy,organizationshare}/
  access/
  entitlements/
  authority/
  placement/
  provisioning/          # lifecycle/state only
  jobs/                  # Control worker and authority-fence fanout
  audit/
  semanticfacts/         # bounded retained user-visible projection inputs
internal/operator/provisioning/
internal/host/bootstrap/
internal/host/routing/
internal/host/projectstores/
internal/transport/http/{bootstrap,middleware}/
internal/wiring/{testing,development,production}/
cmd/{taurus-control-worker,taurus-operator}/
api/openapi/bootstrap-v1.yaml
migrations/control/*
```

## Domain contracts

### Identity

- exact opaque `(issuer, subject)` link;
- verified email/display attributes separate from identity key;
- encrypted, one-use login attempt with state, nonce, PKCE S256, provider,
  return target, and expiry;
- provider adapters using mature OIDC/OAuth verification;
- exact issuer/audience/nonce/authorized-party/tenant rules per provider; and
- account linking only through explicit verified ceremony, never email match.

### Session

- opaque selector/secret credential;
- keyed secret verification with rotatable managed key versions;
- idle and absolute expiry;
- rotation lineage and predecessor replay family revocation;
- CSRF/origin/host/cookie policy;
- provider-backed, browser/session/operation-class-bound one-use
  reauthentication through the stable step-up contract;
- current-family sign-out and sign-out everywhere; and
- authority epoch integration that obeys Stage 01 effective fencing.

### Organization and User

- one Organization ID on every active User;
- Organization owner/admin/user administration under explicit actions;
- first-login invitation binding/atomic consumption before an idempotent
  personal-Organization fallback;
- invitation expiry/revoke/replay/concurrent-callback and assigned-User refusal,
  plus activate/disable/remove lifecycle without orphaning sole ownership; and
- current Organization membership required before Project grants remain live.

### Project

- one owner User, one home Organization, and an editable `Name`/`Description`
  profile guarded by its own `ProfileVersion`;
- explicit User grants and operation-specific roles/actions;
- cross-Organization grants allowed;
- Organization-share freezes an immutable bounded User-set snapshot and applies
  only direct User grants with exact durable status and paged per-User outcomes;
- bounded stable search/filter/group/sort and private per-User Project pins;
- signed-in, expiring, revocable share links whose acceptance materializes only
  an explicit bounded direct User grant;
- non-owner leave and durable duplicate-to-new-Project workflows;
- managers cannot modify/replace existing owner;
- only owner can begin final Project deletion;
- provisioning lifecycle gates discoverability/opening; and
- trusted placement never comes from request input.

### Entitlement and access

Authorization requires active session/User/Organization, active Project,
current User grant/ownership, registered action, entitlement, policy revision,
and operation-specific conditions. Unknown actions/capabilities and repository
errors deny. Permit issuance uses the exact resulting authority generations.

## Stage 02 operation slice

The [Control capability's canonical operation table](../capabilities/control-and-administration.md#canonical-versioned-control-operations)
is authoritative; OpenAPI maps these names to transport routes without
inventing method-based aliases. Stage 02 implements these public slices:

- identity entry and link lifecycle: `identity.providers.list.v1`,
  `identity.login.begin.v1`, `identity.login.complete.v1`,
  `identity.links.list.v1`, `identity.links.begin.v1`,
  `identity.links.complete.v1`, and `identity.links.remove.v1`;
- current-session security: `sessions.current.get.v1`,
  `sessions.current.rotate.v1`, `sessions.current.sign_out.v1`,
  `sessions.user.list.v1`, `sessions.family.revoke.v1`, and
  `sessions.user.sign_out_everywhere.v1`, plus
  `security.step_up.begin.v1` and `security.step_up.complete.v1` with a fresh
  federated/OIDC reauthentication method in this stage;
- current User and Organization administration: `users.current.get.v1`,
  `users.current.profile.update.v1`, `organizations.current.get.v1`,
  `organizations.current.profile.update.v1`, `organizations.users.list.v1`,
  `organizations.invites.list.v1`, `organizations.invites.create.v1`,
  `organizations.invites.revoke.v1`, `organizations.invites.accept.v1`,
  `organizations.users.role.update.v1`,
  `organizations.users.disable.v1`, `organizations.users.enable.v1`,
  `organizations.users.remove.v1`, `organizations.policy.get.v1`, and
  `organizations.policy.update.v1`;
- Project entry/profile/lifecycle: `projects.list.v1`, `projects.create.v1`,
  `projects.pins.set.v1`, `projects.pins.remove.v1`,
  `projects.pins.reorder.v1`,
  `projects.profile.get.v1`, `projects.profile.update.v1`,
  `projects.status.get.v1`, `projects.select.v1`, `projects.archive.v1`,
  `projects.restore.v1`, `projects.leave.v1`,
  `projects.duplicate.request.v1`, `projects.delete.v1`,
  and `projects.provisioning.retry.v1`; self-service ownership transfer remains
  unavailable until Q002 defines and accepts its verified ceremony;
- direct sharing: `projects.grants.list.v1`, `projects.grants.create.v1`,
  `projects.grants.update.v1`, `projects.grants.revoke.v1`, and
  `projects.grants.organization_snapshot.create.v1`,
  `projects.grants.organization_snapshot.status.get.v1`, and
  `projects.grants.organization_snapshot.outcomes.list.v1`, plus
  `projects.share_links.create.v1`, `projects.share_links.list.v1`,
  `projects.share_links.revoke.v1`, and
  `projects.share_links.accept.v1`; and
- current authorization state: `access.explain.v1`, `entitlements.get.v1`,
  `entitlements.update.v1`, `organizations.policy.get.v1`, and
  `organizations.policy.update.v1`.

Stage 02 also wires these typed internal contracts; they are not public routes:

- `control.mutation_permits.issue.v1`,
  `control.mutation_permits.status.get.v1`, and
  `control.mutation_permits.settle.v1`;
- `control.revocations.begin.v1`, `control.revocations.status.get.v1`, and
  `control.revocations.settle.v1`;
- `control.project_placements.product.resolve.v1`,
  `control.project_placements.fence_target.resolve.v1`,
  `control.project_placements.receipt_proof_target.resolve.v1`,
  `control.project_placements.permit_settlement_target.resolve.v1`, and
  `control.project_placements.finalizer_target.resolve.v1`; and
- `control.project_lifecycle.result.record.v1`.

Sole-owner final deletion, User disable/remove, selected-session revocation,
and everywhere sign-out enforce the canonical step-up and effective-fencing
rules. Organization owner/admin and Project owner/manager authority is
operation-specific; no generic update or delete route decides those
consequences from an HTTP verb alone.

### Organization-share snapshot flow

`projects.grants.organization_snapshot.create.v1` is an idempotent durable
Control request, not an alias for an Organization grant. Under current
owner/manager authority it preselects `SnapshotID` and `JobID` and atomically
freezes the bounded eligible User IDs, Organization/User-set digest, requested
role/actions, exact Project/requester/policy generations, snapshot/job,
idempotency and required Control Audit. The response returns the stable
Snapshot ID; exact replay returns the same identity and divergent reuse fails.

The Control worker processes deterministic User-ID pages only while the stored
requester and every frozen security dependency remain current. Each page
atomically applies or leaves unchanged explicit direct grants and appends exact
per-User outcomes plus aggregate counts. Crash recovery rereads outcome rows
before retry; authority loss marks remaining rows skipped/failed and produces
an honest `partial` or `failed` snapshot rather than completing with stale
authority. The read-only status query returns Job/state/counts/generations and
safe failure; the separately cursor-bounded outcomes query returns exact
per-User results. Neither query resumes work or changes a grant.

## Provisioning flow

```text
create Control Project + sole owner in Provisioning
  -> Control job requests a bounded privileged provisioning step
  -> separate operator runner allocates Project Database
  -> apply checked Project Schema Contract
  -> install identity/authority fences
  -> create least-privilege Product credential
  -> create separate fence-only credential
  -> create separate receipt-proof-only credential
  -> create separate permit-settlement-only credential
  -> create closed-kind finalizer credentials
  -> verify TLS, identity, generation, schema and every positive/negative grant
  -> atomically mark trusted placement Active
  -> Project becomes selectable
```

The trusted placement stores distinct typed targets; it never stores or returns
one general Project credential:

- `ProductProjectPlacement` / `ProductCredentialRef` serves ordinary bound
  Product queries and permitted Project transactions, but cannot execute fence,
  receipt-proof, Control permit-settlement, finalizer, Project-Audit
  administration, or DDL routines. Its owning Project UoW may still atomically
  record consumption of the exact permit it uses for that Product effect;
- `AuthorityFenceTarget` / `FenceCredentialRef` can execute only the exact
  schema-owned fence-plus-Audit transition;
- `ProjectReceiptProofTarget` / `ReceiptProofCredentialRef` can verify only an
  exact registered Project Job, standing-work subscription, Task, Agent or
  Routine receipt and its digest/generation for a trusted Control
  acknowledgement or reconciliation; it cannot treat the receipt as authority
  or mutate it;
- `ProjectPermitSettlementTarget` / `PermitSettlementCredentialRef` can read
  only schema-owned exact permit-consumption/fence proof needed by
  `control.mutation_permits.settle.v1`; it cannot consume a permit, perform the
  Product effect, or update Control directly; and
- `ProjectFinalizerTarget` is a sealed versioned union. Each target carries
  exactly one matching per-kind reference—`DurableJobFinalizerCredentialRef`,
  `TaskFinalizerCredentialRef`,
  `IntelligenceAccountingFinalizerCredentialRef`,
  `AgentDisableFinalizerCredentialRef`,
  `RoutineLifecycleFinalizerCredentialRef`, or
  `ProjectAuditExportFinalizerCredentialRef`—for kinds `durable_job@1`,
  `task@1`, `intelligence_reservation_call@1`, `agent_disable@1`,
  `routine_lifecycle@1`, or `project_audit_export@1`. Unknown kinds,
  kind/reference mismatch, and any transition outside that kind's exact
  terminal allowlist fail closed.

The operator creates these database principals, but never returns their raw
credentials to Control or Product code. It returns bounded typed provisioning
results from which the appropriate wiring graph resolves only its target.
Live grant tests must prove every allowed routine and every forbidden sibling
routine/table/action for all principals before placement activation.

Every state is idempotent/restartable. Failed or partial state never yields a
Cell. Relocation/deletion remain explicit state machines and cannot expose two
writable canonical placements.

The Product Host never receives the operator credential. The Control worker
may drive lifecycle and authority-fence jobs but cannot DDL or read Project
Resource content. The operator runner has no Product listener or Cell graph and
returns only the bounded result required to advance Control state.

## Proof matrix

- real protocol flow against deterministic OIDC discovery/JWKS/token server;
- live Google/Microsoft callback evidence when operator credentials exist,
  without committing credentials;
- state/nonce/PKCE one-use, issuer/subject exactness, audience/`azp`/tenant,
  key rotation, outage, and replay cases;
- cookie, CSRF, Host, Origin, redirect, and DNS-rebinding defenses;
- session restart/rotation/idle/absolute/replay/sign-out/all-sign-out behavior;
- OIDC reauthentication step-up is browser/session/operation-class bound,
  short-lived and one-use; Stage 14 can add WebAuthn/TOTP/recovery methods
  without changing the operation contract;
- one-Organization invariant, invitation-before-fallback, invitation one-use/
  expiry/revocation, assigned-User refusal, and concurrent callback/bootstrap;
- sole owner, manager restrictions, cross-org User grants, Organization-share
  frozen snapshot/status/outcomes, membership/grant/authority changes between
  pages, partial crash/retry, stable search/filter/group/sort, private pin races,
  signed-in link accept/revoke/expiry/count races, owner leave refusal, source-
  preserving Project duplication, removal/disable effects, and concurrent
  mutations;
- two-User/two-Organization/two-Project discovery and authorization isolation;
- provisioning crash/retry at every state and non-Active denial;
- Project credential/placement substitution and stale generation;
- typed Product/fence/receipt-proof/permit-settlement/finalizer target
  substitution, unknown finalizer kind/reference mismatch, and live positive/
  negative database grants for each separate principal;
- revocation prevents every older permit from committing before effective;
- production composition uses only durable repositories and managed secrets;
  and
- required Audit and each declared user-visible Control `SemanticFact` are
  atomic with their owning security/administration effect.

## Completion boundary

Completion produces a real authenticated, durable Project selection that can
construct a trusted empty Cell. It does not imply Resource content exists.
Stage 03 introduces Resource identity, workspace, and Product entry operations.
