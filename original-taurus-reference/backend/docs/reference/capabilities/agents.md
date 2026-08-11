# Quarterback and Agents capability

## Purpose, ownership, and boundary

Quarterback is the User's contextual coordination surface. Agents make
delegated work attributable, bounded, reviewable, and reversible. The Agents
capability owns Project-local Agent configuration and execution state; it does
not create a privileged automation path.

Control owns each Agent authority principal, principal status, authority and
tool-grant generations, User and Project grants, entitlements, durable Task
sponsorships, standing Routine delegations, and one-use permit issuance. Those
records are the only authority for Agent work.

Agents owns the Project-local Agent configuration that refers to a Control
principal, Persona versions, canonical Instruction/DeclaredTrigger versions,
tool declarations, Tasks, immutable
PlanRevisions, task/plan node state, attempts, checkpoints, approval and
verification records, non-authoritative sponsorship/delegation receipts,
Routines, trigger deliveries, recommendations accepted into work, and
Agent-specific budget configuration. Resource capabilities own their commands
and effects.
Intelligence owns model calls. Activity/Memory own their records. The web
shell owns Quarterback presentation. The Agents capability never imports a
sibling store or writes canonical Resource state directly.

## Feature contract

| Feature | Required behavior | Initial boundary | Retained breadth |
| --- | --- | --- | --- |
| Ask | Read-only answer/retrieval/calculation over visible scope; no user-visible Product content/workflow write; bounded Intelligence metering only | Contextual grounded answer | Rich comparisons and saved response by separate command |
| Action | Execute only authorized bounded reversible work; verify and produce reviewable/revertible ChangeGroup | Deferred | Single and multi-Resource actions |
| Plan | Create immutable PlanRevision, show scope/consequence, require approval before effects | Deferred | Hierarchical manager/worker execution |
| Intent variants | Generate, Edit Selection, Delegate, Review appear as UX intent under Ask/Action/Plan, not new authority classes | Ask variants | Full contextual palette |
| Agent authority and configuration | Control owns stable authority identity/status/grants/generations; Agents owns Project-local display/persona/tool/budget configuration | Contract ready | User-created and assigned Agents |
| Persona | Versioned focus/behavioral guidance/context refs/verification/output preferences, snapshotted into Task | Contract ready | Shared catalogs and policy controls |
| Instruction | Reusable versioned objective/work contract with input, scope, declared tool-intent and verification shape; exact version is snapshotted into a Task or Routine | Contract ready | Project instruction library and explicit revision history |
| Declared Trigger | Versioned deterministic delivery matcher/input schema; it detects a candidate delivery but grants no authority and starts no work alone | Deferred | Scheduled/webhook/registered committed-fact triggers |
| Task | Objective, scope, mode, Persona snapshot, non-authoritative sponsorship receipt, plan, state, budgets, provenance | No Task for Ask; durable Action/Plan | Full durable execution |
| Tools | Versioned schemas backed by normal Product operations through ToolBroker | Read-only tools | Authorized mutation tools |
| Checkpoints | Pause on approval, ambiguity, conflict, budget, high risk, or constructive refusal | Contract ready | Multi-reviewer gates |
| Verification | Each effect has declared postcondition checks and evidence | Ask citation verification | Domain-specific verification suites |
| Review/revert | Diff, independently accept/reject rows where supported, and invoke domain inverse/compensation commands | Deferred | Review inbox and cross-Resource groups |
| Routine | Versioned automation binding among one exact InstructionVersion, DeclaredTriggerVersion, Agent/tool generations, sponsor and bounded standing authority | Deferred | Scheduled/external automation under policy |
| Project Agent | Zero or one ordinary assigned Agent; assignment never widens grants | Deferred | Guide and recommendation behavior |

## Authority modes

The three modes are security semantics, not styling:

- **Ask** may call authorized bounded queries and bounded Intelligence. A
  query that exceeds its interactive contract returns its family's
  `*_async_required` precondition; Ask cannot invoke the named durable request
  command or auto-upgrade that query into work. Ask creates no
  Resource, Task, Activity, Memory, Semantic Fact, durable job, ChangeGroup, or
  tool effect. A provider-backed Ask may admit only one bounded Intelligence
  reservation, call record, optional continuation envelope, and exact
  `FinalizationRecord` under one exact session-sourced effect permit with
  atomic required Audit. The separately typed metering finalizer may later
  record the provider receipt and terminalize only that exact reservation and
  call generation, including after session loss; it cannot call the provider
  again or touch Product state. Those records are
  operational accounting, not user-visible Product content or workflow. The
  transient answer may be displayed in Quarterback/Chat; saving it is a
  separate explicit command owned by the destination.
