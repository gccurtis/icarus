# Activity, Working Context, Memory, and recommendations

## Purpose, ownership, and boundary

These capabilities help a User understand what happened, resume current work,
and deliberately retain how work is done. They must not turn telemetry, model
output, or inferred preference into source-backed Knowledge truth.

- **Activity** owns a human-readable semantic projection, rebuildable within
  the retained-fact horizon, of committed product facts plus tightly bounded
  interaction signals.
- **Working Context** owns short-lived current objective, focus, open loops,
  and active Task references for one declared scope.
- **Work Episodes** own selective, attributable summaries of a bounded period
  of work and its outcome.
- **Memory** owns governed preference, convention, procedure, and outcome-
  heuristic entries with evidence and user controls.
- **Recommendations** own read-only, expiring suggestions derived from explicit
  triggers/context and accepted only by conversion to Quarterback drafts.

They do not own canonical Resource content, family ChangeSets, required Audit,
authorization, Knowledge evidence, provider transcripts, Agent Tasks,
telemetry, or logs. Memory is never fact, evidence, permission, policy, or a
silent instruction override.

## Record separation

| Record | Authority and purpose | Allowed input | Forbidden role |
| --- | --- | --- | --- |
| Canonical family state | Product truth | Owning command/transaction | Activity or Memory replacement |
| Family ChangeSet/revision | Reconstruct/change family state | Owning mutation | Generic universal event |
| Required Audit | Security attribution atomic with effect | Safe trusted metadata | User activity feed or prompt store |
| Durable job | Restartable intent/execution | Committed triggering intent | Activity/Memory truth |
| Activity | Human explanation rebuildable within retained-fact horizon | Authorized semantic committed facts; bounded interactions | Audit or authorization |
| Working Context | Current bounded objective/focus | Explicit User/Task changes and authorized refs | Long-term history or evidence |
| Work Episode | Selective episode summary | Context, semantic Activity, outcomes, explicit feedback | Raw transcript/log archive |
| Memory | Governed preference, convention, procedure, or outcome heuristic | Evidence-linked episodes/activity and explicit feedback | Knowledge/fact/permission |
| Telemetry/logs | Operations and diagnosis | Redacted technical signals | Product context or learning corpus |
| Realtime hint | Prompt an authorized canonical read | Committed safe reference/version | State or ordering authority |

## Feature contract

| Area | Feature | Required behavior | Initial boundary | Retained breadth |
| --- | --- | --- | --- | --- |
| Activity | Journal | Semantic Project timeline for committed Resource/File/Resolution/Agent/share/import/export facts | Document/File/Resolution | Complete capability coverage |
| Activity | Scope | Project-shared and private User-within-Project items remain explicit and separate | Required | Policy-shaped feeds |
| Activity | Projection | Rebuildable, coalesced, bounded payloads, current read authorization | Required | Search/filter/group/export |
| Activity | Interactions | Only minimal authorized short-retained signals when product value is explicit | None by default | Deliberate resume signals |
| Context | WorkingContext | Current objective, subgoal, focus refs, open loops, active Task, expiry/revision | Explicit update | Automatic bounded suggestions |
| Context | WorkEpisode | Intent, resources, evidence refs, actions, outcome, feedback, time bounds | Contract ready | Segmentation/consolidation |
| Memory | Entry types | Preference, convention, procedure, outcome heuristic | Explicitly confirmed entries | Governed candidate generation |
| Memory | Lifecycle | Candidate, active, challenged, superseded, expired, deleted | Required | Policy/retention automation |
| Memory | Controls | Inspect evidence/consultation, confirm/challenge/supersede/delete, mute category, export/delete | Required before inference | Rich review center |
| Memory | Scopes | Private User-within-Project, shared Project, and Agent Task context never collapse | Private first | Shared governed memory |
| Recommendation | Trigger | Sparse deterministic triggers first; Intelligence only when useful and bounded | Deterministic only | Precision-proven inferred triggers |
| Recommendation | Presentation | Explain why-now, evidence, scope, mode, expiry, dedupe, quiet hours | Read-only | Ranking/personalization |
| Recommendation | Acceptance | Convert to explicit Quarterback draft; recommendation never writes target state | Required | Batch review |
| Project Agent | Assignment | Zero or one ordinary Agent; assignment never widens grants | Deferred | Project Guide behaviors |

