# Collaboration, change control, notifications, references, and search

## Purpose, ownership, and boundary

This capability family lets people review changes, discuss stable parts of
Resources, navigate relationships, find authorized Project material, and learn
that committed state changed. It does not create a universal Resource model,
event log, collaboration algorithm, or authorization index.

Collaboration owns shared comment threads, private Notes, mentions,
cross-Resource reference edges, optional ephemeral presence, and the Project-
scoped notification delivery records defined below. Change control owns the
owner-routed history/diff query contract, Proposals, ChangeGroups, review
decisions, review-inbox query, and undo/revert attempt records. Search owns a
rebuildable authorization-shaped index/projection. Resource families continue
to own canonical content, change/history representation and revisions,
component identity, concurrency, domain diff meaning, and every typed inverse
or compensation operation. Documents therefore keep canonical Document
ChangeSets while another family may keep immutable versions, transition
history, or conditional revisions. Change control never creates a universal
change log or edits family state.

## Feature contract

| Area | Feature | Required behavior | Initial boundary | Retained breadth |
| --- | --- | --- | --- | --- |
| Change control | Attribution | Actor, delegator, Agent/Task/Persona, operation, expected/canonical versions, idempotency | Document edits | All families |
| Change control | History/diff | Owner-routed access to each family's canonical attributed history and family-rendered safe diffs | Document | Every declared change-bearing operation |
| Change control | Review/undo | Canonical review inbox; undo is a new owner inverse/compensation command, never history deletion | Document | All reversible families |
| Change control | Proposals | Reviewable proposed commands distinct from accepted canonical effects | Contract ready | Risk- and approval-shaped proposals |
| Change control | ChangeGroup | Coordinate related effects and row decisions; expose partial/compensated state, no fake distributed transaction | Required for Agent/import/template groups | Cross-Resource workflows |
| Comments | Threads | Project-shared, stable component anchors, replies, resolve/reopen, edit history, mentions | Document | All anchor-capable families |
| Notes | Privacy | Private per-User/per-Project annotations with separate storage/query/auth from comments | Required | Personal organization/search |
| Anchors | Stability | Owner-generated component IDs and exact version context; orphan explicitly, never fuzzy reattach | Required | Family relocation adapters |
| References | Graph | Typed exact Resource/component/version relationships and safe broken/inaccessible state | Basic links | Impact/navigation graph |
| Search | Index | Rebuildable authorized Project search over owner-supplied bounded fields | Resource/File titles + Document text | Full family/filter/facet coverage |
| Search | Authority | Query rechecks current authority and post-filters results; index presence grants nothing | Required | Policy-shaped ranking |
| Realtime | Committed hints | Small versioned invalidations/status after commit; duplicate/reorder/gap safe | Document/workspace hints | Broader subscriptions |
| Presence | Ephemeral | Optional best-effort active-view/cursor state, explicitly noncanonical | Deferred | Family-specific presence |
| Activity feed | Semantic facts | Authorized link to Activity projection, not a collaboration event store | Basic | Review inbox/inbox routing |
| Notifications | Inbox | Recipient-scoped in-product attention records referencing committed source objects | In-product first | Cross-Project Host aggregation |
| Notifications | Delivery/preferences | Dedupe, read/dismiss/snooze, subscriptions, quiet hours and governed external attempts | In-product required | Approved email/external channels |

## Domain model