- **Action** may perform only operations declared action-safe for the current
  authority, reversibility, risk, and budget. It obtains normal one-use permits
  at each owning command's commit and records a `ChangeGroup`.
- **Plan** creates no target effects until an immutable `PlanRevision` is
  approved. Any material plan change creates a new revision and invalidates
  the prior approval.

External side effects, destructive/irreversible work, permission or secret
changes, security actions, and material spend always require explicit current
preapproval. A Persona or Project-Agent assignment cannot bypass this rule.

## Domain model and state machines

```text
ProjectAgentConfiguration {
  agent_id, control_principal_ref, display_name, local_state,
  declared_tools, default_persona_id?, budget_policy_id, revision
}

PersonaVersion {
  persona_id, version, focus, behavioral_guidance, context_refs,
  default_verification, output_preferences, digest
}

Instruction {
  instruction_id, display_name, lifecycle, current_version_id?, revision
}

InstructionVersion {
  instruction_id, version, objective_template, input_schema,
  allowed_modes, scope_template, declared_tool_intents,
  verification_contract, consequence_template, created_by, digest
}

DeclaredTrigger {
  trigger_id, display_name, lifecycle, current_version_id?, revision
}

DeclaredTriggerVersion {
  trigger_id, version, kind, deterministic_match_definition,
  delivery_input_schema, dedupe_key_schema, safe_preview_schema,
  created_by, digest
}

Task {
  task_id, mode, objective, scope, sponsor_user_id, actor, delegator?,
  persona_snapshot, instruction_version_snapshot?,
  sponsorship_receipt, plan_revision_id?, state, budgets, created_at,
  terminal_summary?
}

DurableSponsorship {
  sponsorship_id, sponsor_user_id, project_id,
  task_id, sponsorship_generation,
  agent_generation, tool_grant_generation, policy_generations,
  initial_task_digest, pending_receipt_digest,
  allowed_operations, allowed_targets, allowed_scope,
  budget_ceiling, expires_at, state
  // Control-owned authority record; never serialized into Project state.
}

TaskSponsorshipReceipt {
  sponsorship_id, sponsorship_generation, task_id,
  authority_digest, issued_at
  // Project-local evidence/reference; never grants authority by itself.
}

PlanRevision {
  plan_id, revision, nodes[], edges[], declared_tools[], consequences,
  verification_plan, digest, approval_state
}

TaskNode {
  node_id, operation, input_template, dependencies, risk,
  expected_outputs, verification, state
}

Attempt {
  attempt_id, task_id, node_id, generation, route_receipts,
  tool_calls[], checkpoint?, state, failure?
}

NodeRetryDirective {
  retry_id, task_id, plan_revision_id, node_id, expected_node_generation,
  predecessor_attempt_ids, reason, requested_by, idempotency_key,
  created_at
}

ToolCall {
  tool_call_id, operation_version, canonical_input_digest,
  idempotency_lineage, expected_scope, state, result_ref?
}

Routine {
  routine_id, version, instruction_version_id, declared_trigger_version_id,
  task_input_binding,
  standing_delegation_receipt, authority_policy, state
}

StandingDelegation {
  delegation_id, sponsor_user_id, project_id, routine_id, routine_version,
  agent_generation, tool_grant_generation, allowed_trigger,
  allowed_operations, allowed_targets, allowed_scope,
  per_run_budget, cumulative_budget,
  max_runs, not_before, expires_at, generation, state
  // Control-owned PendingProjectReceipt -> Active authority ceiling used only
  // to issue fresh Task sponsorships after an exact Routine receipt exists.
}
```

Task states are `draft`, `awaiting_approval`, `ready`, `running`, `paused`,
`cancel_requested`, `awaiting_review`, `succeeded`, `partially_completed`,
`failed`, `canceled`, or `superseded`. Node/attempt transitions require
expected generation. An Agent
cannot mark work successful until declared verification has passed or the
result explicitly says verification was unavailable/failed.

Instruction and DeclaredTrigger each have stable identity plus immutable
versions. Their aggregate lifecycle is `draft`, `published`, `deprecated`, or
`retired`; only an exact `published` version may be selected for a new Task or
Routine. Revising appends a draft candidate and publishing makes that exact
version selectable; it never edits the predecessor. Deprecation prevents new
selection while existing Task snapshots and enabled Routine versions retain
their exact historical meaning. Retirement is retention-governed and cannot
erase referenced versions.

