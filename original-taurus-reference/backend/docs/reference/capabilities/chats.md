# Chats

## Purpose

Chats provides a durable, Project-scoped conversation Resource for Users and
Agents. It owns ordered messages, branches, revisions/redactions, attachments,
persona/steering settings, exact grounding references, inference provenance and
promotion links. It can be exercised entirely from the Product API or lab;
provider conversations and browser state are not canonical Chat truth.

### Owns

- Chat identity, optional Resource affiliation, lifecycle, representation
  version, title and conversation settings.
- Stable branches, immutable message revisions, canonical per-Chat sequence,
  authorship/delegation and reply/regeneration lineage.
- Attachment and exact grounding/source references, referenced/unreferenced
  contribution status, normalized inference evidence and spawned output links.
- Static and standing `SavedOutput` records, Chat-native Output revisions and
  the exact reference to a Resolution-owned standing mount.
- Conditional settings/message-status transitions, extraction and transcript
  rendering semantics, ordinary deletion tombstones and privileged redaction
  consequences.

### Does not own

- Provider threads/tokens/models, identity, sessions, personas, Knowledge,
  model inference, Agent tasks, attached Resource bodies, SQL, jobs, authority,
  required Audit or transient streaming buffers.
- A universal Activity log. A Chat is intentional conversation content, not a
  copy of logs, audit records or every Agent event.
- Automatic promotion of model output to trusted Knowledge or canonical edits.
- Resolution definitions, runs, Results, EvidenceSets, dependencies, refresh
  planning or provider calls. A standing SavedOutput hosts a Resolution mount;
  it does not absorb Resolution state into Chat.

## Supported feature contract

| Feature | Required behavior | Canonical boundary |
| --- | --- | --- |
| Durable conversation | Chat remains addressable across sessions/tabs and can be Project-wide or explicitly affiliated with one Resource | Chat metadata and exact affiliation |
| Ordered messages | User, Agent/system-mediated and tool/result messages have stable IDs, canonical order, role/content kind and trusted provenance | Immutable message revision plus Chat sequence |
| Threads and branches | Reply, regenerate and branch preserve parent/branch lineage; no prior output is overwritten | Branch and parent IDs |
| Editing | Policy-allowed edits create a new revision and never rewrite branch history | Immutable revision chain/current pointer |
| Governed delete | An ordinary authorized delete tombstones presentation and excludes content from future ordinary context while preserving topology, attribution, retention pins and required provenance | `DeletionRecord` plus immutable history |
| Privileged redact | A separately authorized privacy/security operation erases or makes content inaccessible under policy, revokes derived previews/caches and preserves only the required tombstone/hash/provenance | `RedactionRecord`; never an ordinary delete alias |
| Grounded replies | Exact authorized Knowledge/source/Resource versions and citations are recorded in normalized evidence | Chat evidence, not raw provider response |
| Attachments | Exact File/Resource versions with bounded display metadata | Reference only; family owner retains content |
| Persona and steering | Select exact Persona version and bounded conversation settings; later changes do not rewrite old provenance | Chat settings revision |
| Referenced status | Explicitly mark eligible authored/reviewed message revisions as Knowledge source material | Conditional contribution state |
| Streaming UX | Partial tokens may be hinted to a client, but only a completed normalized message revision is canonical | Durable final or explicit failed/canceled attempt status |
| Regeneration | New model result is a sibling/branch with its own evidence/usage; old result remains addressable under policy | Reply lineage |
| Promoted outputs | Create/link a Resource, analytic artifact, plan or Agent task through an explicit authorized operation | Link to exact target/proposal, not embedded target state |
| Static saved output | Preserve the presentation of one exact MessageRevision as an immutable Chat-native Output | `SavedOutput{mode=static}` and initial `SavedOutputRevision`; no Resolution mount |
| Standing saved output | Host a stable editable Output whose grounded material can refresh through an exact Resolution mount while preserving last-good and User edits | `SavedOutput{mode=standing}`, `ResolutionMountRef`, immutable Output revisions |
| Output history and restore | Get/list retained Output revisions and restore by appending a new User-authored revision based on an old one; never rewind or rewrite history | Conditional current pointer plus retention pins |
| Search/extraction | Exact-version transcript, authored referenced contribution and stable message anchors | Chat query/extraction |
| Starter/settings presets | A preset can prefill bounded initial settings or starter content, but is not a Template Resource, TemplateVersion, or hidden provider thread | Plain preset input copied into ordinary Chat state |
| Export | Deterministic JSON/Markdown transcript with redaction and evidence policy | Exact Chat revision/sequence |