```text
Anchor {
  resource_id, owner_kind, component_id, anchor_kind,
  observed_version, range_or_region?, anchor_digest
}

CommentThread {
  thread_id, anchor, state, revision, created_by, created_at
}

Comment {
  comment_id, thread_id, body, mentions[], version,
  created_by, created_at, edited_at?
}

PrivateNote {
  note_id, user_id, project_id, anchor?, body, revision, state
}

ReferenceEdge {
  edge_id, kind, source_ref, target_ref, exactness,
  created_by, state, revision
}

Proposal {
  proposal_id, actor, origin_ref, commands[], risk,
  plan_digest, state, revision, expires_at?
}

ProposalApply {
  apply_id, proposal_id, proposal_revision, plan_digest,
  change_group_id, work_authority_id, job_id, job_generation,
  state, total_rows, pending_rows, applied_rows, conflicted_rows,
  failed_rows, safe_failure?, revision, created_at, completed_at?
}

ProposedOwnerCommand {
  operation, target_ref, expected_version_or_state,
  input_digest, bounded_summary, risk, required_approval?
}

ChangeGroup {
  change_group_id, actor, origin_ref, entries[], derived_state,
  review_revision, verification_ref?, completion_summary
}

OwnerChangeRef {
  owner_kind, owner_change_id, resource_ref,
  owner_schema_version, result_version_or_state
}

ChangeSummary {
  owner_change_ref, component_refs[], actor, command_ref, group_id?,
  base_version_or_state, result_version_or_state,
  bounded_summary, created_at
}

ChangeGroupEntry {
  entry_id, owner_kind, target_ref, command_ref, owner_change_ref?,
  apply_state, review_decision?, revert_state?, failure?, revision
}

ReviewDecision {
  decision_id, change_group_id, entry_id, decision,
  reviewer, reason?, expected_review_revision, created_at
}

UndoAttempt {
  undo_attempt_id, target_change_or_group, requested_by, mode,
  preview_digest, state, entries[], conflicts[], result_owner_changes[]
}

UndoEntry {
  owner_change_ref, current_version_or_state, owner_plan_kind,
  owner_operation_digest?, irreversible_consequence?, state, result_ref?
}

UndoConflict {
  owner_change_ref, component_or_address, conflict_kind,
  target_before_after, current_safe_projection, resolution_required
}

Notification {
  notification_id, scope, recipient_user_id, source_ref,
  category, urgency, summary_template, safe_arguments,
  destination_ref, dedupe_key, state, snoozed_until?,
  revision, created_at, expires_at?
}

NotificationSubscription {
  subscription_id, scope, recipient_user_id, subject_filter,
  category_filter, state, revision
}

NotificationPreference {
  recipient_user_id, scope, category_rules, channel_rules,
  quiet_hours, timezone, revision
}

NotificationDelivery {
  delivery_id, notification_id, channel, destination_ref,
  attempt, state, next_attempt_at?, provider_receipt_ref?, revision
}

SearchDocument {
  search_id, owner_ref, owner_version, safe_fields,
  authorization_shape, projection_generation
}

CommittedHint {
  stream, sequence, target_ref, canonical_version, kind
}
```

Thread states are `open`, `resolved`, `orphaned`, or `deleted`. Proposal states
are `draft`, `validating`, `awaiting_approval`, `approved`, `rejected`,
`expired`, `applying`, `applied`, `partially_applied`, `conflicted`, or
`failed`. A ChangeGroup entry independently records apply, review, and revert/
compensation state; group state is derived and may be `needs_review`,
`partially_reviewed`, `accepted`, `revert_pending`, `partially_reverted`,
`reverted`, `conflicted`, or `failed`. An UndoAttempt is `requested`,
`previewing`, `ready`, `applying`, `succeeded`, `partial`, `conflicted`, or
`failed`. These coordination states do not override the target owner's
canonical version.

`expired` is an effective state derived from canonical `expires_at` whenever a
Proposal is otherwise nonterminal. Reads return that effective state, and
review/apply commands reject it before work admission. No timer, capability
goroutine, internal expiry command, permit, Audit row, or background mutation
is required merely for time to pass. A later authorized command may retain a
terminal tombstone only when retention policy requires one; the deadline
remains the authority for the outcome.

Entry apply state is `proposed`, `apply_pending`, `applied`, `conflicted`,
`failed`, or `canceled`; review decision is `pending`, `accept_proposal`,
`reject_proposal`, `accept_applied`, or `request_revert`; revert state is
`not_requested`, `preview_ready`,
`revert_pending`, `reverted`, `compensated`, `conflicted`, `not_revertible`, or
`failed`. `ReviewDecision` rows are immutable; changing a decision creates a
new revisioned decision under policy rather than overwriting its attribution.

Notification state is `unread`, `read`, `dismissed`, or `expired`; snooze is an
orthogonal deadline and does not erase unread state. Subscription state is
`active`, `paused`, or `deleted`. Delivery is `pending`, `deferred`, `sending`,
`delivered`, `failed_retryable`, `outcome_unknown`, `dead_lettered`,
`suppressed`, or `canceled`.
External delivery state is never evidence that the recipient opened or acted
on the canonical source.