The four concepts are intentionally different: Persona controls behavior and
presentation; Instruction defines reusable work; DeclaredTrigger recognizes a
delivery; Routine binds exact versions to sponsored bounded automation. None is
an authority principal, permit, Task sponsorship or approval.

Routine states are `published`, `enable_pending`, `enabled`,
`disable_requested`, `disabled`, or `superseded`. Only `enabled` can admit a
trigger. Enable and disable each precommit an exact schema-owned Routine
finalization record bound to the expected Routine/delegation generations. The
typed Routine finalizer may move only `enable_pending -> enabled` after trusted
proof that the exact Control delegation is active, or
`disable_requested -> disabled` after trusted proof that it is revoked and
fenced. It cannot change Routine configuration, admit a trigger, create a Task,
invoke a provider/tool, or enqueue work.

Invariants:

- Tasks snapshot Persona content; later Persona edits do not rewrite history;
- Tasks snapshot an exact InstructionVersion when one is selected; later
  Instruction publication/deprecation cannot rewrite the Task;
- a Routine references exact published Instruction and DeclaredTrigger
  versions; neither a trigger match nor either definition can create a Task or
  issue authority by itself;
- plans and approvals bind exact revision/digest/scope/consequences;
- every tool call uses a registered Product operation and current authority;
- a Task sponsorship is exact to one trusted `TaskID`; its Project receipt is
  evidence, not authority;
- every ordinary protected Project-effect permit names exactly one live
  `SessionAuthority`, `DurableWorkAuthority`, or
  `TaskSponsorshipAuthority`; Agent Task effects use only the last arm after
  exact Task/receipt acknowledgement;
- every execution uses Cell key `(SponsorUserID, ProjectID)`; Agent is a
  secondary actor/delegate and never an Agent-only Cell authority;
- delegation can narrow but never widen authority, scope, deadline, depth,
  work, cost, or data classification;
- cycles and unbounded recursive delegation fail before work begins;
- no Agent has direct repository, SQL, object-store, secret, or provider access;
  and
- constructive refusal is a valid attributable result, not a hidden fallback.

## Commands and queries