## Canonical domain model

| Type | Required content and invariant |
| --- | --- |
| `Chat` | `ChatID`, title, lifecycle, representation version, optional exact Resource affiliation, default branch, next committed sequence, metadata/settings revisions and attribution |
| `Branch` | Stable BranchID, optional parent message, root sequence, label/state and revision; branch graph is acyclic |
| `Message` | Stable MessageID, BranchID, canonical sequence, parent MessageID, current revision ID, author kind/trusted actor/delegation, creation time and state |
| `MessageRevision` | Immutable RevisionID, prior revision, closed content kind, bounded normalized content, edit/redaction reason, provenance and digest |
| `MessageContent` | Versioned authored text/structured parts, normalized inference reply, tool/action proposal/result summary or explicit safe system notice; provider SDK payload is forbidden |
| `AttachmentRef` | Exact Project Resource/File ID, family, version and bounded safe display metadata; no object key/URL |
| `GroundingRef` | Exact source/artifact/Resource version, stable anchor, citation label, access classification and normalized relevance/evidence fields |
| `InferenceProvenance` | Provider-neutral model/policy identifier, request/context digest, evidence set, finish/error classification and bounded usage; no token/credential/raw transport |
| `ContributionState` | Message revision, `unreferenced`/`referenced`/`withdrawn`, actor, reason and state revision; only eligible reviewed content can be referenced |
| `ChatSettings` | Exact Persona/version reference, steering/context policy, allowed tools/modes and revision; settings cannot grant authority |
| `SpawnedLink` | Exact target Resource/artifact/task/proposal, originating message revision and status |
| `SavedOutput` | Stable SavedOutputID, Chat/SourceRevisionID, `static` or `standing`, native kind/schema version, lifecycle/state, optional exact ResolutionMountRef, current/last-good/latest-User-edited OutputRevision IDs, presentation-diverged flag and aggregate revision |
| `SavedOutputRevision` | Immutable OutputRevisionID, SavedOutputID, predecessor, origin (`source_snapshot`, `resolution_result`, `user_edit`, `restored`), optional exact ResultID, typed presentation, User-edited flag, actor, created time and digest |
| `ResolutionMountRef` | Exact ResolvableID, owner mount key `chat.saved_output/{SavedOutputID}`, instruction version, source-scope digest and expected Resolution definition generation; it is a reference, not copied Resolution state |
| `DeletionRecord` | Exact Message/expected Revision, actor, reason, affected-reference decision, policy/retention decision and time; content remains governed and branch topology remains intact |
| `RedactionRecord` | Exact Message/expected Revision, privileged actor, reason/policy basis, consequence preview digest, erasure mode, cache/preview revocation state and required retained tombstone/hash |
| `ChatResolutionRequest` | Plain bounded Resolution Ask input with exact branch head/context/settings/source digests, intended parent, answer schema, policy and budget; never provider transport or a live client |
| `ChatProjection` | Exact metadata/settings revision and through-sequence plus requested branches/messages; omission is explicit |
| `ChatRenderResult` | Immutable request/result IDs, exact Chat/branch/message-revision cutoff and visibility lineage, closed JSON/Markdown kind, renderer/policy versions, digest, size, warnings and opaque family result reference; no File or delivery URL |