Notification categories are the closed v1 set `needs_action`, `mention_reply`,
`agent_task`, `data_refresh`, `system_project`, and `recommendation`. Attention
levels are `ambient`, `actionable`, `time_sensitive`, and `blocking`; only
security, integrity, required approval, or irreversible-decision policy may
select `blocking`. Channels are `in_product`, `email`, or one explicitly
registered external channel version. Unknown category, urgency, template, or
channel fails closed.

Invariants:

- comment anchors use owner-issued stable component identities;
- an unresolved anchor mismatch becomes `orphaned`; textual similarity never
  silently reattaches it;
- Notes are private and cannot be returned through shared comment/activity/
  search queries;
- mentions do not grant Project/Resource access;
- a family-owned canonical change/history record, bounded `ChangeSummary`,
  Activity row, `SemanticFact`, notification, required Audit and realtime hint
  are distinct records with distinct retention and authority;
- every family with a change-bearing operation supplies a bounded diff adapter
  and explicitly reports `inverse`, `compensation`, or `not_revertible`; there
  is no universal inverse payload or blind before-state restore;
- review decisions never mutate an owner directly: an accepted proposal or
  requested revert invokes the exact owner operation under current authority,
  expected version, idempotency and a fresh permit;
- Notification creation is idempotent over recipient, source fact/version,
  category and semantic dedupe key; replay/rebuild cannot silently redeliver;
- notifications and subscriptions grant no authority, and opening one
  reauthorizes its exact destination;
- Search, realtime, Activity, and presence are projections/hints and can be
  lost without canonical content loss;
- a ChangeGroup honestly reports partial effects and compensation; and
- every accepted effect is executed by its owning capability under current
  authority and its own concurrency contract.

## Commands and queries

### Collaboration and references

| Operation | Kind | Behavior |
| --- | --- | --- |
| `comments.create_thread.v1` | Command | Validates current owner anchor and creates shared thread |
| `comments.reply.v1` | Command | Appends versioned reply with validated mentions |
| `comments.edit.v1` | Command | Conditionally creates a new comment version |
| `comments.delete.v1` | Command | Creates a governed comment tombstone revision under author/admin policy without erasing required thread history |
| `comments.resolve.v1` | Command | Resolves/reopens thread by expected revision |
| `comments.list_for_resource.v1` | Query | Returns authorized threads with anchor state |
| `notes.create.v1` | Command | Creates private User/Project note, optionally anchored |
| `notes.update.v1` | Command | Conditional private note update |
| `notes.delete.v1` | Command | Makes one private Note unavailable under expected revision and retention policy without exposing it through shared records |
| `notes.list.v1` | Query | Returns only the bound User's notes |
| `references.add.v1` | Command | Adds typed validated edge between authorized objects |
| `references.remove.v1` | Command | Conditionally removes edge |
| `references.graph.v1` | Query | Returns bounded authorized neighborhood/impact graph |
| `changes.get.v1` | Query | Routes an exact OwnerChangeRef to its owner and returns a bounded authorized ChangeSummary |
| `changes.history.list.v1` | Query | Routes to the owner and returns bounded canonical Resource history/version lineage |
| `changes.component_history.list.v1` | Query | Routes to owner-defined history for one owner-issued stable component/address when supported |
| `changes.diff.get.v1` | Query | Invokes the owner diff renderer for one exact OwnerChangeRef/current-version pair |
| `changes.trace.get.v1` | Query | Returns bounded command, group, Task and resulting-version correlation |
| `proposals.create.v1` | Command | Stores exact owner commands, expected targets, risk and immutable plan digest |
| `proposals.get.v1` | Query | Returns one authorized proposal and its effective validation/approval/expiry state |
| `proposals.review.v1` | Command | Approves or rejects an exact proposal revision/digest under current authority |
| `proposals.apply.v1` | Idempotent durable command | Freezes one approved proposal revision/digest, preselects stable Apply/ChangeGroup/Work/Job identities, and applies its ordered owner rows under exact bounded authority |
| `proposals.apply.status.get.v1` | Query | Returns one exact Apply/Job generation, stable ChangeGroup identity, progress counts, terminal state and bounded safe failure; `changegroups.get.v1` supplies the corresponding bounded per-row results |
| `changegroups.create.v1` | Command | Creates a coordination group over exact proposed or already committed owner rows |
| `changegroups.review.v1` | Command | Records independent row decisions by expected review revision |
| `changegroups.get.v1` | Query | Returns honest per-entry apply/review/revert/compensation state |
| `changegroups.review_inbox.list.v1` | Query | Returns the current User's authorized bounded needs-review projection from canonical group/proposal state |
| `undo.preview.v1` | Query | Asks each owner to preview current-version inverse/compensation, conflicts and irreversible rows without mutating |
| `undo.request.v1` | Durable command | Persists an exact preview-bound request and coordinates owner revert/compensation commands newest-first |
| `undo.get.v1` | Query | Returns per-row attempt, conflict, partial-revert and resulting OwnerChangeRefs |
| `undo.conflicts.resolve.v1` | Command | Records a new explicit resolution proposal; never overwrites changed components |