## Domain model and invariants

```text
ActivityItem {
  activity_id, semantic_kind, scope, actor_ref, target_refs,
  canonical_versions, occurred_at, summary_fields,
  source_domain, source_fact_ref, source_schema_version
}

WorkingContext {
  context_id, scope, objective, subgoal?, focus_refs[], open_loops[],
  active_task_id?, revision, expires_at
}

WorkEpisode {
  episode_id, scope, interval, intent, resource_refs[],
  activity_refs[], evidence_refs[], outcome, feedback?, state
}

MemoryEntry {
  memory_id, scope, kind, statement, state, confidence,
  evidence_refs[], consultation_policy, created_by, revision,
  expires_at?, supersedes?
}

MemoryConsultation {
  consultation_id, scope, purpose_kind, consumer_ref,
  query_digest, considered_entry_refs[], applied_entry_refs[],
  excluded_counts, policy_version, actor_ref, consumer_commit_ref,
  follow_up_id, source_job_id, source_authority_kind,
  source_authority_generation, created_at
}

MemoryConsultationFollowUp {
  follow_up_id, consultation_id, consumer_ref, consumer_commit_ref,
  query_and_result_digest, applied_entry_refs[], source_job_id,
  source_authority_kind, source_authority_id, source_authority_generation,
  state, attempt, settled_consultation_id?
}

MemoryExport {
  export_id, requester_user_id, scope, requested_revision,
  policy_version, manifest_digest, state, output_file_id?,
  output_file_version_id?, created_at, expires_at?, failure_category?
}

RecommendationEvaluation {
  evaluation_id, trigger_ref, recipient_user_id, input_cutoff,
  input_digest, trigger_policy_version, attention_policy_revision,
  job_id, job_generation, state, candidate_count, published_count,
  suppressed_count, safe_failure?, created_at, completed_at?
}

Recommendation {
  recommendation_id, trigger_ref, scope, suggested_mode,
  draft, why_now, evidence_refs[], created_at, expires_at,
  dedupe_key, attention_policy_revision, state,
  presentation_after?, suppression_reason?
}
```

`scope` is one of private User-within-Project, shared Project, or Agent Task.
Private and shared IDs/types are not interchangeable. A recommendation's
scope is presentation scope, not authority to execute.

Memory export states are exactly `queued`, `rendering`, `publishing`,
`settling`, `ready`, `failed`, and `canceled`. Expected revision and job
generation fence transitions. Retry records a new Attempt under the same frozen
snapshot and preselected output identity. No terminal state reopens, and a new
snapshot requires a new export request.

Memory-consultation follow-up states are exactly `pending`, `settling`,
`settled`, `authority_denied`, or `failed`. Its source-authority tag is exactly
`task_sponsorship` or `durable_work`; the stored tagged ID/generation and
`source_job_id` must match the consumer's trusted execution and receipt. A
terminal row never reopens, and only `settled` names a
`MemoryConsultation.consultation_id`.

Recommendation states are `available`, `deferred_quiet_hours`,
`suppressed_by_preference`, `dismissed`, `accepted`, and `expired`. Quiet-hour
deferral records the exact preference revision and `presentation_after` time;
category suppression records only a bounded reason. Neither state is a Product
effect, Notification delivery, authority, or permission.

Recommendation evaluation states are `queued`, `evaluating`, `completed`, or
`failed`. The evaluation freezes a registered deterministic trigger, exact
retained input cutoff/digest and policy revisions. A status read cannot resume
work or publish a Recommendation.

Invariants:

- every Activity item points to a committed fact and safe canonical versions;
- Activity payloads contain no Resource body, raw prompt, source text, provider
  payload, secret, arbitrary error, or Audit record;
