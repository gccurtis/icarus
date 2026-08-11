# Stage 12 — Quarterback, Agents, context, review, and notifications

## Outcome

Build bounded agentic work over existing public Product operations: Quarterback
Ask/Action/Plan, Agents/Personas/Tasks, durable plan execution, proposals and
review, Activity/Working Context/Memory, recommendations, comments/Notes,
search/references, and safe committed-change notifications.

## Non-goals

- a privileged Agent storage or authorization path
- Persona as identity/authority
- unbounded recursive agents or hidden spend
- Memory as fact, Evidence, or permission
- automatic high-risk/irreversible/external actions
- realtime as canonical state or guaranteed authority delivery

## Target tree and files

```text
internal/
  capabilities/{agents,activity,context,episodes,memory,recommendations,search}/
  capabilities/agents/{instructions,triggers,routines,tasks,tools}/
  capabilities/collaboration/{changecontrol,comments,notifications,references}/
  cell/handlers/{agents,activity,context,episodes,memory,recommendations,search}/
  cell/handlers/agents/{instructions,triggers,routines,tasks,tools}/
  cell/handlers/collaboration/{changecontrol,comments,notifications,references}/
  cell/handlers/activity/projector/      typed local/Control fact projection
  cell/handlers/recommendations/projector/ exact-Project trigger projection
  control/semanticfacts/projectreader/  exact-Project paged safe-fact reader
  control/agents/                       principal/grants/generations, sponsorships, standing delegations
  control/agents/mysql/                 Control-owned Agent authority repositories
  control/jobs/agent_authority/         orphan cleanup, expiry and revocation fanout
  host/jobs/agents/                     sponsored durable reconstruction
  host/jobs/activity/                   bounded projection polling/rebuild
  host/jobs/recommendations/            deterministic evaluation/rebuild
  host/jobs/memory/consultations/       exact consumer follow-up settlement
  host/jobs/collaboration/changecontrol/ proposal apply and revert coordination
  host/jobs/collaboration/notifications/ fact materialization and external delivery
  wiring/{testing,development,production}/{agents,context}.go
migrations/project/*_{agents,activity,context,episodes,memory,recommendations,changecontrol,collaboration,notifications,search}.sql
migrations/control/*_{agent_authority,project_fact_projection}.sql
api/openapi/product-v1.yaml
test/{integration,security,recovery,acceptance}/{agents,context}/
```

## Versioned contracts and schemas