### Search, notifications, and delivery

| Operation | Kind | Behavior |
| --- | --- | --- |
| `search.query.v1` | Query | Returns bounded authorized hits, facets, snippets, and projection watermark |
| `search.suggest.v1` | Query | Returns bounded authorized title/name suggestions |
| `search.rebuild.v1` | Durable admin command | Rebuilds shadow projection and atomically promotes generation |
| `search.rebuild.status.get.v1` | Admin query | Returns exact rebuild generation, source coverage/watermarks, promotion state and safe failure without changing projection |
| `realtime.subscribe.v1` | Session command | Subscribes current authorized connection to hint streams |
| `realtime.resync.v1` | Query | Returns snapshot/version point after a detected gap |
| `presence.update.v1` | Ephemeral command | Publishes bounded expiring state; loss is acceptable |
| `notifications.create_from_fact.v1` | Durable internal command | Materializes intended recipient rows from one registered committed SemanticFact with exact dedupe |
| `notifications.list.v1` | Query | Returns a bounded reauthorized inbox, grouped/filterable by attention category |
| `notifications.get.v1` | Query | Returns one reauthorized notification and safe current destination state |
| `notifications.mark_read.v1` | Command | Idempotently marks one exact recipient row read by expected revision |
| `notifications.dismiss.v1` | Command | Idempotently dismisses one recipient row without changing its source object |
| `notifications.snooze.v1` | Command | Defers one nonblocking recipient row until a bounded deadline |
| `notification_subscriptions.create.v1` | Command | Creates an authorized bounded subject/category subscription |
| `notification_subscriptions.list.v1` | Query | Lists only the bound User's subscriptions in the requested scope |
| `notification_subscriptions.update.v1` | Command | Conditionally pauses/resumes/narrows one subscription; widening reauthorizes |
| `notification_subscriptions.delete.v1` | Command | Tombstones one subscription by expected revision |
| `notification_preferences.get.v1` | Query | Returns the bound User's scoped channel/category/quiet-hours preferences |
| `notification_preferences.update.v1` | Command | Conditionally updates validated preferences; mandatory security policy remains enforced |
| `notification_deliveries.list.v1` | Query | Returns safe delivery status for the notification recipient or authorized operator |
| `notification_deliveries.retry.v1` | Durable internal command | Retries one eligible external attempt under current policy, generation and idempotency |

## Consumed and provided ports

Resource families and registered fact-source policies supply narrow contracts:

```go
type AnchorResolver interface {
    ResolveAnchor(context.Context, Anchor) (AnchorStatus, error)
}
type SearchProjector interface {
    ProjectSearch(context.Context, ProjectionRequest) (SearchProjection, error)
}
type ChangeApplier interface {
    Apply(context.Context, ApprovedOwnerCommand) (AppliedChange, error)
}
type ChangeHistoryReader interface {
    GetChange(context.Context, OwnerChangeRef) (ChangeSummary, error)
    ListHistory(context.Context, OwnerHistoryQuery) (ChangeSummaryPage, error)
}
type ChangeDiffRenderer interface {
    RenderDiff(context.Context, ExactChangeRef, CurrentVersionRef) (SafeDiff, error)
}
type ChangeReverter interface {
    PreviewRevert(context.Context, ExactChangeRef, CurrentVersionRef) (RevertPreview, error)
    RevertOperation(context.Context, RevertRequest) (TypedOwnerCommand, error)
}
type NotificationFactPolicy interface {
    IntendedNotifications(context.Context, RegisteredSemanticFact) ([]NotificationIntent, error)
}
type NotificationSourceResolver interface {
    ResolveForRecipient(context.Context, RecipientSourceRef) (SafeDestination, error)
}
type NotificationDeliveryChannel interface {
    Deliver(context.Context, DeliveryAttempt) (SanitizedDeliveryReceipt, error)
}
```