Sequence is assigned transactionally per Chat and is only canonical ordering
inside that Chat. It is not a cross-product event cursor. Message content is
immutable once committed; edits/redactions advance a current revision pointer
under explicit policy while retaining governed history.

SavedOutput state is closed. Static outputs use `ready`. Standing outputs use
`draft`, `mount_pending`, `ready`, `resolving`,
`current`, `dirty`, `awaiting_contradiction_resolution`, `failed`, or
`detached`; a failed/dirty/waiting state preserves the visible last-good Output.
Only a standing SavedOutput can own the Chat side of a Resolution mount.
Ordinary Messages, referenced Messages, promoted links and static SavedOutputs
never become Resolvables implicitly.

## Commands and queries

| Product operation | Kind | Capability behavior |
| --- | --- | --- |
| `chats.create.v1` | Idempotent command | Create a bounded Chat, optional exact Resource affiliation and initial settings |
| `chats.duplicate.v1` | Idempotent command | Freeze one authorized exact branch/message cutoff and create an independent same-Project Chat identity with bounded provenance; SavedOutputs, Tasks, comments, grants and private state are not copied unless a separately named operation later admits them |
| `chats.rename.v1` | Command | Rename under metadata revision |
| `chats.set_lifecycle.v1` | Command | Archive/restore/tombstone under retention/legal-hold policy |
| `chats.append_message.v1` | Idempotent command | Append an authored message to an exact branch/parent with attachments/grounding refs |
| `chats.request_reply.v1` | Idempotent durable command | Snapshot exact context/settings/sources and admit bounded inference under policy as durable work |
| `chats.commit_reply.v1` | Internal settlement command | Normalize and append one exact Resolution Result projection only under request/branch/authority preconditions |
| `chats.regenerate.v1` | Idempotent durable command | Create a sibling durable reply request retaining original lineage/evidence |
| `chats.edit_message.v1` | Idempotent command | Add a policy-allowed revision under exact current message revision |
| `chats.delete_message.v1` | Idempotent command | Apply an ordinary governed tombstone, exclude content from future ordinary context, and preserve topology/provenance under legal-hold/reference policy |
| `chats.redact_message.v1` | Privileged idempotent command | Apply the preapproved privacy/security erasure policy, revoke previews/caches and retain only required tombstone/hash/provenance; never masquerade as ordinary delete |
| `chats.create_branch.v1` | Idempotent command | Create a branch from an exact parent revision |
| `chats.set_referenced.v1` | Command | Conditionally reference/withdraw one eligible exact message revision for Knowledge |
| `chats.update_settings.v1` | Command | Set Persona/steering/context policy under exact settings revision |
| `chats.promote.v1` | Idempotent command | Invoke an explicit target create/proposal/task operation and record exact link |
| `chats.saved_outputs.create.v1` | Idempotent command | Create a static snapshot or standing native Output from one exact MessageRevision; standing creation begins with an exact mount-pending definition |
| `chats.saved_outputs.convert_to_standing.v1` | Idempotent command | Conditionally convert a static Output by creating an explicit instruction/source scope and exact Resolution mount; never infer standing behavior from references |
| `chats.saved_outputs.mount.attach.v1` | Internal settlement command | Attach the exact successfully created Resolvable/mount reference to the expected mount-pending SavedOutput |
| `chats.saved_outputs.revisions.append.v1` | Internal settlement command | Conditionally append one normalized Resolution Result as a new Output revision under exact SavedOutput/mount/Result preconditions |
| `chats.saved_outputs.edit.v1` | Idempotent command | Append a User-edited typed presentation under the exact current Output revision and preserve Result lineage/divergence |
| `chats.saved_outputs.detach.v1` | Command | Stop future standing refresh, detach the Resolution mount through its owner contract and preserve retained Output history |
| `chats.saved_outputs.restore_revision.v1` | Idempotent command | Append a new current User-authored revision copied from one retained exact OutputRevision; never move the pointer backward or alter Resolution evidence |
| `chats.saved_outputs.get.v1` | Query | Return one authorized SavedOutput, current/last-good presentation and safe mount/status projection |
| `chats.saved_outputs.list.v1` | Query | List authorized static/standing SavedOutputs by Chat, source revision, state or native kind under explicit bounds |
| `chats.saved_outputs.revisions.get.v1` | Query | Return one retained authorized immutable OutputRevision with exact predecessor/origin/Result lineage |
| `chats.saved_outputs.history.list.v1` | Query | Page retained immutable Output revisions with exact origin/Result lineage and explicit truncation |
| `chats.get.v1` | Query | Return metadata/settings and a bounded exact conversation projection |
| `chats.list_messages.v1` | Query | Return messages after a declared Chat sequence or around stable IDs with explicit truncation |
| `chats.render.v1` | Query | Return a bounded deterministic JSON/Markdown transcript at exact revisions/sequence without creating an artifact |
| `chats.render_jobs.request.v1` | Idempotent durable command | Freeze the exact Chat branch/message/revision cutoff, format/options and policy version and admit a durable render Job |
| `chats.render_jobs.status.get.v1` | Query | Return bounded safe Job state and, when ready, typed Chat-render result metadata for that exact request |
| `chats.extract.v1` | Query | Produce only eligible referenced exact message revisions and anchors for Knowledge |
| `chats.validate_anchor.v1` | Query | Validate or deterministically rebase a Collaboration/source anchor across exact message revisions and branch lineage |