- Activity and search projections may be dropped/rebuilt within the retained
  semantic-fact horizon without canonical content loss;
- Working Context is bounded, replaceable, inspectable, and expiring;
- Memory has explicit provenance and lifecycle; confidence cannot promote it
  to Knowledge or authority;
- Memory consultation is recorded in safe bounded form when it materially
  shaped a recommendation/Task;
- deletion/supersession prevents future consultation after the commit becomes
  effective while retaining only policy-required tombstone metadata; and
- recommendations are read-only, expiring, deduplicated, and never silently
  accepted.

## Commands and queries

### Activity

| Operation | Kind | Behavior |
| --- | --- | --- |
| `activity.list.v1` | Query | Lists currently authorized semantic items with cursor scoped only to this feed |
| `activity.get.v1` | Query | Returns one authorized item and safe canonical links |
| `activity.rebuild.v1` | Durable admin command | Rebuilds projection from canonical facts under generation/fencing |
| `activity.rebuild.status.get.v1` | Admin query | Returns exact rebuild generation, source coverage/watermarks/gaps, state and safe failure without changing projection |

Activity ingestion is an internal projector operation over committed facts, not
a public generic event endpoint. Each owner appends the bounded semantic fact
in the same transaction as the declared user-visible effect. A later durable
projection job may consume that already-committed fact; it may never create or
reconstruct the fact after the owner transaction.

### Control facts projected into one Project

Control owns the facts for Project sharing, ownership, lifecycle, and other
declared user-visible Control effects. Activity owns the resulting Project
projection. The boundary is a typed paged read contract, not table access,
cross-database transaction, webhook, event bus, or general-purpose message
stream:

```go
type ControlProjectFactReader interface {
    ReadPage(context.Context, ControlFactPageRequest) (ControlFactPage, error)
}

type ControlFactPageRequest struct {
    ProjectID       ProjectID
    After           ControlFactCursor
    PageSize        uint16
    ContractVersion uint16
}

type ControlFactPage struct {
    ProjectID            ProjectID
    RetainedFromOrdinal  uint64
    ThroughOrdinal       uint64
    PreviousChainDigest  Digest
    ChainDigest          Digest
    Facts                []ControlSemanticFact
    Next                 ControlFactCursor
}
```

The reader is constructed only with a `ControlFactProjectorCredential` bound to
one exact `ProjectID`. Control verifies the request Project against that
credential and filters in Control SQL; passing a caller-controlled Project ID,
post-filtering a broader result, or returning facts with a different Project
audience is forbidden. The role may read only registered safe semantic-fact
columns and retention/continuity metadata. It cannot read Control Audit,
identity/session/credential tables, mutate Control, or enumerate Projects.

Each Project-audience Control fact receives an immutable per-Project ordinal
and chain digest in its owning Control transaction. These values exist only to
page, detect omissions, and resume the projection; they do not order Product
commands or authorize work. The Project stores a source checkpoint containing
the exact Project, contract version, next opaque cursor, ordinal, chain digest,
retention floor, and projection generation. In one Project transaction, the
projector upserts Activity rows under unique
`(source_domain, source_fact_id, source_schema_version)` identities and advances
that checkpoint. A crash before commit repeats the page; a crash after commit
sees the idempotent rows and committed cursor.

Project-local semantic facts are read through an independently scoped Project
projection role. The Project role can read local semantic facts and write only
Activity rows, source checkpoints, coverage, and rebuild-generation state. It
cannot mutate Resources, Memory, grants, jobs, required Audit, or canonical
family history. Control and Project pages are never joined in one transaction.

A missing ordinal, mismatched chain digest, invalid cursor, or cursor older than
Control's advertised retention floor stops projection and records a visible
coverage gap. Within retained history, the projector starts a fresh generation
and replays both sources before atomic promotion. If the needed fact is already
outside retention, the feed advertises its actual coverage start and does not
claim complete reconstruction. Polling is an explicit bounded durable Project
job; a realtime hint may schedule a poll but is never the delivery or ordering
authority.