| Operation | Kind | Behavior |
| --- | --- | --- |
| `quarterback.ask.v1` | Command (Product-read-only orchestration) | Answers within explicit visible scope using authorized queries and bounded Reasoning; only its explicitly bounded Intelligence accounting envelope may write |
| `agents.create.v1` | Command | Creates a Project Agent through the pending Control-principal/Project-receipt/acknowledgement saga below |
| `agents.update.v1` | Command | Conditionally updates ordinary configuration, never authority |
| `agents.get.v1` | Query | Returns one authorized safe Project Agent configuration plus current Control-status projection |
| `agents.list.v1` | Query | Lists authorized Project Agents and safe configuration/status projections |
| `agents.disable.v1` | Command | Moves the expected local Agent to disable-requested, invokes Control principal/grant/sponsorship/delegation deny-first revocation, and reports disabled only after fencing plus exact terminal finalization |
| `agents.assign_project_agent.v1` | Command | Sets zero/one Project Agent without widening grants |
| `personas.publish.v1` | Command | Publishes immutable PersonaVersion |
| `personas.get.v1` | Query | Returns one authorized immutable PersonaVersion and safe current-version metadata |
| `personas.list.v1` | Query | Lists authorized Persona projections and versions under explicit bounds |
| `instructions.create.v1` | Idempotent command | Create a stable draft Instruction and first bounded draft version; creates no Task or authority |
| `instructions.revise.v1` | Idempotent command | Append a draft candidate from an exact predecessor without changing published history |
| `instructions.publish.v1` | Command | Publish one exact immutable InstructionVersion under expected aggregate revision |
| `instructions.deprecate.v1` | Command | Prevent new Task/Routine selection of the expected version while preserving historical snapshots |
| `instructions.retire.v1` | Command | Retire the expected aggregate after dependency/retention checks without erasing referenced immutable versions |
| `instructions.get.v1` | Query | Return one authorized Instruction and requested/current immutable version |
| `instructions.list.v1` | Query | List authorized Instruction projections by lifecycle/tool intent under explicit bounds |
| `instructions.history.list.v1` | Query | Page immutable Instruction versions and lifecycle decisions without sensitive bodies in list projections |
| `declared_triggers.create.v1` | Idempotent command | Create a stable draft deterministic trigger definition; grants no delivery or execution authority |
| `declared_triggers.revise.v1` | Idempotent command | Append a draft trigger version from an exact predecessor |
| `declared_triggers.publish.v1` | Command | Publish one exact immutable matcher/input/dedupe schema version |
| `declared_triggers.deprecate.v1` | Command | Prevent new Routine binding to the expected trigger version without rewriting existing Routine history |
| `declared_triggers.retire.v1` | Command | Retire the expected aggregate after proving no active/new binding depends on it; retained versions remain queryable under policy |
| `declared_triggers.get.v1` | Query | Return one authorized trigger and requested/current immutable version |
| `declared_triggers.list.v1` | Query | List authorized safe trigger projections by kind/lifecycle under explicit bounds |
| `declared_triggers.history.list.v1` | Query | Page immutable trigger versions and lifecycle decisions |
| `tasks.create.v1` | Command | Creates explicit Action/Plan Task with exact sponsorship, scope, Persona and optional InstructionVersion snapshots, and budget; Ask is rejected |
| `tasks.approve_plan.v1` | Command | Approves exact plan revision/consequence digest |
| `tasks.pause.v1` | Command | Requests an expected-state checkpoint and fences new attempts without corrupting committed effects |
| `tasks.resume.v1` | Durable command | Resumes an expected checkpoint with explicit decision/input |
| `tasks.cancel.v1` | Command | Cancels pending work and fences stale attempts |
| `tasks.retry_node.v1` | Idempotent durable command | Append an exact retry directive and schedule a new Attempt only for an admitted retryable node under current plan, sponsorship, approval, scope and budgets |
| `tasks.review_changes.v1` | Command | Records review rows; owning capabilities perform accepted effects/reverts |
| `tasks.get.v1` | Query | Returns bounded Task/plan/attempt/checkpoint projection |
| `tasks.list.v1` | Query | Lists authorized Tasks by state/Agent/Resource/time |
| `tasks.plan_history.list.v1` | Query | Page immutable PlanRevisions, consequence digests and approval/supersession status for one authorized Task |
| `tasks.step_attempts.list.v1` | Query | Page immutable Attempts for one Task/node with safe outcome, retry and canonical result references |
| `agents.tool_catalog.query.v1` | Query | Return only safe registered operation descriptors currently visible for the actor/Agent/Task scope, mode, policy and grant generations |
| `routines.publish.v1` | Command | Publish an immutable Routine version referencing exact published Instruction and DeclaredTrigger versions |
| `routines.enable.v1` | Command | Enables only after Control issues the exact bounded standing delegation; unknown triggers and receipt-only authority fail closed |
| `routines.disable.v1` | Command | Moves the expected Routine to `disable_requested`, precommits its exact disable finalization record, invokes Control revocation/fencing, and reports `disabled` only after typed terminalization |
| `routines.get.v1` | Query | Returns one authorized Routine version, trigger/configuration, receipt and safe delegation-status projection |
| `routines.list.v1` | Query | Lists authorized Routines by state, Agent, or trigger under explicit bounds |

Post-create Agent tool-grant widening or replacement is intentionally
unavailable in v1. `agents.update.v1` changes ordinary Project-local display,
Persona and budget configuration only. Until a separate expected-generation,
deny-first cross-domain authority-edit command is specified and accepted, a
different grant set requires disabling and recreating the Agent; Project-local
state can never call the internal Control grant operations directly.

Publishing an Instruction or DeclaredTrigger is an ordinary session-authorized
Project mutation with a fresh permit, expected aggregate revision, idempotency,
required Audit and fact. Publication grants no Task sponsorship, standing
delegation, approval or tool. `routines.publish.v1` accepts only exact published
versions and copies their digests into the immutable Routine version. Enabling
that Routine still follows the separate pending-receipt/acknowledgement
standing-delegation protocol.

`tasks.retry_node.v1` is not a generic “run again” escape hatch. It accepts one
exact Task, approved PlanRevision, NodeID/generation, declared retry reason and
idempotency key. The handler rechecks the active Task sponsorship and receipt,
current plan/approval, node retryability, tool descriptor/version, scope,
placement, remaining budgets and the prior Attempts. It appends a
`NodeRetryDirective`, advances the node generation and enqueues at most one new
Attempt. An uncertain protected effect reuses its original operation
idempotency lineage; a deliberate new effect requires an explicit plan revision
or admitted node contract. Retry never edits or hides an Attempt.