Consumers own the narrow ports they need; handler adapters use bounded nested
dispatch to owner operations. Search does not import Resource implementations
or inspect their tables. `ChangeHistoryReader` routes through an explicit
family adapter; it does not copy family history into collaboration storage.
`ChangeApplier` never bypasses ordinary authority, fresh permits, idempotency,
Audit, or family concurrency. `ChangeReverter`
returns a typed owner command or an explicit `not_revertible`; it cannot return
an untyped patch, execute SQL, or promise a generic inverse. Compensating a
provider/external effect is a different owner command from reverting canonical
Resource content and may itself require approval.

For the initial Document integration, a valid inverse is a new typed
`documents.submit_changes.v1` command against the current canonical head. No
generic `undo.apply` operation exists. Every other owner must nominate and test
one of its own registered operations for inverse/compensation before declaring
a row reversible; otherwise its adapter returns `not_revertible` truthfully.

Notification materialization accepts only registered, retained, redacted
`SemanticFact` inputs. It never reads Audit as a feed, reconstructs meaning
from logs, or treats a fact as Product authority. Account/security
notifications remain Control-owned; Project notifications live in their exact
Project Database. A Host notification-center query may aggregate bounded
results from currently authorized placements, but no shared cross-Project
notification table is introduced.

`NotificationSourceResolver` returns only a recipient-safe current projection
after authority recheck. `NotificationDeliveryChannel` is implemented by an
explicit external integration adapter and receives no Project database handle,
owner mutation port, session cookie, permit or raw source body. Provider
receipts are sanitized before persistence.

Committed hint delivery consumes explicit transaction-local delivery facts or
durable jobs. It is not a global event runtime. A per-subscription sequence is
allowed only to detect delivery gaps; it is not canonical product ordering.

## Persistence and concurrency

- Threads and Notes use expected aggregate revisions. Comment bodies are
  immutable versions; edit updates the current pointer.
- Comment deletes and private Note deletes are expected-revision governed
  tombstone transitions. They retain only policy-required history and never
  convert private Note content into a shared or projected record.
- Mentions are derived from validated comment version content and current
  visibility; notification delivery is idempotent and non-authoritative.
- Reference edges use immutable stable identity plus expected state/revision.
- Proposals/ChangeGroups use expected-state transitions. Target effects remain
  separate owner transactions with stable idempotency links; recovery queries
  the target owner before retry.
- Proposal expiry is derived from the stored deadline on every get/review/apply;
  it schedules no no-session work and cannot race an approval or application
  into eligibility after the deadline.
- Each family persists its canonical change/history representation in the same
  owner transaction as the effect, idempotency, required Audit and declared
  SemanticFact. A bounded `ChangeSummary` is read from that record through the
  owner adapter; it is not a second canonical copy. Large encrypted historical
  material may use an owner-governed Files/object snapshot ref; history
  retention and undo eligibility are separate deadlines.
- Review inbox rows are a query/projection of canonical pending Proposal and
  ChangeGroup state. Rebuilding the inbox cannot create decisions or effects.
- A review decision is valid only for its row state: proposal decisions govern
  later apply eligibility, `accept_applied` closes review without an owner
  mutation, and `request_revert` starts an explicit preview/undo flow. Rejecting
  an already applied row cannot pretend the owner effect disappeared.
- Undo preview is side-effect free and bound to target/current versions plus a
  digest. Execution rechecks every row; newest-first ordering is a group policy,
  not permission to overwrite a newer owner version. Partial success is
  canonical and reported per entry.
- Notification rows and preference/subscription aggregates use expected
  revisions. The materializer has a uniqueness fence on recipient, scope,
  source fact/schema/version and dedupe key. Delivery attempts use durable jobs,
  stable attempt identity, leases, backoff and a dead-letter state.