### Context and Memory

| Operation | Kind | Behavior |
| --- | --- | --- |
| `context.get_working.v1` | Query | Returns current non-expired authorized context |
| `context.replace_working.v1` | Command | Conditionally replaces bounded context by expected revision |
| `context.clear_working.v1` | Command | Clears current context and prevents later consultation |
| `episodes.create.v1` | Command | Creates a selective episode from authorized references |
| `episodes.review.v1` | Command | Records explicit feedback/correction |
| `episodes.get.v1` | Query | Returns one authorized bounded WorkEpisode with evidence links and review state |
| `episodes.list.v1` | Query | Lists authorized WorkEpisodes by time/resource/outcome under explicit bounds |
| `memory.propose.v1` | Command | Creates a candidate with exact evidence refs; no auto-activation |
| `memory.confirm.v1` | Command | Activates a reviewed candidate by expected revision |
| `memory.challenge.v1` | Command | Marks entry challenged and excludes/default-restricts consultation |
| `memory.supersede.v1` | Command | Activates a replacement and links prior entry |
| `memory.delete.v1` | Command | Makes entry unavailable for future consultation under retention policy |
| `memory.list.v1` | Query | Lists entries/evidence/consultation state for the authorized scope |
| `memory.consult.v1` | Query | Returns a bounded currently authorized policy-filtered consultation result plus deterministic query digest; writes nothing |
| `memory.consultations.record.v1` | Idempotent internal settlement command | Under one exact committed consumer follow-up and its still-active Job authority, records the safe consultation and settles that follow-up atomically |
| `memory.consultations.get.v1` | Query | Returns one authorized safe consultation record and current visibility of its entry/evidence refs |
| `memory.consultations.list.v1` | Query | Lists bounded consultation history for one authorized Memory entry or consumer ref |
| `memory.export.v1` | Durable command | Creates an exact policy-shaped Memory export job and returns its stable export identity |
| `memory.export.status.get.v1` | Query | Returns the authorized export state and, when ready, its exact Files-owned output reference |
| `memory.set_category_policy.v1` | Command | Mutes/allows proposal or consultation categories |

### Recommendations

| Operation | Kind | Behavior |
| --- | --- | --- |
| `recommendations.evaluate.v1` | Durable internal projection command | Under an exact-Project Recommendation projector credential, evaluates one registered deterministic trigger against pinned authorized state and writes only evaluation/recommendation projection rows |
| `recommendations.evaluations.status.get.v1` | Internal query | Returns one exact evaluation Job state, trigger/policy generations, counts and safe failure |
| `recommendations.list.v1` | Query | Lists non-expired authorized suggestions |
| `recommendations.dismiss.v1` | Command | Records dismissal/dedupe policy without target effect |
| `recommendations.accept.v1` | Command | Returns/creates an explicit Quarterback draft; does not execute it |

## Consumed and provided ports

Activity consumes owner-provided `SemanticFact` contracts. The contract names
kind, actor/delegation, safe targets/versions, time, scope, and bounded summary;
it cannot carry arbitrary maps or serialized domain objects.

Context/Memory may consume authorized projections through explicit ports:

```go
type ActivityReader interface {
    ReadSemantic(context.Context, ActivityQuery) (ActivitySlice, error)
}
type CanonicalReferenceReader interface {
    ResolveCurrent(context.Context, Reference) (ReferenceStatus, error)
}
type RecommendationReasoner interface {
    Propose(context.Context, RecommendationInput) (RecommendationDraft, error)
}
type MemoryExportPublisher interface {
    Publish(context.Context, MemoryExportArtifact) (FileVersionReference, error)
}
type RecommendationAttentionPolicyReader interface {
    Read(context.Context, RecommendationAttentionRequest) (RecommendationAttentionPolicy, error)
}
```