Register the exact operation tables in [Quarterback and Agents](../capabilities/agents.md#commands-and-queries),
[Activity/Context/Memory](../capabilities/activity-context-memory.md#commands-and-queries)
and [Collaboration/Search](../capabilities/collaboration-and-search.md#commands-and-queries).
Also register the Agent-principal/tool-grant/sponsorship/standing-delegation,
permit/revocation and fact-reader operations from the
[canonical Control table](../capabilities/control-and-administration.md#canonical-versioned-control-operations);
no Project receipt or public transport may substitute for them.
Control schemas version Agent authority principals/status/grants/generations,
exact durable Task sponsorships, bounded standing Routine delegations, and
their revocation state. Project schemas separately version Project-local Agent
configuration/tool declarations, Persona/Task/plan/attempt/checkpoint,
Instruction/InstructionVersion, DeclaredTrigger/DeclaredTriggerVersion,
node-retry directives,
non-authoritative sponsorship/delegation receipts, Activity facts/projections,
source-specific Activity checkpoints/coverage/rebuild generations, Working
Context/Episodes/Memory/recommendations, Memory consultation follow-up/outbox
rows with exact consumer Job/authority mappings, Memory export requests and
Files-owned output receipts, Proposals/ChangeGroups/review/undo attempts and rebuildable
bounded change summaries, comments/private Notes/anchors, notification subscriptions/
preferences/rows/deliveries, search rows and hint cursors.
Control semantic-fact schemas include registered safe fields, exact Project
audience, immutable per-Project projection ordinal/continuity digest and
retention floor. None is a generic event log.

The exact Control authority slice wired in this stage is:

- `control.agent_principals.list.v1`,
  `control.agent_principals.create.v1`,
  `control.agent_principals.activate.v1`,
  `control.agent_principals.get.v1`,
  `control.agent_principals.update.v1`, and
  `control.agent_principals.disable.v1`;
- `control.agent_tool_grants.list.v1`,
  `control.agent_tool_grants.create.v1`,
  `control.agent_tool_grants.update.v1`, and
  `control.agent_tool_grants.revoke.v1`;
- `control.agent_sponsorships.issue.v1`,
  `control.agent_sponsorships.activate.v1`,
  `control.agent_sponsorships.status.get.v1`, and
  `control.agent_sponsorships.revoke.v1`; and
- `control.agent_standing_delegations.issue.v1`,
  `control.agent_standing_delegations.activate.v1`,
  `control.agent_standing_delegations.status.get.v1`,
  `control.agent_standing_delegations.trigger.admit.v1`, and
  `control.agent_standing_delegations.revoke.v1`.

These are trusted internal orchestration contracts, never public Agent routes.
Project configuration/Task/Routine receipts cannot call or replace them.

## Quarterback contract

- **Ask:** transient and read-only against user-visible Product content/workflow
  state. It cannot create Resource, Task, Chat, Activity, Memory, Semantic Fact,
  durable job, ChangeGroup or tool effects. Provider-backed Ask may write only
  one bounded Intelligence reservation, call record, optional continuation
  envelope, and exact `FinalizationRecord` under one exact session-sourced
  effect permit with atomic required Audit. Its separately typed finalizer may
  later record the receipt and terminalize only that exact reservation and call
  generation, even after session loss; it cannot call the provider again or
  touch Product state. Saving an answer requires a later explicit owner command.
- **Action:** one clearly scoped authorized reversible effect after showing
  target, consequence, verification, and destination; creates reviewable
  attribution/change group.
- **Plan:** immutable plan revision for inspection/approval before execution.

Generate/Edit Selection/Delegate/Review are visible intents under these modes,
not alternative security classes. High-risk external, irreversible,
destructive, permission, secret, security, or material-spend effects always
require explicit preapproval and often step-up.

## Agent model

- Control-owned Agent authority principal, explicit grants and authority/tool
  generations, status and lifecycle;
- Project-local Agent configuration, display/persona preferences, tool
  declarations and budget configuration referencing that Control principal;
- Persona/version: focus, behavioral guidance, context references, verification
  and output preferences; snapshotted at Task start;
- Instruction/version: reusable explicit objective, typed input/scope, declared
  tool intents, consequences and verification contract; exact published
  version is snapshotted into Task/Routine;
- DeclaredTrigger/version: deterministic matcher, delivery input/dedupe and safe
  preview schemas; detects a candidate but grants no authority;
- Task and immutable plan revisions/decomposition tree;
- Step/Attempt/Execution states, inputs/outputs, checkpoints, approvals,
  verification, budgets, deadlines, cancellation;
- proposed owner commands, committed OwnerChangeRefs/ChangeGroups and
  compensation links;
- Routine/version: exact InstructionVersion + DeclaredTriggerVersion + Agent/
  tool/sponsor/budget binding; and non-authoritative authority receipts with
  version/schedule/state.

Persona, Instruction, DeclaredTrigger and Routine are four different records.
Persona shapes behavior/presentation; Instruction defines reusable work;
DeclaredTrigger recognizes delivery; Routine binds exact versions to bounded
automation. None is Control authority, a Task sponsorship, approval or permit.
Instruction and DeclaredTrigger lifecycle is `draft`, `published`, `deprecated`,
or `retired`; immutable versions survive deprecation/retirement references.

The stage registers `instructions.create.v1`, `instructions.revise.v1`,
`instructions.publish.v1`, `instructions.deprecate.v1`,
`instructions.retire.v1`, `instructions.get.v1`, `instructions.list.v1`,
`instructions.history.list.v1`, `declared_triggers.create.v1`,
`declared_triggers.revise.v1`, `declared_triggers.publish.v1`,
`declared_triggers.deprecate.v1`, `declared_triggers.retire.v1`,
`declared_triggers.get.v1`, `declared_triggers.list.v1`,
`declared_triggers.history.list.v1`,
`tasks.retry_node.v1`, `tasks.plan_history.list.v1`,
`tasks.step_attempts.list.v1`, and `agents.tool_catalog.query.v1` exactly as
defined in the capability operation table.

Agents call the same registered operations through a Tool Broker that enforces
schema, current authority, scope, idempotency, budgets, and receipts. No Agent
or tool gets repositories, SQL, operator credentials, or a hidden write API.

`agents.create.v1` preselects stable Project Agent and Control principal/grant
IDs plus exact config/grant-set digests. Control first creates an inactive
`PendingProjectReceipt` principal/grant generation with Audit; a session-
permitted Project transaction creates the Agent configuration, non-authoritative
receipt, Project Audit and single Agent-created fact; trusted acknowledgement
alone activates Control authority. Pending orphans cannot sponsor work and are
expired/revoked; lost acknowledgement reconciles from the exact receipt.

`agents.update.v1` cannot change authority. Post-create tool-grant replacement
is unavailable in v1 until an explicit expected-generation, deny-first two-
domain protocol is accepted. `agents.disable.v1` records Project disable-
requested, revokes/fences the Control principal and descendants, then uses an
exact finalizer to settle only that Agent configuration to disabled.

Creating/revising/publishing/deprecating/retiring an Instruction or
DeclaredTrigger is a normal session-permitted Project mutation and grants no
execution authority. Routine
publication accepts only exact published versions and copies their digests;
Routine enable remains the separate pending Control delegation -> Project
receipt -> trusted acknowledgement protocol. Deprecation prevents new Task/
Routine selection but cannot mutate existing Task snapshots or enabled Routine
versions.

## Sponsorship and Cell authority

Every Agent execution reconstructs the immutable `CellKey` as
`(SponsorUserID, ProjectID)`; the Agent is a secondary actor and never replaces
the sponsoring User. Interactive work is bound to the live User session.
Control—not the Agents capability—owns the authoritative Agent principal,
status, grants, generations, exact durable Task sponsorships, and standing
Routine delegations. Agents owns the Project-local configuration, Persona/tool
declarations, Task and non-authoritative authority receipts.

Every protected permit has a trusted tagged authority source with exactly one
arm:

```text
SessionAuthority      { SessionFamilyID, Generation }
DurableWorkAuthority  { WorkAuthorityID, Generation, JobID }
TaskSponsorshipAuthority { SponsorshipID, Generation, TaskID }
```

Interactive work uses the session arm; non-Agent durable jobs use the work arm;
Action/Plan effects use the Task-sponsorship arm. Control validates the source
and every indexed dependency, sponsor, Project, actor/grant generations,
operation/target/scope, budgets and minimum deadline before issuance. The
Project handler additionally loads the exact active Task and matching
`TaskSponsorshipReceipt` for Agent effects. Inputs, Job/Task rows, leases and
receipts cannot choose or mint a source. Session-started Task creation uses an
ordinary exact session-sourced permit. A no-session Routine trigger may receive
one separately typed exact `ReceiptBootstrapCredential`; it is not an effect
permit and cannot authorize later effects.

Task creation is an idempotent two-domain saga:

1. under a live session—or through
   `control.agent_standing_delegations.trigger.admit.v1` for one admitted
   no-session Routine delivery—choose stable Task ID, initial Task digest and
   idempotency;
2. one Control transaction creates an exact
   `TaskSponsorship{PendingProjectReceipt}` and required Control Audit. The
   live-session path obtains an ordinary session-sourced permit; the trigger
   path atomically consumes delegation allowance and issues one exact
   `ReceiptBootstrapCredential`; this security plumbing emits no ordinary Task
   semantic fact;
3. one Project transaction consumes the session permit or receipt-bootstrap
   credential and creates the Task, sponsorship receipt,
   `AuthorityReceiptProof`, exact `task@1` finalization record, Project
   idempotency, required Audit, the single Task-created fact and first durable
   job;
4. trusted Project commit acknowledgement activates the sponsorship; and
5. permit sponsored execution only when active Control authority and the exact
   current Project Task/receipt agree.

There is no distributed transaction. A crash after Control commit leaves a
pending sponsorship bound to an absent Task; it cannot authorize an ordinary
effect, retry completes exact Project creation, and a Control reconciler revokes
abandoned orphans. Lost acknowledgement after Project commit is reconciled by
verifying the exact receipt; a receipt alone cannot activate authority.

Reconstruction revalidates both domains before every Attempt and protected
operation. Current-session-family sign-out stops interactive work but preserves
an explicitly accepted durable sponsorship. `Sign out everywhere` revokes
every active sponsorship and standing Routine delegation sponsored by that
User. User disable/removal, sponsor
invalidity, Project or Agent/tool revocation, Task cancellation, generation
change, or expiry revokes all affected sponsorships deny-first, prevents new
permits, and completes Project fencing before being reported effective. Expiry
is a fenced authority transition, not only a local clock comparison. A durable
job cannot select a different sponsor, Project, authority source, or Task from
payload, Persona or prior checkpoint.

## Routine authority

Enabling a Project-local Routine obtains a bounded Control-owned
`StandingDelegation{PendingProjectReceipt}`; a session-permitted Project
transaction creates the Routine and non-authoritative receipt, and only trusted
commit acknowledgement activates the delegation. It
binds sponsor, Project, Routine version, Agent/tool generations, admitted
trigger, operation/target/scope ceilings, per-run and cumulative budgets,
maximum runs, validity window, and revocation generation.

Every accepted trigger uses
`control.agent_standing_delegations.trigger.admit.v1` to idempotently dedupe the
delivery, consume the current standing-delegation allowance, and create a fresh
pending exact Task sponsorship plus create-only receipt bootstrap before
Project Task/job creation. The delegation retains each issued
sponsorship's lineage. A duplicate delivery returns the existing Task. Pending
delegation or sponsorship orphans are harmless under the same absent-record
rule. Routine updates cannot widen existing authority:
widening creates a replacement delegation and deny-first revokes the
predecessor. Expiry, exhaustion, generation change, disable, or revocation
prevents new Tasks and deny-first revokes/fences affected derived sponsorships.
The standing delegation is not per-run approval; high-risk external,
destructive, security, irreversible or material-spend effects still pause for
explicit exact current approval.

Routine state is closed:
`published -> enable_pending -> enabled -> disable_requested -> disabled`, with
`superseded` available only through explicit replacement. Enable precommits an
exact activation finalization record; disable precommits an exact disable
finalization record. Their typed finalizer can complete only the matching
expected Routine/delegation generation after trusted Control status proof and
cannot admit triggers, create Tasks, change configuration, or enqueue work.

## State machines

Tasks use the canonical Agents states: `draft`, `awaiting_approval`, `ready`,
`running`, `paused`, `cancel_requested`, `awaiting_review`, `succeeded`,
`partially_completed`, `failed`, `canceled`, and `superseded`. Attempts are
immutable; retry creates a new Attempt under the same Task/step. Plans are
versioned and cannot change under an executing approval. User input needed
during execution is a `paused` checkpoint with a typed reason, not a second
Task-state vocabulary.

`tasks.retry_node.v1` accepts only one exact current Task, approved
PlanRevision, failed/paused retryable node generation, declared reason and
idempotency key. It rechecks active sponsorship/receipt, approval, tool
descriptor/version, scope, placement and budgets; appends one immutable retry
directive; advances the node generation; and queues at most one new Attempt.
It never rewrites a StepAttempt. An uncertain protected effect must reconcile
through its original operation-idempotency lineage before another effect can be
admitted.

`tasks.plan_history.list.v1` and `tasks.step_attempts.list.v1` page immutable
history, including superseded plans and failed tries, under current read
authorization. `agents.tool_catalog.query.v1` returns a policy-shaped safe
projection of only currently visible registered operations for the exact
actor/Agent/Task/mode/scope/grant generations; omission hides existence and the
query itself grants nothing.

Failures/cancellation do not roll back arbitrary databases. Each committed
effect remains canonical and can be reverted only through its owner's inverse
or compensation command. Cross-Resource groups display partial progress and
compensation status.

## Context and Memory

- Activity is a rebuildable authorized semantic projection of committed facts.
- Working Context is bounded short-lived objective/subgoal/focus/open-loop
  state.
- Work Episodes selectively summarize intent/outcome/resources/evidence/
  feedback.
- Memory entries are evidence-linked candidates/preferences/conventions/
  procedures/heuristics with candidate/active/challenged/superseded/expired/
  deleted lifecycle.

Memory sources are authorized semantic Activity, explicit feedback, and named
evidence—not raw logs, Audit, prompt/source bodies, or provider payloads. Users
can inspect evidence/consultation, confirm/challenge/supersede/delete, mute
categories, and export/delete according to policy.

`memory.consult.v1` is the bounded, currently authorized, zero-write selection
surface. If a Task or recommendation materially uses entries, that consumer
atomically pins an exact `ConsultationID`, `FollowUpID`, query/result digest,
applied entry refs, consumer commit, source `JobID`, and tagged authority ID/
generation in a durable consumer-owned follow-up row with its canonical effect,
idempotency and required Audit. No query records its own consultation and no
Memory record becomes Evidence or authority.

The authority mapping is closed. A Task follow-up names the already active
`TaskSponsorshipAuthority` and exact Task/receipt/generation/Job; a
recommendation evaluation follow-up names its already active
`DurableWorkAuthority` and exact Job/receipt/generation. Payloads, follow-up
rows and receipts cannot select or mint the source. The consumer Job remains in
`settling_consultation` and Host reconstruction calls the idempotent internal
`memory.consultations.record.v1` directly—never through a second durable
admission. Settlement reauthorizes entries/evidence/consumer commit, obtains a
fresh permit from that tagged source, and atomically inserts the unique safe
consultation plus marks the follow-up settled with idempotency and Audit.

Recovery covers both commit boundaries: no consumer commit means no follow-up;
a committed pending follow-up is discoverable after restart; a committed
Memory row plus lost acknowledgement replays to the same consultation/follow-
up identities; lease loss fences the stale worker. Digest/ref/commit/Job/
generation mismatch fails closed. Revocation prevents settlement and produces
an explicit denied consumer status; neither `durable_job@1` nor the Task
finalizer may write Memory or claim the follow-up settled. Get/list queries
reauthorize historical refs.

Recommendation evaluation reads only a narrow current attention-policy
projection adapted from Collaboration-owned
`notification_preferences.get.v1`. It pins the preference revision, records
`suppressed_by_preference` or `deferred_quiet_hours` when applicable, and lists
only currently admitted suggestions. Preference change can suppress a row
before reconciliation because every list rechecks current policy.

Activity projects Project-local facts and declared Project-audience Control
facts through separate typed sources. The Control reader is paged and bound by
a least-privilege credential to one exact Project; Control applies the Project
filter before returning only registered safe fact fields and continuity/
retention metadata. A Project projection role can write only Activity rows,
source checkpoints, coverage and rebuild generations. It cannot read Control
Audit/identity/session data or mutate Resources, Memory, jobs, or family
history. Each page and checkpoint commit idempotently in one Project
transaction. Gaps stop the projector; retained history rebuilds into a new
generation, while data before the retention floor is reported unavailable.
Polling is an explicit bounded durable job, not an event bus.

`memory.export.v1` commits a policy-shaped exact Memory input snapshot and
durable Project job. The worker publishes exactly one immutable Files-owned
FileVersion through a consumer-owned port adapted to the verified generated-
output arm of `files.add_version.v1`; Memory stores only the resulting File/
FileVersion receipt, manifest digest and status. Object references,
delivery URLs, and bytes remain Files-owned. A publication/settlement crash
reconciles by one stable idempotency key; download is always reauthorized
through Files.

## Collaboration/search/realtime

- owner-routed canonical history and owner-rendered safe diff;
- Proposal validation/approval/application, derived ChangeGroup state, review
  inbox and independent row decisions;
- preview-bound owner-specific inverse/compensation requests with explicit
  conflict, `not_revertible` and partial-revert reporting;
- shared threaded comments with stable family anchors;
- private per-User Notes;
- mentions and stable Resource/component references;
- access-shaped Project search and Activity feeds;
- optional ephemeral presence/cursors;
- committed-change hints with dedupe/gap detection/resnapshot.

Every registered change-bearing owner operation appends its own family-specific
canonical history in the same Project UoW as canonical state, idempotency,
required Audit and any declared SemanticFact. Change control owns Proposal,
ChangeGroup, review, undo and rebuildable bounded-summary coordination records;
the Resource family owns history representation, content, versions, diff
semantics and the exact typed inverse or compensation command. Documents keep
Document ChangeSets; this stage must not add a universal change table.
`undo.preview.v1` is read-only. `undo.request.v1` binds
the accepted preview digest and current owner versions, then dispatches new
ordinary owner commands under fresh permits. It never deletes history or
restores a generic before-image. Group jobs stop on an unhandled failure and
report every applied, conflicted, compensated, failed and not-revertible row.
The Document adapter emits a new typed `documents.submit_changes.v1` command
against the current head. Other families must nominate one of their own exact
registered commands and pass the same conformance suite before advertising
reversibility; unsupported rows remain `not_revertible`.

`proposals.apply.v1` preselects and atomically commits stable `ApplyID`,
`ChangeGroupID`, `WorkAuthorityID`, `JobID`, Job generation, ordered row plan,
idempotency, receipt, Audit and declared fact. Exact retry after a lost response
returns the same identities. `proposals.apply.status.get.v1` is the zero-write
Apply/Job progress and safe-failure surface; its returned ChangeGroup ID routes
to `changegroups.get.v1` for the bounded exact per-row results. Proposal
expiration is derived from canonical `expires_at` by get/review/apply and admits
no timer, Job, no-session authority, background write or expiry operation.

The stage registers every operation in the canonical
[Collaboration/Search table](../capabilities/collaboration-and-search.md#commands-and-queries),
including `changes.*`, `proposals.*`, `changegroups.*`, and `undo.*`. The review
inbox is rebuilt from canonical Proposal/ChangeGroup states and cannot approve,
apply or revert by projection replay.

## Notification and attention delivery

Notification is a recipient-scoped delivery record referencing a committed
source object/fact; it is not the source's state. Implement the exact
`Notification`, `NotificationSubscription`, `NotificationPreference`, and
`NotificationDelivery` aggregates and every `notifications.*`,
`notification_subscriptions.*`, `notification_preferences.*`, and
`notification_deliveries.*` operation from the capability table.

In-product delivery is the first mandatory channel. A registered redacted
`SemanticFact` may idempotently materialize intended recipient rows only after
the source commit. Unique recipient/scope/source schema+version/dedupe keys
prevent duplicate rows under replay, projection rebuild and crash. One
evolving job/Task/batch updates a grouped row rather than alerting per step.
Read, dismiss and bounded snooze are expected-revision/idempotent recipient
operations; none changes the source. Subscriptions and preferences grant no
Resource authority. Every list/get/open/action rechecks current durable access
to the exact source and destination.

External email or other approved delivery is disabled until the channel has an
explicit provider adapter, verified destination, minimum-content template,
quiet-hours/mandatory-policy behavior, expiring signed route, durable leased
attempts, retry/dead-letter rules, secret redaction and live failure evidence.
A route authenticates navigation only; it is not a Product credential. Delivery
failure never rolls back owner state. An adapter must offer provider
idempotency or typed delivery-status reconciliation; an ambiguous post-send
timeout enters `outcome_unknown` and cannot be blindly resent. Activity and
notification projection may
consume the same registered SemanticFact independently, but Activity rebuild
cannot resend a notification and neither record is Audit or authority.

The Project notification materializer runs under a separate exact-Project,
least-privilege projection credential that can create/update only notification
rows, subscription-derived recipient links, delivery attempts and its own
checkpoint. It cannot read Audit, mutate source Resources, decide reviews or
grant access. Before every external attempt it rechecks source visibility,
recipient destination verification, current preference/mandatory policy and
quiet hours; revocation suppresses unsent attempts and invalidates the route,
though it cannot recall a message already delivered.

Search, Activity, recommendations, and notifications are projections or
delivery records over owner truth. Every read reauthorizes, and a gap triggers
an authorized canonical query.

## Authority, transactions, failure, and recovery

Ask receives a mechanically Product-query-only registry and returns
transiently. An over-bound query returns its family's `*_async_required`
precondition; Ask cannot see the corresponding durable request command or
auto-upgrade the query into work. It creates no Resource, Task, Activity,
Memory, Semantic Fact,
durable job, ChangeGroup or tool effect. Provider-backed execution may commit
only one bounded Intelligence reservation, call record, optional continuation
envelope, and exact `FinalizationRecord` under an exact session permit with
atomic Audit. Its separately typed finalizer alone may later record the
provider receipt and terminalize that exact reservation and call generation
after crash or revocation, without invoking the provider again or touching
Product state. Deterministic local execution may be literally zero-write. An explicit
subsequent Chat/resource command may retain its answer.
Action/Plan mutations and each tool effect consume fresh permits and commit
owner state, idempotency and required Project Audit in that owner's
transaction. Task state
records receipts and partial progress but cannot create a cross-owner atomic
transaction.

Approved Proposal application and multi-row undo are exact bounded durable
work, not ambient Agent authority. Their admission fixes row order, owner
operation/target ceilings, plan or preview digest, stable per-row idempotency,
budget and failure policy. Every owner row rechecks the active WorkAuthority
and consumes a fresh permit. Restart first reconciles the owner idempotency
result; revocation prevents every not-yet-committed row while preserving honest
partial state. Proposal status is read-only and reports the exact Apply/Job/
ChangeGroup generations and safe failure; deadline expiry is derived before
admission and therefore needs no authority-bearing background worker.

Attempts are immutable and lease/generation fenced. Crash recovery reconstructs
only currently sponsored durable work by checking both the Control sponsorship
and exact Project Task/receipt; stale completion cannot commit. Explicit
cancellation first requests Project `cancel_requested` under current session
authority when available, then revokes Control sponsorship and completes deny-
first Project fencing. User-wide revocation may skip the first step. The exact
precommitted Task finalizer can then move only that Task generation to
`canceled` with Audit/terminal fact and cannot invoke a tool, mutate a Resource,
or enqueue effect work. Partial ChangeGroups expose committed effects and
owner-specific inverse/compensation.
Activity/search/notification materialization rebuild from retained semantic
facts without redelivery; Memory, change-control and collaboration canonical
records require Project backup/restore. Missing authority, approval,
budget, Evidence, tool version or sponsor pauses/fails explicitly.
`activity.rebuild.v1`/`activity.rebuild.status.get.v1` and
`search.rebuild.v1`/`search.rebuild.status.get.v1` are explicit durable-request
and read-only-status pairs; each status names exact generation, coverage,
watermarks/gaps and safe failure and cannot promote a projection.
Facts are retained for at least the advertised Activity rebuild horizon; the
product does not promise reconstruction beyond that horizon unless the facts
remain available.

Recommendation evaluation similarly uses a separate exact-Project projection
role and retained registered trigger inputs. Its durable Job grants only
restartable projection execution; the typed credential can update only its
evaluation/recommendation/checkpoint generation and cannot become a Project
permit source. Rebuild into a shadow generation is deterministic for the
initial no-Intelligence policy and reports a coverage gap when required inputs
are outside retention.

Control and Project fact reads never join one transaction. Projection replay is
deduplicated by source domain, fact ID and schema version; the corresponding
source cursor/digest advances atomically with Activity rows. An invalid cursor,
ordinal/chain gap or retention-floor overrun records degraded coverage and
cannot silently skip history. Memory export recovery similarly cannot create a
second FileVersion or expose a staging object after a crash.
Memory consultation recovery scans only exact committed consumer follow-ups;
it cannot infer material use from logs, prompts or Task output, create
replacement authority, or admit a second Job. Consumer-commit and Memory-
settlement replay converge on the same follow-up/consultation identities.

## Production and test composition

Production registers an allowlist of versioned tools, the tagged permit-source
contract, real Control sponsorship/standing-delegation repositories, Project
Task receipts/finalization records, durable jobs/repositories,
spend/depth/cycle limits and approval policy. A synthetic sponsor, receipt-as-
authority adapter, overpowered finalizer, unbounded broker,
allow-all tool or memory repository fails closed. Product Host credentials
cannot create or widen Control authority except through the registered Control
commands. Tests use deterministic tools/providers and clocks; live database,
provider, concurrent-Cell, revocation, restart, approval and browser review
evidence is required for each promoted Agent workflow.

Production Activity composition additionally requires a
  `ControlFactProjectorCredential` bound to one exact Project and a separate
Project projection role restricted to local semantic facts, Activity rows,
checkpoints, coverage, and rebuild generations. A broad Control reader, shared
cross-Project projector credential, direct Control SQL from the Product Host,
or projector write access to canonical family tables fails composition. Tests
use typed in-memory page sources with the same Project filter, continuity,
retention-floor, and permission failures.

Production notification composition additionally requires a registered fact-
to-intent policy, exact-Project notification repository, recipient-bound reads,
durable delivery jobs and explicit per-channel adapters. An Audit reader,
generic log consumer, cross-Project notification store, unbounded payload,
unverified external destination, or allow-all channel fails composition.

Production Recommendation composition additionally requires a registered
deterministic trigger catalog and `RecommendationProjectorCredentialRef` bound
to one exact Project. Its database role can read only registered safe trigger
facts and bounded Context/Memory/preference projections and can write only
Recommendation evaluations, Recommendations, their Jobs and projection
checkpoint/generation. Cross-Project credentials, Audit/log readers, Product or
Memory writers, permit issuers, Task creators and Intelligence/provider adapters
fail composition. Tests use the same role-shaped in-memory contract and prove
duplicate trigger, restart, coverage-gap and shadow-promotion behavior.

## Recommendations and Project Agent

Zero or one ordinary Agent may be assigned as Project Agent without gaining
extra authority. Recommendations are read-only, bounded, explain why-now,
evidence, scope, and proposed mode, expire/deduplicate, respect quiet hours,
and become explicit Quarterback drafts only after acceptance. Start with sparse
deterministic triggers; inference is added only after precision evidence. A
Routine can run without a browser session only through its bounded standing
delegation and a fresh exact Task sponsorship for each accepted trigger.

`recommendations.evaluate.v1` is an internal non-authoritative projection
command, not a Product mutation or ambient Agent action. A registered trigger
fact and exact input/policy cutoff deterministically select `EvaluationID`,
`JobID` and generation. The exact-Project Recommendation projector transaction
commits the evaluation/job and checkpoint together, then writes only evaluation
and Recommendation projection rows. Duplicate trigger replay returns the same
identity; crash recovery rereads it, and a shadow rebuild promotes only after
coverage verification. `recommendations.evaluations.status.get.v1` is read-
only. Initial composition forbids Intelligence; inferred suggestions require a
later separately admitted WorkAuthority/usage/provider-call path and cannot use
the projector credential.

## Proof matrix

- Ask cannot invoke Product mutation descriptors; provider-backed proof admits
  only one bounded reservation, call record, optional continuation envelope,
  and exact `FinalizationRecord` before provider invocation, then proves its
  separately typed finalizer alone records the receipt and terminalizes that
  exact reservation and call generation after crash/session revocation and
  cannot call the provider again or touch Product state;
- Action/Plan target/consequence/approval and high-risk refusal;
- Agent/Persona/User/delegator attribution and Persona snapshot immutability;
- Instruction/DeclaredTrigger stable IDs, immutable revision history,
  publish/deprecate races, exact Task/Routine snapshots, definition-versus-
  Persona/Routine distinctions and proof that definitions grant no authority;
- Agent create pending/commit/ack/lost-ack/orphan behavior, safe get/list,
  authority-edit refusal, and disable not reporting complete before Control
  fencing plus exact Project finalization;
- Control Agent-principal/grant/generation authority cannot be replaced by a
  Project Agent configuration, Task, sponsorship receipt or Routine receipt;
- permit authority source rejects zero/multiple arms, stale session/work/
  sponsorship generations, Job/Task mismatch and caller-selected sources;
- crash/retry at every Control-sponsorship/Project-Task and Routine/delegation
  boundary; pending orphans cannot act, receipts cannot activate authority,
  lost acknowledgement reconciles and idempotent retry converges;
- tool schema/scope/authority/budget/depth/cycle/spend enforcement;
- retry-node admission rechecks exact approved plan/node generation,
  sponsorship, current tool descriptor, scope and budgets; duplicate retry
  idempotency, uncertain-effect reconciliation and immutable prior Attempts;
- stable authorized plan-history/step-attempt pagination plus tool-catalog
  omission of unknown/unauthorized operations and zero authority from queries;
- task job restart/pause/resume/cancel/retry/lease loss and exact post-fence
  Task finalization with positive-effect denial;
- within this Agent stage, current-family sign-out preserves explicit Task
  sponsorships and standing Routine delegations, while sign-out-everywhere/
  User disable deny and fence all affected Agent sources before reporting
  complete; Control applies the same global action to non-Agent work sources;
- Routine delivery dedupe, standing-delegation run/cumulative exhaustion,
  expiry, replacement, generation change, and deny-first revocation;
- atomic family-owned history append, safe family diff, proposal digest approval, current-
  authority review inbox, derived no-write expiry, exact Apply/Job/ChangeGroup
  status after lost response, independent row review, partial ChangeGroup and
  owner-specific inverse/compensation behavior;
- undo preview staleness, changed-component conflict, unavailable inverse,
  newest-first group attempt, partial revert, retry and compensation failure;
- Memory evidence/lifecycle/private/shared scopes and deletion;
- Memory consult zero-write behavior plus exact material-use follow-up/Job/
  authority mapping committed with the consumer effect, direct settlement,
  crash/restart/lease replay to one record, mismatched replay/revocation/
  finalizer denial, and current get/list reauthorization;
- Memory export exact-snapshot/redaction policy, one Files-owned output across
  publication/settlement crashes, output revocation, and no Memory object ref;
- no raw logs/Audit/provider/source bodies feed Memory;
- exact-Project Control fact filtering, source/destination least-privilege
  projector roles, page/checkpoint replay, gap detection, retention-floor
  behavior and generation rebuild with no event runtime;
- comment/Note anchors and private Note isolation;
- governed comment tombstone/private-Note deletion plus WorkEpisode create/
  review/get/list authorization and bounded evidence links;
- search/realtime authorization, duplicate/gap/resnapshot, dropped presence;
- notification fact replay/dedupe, grouped progress, read/dismiss/snooze races,
  subscription/preference isolation, quiet hours, mandatory policy, revoked
  source, expired route, external retry/dead-letter and no Activity-rebuild
  redelivery;
- recommendation expiry/dedup/quiet/mute/acceptance, exact attention-policy
  revisions and suppression/deferral behavior, plus exact-Project projector
  isolation, duplicate/crash recovery, coverage gaps, shadow rebuild and denial
  of Product/Memory/Task/Intelligence effects; and
- headless multi-capability Task with exact evidence, receipts, changes, Audit,
  review, and owner revert/compensation commands.

## Completion boundary

Agentic behavior is production-shaped only for explicitly registered tools and
proven budgets/approval paths. “General autonomous agent” is never a blanket
completion claim.

## Consequential decisions and source grounding

- **Ask is read-only at the Product surface.** Retention is a separate explicit
  owner command. Hidden Resource/Task/Chat/Activity/Memory/Semantic Fact/job/
  tool writes are forbidden; only bounded, permitted, audited Intelligence
  metering may be durable.
- **A User sponsors every Agent execution.** `CellKey` remains User/Project and
  Agent/delegation are secondary attribution. Control owns authority identity,
  grants, generations and delegations; Agents owns Project-local configuration
  and work state. Revisit only if a separately accepted non-User authority
  model replaces D002.
- **Durable authority crosses domains as a saga.** Control creates a pending
  exact Task sponsorship/bootstrap; Project stores only a matching non-
  authoritative receipt and Task; trusted acknowledgement activates. Absence
  of either side fails closed, receipts grant nothing, and orphans/lost
  acknowledgements expire or reconcile.
- **Routine authority is standing but finite.** A bounded Control delegation
  issues one fresh exact sponsorship per Task; it is never an ambient Agent
  session or infinite recurring grant.
- **Sign-out semantics are explicit.** Current-family sign-out ends interactive
  work but preserves explicit Task sponsorships and standing Routine
  delegations; sign-out-everywhere and User disable revoke and fence every
  affected Agent source before completion. Control owns the corresponding
  global rule for non-Agent work sources.
- **Collaboration owns comment/private Note records.** Families supply anchor
  semantics, while Activity/search/realtime remain projections.
- **Change control coordinates; owners keep history and define meaning.**
  Proposals, ChangeGroups, review, undo attempts and bounded summaries are
  shared, but every family retains its canonical history representation,
  renders its diff and supplies a typed inverse, compensation, or
  `not_revertible` result.
- **Notification is delivery, not truth.** Registered SemanticFacts are bounded
  materialization inputs; notification rows, Activity and Audit remain separate.
  In-product is required first and external channels are enabled only with
  explicit governance and live evidence.
- **Partial multi-owner work is visible.** Compensation replaces a fictitious
  distributed rollback.

Grounding: [Quarterback and Agents](../capabilities/agents.md),
[Activity/Context/Memory](../capabilities/activity-context-memory.md),
[Collaboration and Search](../capabilities/collaboration-and-search.md), and
[agent-task flow](../flows/agent-task.md). Taurus target behavior is grounded
directly in [SOL X 45 — Quarterback, Agents, Personas & Task Execution](https://app.notion.com/p/39ab6410e50281b0bb98d7a1d726080f),
[SOL X 47 — Change Sets, Proposals, Review & Undo](https://app.notion.com/p/39ab6410e5028135a246d3d806110f9f)
and [SOL X 67 — Notifications, Activity & Recommendation Delivery](https://app.notion.com/p/39ab6410e50281b98095c2f7e99f4466).