- An external channel must support provider idempotency or a typed status
  reconciliation contract. A timeout after send becomes `outcome_unknown` and
  is never blindly resent; retry requires a proven absent result or an explicit
  governed duplicate-risk decision.
- Quiet hours defer noncritical external delivery; they do not hide canonical
  in-product state. One evolving job/Task/batch source updates or replaces its
  grouped row rather than producing one row per progress step.
- Proposal apply and multi-row undo use exact bounded durable work. The request
  transaction fixes ordered rows, owner operations/targets, idempotency lineage,
  preview/plan digest, budgets and failure policy; each later owner effect still
  checks current WorkAuthority, obtains its own fresh permit and records its own
  canonical result. Restart reconciles each row by owner idempotency before
  retry. Revocation stops new rows and cannot erase already committed effects.
  Proposal apply additionally commits stable `ApplyID`, `ChangeGroupID`,
  `WorkAuthorityID`, `JobID` and Job generation. Exact request replay returns
  those same identities after a lost response; the status Query is zero-write
  and `changegroups.get.v1` returns the exact bounded row outcomes.
- Search documents are rebuildable versioned projections. Shadow rebuild and
  promotion prevent mixed generations. `search.rebuild.v1` freezes the source
  coverage/cutoff and target generation; `search.rebuild.status.get.v1` is the
  separate read-only status/result surface. It reports truthful coverage,
  watermarks, gaps and safe failure and never promotes a generation.
- Every history, review-inbox, notification and search page cursor is opaque,
  bounded, expiry-limited and bound to exact Project/User/query/filter and
  source generation or stable ordering key. A cursor grants no authority;
  mismatch or unsupported generation fails explicitly.
- Realtime committed hints are produced only after state commit through a
  transaction-local fact/job. Missed/duplicate/reordered hints cause canonical
  read/resnapshot.
- Presence is bounded, expiring, and disposable; no durable correctness depends
  on it.

No global application lock, universal event sequence, or hidden per-capability
worker is introduced. Durable projection/delivery work uses explicit Host-
supervised jobs with leases and fencing.

## Security, privacy, and errors

Every query rechecks current durable authority on the collaboration/search
record and its target. Search and references post-filter current access; stale
index/grant data cannot disclose titles, snippets, member names, anchors, or
existence. A mention to an unauthorized User is rejected or delivered as no
content according to policy; it never grants access.

History, diff, Proposal, ChangeGroup, review-inbox and undo reads likewise
enforce current authority plus history-retention policy. Previous access at
change time grants no later read. A safe diff may omit or redact historical
content that the current viewer may no longer inspect, while preserving a
truthful `content_redacted`/`target_unavailable` state.

Private Notes have distinct operation names, repository contracts, storage
classification, projection rules, and tests. They are excluded from shared
search, Activity, Template, Project Archive, Agent context, and export unless a
separate User-private export explicitly includes them.

Comment/note bodies, diffs, inverse payloads, notification safe arguments and
search snippets are excluded from required Audit and general logs. Generic
notification summaries contain no raw Resource text, prompts, searches,
provider payloads, secret values, private navigation, unauthorized filenames,
or delivery capabilities. External messages contain the minimum safe template
and an expiring route back to Taurus; authentication and current authorization
are still required at open time.

Stable errors cover invalid/orphaned anchor, expected revision conflict,
inaccessible target, unsupported owner/anchor/index/change schema, proposal
stale/expired, plan digest mismatch, approval required, component changed,
history below retained floor, safe diff redacted, inverse unavailable, undo
preview stale, undo conflict, partial apply/partial
revert, compensation failure, notification expired, snooze forbidden,
subscription scope invalid, mandatory preference, delivery suppressed,
delivery outcome unknown, cursor invalid/stale, projection stale, and
gap/resync required without cross-Project disclosure.

## Cross-capability contracts

- Resource owners define stable components, canonical changes/history, diffs,
  conflicts, inverses/compensations, and search projections.
- Agents may create Proposals/ChangeGroups through normal operations; accepted
  effects still run owner commands.
- Workspace uses committed hints to refresh views and may show presence, but
  neither is canonical.
- Activity is the semantic human feed; collaboration delivery facts are not
  automatically Activity items.