Plan-history, step-attempt and tool-catalog reads reauthorize every request.
The catalog is a policy-shaped projection over the immutable Product operation
registry, not a discovery path to hidden operations: it omits unauthorized
descriptors and returns safe schema/risk/version/constraint metadata only.

## ToolBroker and consumed ports

Agents owns a narrow execution contract, not capability-specific clients:

```go
type ToolBroker interface {
    Describe(context.Context, OperationRef) (ToolDescriptor, error)
    QueryCatalog(context.Context, ToolCatalogQuery) (ToolCatalogPage, error)
    Invoke(context.Context, ToolInvocation) (ToolResult, error)
}

type ReasoningProvider interface {
    Start(context.Context, ReasoningStart) (ReasoningTurn, error)
    Continue(context.Context, ReasoningContinue) (ReasoningTurn, error)
}
```

`ToolBroker` is implemented by a handler adapter over the immutable operation
registry and bounded nested dispatch. It preserves the Cell key, actor,
delegation chain, deadline, idempotency lineage, trace, and descended budgets.
The broker rechecks the tool descriptor and current authority on every call.

`ReasoningProvider` adapts to Intelligence. Intelligence returns declared tool
calls; Agent orchestration validates them against Plan/Task/tool schemas and
then asks ToolBroker to execute. No model output is itself a command.

Recommendation intake is a read-only proposed `QuarterbackDraft`; accepting it
creates an ordinary explicit Ask/Action/Plan request. Activity/Memory adapters
can supply bounded context but never authority or evidence.

## Durable Agent authority protocol

The permit authority source is a tagged union supplied by trusted handler
context, never by capability input:

```go
type PermitAuthoritySource struct {
    Session        *SessionAuthoritySource        // family ID + generation
    DurableWork    *DurableWorkAuthoritySource    // work ID + generation + Job ID
    TaskSponsorship *TaskSponsorshipAuthoritySource // sponsorship + generation + Task ID
}
```

Exactly one arm must be present. Control validates the named source and every
indexed dependency are active/current and that operation, target, scope, actor,
Project, budget and expiry fit the ceiling. The Project transaction also
requires the exact Task and matching `TaskSponsorshipReceipt` for the Task arm.
A receipt, Task, Persona, Project Agent assignment, cache, lease, or durable job
cannot mint authority. Session-started Task creation uses an ordinary exact
session-sourced permit. A no-session Routine trigger may instead receive the
separately typed one-use `ReceiptBootstrapCredential` described below; it is
not an effect permit and cannot authorize any later effect.

Agent creation is also an explicit two-domain saga:

1. under a live session, the handler preselects stable Project `AgentID`,
   Control `PrincipalID`, exact initial tool-grant IDs/set digest, Project
   configuration digest and idempotency identity;
2. one Control transaction creates the principal/grants as
   `PendingProjectReceipt` with required Control Audit but no ordinary Agent-
   created fact;
3. one session-permitted Project transaction creates the Agent configuration,
   non-authoritative principal/grant receipt, idempotency, required Project
   Audit and the single Agent-created semantic fact; and
4. trusted verification of that exact Project commit activates the Control
   principal/grant generation.

Pending authority cannot issue sponsorships or permits. An absent Project
record leaves a harmless expiring/revoked orphan; a lost acknowledgement is
reconciled from the exact receipt and digest. Project receipt existence alone
never activates Control authority. `agents.disable.v1` uses the inverse deny-
first saga described in persistence: Project records disable-requested,
Control revokes/fences the principal and descendants, and an exact finalizer
settles only that Project Agent configuration to disabled.

Task creation crosses authority domains without a distributed transaction:

1. the authenticated handler—or
   `control.agent_standing_delegations.trigger.admit.v1` for one admitted
   no-session Routine delivery—chooses stable Task ID, initial Task digest and
   idempotency;
2. Control atomically creates an exact
   `TaskSponsorship{PendingProjectReceipt}` and required Control Audit. A
   session-started request obtains an ordinary exact session-sourced permit for
   `tasks.create.v1`. A standing-trigger admission instead atomically consumes
   delegation allowance and issues a separately typed one-use
   `ReceiptBootstrapCredential` bound to the absent TaskID, Project,
   sponsorship/initial digests, placement generation and expiry. This Control
   security step emits no ordinary Task-created `SemanticFact`;
3. one Project transaction consumes the session permit or receipt-bootstrap
   credential and creates the exact Task, non-authoritative receipt,
   `AuthorityReceiptProof`, `task@1` finalization record, idempotency outcome,
   required Project Audit, the single Task-created semantic fact and first
   durable job;