`request_reply` and `regenerate` always use the same durable request class and
transaction contract. They atomically store exact intent and a durable Job;
the request may wait briefly and return an already-terminal projection, but it
never changes its request class or transaction contract based on latency or
size. Token streaming is a noncanonical status hint; restart, disconnect or
duplicate hints cannot create or lose a canonical reply.

`chats.render.v1` is always a bounded read-only query. It cannot create a Job,
WorkAuthority, transcript object, idempotency record or Audit mutation. If the
exact branch/revision/sequence projection exceeds interactive message, byte or
time bounds, it returns `chat_render_async_required`, naming
`chats.render_jobs.request.v1`, with no side effects. The durable request
freezes the exact Chat branch, message revision cutoff, visibility projection,
format/options and renderer-policy version before committing its request, Job,
receipt and Audit envelope through the ordinary durable-work protocol. Its
status query is read-only; a ready response supplies typed JSON/Markdown
transcript-result metadata, digest, size, renderer version and exact input
lineage. Translation owns creation of an exported File. Ask may call only the
bounded render query when admitted and dispatch never auto-upgrades it to the
durable request command.

## Capability API and ports

Pure operations validate/create Chats, branches, message revisions and
settings; construct a bounded `ChatResolutionRequest`; normalize/accept a reply
against exact plan digests; determine contribution eligibility; render/extract;
and validate message anchors.

Consumer-owned ports are expressed in Chat vocabulary:

```go
type ChatResolutionProvider interface {
    Ask(context.Context, ChatResolutionRequest) (ChatResolutionResult, error)
    CreateSavedOutputMount(context.Context, SavedOutputMountRequest) (ResolutionMountRef, error)
    DetachSavedOutputMount(context.Context, SavedOutputDetachRequest) error
}

type ChatActionProvider interface {
    Promote(context.Context, ChatPromotionRequest) (ChatPromotionResult, error)
}
```

Resolution returns a normalized Result projection whose citations are bound to
its sealed EvidenceSet, or an exact stable mount reference for a standing
SavedOutput. Chat never calls Knowledge retrieval or Intelligence providers
directly and never imports a Resolution repository. Action promotion returns
an exact Resource/task/proposal reference. Handler adapters satisfy these
through Resolution/Agents/other Resource operations under bounded nested
dispatch; Chat never imports them.

Handlers own the Project-bound message repository, consistent projection and
conditional append, jobs, Resolution/action adapters, idempotency, permit
consumption, required Audit and Activity facts.

## Persistence and concurrency