`RecommendationReasoner` is optional and adapts to a bounded Intelligence Cast.
It receives normalized allowed fields, not raw Resource/source bodies. Its
output is validated against deterministic trigger, scope, evidence, and policy
rules. Memory exposes bounded consultation results to Agents/Quarterback via
consumer-owned ports; it never returns permission or evidentiary status.

`RecommendationAttentionPolicyReader` is a narrow consumer-owned adapter over
Collaboration's current `notification_preferences.get.v1` projection for the
bound User/Project/category. It returns only category enablement, quiet-hours
window/time-zone, mandatory-policy ceiling and exact preference revision. It
cannot mutate preferences, enumerate Users, deliver a Notification or grant
authority. Evaluation pins that revision. A disabled category creates only a
deduped `suppressed_by_preference` record; quiet hours create
`deferred_quiet_hours` with the computed presentation time. List reauthorizes
and rereads current preferences, so a newly muted category never appears even
before reconciliation. Recommendations do not send an external Notification;
that requires a separate declared notification intent/policy.

`MemoryExportPublisher` is a consumer-owned handler port implemented through
the generated-output arm of registered `files.add_version.v1`. Memory owns the
export request, exact authorized
input revision/set, policy-shaped manifest, state, and output receipt. Files
owns the output File identity, immutable FileVersion, object reference,
integrity, safe delivery, lifecycle, and retention. Memory never stores export
bytes, object-store references, or delivery URLs.

## Persistence and concurrency

- Activity is a rebuildable projection keyed by stable semantic fact identity.
  Duplicate projection is idempotent; generation rebuild promotes atomically.
  Owner transactions retain facts for at least the advertised rebuild horizon;
  beyond that horizon the product cannot claim rebuildability unless the facts
  remain available.
- Working Context is a compact expected-revision aggregate with TTL/expiry.
- Episodes are immutable summaries plus expected-state review transitions.
- Memory evidence and versions are immutable; lifecycle/current pointers
  advance conditionally. Deletion creates the minimum tombstone required for
  replay/retention and removes consultable content.
- `memory.consult.v1` is a read-only bounded selection. When a later Task or
  recommendation materially applies entries, its canonical consumer
  transaction must commit an exact `ConsultationID`, `FollowUpID`, query/result
  digest, applied entry refs, consumer commit reference, source `JobID`, and
  tagged authority identity/generation in a durable consumer-owned follow-up
  row. That follow-up commits with the consumer effect, idempotency and required
  Audit; there is no crash window in which the effect exists with no durable
  record of the required Memory settlement.
- The follow-up reuses the consumer Job's already admitted authority source:
  an Agent Task uses its exact active `TaskSponsorshipAuthority` plus matching
  Task/receipt/generation, while recommendation evaluation uses its active
  `DurableWorkAuthority` plus matching Job/receipt/generation. A follow-up row,
  lease, Memory receipt or consumer payload never selects or creates an
  authority source. The consumer Job remains in a settling state and cannot
  claim fully settled success until the follow-up is settled or reports an
  explicit authority-denied terminal failure.
- A Host-reconstructed worker reads the exact pending follow-up and invokes
  `memory.consultations.record.v1` directly; that operation never admits
  another Job. It reauthorizes the Memory entries/evidence and consumer commit,
  obtains a fresh permit from the tagged active authority, and in one Project
  transaction inserts the unique safe `MemoryConsultation` and marks the exact
  follow-up settled with permit consumption, idempotency and required Audit.
  The record stores safe refs/digests, not copied entry bodies. A changed digest,
  refs, consumer commit, Job or authority generation conflicts/fails integrity.
- Crash/replay is identity-driven: before the consumer transaction there is no
  consumer effect or follow-up; after it commits, restart reconstruction finds
  the pending exact follow-up; after Memory settlement but before
  acknowledgement, replay returns the same consultation and settled row under
  their unique IDs. Lease loss fences the stale worker. If sponsorship/work
  authority is revoked before settlement, no finalizer may create the Memory
  record; the retained follow-up and consumer status expose the denied outcome
  rather than falsely claiming complete consultation history.