- SemanticFacts may drive Activity and Notification projectors independently.
  Activity replay never resends a notification, notification delivery never
  becomes Activity, and neither is required Audit or canonical owner history.
- Workspace presents Needs action, mentions/replies, Agent/task work, data/
  refresh, system/Project and recommendations without collapsing their owners.
  Recommendations remain non-mutating; Accept only drafts an explicit
  Quarterback operation.
- Knowledge/Resolution citation/reference types can appear as typed edges, but
  Search/References cannot become Evidence.
- Translation/Templates strip private Notes, comments/review state, presence,
  and delivery state unless a specific contract explicitly preserves shared
  comments.

## Headless and browser proof plan

1. Stable anchor survival through non-destructive family edits and explicit
   orphaning through deletion/replacement; no fuzzy reattachment.
2. Shared comment edit/delete/tombstone and private Note update/delete isolation
   across two Users and two Projects, including search/export/Activity/Agent-
   context negative tests.
3. Mentions notify only currently authorized recipients and grant nothing.
4. Direct User and Agent changes atomically append their family-owned canonical
   history with exact actor/delegator, command, expected/result versions or
   states and, where applicable, group lineage; no universal history is added.
5. Proposal digest/version approval, review-inbox authorization, independent
   ChangeGroup row decisions, derived deadline expiry with no background write,
   stable Apply/Job/ChangeGroup status after lost response, apply conflict,
   partial progress, crash/retry and compensation journeys use owner idempotency
   exactly once.
6. Family undo preview reports safe exact diffs, current-version conflict and
   `not_revertible`; execution creates new attributable owner changes, group
   partial-revert state, and never erases history or blindly restores bytes.
7. Search projection delete/rebuild/shadow-promote equivalence, exact rebuild
   status generation/coverage/watermark/failure, stale-index post-filtering,
   unauthorized snippet/title non-disclosure, and hostile query bounds.
8. Realtime duplicate/reorder/delay/drop/gap/reconnect causes authorized
   resnapshot and never loses committed content.
9. Presence loss/expiry has no correctness effect and no durable retention.
10. A duplicated/replayed fact creates no duplicate inbox row or external
    attempt; grouped progress updates one row; quiet hours defer only eligible
    channels; reconnect/resync loses no actionable canonical rows.
11. Revoked access suppresses cached summary/destination content and prevents
    open/action. Dismiss/snooze/read and preferences affect only the recipient,
    grant no authority, and cannot disable mandatory security delivery.
12. External delivery retry/dead-letter, expired route, provider outage and
    crash-after-send converge without rolling back or duplicating owner state.
13. Revocation stops new mutations and prevents stale permits/queries even when
   caches/index/hints still contain old references.
14. Race, cancellation, backup/restore, bounded-cardinality observability, and
    content-redaction tests.

Stage 12 owns the canonical change-control coordination and notification
contracts in this page. Initial completion covers Document history/diff/undo
through the Document owner, Proposal/ChangeGroup review, comments, the private
Notes boundary, a search projection seam, in-product notifications/preferences,
committed update hints, and resnapshot on gap. External delivery is promoted
only channel-by-channel after policy, privacy, provider, retry and live evidence.
Rich coediting and presence require a separate family-specific protocol and
live multi-client evidence.

## Source grounding

- [SOL X 47 — Change Sets, Proposals, Review & Undo](https://app.notion.com/p/39ab6410e5028135a246d3d806110f9f)
- [SOL X 48 — Collaboration, Comments, Notes, Search & Activity Views](https://app.notion.com/p/39ab6410e50281ee91b3ef6cf6cdda53)
- [SOL X 67 — Notifications, Activity & Recommendation Delivery](https://app.notion.com/p/39ab6410e50281b98095c2f7e99f4466)
- [Omega persistence and concurrency](../architecture/persistence-and-concurrency.md)
- [Omega jobs, Audit, and observability](../architecture/jobs-audit-observability.md)
- [Omega request dispatch](../architecture/request-dispatch.md)

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
Nova has typed primitives in
[`internal/change`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/change),
[`internal/activity`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/activity),
and [`internal/realtime`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/realtime)
for attributed facts, versioned hints, generation fencing and resync. Nova does
not prove complete Comments, private Notes, References, Proposals/ChangeGroups,
authorized Search or multi-client collaboration journeys; those are
target-only.