Chat uses immutable append plus conditional revisions, not Document ChangeSets:

- a transactionally assigned per-Chat message sequence;
- immutable MessageRevision rows and a conditional current-revision pointer;
- immutable Branch creation and parent lineage;
- metadata/settings and contribution-state revisions; and
- immutable inference attempt/evidence keyed by exact request digest, with an
  explicit pending/succeeded/failed/canceled state machine;
- immutable SavedOutputRevision rows plus conditional current/last-good/latest-
  User-edited pointers and explicit retention pins; and
- SavedOutput/Resolution mount references keyed uniquely by
  `(ProjectID, SavedOutputID, ResolvableID)` with no copied Result/Evidence body.

Concurrent appends to one branch are both valid when their exact parent policy
allows it; the Project transaction assigns their canonical sequences. If a
command requires “reply to current branch head,” a changed head conflicts or
the operation explicitly creates a branch—never silently retargets. Two edits
to one current message revision conflict. Independent messages/settings can
update independently. Contribution state uses exact message revision and CAS.

Reply flow:

1. Authorize and load exact Chat branch/settings plus bounded requested context;
   build a digest and stable `ReplyRequestID`, `WorkAuthorityID`, and `JobID`.
2. Under the current session, create exact
   `DurableWorkAuthority{PendingProjectReceipt}` in Control, then consume a
   fresh session-sourced permit in one Project transaction that stores the
   ReplyRequest/context snapshot, Job, non-authoritative receipt, idempotency,
   required Audit/fact, and closed `durable_job@1` record.
3. Trusted acknowledgement of that exact receipt activates the work. Pending
   authority/bare receipt cannot issue a permit; missing Project state expires
   as an orphan, while lost acknowledgement reconciles only from the exact
   trusted receipt.
4. Under the active WorkAuthority and matching Job/receipt, invoke the approved
   Resolution Ask adapter outside any Project transaction or held permit.
   Resolution owns retrieval, sealed Evidence, contradictions, bounded
   Reasoning, provider admission/accounting and its own durable recovery.
5. Normalize only the returned Result projection; never persist raw provider,
   Knowledge or Resolution-store transport.
6. `chats.commit_reply.v1` rechecks exact request/branch/context and work
   dependencies, obtains a fresh work-sourced permit for the append, and in one
   Project transaction appends the Message/Revision/evidence, settles intent,
   consumes the permit, stores idempotency and required Audit/fact.

If the branch advanced, declared policy either appends to the original parent
as a visible branch or returns `chat_context_changed`. A stale provider result
cannot masquerade as a reply to newer context. A failure records a bounded
attempt status but no fake assistant message. Retries reuse intent identity and
cannot duplicate a reply.

SavedOutput creation follows the same ownership discipline. Static creation is
one Chat transaction. Standing creation preselects stable SavedOutput and
Resolvable IDs, commits `mount_pending`, then calls
`resolution.create_resolvable.v1` through the adapter using the mount key
`chat.saved_output/{SavedOutputID}`. `chats.saved_outputs.mount.attach.v1`
accepts only that exact definition/digest. A Resolution settlement reaches Chat
only through `chats.saved_outputs.revisions.append.v1`, which rechecks the
expected SavedOutput revision, mount generation, ResultID and replacement
policy, consumes a fresh permit, appends one Output revision and advances
current/last-good atomically with idempotency, required Audit and fact. A lost
acknowledgement reconciles from exact identities; an absent/mismatched Chat
mount cannot be settled. Restore and User edits create presentation history but
never mutate a Result, EvidenceSet or Resolution history.

Current-family sign-out preserves the explicitly admitted reply. User-wide,
grant/policy/entitlement, cancel/expiry or explicit revocation denies/fences
new append permits. `durable_job@1` may only terminalize exact Job bookkeeping
after authority loss and cannot change ReplyRequest/Chat state; success requires
prebound proof that the ordinary reply effect already settled. It cannot invoke
the provider, append a message, promote output, create a Task/Resource, enqueue
work or widen authority. Capability state must commit under a fresh permit
before revocation or remain nonterminal.