- Recommendations use stable trigger/dedupe identities, expiry, and expected
  state transitions plus exact attention-policy revisions. An accepted
  recommendation produces a Quarterback draft, not the target effect.
- Background evaluation is a rebuildable non-authoritative Project projection.
  A `RecommendationProjectorCredentialRef` is bound to one exact Project and
  may read only registered retained trigger facts plus the bounded authorized
  Context/Memory/preference projections, and may write only Recommendation
  evaluation rows, Recommendation rows, Jobs and its checkpoint/generation. It
  cannot read Audit, call Product mutations, obtain a permit, create a Task,
  accept/dismiss a recommendation, or write canonical owner/Memory state.
- The projection transaction deduplicates by trigger/input/policy digest and
  commits exact Evaluation/Job identity with its checkpoint. Crash recovery
  rereads that identity; rebuild replays retained registered triggers into a
  shadow generation and promotes only after coverage verification. Missing
  retained inputs produce an honest coverage gap, not a guessed suggestion.
  The initial path is deterministic. Inference-backed recommendation generation
  remains disabled until a separately admitted WorkAuthority, usage reservation
  and provider-call protocol is specified; projector authority cannot call
  Intelligence.
- A Memory export first commits its exact requester/scope, input revision or
  bounded entry set, policy version, durable job, idempotency, required Audit,
  and safe fact in the Project transaction. The worker serializes only the
  policy-admitted entries fixed by that snapshot and its authorized evidence
  references, records a deterministic manifest digest, and publishes through
  Files as one immutable
  FileVersion. Memory then stores only the exact File/FileVersion receipt.
  Files publication and Memory settlement are separate idempotent owner
  transactions: retry uses the same publication key and cannot create a second
  output. A crash after Files commit is reconciled to that same output; orphan
  staging is reaped. Download always uses `files.download.v1` and reauthorizes
  both the Memory export and FileVersion.
- Projection/recommendation/episode consolidation can run as explicit durable
  jobs with leases/fencing. No always-running capability mailbox or universal
  event runtime exists.
- Cache/realtime loss affects freshness only; canonical owner reads and
  lifecycle state remain authoritative.

Mutations use fresh one-use permits and commit canonical state, idempotency,
required Audit, the required `SemanticFact` for a user-visible effect, and any
durable job together in the Project transaction.

## Security, privacy, retention, and errors

Every read re-evaluates current authority, including each linked target. A
previously visible Resource may become a redacted/inaccessible reference rather
than leak its prior title/content. Shared Memory creation/activation requires a
separate explicit permission from private Memory.

Raw logs, telemetry, Audit, prompt/provider transcripts, Resource bodies,
Source contents, and secret-bearing data are prohibited inputs. Retention is
type/scope specific. Unknown retention/legal-hold requirements preserve
correctness/recovery history and minimize content pending decision Q003; they
must not be guessed in implementation.

Memory exports exclude entries that are deleted or non-consultable in the
committed export snapshot, provider payloads, raw Activity, Audit, Knowledge/
source bodies, secrets, and inaccessible evidence unless an explicit export
policy admits a safe representation. The export
manifest records omissions and redactions. Deleting or revoking access to the
output File cannot resurrect Memory state; the Memory export then resolves to
an inaccessible output reference rather than bypassing Files authorization.

Stable failures cover invalid scope/type/evidence, inaccessible reference,
expected revision conflict, expired context/recommendation, lifecycle
precondition, policy-muted category, unsupported version, projection stale,
and temporarily unavailable reasoner. Memory insufficiency is an empty result,
not permission to infer or fabricate an entry.

## Cross-capability contracts

- Canonical owners supply semantic facts; Activity does not inspect their
  tables or replace family ChangeSets.
- Control supplies Project-audience facts only through the exact scoped paged
  reader; Activity never opens Control tables or consumes a general event feed.