4. a trusted idempotent acknowledgement verifies that exact Project commit and
   moves the Control sponsorship to `Active`; and
5. later workers can request Task-sponsorship-sourced permits only when the
   active Control record and exact current Project Task/receipt agree.

A crash after step 2 leaves an expiring pending Control orphan bound to a Task
that does not exist. It cannot authorize an ordinary Project effect; exact
idempotent retry finishes step 3, while reconciliation revokes unused orphans.
A lost acknowledgement after Project commit is recovered by verifying the
exact trusted receipt. Project receipt existence alone never activates Control
authority.

Explicit cancellation first moves the Project Task to `cancel_requested` under
current session authority when available, then Control revokes the sponsorship
and completes its Project fence. User-wide disable/revocation may necessarily
skip the first step. The Task's separately typed precommitted finalizer can then
move only that exact Task generation to `canceled` and append required Audit/
terminal fact; it cannot run a tool, change a Resource, enqueue effect work, or
resurrect authority. Project unavailability may leave a visible cancel-in-
progress state, but it cannot leave authority active. Expiry is a deny-first
generation/fence transition, not an unchecked wall-clock hint.

Current-session-family sign-out ends interactive work but does not silently
cancel an explicitly accepted durable sponsorship. `Sign out everywhere`
revokes every active sponsorship and standing Routine delegation sponsored by
that User. User disable/removal, Project-grant loss, Agent/tool revocation, and
sponsor invalidation revoke every affected source and its derived authority.
Each action fences protected work before reporting complete.

Enabling a Routine first creates a bounded Control-owned
`StandingDelegation{PendingProjectReceipt}`. A session-permitted Project
transaction moves the expected Routine to `enable_pending`, stores the exact
non-authoritative receipt and precommits the exact activation finalization
record. Trusted commit acknowledgement activates the delegation; the typed
Routine finalizer then moves only that expected generation to `enabled`. Lost
acknowledgement and lost finalization are reconciled from the exact receipt and
Control status; an absent Routine leaves an unusable orphan that
expires/revokes.

Each admitted trigger atomically consumes current delegation allowance and
creates a fresh pending Task sponsorship plus exact one-use
`ReceiptBootstrapCredential`. The Task protocol above then runs without a
browser session. The
delegation binds sponsor, Project, Routine version, Agent/tool generations,
exact InstructionVersion and DeclaredTriggerVersion digests, trigger,
operation/target ceilings, per-run/cumulative budgets, maximum runs,
validity window and generation. Routine edits cannot widen it: widening
publishes a replacement and revokes the predecessor. It is an authority ceiling,
not per-run approval; external, destructive, security, irreversible or material-
spend effects still pause for explicit exact current approval unless a later
accepted contract defines bounded per-run approval.

Disable first commits `disable_requested` and its exact disable finalization
record, then begins deny-first Control revocation. No trigger is admitted in
`disable_requested`. After Control reports the exact delegation generation
revoked and all derived authority fenced, the typed Routine finalizer alone may
move that expected Routine generation to `disabled` with required Audit and its
declared terminal fact. Crash or lost acknowledgement delays display-state
convergence but never leaves trigger authority active after effective
revocation.

## Persistence and concurrency

Handlers own repositories for Agents, Personas, Instructions and immutable
InstructionVersions, DeclaredTriggers and immutable versions, Tasks, plans,
nodes, retry directives, attempts, tool calls, checkpoints, approvals,
Routines, and trigger delivery records.
Control repositories—not Agents repositories—own Agent principals/grants,
durable sponsorships, standing delegations, and their authority generations.

- Agent configuration uses expected aggregate revision.
- Agent disable is a cross-domain saga: Project records `disable_requested` and
  an exact finalization record, Control denies/fences the authority principal
  and descendants, and the typed finalizer may then mark only that expected
  Project Agent configuration `disabled`; ordinary update cannot perform it.
- Routine enable/disable use their own closed finalization target kinds and
  expected Routine/delegation generations; the finalizer can only complete the
  two state transitions defined above and cannot admit work.
- Persona, Instruction, DeclaredTrigger, Routine and Plan versions are
  immutable inserts; aggregate pointers/lifecycle use expected revision.
- Task/node/attempt transitions use expected state and generation.
- Node retry appends one directive and new Attempt under a new node generation;
  it cannot edit earlier attempts or replace uncertain effect idempotency.
- Long work runs as explicit Project durable jobs with leases and fencing; no
  permanent Agent goroutine or mailbox exists.