## Security, failure and stable errors

Every attachment, grounding reference, Persona, promoted target and transcript
read is reauthorized at its exact version. Hidden source content is not copied
into error details, logs or inference evidence. Prompt-injection defenses apply
to Chat input and Resolution context; model output
never becomes authority or an executable operation without a separately gated
typed command.

Only an explicitly eligible exact revision can become `referenced`; model
output remains inference and requires accepted policy/review. Withdrawn or
redacted content cannot be newly acquired by Knowledge, while retention of
already derived artifacts follows explicit source-removal policy.

Delete and redact have different authority and consequences. Delete is an
ordinary family mutation subject to retention, legal hold and referenced/
canonicalized-source withdrawal policy; it preserves content where policy
requires and never removes a SavedOutput. Redact requires a privileged,
separately registered action, reason/policy basis and exact consequence preview.
It can cryptographically erase or make the body inaccessible and revoke
previews/caches, but it cannot rewrite branch topology, Audit or a sealed
historical EvidenceSet. Citations to newly inaccessible content render an
inaccessible marker without leaking it.

| Family error | Kernel category | Meaning/retry |
| --- | --- | --- |
| `chat_invalid_model` | `invalid_argument` | Invalid branch, message, content, attachment, setting or bounds |
| `chat_unknown_kind` | `unsupported_version` | Unsupported representation/content/evidence kind |
| `chat_conflict` | `conflict` | Expected metadata/settings/message/contribution revision changed |
| `chat_context_changed` | `conflict` | Exact branch/context for a reply or promotion advanced; replan/branch |
| `chat_broken_reference` | `precondition_failed` | Parent, Persona, attachment, source or promoted target no longer resolves |
| `chat_delete_blocked` | `precondition_failed` | Legal hold, retention pin or referenced-source policy requires withdrawal/combined action before ordinary deletion |
| `chat_redaction_not_permitted` | `forbidden` | Caller lacks the privileged redaction action or approved policy basis |
| `chat_redaction_consequence_changed` | `conflict` | Expected Message/reference/cache consequence preview is stale |
| `chat_saved_output_conflict` | `conflict` | SavedOutput/current Output revision/mount generation changed |
| `chat_saved_output_not_standing` | `precondition_failed` | Standing-only refresh/mount action targeted a static or detached Output |
| `chat_saved_output_mount_mismatch` | `integrity_failure` | Resolvable owner key, Project, definition generation or source-scope digest does not match the SavedOutput |
| `chat_output_revision_unavailable` | `precondition_failed` | Requested history/restore revision is outside retention or inaccessible |
| `chat_ineligible_contribution` | `precondition_failed` | Revision cannot be marked referenced under provenance/review policy |
| `chat_reply_rejected` | `precondition_failed` | Normalized provider result violates content/evidence/policy contract |
| `chat_too_large` | `invalid_argument` | Message/context/attachment/result budget exceeded |
| `chat_render_async_required` | `precondition_failed` | Exact transcript render exceeds interactive bounds; call `chats.render_jobs.request.v1`; no Job, work or artifact was created |
| `chat_integrity_failure` | `integrity_failure` | Sequence, branch or revision lineage is corrupt/forked |

Provider timeout/rate/unavailability maps to stable retry categories and leaves
canonical conversation intact. Current authority, fresh permit and atomic
effect/Audit apply to every mutation, including automated reply commit.

## Cross-capability relationships

- Resolution supplies grounded Ask and standing-refresh Results backed by
  sealed Evidence; Chat owns only Message/Output presentation settlement.
- Knowledge receives only explicitly referenced eligible revisions through
  `chats.extract.v1`; Chat does not retrieve Knowledge directly.
- Intelligence is consumed by Resolution, not Chat. Provider/model identity
  remains provider-neutral provenance and does not shape Chat state.