- Required Audit is never an Activity or Memory input.
- Knowledge supplies factual evidence; Memory supplies working preference only
  and cannot be cited as Knowledge evidence.
- Agents/Quarterback may consult scoped Memory/Context but retain normal
  authority, Persona, budget, and verification rules.
- Project Agent assignment lives with Agents/Control; recommendations are
  ordinary read-only drafts regardless of assignment.
- Search may index authorized Activity summaries; realtime may hint that feed
  or recommendation versions changed.
- Translation/Project Archive excludes private Working Context, Memory,
  Activity, and Audit unless an explicit policy-shaped export says otherwise.

## Headless proof plan

1. Rebuild Activity from committed semantic facts and compare byte-equivalent
   authorized projections inside the declared retention horizon; deletion of
   projection loses no canonical state, and an out-of-horizon request never
   claims unavailable history is rebuildable.
2. Negative fixtures reject Resource bodies, prompts, sources, provider
   payloads, secrets, Audit, and arbitrary error fields from `SemanticFact`.
3. Private User-within-Project, shared Project, and Agent Task scopes cannot be
   substituted across Users/Projects.
4. Working Context expected-revision, expiry, clear, restart, and stale-cache
   behavior under race; WorkEpisode create/review/get/list preserves selective
   evidence links, authorization and bounded query behavior.
5. Memory candidate/confirm/challenge/supersede/delete/consult/export lifecycle
   with evidence and policy controls; consult Query is zero-write. Material-use
   consumer commit atomically stores the exact follow-up/Job/authority mapping;
   restart/lease loss and crash before/after consumer/Memory commits replay to
   one consultation, mismatched replay conflicts, revocation cannot be bypassed,
   no finalizer writes Memory, and list/get reauthorize. Export
   crash/retry produces exactly one Files-owned immutable FileVersion and no
   Memory-owned object reference.
6. Deleted/challenged/muted Memory cannot influence later recommendations or
   Tasks after commit; stale permits cannot alter it.
7. Recommendations dedupe, expire, obey quiet hours, explain why-now/scope/
   evidence/mode, pin and recheck Collaboration-owned preference revisions,
   suppress/defer deterministically, and acceptance creates no target effect.
   Exact-Project projector credential substitution, trigger replay, crash before/
   after checkpoint commit, shadow rebuild/coverage and forbidden Product/
   Memory/Task/Intelligence writes are proved.
8. Deterministic trigger runs without Intelligence; bounded fake-Intelligence
   output cannot invent scope/evidence or bypass validation.
9. Revoked source/Resource access is reauthorized and redacted in Activity,
   episodes, Memory evidence, and recommendations.
10. Crash/retry/lease-loss/rebuild/backup/restore and observability-redaction
    evidence with caches and realtime disabled.
11. Control-to-Project projection proves exact credential-bound Project
    filtering, page replay idempotency, crash before/after checkpoint commit,
    ordinal/chain gap detection, retention-floor behavior, generation rebuild,
    and inability to read Audit/identity/other-Project facts or mutate canonical
    Project state.

The initial proof covers typed Activity for committed Document, File, and
Resolution changes with private/shared separation and no raw content. Memory
and recommendations remain incomplete until user controls, provenance,
revocation, deletion, and false-positive/precision evidence pass.

## Source grounding

- [SOL X 50 — Activity and Working Context](https://app.notion.com/p/39ab6410e50281278898e25b71488977)
- [SOL X 51 — Memory and recommendations](https://app.notion.com/p/39ab6410e50281dc8be3fb4c5aab6c67)
- [Omega jobs, changes, Audit, and observability](../architecture/jobs-audit-observability.md)
- [Omega capability model](../architecture/capability-model.md)
- [Omega open questions](../questions/README.md)

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
[`internal/activity`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/activity),
typed Change/Audit records and durable-job primitives are useful evidence for
semantic projections, attribution and rebuildable follow-up. Nova does not
prove the complete Working Context, Episodes, governed Memory, recommendation
evaluation or User review/delete/consultation journeys; those are target-only.