- Tool effects commit in the owning capability transaction, with their own
  idempotency, fresh permit, required Audit, and canonical version.
- Agent state records only references/results after committed tool effects. A
  crash between domains is reconciled through stable ToolCall identity and
  idempotent query, not a distributed transaction.
- A ChangeGroup is an attributable coordination record, not a universal atomic
  transaction. Partial progress and compensations are explicit.
- Cancel/revoke advances generations and stops new work; stale workers cannot
  complete or invoke new tools after fence loss.

Interactive Agent work is session-bound. Durable Action/Plan work survives
current-session-family sign-out only through its explicit active sponsorship.
`Sign out everywhere` revokes every active sponsorship and standing Routine
delegation sponsored by that User. User disable or removal, Project grant loss,
Agent/tool revocation, Task cancellation, expiry, or an invalid sponsor advances
affected Control authority. Each denies later checks and permits and fences
protected effects before reporting complete. A Project Agent or Routine always
names an accountable sponsor; assignment never creates ambient Project
authority.

## Security, privacy, and errors

Every step checks current durable authority. D007 applies to each target
mutation at its own commit. A cached Task grant, Project sponsorship receipt,
Persona, Agent assignment, model continuation, or Cell lifetime never grants
authority. Current-family sign-out prevents interactive work. User-wide
sign-out and every applicable revoke must prevent new sponsorship/tool permits
and invalidate permit checks before being reported effective.

Task/plan/tool/provider content is redacted from general logs and required
Audit. Audit captures safe actor/delegator/Agent/Task/operation/target/policy
identities, decision, and outcome. Secrets are never valid Task context or tool
arguments except through a dedicated write-only secret operation.

Errors distinguish invalid plan/tool schema, approval revision mismatch,
undeclared or forbidden tool, delegation cycle/depth, stale authority,
conflict, checkpoint required, budget exhausted, verification failed,
constructive refusal, cancellation, provider unavailable, and partial
completion. They map to stable kernel categories without leaking unavailable
Resources or provider payloads.

| Family error | Kernel category | Meaning/retry |
| --- | --- | --- |
| `agent_instruction_invalid` | `invalid_argument` | Instruction input/scope/tool-intent/verification schema is invalid |
| `agent_instruction_version_unavailable` | `precondition_failed` | Exact InstructionVersion is unpublished, deprecated for new selection, retired or inaccessible |
| `agent_trigger_invalid` | `invalid_argument` | Trigger matcher/input/dedupe/preview schema is invalid or nondeterministic |
| `agent_trigger_version_unavailable` | `precondition_failed` | Exact DeclaredTriggerVersion cannot be selected for a new Routine |
| `agent_routine_binding_mismatch` | `conflict` | Routine's exact Instruction/Trigger/Agent/tool digests no longer match expected publication input |
| `agent_retry_not_admitted` | `precondition_failed` | Node/outcome is not retryable or current plan/approval/sponsorship/budget does not admit a retry |
| `agent_retry_effect_uncertain` | `precondition_failed` | Protected prior effect must reconcile under its original idempotency lineage before any new effect |
| `agent_plan_revision_mismatch` | `conflict` | Requested plan/history/retry target is not the current expected immutable revision |
| `agent_attempt_page_invalid` | `invalid_argument` | Attempt cursor/filter/bounds are invalid |
| `agent_tool_not_visible` | `not_found` | Operation is absent or not visible in the caller's policy-shaped catalog; existence is hidden |

## Cross-capability contracts

- Control owns Agent authority principals/grants/generations, exact Task
  sponsorships, and standing Routine delegations; Agents owns Project-local
  Agent configuration/tool declarations, receipts, Personas, Tasks, and plans.
- Intelligence reasons but cannot execute tools or establish authority.
- Resource/Knowledge/Resolution/Formula/Data/Translation capabilities expose
  the same operations to Users and Agents; there is no Agent-only backdoor.
- Collaboration/change control owns generic ChangeGroup/review projections if
  factored separately; each target owner defines inverse/compensation behavior.
- Activity records committed semantic task/checkpoint/review facts. Memory may
  inform a Persona/context proposal but is never permission, evidence, or fact.
- Workspace presents Quarterback and Agents screens but does not own Task truth.
- Routines/Triggers create explicit durable Task intent; they are not a global
  event runtime.

## Headless proof plan