- Files/Resource families supply exact attachment projections. Chats never
  copies their canonical bodies.
- Personas/Agents supply exact Persona policy and task/proposal creation.
  Promotion invokes ordinary target operations under inherited delegation,
  budget and a separately required action.
- Collaboration may attach threads to stable Chat/message/revision anchors,
  but messages themselves already provide conversation structure.

`chats.promote.v1` is not a SavedOutput command. Promotion creates or updates a
different owner (Resource, proposal or Task) and records a `SpawnedLink`.
Saving creates Chat-owned presentation history; making it standing additionally
creates a Resolution mount. Neither behavior is implied by the other.

## Headless proofs and examples

```text
create chat "Research" -> branch main, through sequence 0
append user question -> M1 sequence 1
request grounded reply at M1 with source S@v4
  -> plan digest P; deterministic fake returns citations
commit reply -> M2 sequence 2, exact S@v4 evidence
regenerate M2 -> M3 sibling sequence 3; M2 remains addressable
mark M1 referenced -> exact M1 revision eligible for Knowledge extraction
save M2 static -> SO1 + O1 snapshot; no Resolvable exists
convert SO1 to standing -> mount chat.saved_output/SO1, exact Resolvable R1
settle Result R7 -> append O2; restore O1 -> append O3 based_on O1
delete M1 -> branch tombstone and context exclusion; topology remains
render --markdown -> byte-stable branch-aware transcript
```

Required proofs include:

- deterministic branch/revision/sequence validation, render and extraction;
- concurrent append, head-required reply, edit, settings and referenced-state
  races against a live Project Database;
- idempotent reply retries, crash before/after provider and commit, job lease
  loss and no duplicate reply;
- branch advances while inference runs under both conflict/branch policies;
- provider timeout/cancel/malformed/oversized/unsafe output and redaction;
- bounded transcript render proves zero Job/work/artifact/idempotency writes and
  exact async-required routing; durable render request/status proves frozen
  cutoff, typed metadata, exact replay, lease loss and stale-result fencing;
- static/standing SavedOutput distinction, mount owner-key/digest mismatch,
  idempotent settlement, last-good preservation, User-edit divergence, paged
  history/retention pins and append-only restore;
- ordinary delete versus privileged redact, legal hold/reference withdrawal,
  cache revocation, inaccessible citations and proof that neither silently
  deletes SavedOutputs or rewrites branches;
- exact attachment/source revocation and unauthorized existence hiding;
- referenced/withdrawn/redacted contribution behavior and feedback prevention;
- exact anchor validation/rebase across message edits, redactions, branches and
  unavailable revisions;
- fresh-permit revocation race and effect/Audit atomicity; and
- complete browser-free chat, grounded reply, branch, promotion and transcript
  flow through the same Product operations.

## Source grounding

- The original [Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0)
  defines persistent conversations, branches/regeneration, referenced status,
  grounded responses, personas, attachments, artifacts/tasks and promotion.
  It is vision evidence, not the build-ready construction contract.
- [SOL X 30 — Chat & Conversation](https://app.notion.com/p/39ab6410e50281b4971bfb5c1b5a38f1)
  is the exact construction authority for immutable conversation revisions,
  governed Delete versus privileged Redact, static/standing SavedOutput,
  `chat.saved_output/{id}` ResolutionHost mounts, Output history and restore.
- Current Omega [jobs/Audit](../architecture/jobs-audit-observability.md),
  [dispatch](../architecture/request-dispatch.md) and
  [capability](../architecture/capability-model.md) contracts supply the
  provider, durable reply and security envelope.

### Nova evidence (pinned)

- Nova's prompt-block implementation and tests at
  [`internal/document/promptblock`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/promptblock)
  are evidence for normalized inference lifecycle, grounded refresh, bounded
  history and stale-result preservation. The audited Nova tree at
  [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova)
  contains no canonical Chat aggregate. Chats is therefore a new Omega
  contract, not Nova persistence or compatibility behavior.