1. Ask can invoke only authorized Product queries and produces no Resource,
   Task, Activity, Memory, Semantic Fact, durable job, ChangeGroup, tool effect,
   or hidden save. Provider-backed tests prove one permitted admission commits
   the bounded reservation, call record, optional continuation envelope, and
   exact `FinalizationRecord` before provider invocation; its separately typed
   finalizer alone records the receipt and terminalizes that exact reservation
   and call generation after crash or session revocation, cannot invoke the
   provider again or touch Product state, and appends atomic Audit. Deterministic local
   Ask may be literally zero-write.
2. Action/Plan mode matrix proves high-risk categories always checkpoint before
   effect and approval binds exact plan/consequence digest.
3. ToolBroker rejects unknown versions, schema mismatch, undeclared tools,
   scope widening, cycles, depth/work/cost exhaustion, and forged IDs.
4. User and Agent invoking the same Product operation reach the same handler,
   authority, permit, persistence, Audit, and error path.
5. Persona and plan snapshots remain immutable while newer versions coexist.
6. Crash/restart/lease-loss/retry around every tool boundary does not duplicate
   effects; stale attempts cannot complete.
7. Revocation, User-wide sign-out, or User disable during Reasoning prevents all
   later tool permits and mutation commits; current-family sign-out stops only
   interactive work unless the Task's explicit sponsorship is also revoked.
8. Cancel/pause/resume/checkpoint, verification failure, constructive refusal,
   partial ChangeGroup, and compensation golden journeys.
9. Two-Project/Agent delegation and content-redaction security tests under race.
10. Deterministic fake Reasoning produces reproducible plans/tool calls;
    live-provider evidence is separately labeled and cannot substitute for
    authorization/commit proofs.
11. Every execution reconstructs the sponsoring User/Project Cell key; no
    Agent-only Cell exists, and sponsor/grant/Agent/tool/task revocation races
    fence all later protected effects.
12. Task creation and Routine activation crash points prove pending Control
    orphans cannot act, Project receipts cannot authorize by themselves, lost
    acknowledgements reconcile exactly, and retry converges without a
    distributed transaction.
13. Within the Agent surface, current-family sign-out preserves explicit Task
    sponsorships and standing Routine delegations; sign-out-everywhere/User
    disable revokes and fences every affected source. Control applies the same
    global action to non-Agent durable-work sources.
14. Routine trigger replay, exhaustion, expiry, replacement, and revocation
    prove each run has a fresh exact sponsorship and bounded cumulative work.
15. Instruction and DeclaredTrigger create/revise/publish/deprecate races prove
    immutable history, exact-version Task/Routine snapshots, rejection of
    unpublished/deprecated new selections and no authority from definitions.
16. `tasks.retry_node.v1` proves current sponsorship/receipt, exact approved
    plan/node generation, retry class, tool version, scope and remaining budget
    are all rechecked; duplicate requests create one directive/Attempt, stale
    retries are fenced, and an uncertain protected effect retains its original
    idempotency lineage.
17. Plan-history and step-attempt pagination is stable under concurrent work,
    preserves superseded revisions/failed attempts and hides inaccessible
    content; tool-catalog queries omit unauthorized/unknown operations and
    cannot be used to invoke or widen grants.

Initial completion is Quarterback Ask with explicit scope/target/consequence,
grounded read-only response, deterministic fake and one provider-neutral
Reasoning path, plus architecture-ready Task/Tool contracts. Action/Plan are not
complete until real owner commands, review, reversal, crash, and revocation
proofs pass.

## Source grounding

- [SOL X 45 — Quarterback, Agents, Personas & Task Execution](https://app.notion.com/p/39ab6410e50281b0bb98d7a1d726080f)
  is the exact construction authority for canonical Instruction and declared-
  trigger records, Task/Plan/StepAttempt history, RetryNode, QueryToolCatalog,
  Persona/Instruction/Routine distinctions, and supervised execution.
- [SOL X 76 — Quarterback Surface, Engagement & Workflow Matrix](https://app.notion.com/p/39ab6410e50281599738d108c7f43f78)
- [AI Quarterback design specification](https://app.notion.com/p/392b6410e50281399bf3d2ec623307e7)
- [Omega request dispatch](../architecture/request-dispatch.md)
- [Omega jobs, Audit, and observability](../architecture/jobs-audit-observability.md)
- [Omega decision register](../decisions/README.md)

### Nova evidence (pinned)

The audited Nova tree at
[`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova)
contains presentation/planning authorities for Agents but no complete canonical
Agent, Persona, Task, Plan, ToolBroker, approval or Routine execution path.
Durable-job, access and Intelligence packages are supporting primitives only;
the Agents capability and every mutation/review journey in this page are
target-only.
