# Stage 06 — Knowledge, Intelligence, Resolution, and Prompt Blocks

## Outcome

Build grounded prompt execution end to end: exact-version source acquisition,
Knowledge artifacts and KLR retrieval, provider-neutral Intelligence,
durable Resolution plans/evidence/results, and Document Prompt Block
execution/refresh with last-good display and explicit staleness.

## Non-goals

- Knowledge synthesis or model calls inside KLR
- provider/model names in Resource commands or canonical state
- generated output automatically becoming Knowledge
- global event-driven source synchronization
- hidden retries/failover that weaken requested semantic cast
- claiming general autonomous Agents

## Target tree and files

```text
internal/
  capabilities/{knowledge,intelligence,resolution}/
  control/intelligence/                    Cast/route/provider policy and limits
  control/intelligence/mysql/              Control policy repository
  cell/handlers/{knowledge,intelligence,resolution}/
  cell/handlers/documents/prompt_resolution.go
  cell/handlers/{knowledge,intelligence,resolution}/mysql/
  integrations/intelligence/
    openrouter/                            provider-neutral inference/embedding adapter
    openai/                                provider-neutral inference/embedding adapter
    anthropic/                             provider-neutral inference adapter
  platform/jobs/                         execution mechanism only
  wiring/{testing,development,production}/reasoning.go
migrations/control/*_intelligence_policy.sql
migrations/project/*_{knowledge,intelligence_usage,resolution}.sql
api/openapi/product-v1.yaml
test/{integration,security,recovery,performance,golden}/resolution/
```

Concrete model/embedding clients live in provider-named integration adapters;
admission queues and durable workers remain in handlers/platform/wiring. An
adapter implements the handler-owned provider-neutral port and contains every
provider SDK/wire type, credential lookup, timeout/retry rule, response mapping,
and error redaction. No capability or canonical schema imports a provider
adapter or provider model name. A directory is created only when that provider
is admitted and tested. The three capability libraries retain separate models
and cannot import one another.

## Versioned contracts and schemas

Register the exact operation tables in [Knowledge](../capabilities/knowledge.md#operations),
[Intelligence](../capabilities/intelligence.md#commands-and-queries) and
[Resolution](../capabilities/resolution.md#commands-and-queries), plus the
Documents-owned prompt operations. No stage-local alias is public. Persisted
Control schemas version immutable Casts and active/deprecated lifecycle, route
epochs, provider/credential references, policy generations, health admission
and Organization limits.
Project schemas separately version Source/artifact/KLR facts; Intelligence call
reservations, normalized receipts, continuations and usage; Resolution request/
plan/step/Evidence/decision/Result/receipt state, dependency/dirty-cause facts
and current/last-good Result pointers; and Document-owned Prompt Block/visible
Output state. Provider requests, SDK objects, queues and editable output are
not Knowledge records.

Knowledge schemas explicitly version Corpus definitions, lifecycle and current
generation plus declarative owner-scoped subscriptions, their policy/revision/
generation, membership, and SubscriptionAcquisition request/Job/cursor/counts/
failure state. A subscription never grants source access; its generation fences
stale acquisition when policy or owner scope changes. Subscription create/
update/remove are declarative and create no acquisition Job.

The Documents-owned `PromptResolutionProvider`, Knowledge source-content
provider, Intelligence inference/embedding ports and Resolution step adapters
are narrow versioned interfaces. Every value names exact source/target versions,
bounds, semantic cast, authority/delegation context and normalized safe errors.

## Knowledge construction

Owned truth:

- Source ledger with exact version/hash/dirty/removal/watermark;
- immutable base artifacts with origin/inference markers and content hash;
- deterministic window geometry and retained exact text;
- embeddings stamped by space/model dimensions and rebuildable projection;
- KLR lattice nodes/links/representatives/orphans/coverage/snapshot metadata;
- Corpus definitions, exact retrieval/embedding policy, declarative
  subscriptions, membership and active/candidate generation pointers; and
- source/artifact dependency and staleness facts, never Resolution dirty causes
  or editable Resource output state.

The only callable operations are the exact registered names in the Knowledge
capability table. Corpus/subscription lifecycle, Source register/change/remove/
get/acquire, subscription acquisition request/status, generation build/status/
verify/promote and bounded retrieval map directly to those names. “Reconcile,”
“hydrate,” “rebuild,” “exact scan,” “statistics,”
“fetch artifact,” “note usage,” “sweep,” and “mark stale” are deterministic
capability functions or fenced handler/job steps inside those registered
operations—not additional Product operations or stage-local aliases. Internal
maintenance uses the same typed handler boundary and cannot bypass authority,
bounds, Audit or generation fencing.

Complete candidate verification uses the fixed durable request/status pair
`knowledge.generations.verify.request.v1` and
`knowledge.generations.verify.status.get.v1`; it is never an effectful or
potentially unbounded Query. Promotion consumes the exact ready verification
identity/report digest and rejects stale, partial or policy-mismatched reports.
Candidate construction uses `knowledge.generations.build.v1` plus the separate
read-only `knowledge.generations.build.status.get.v1`. The status Query is bound
to the exact candidate generation and Job and returns bounded progress,
coverage/watermarks, candidate manifest/integrity metadata and safe failure. It
cannot build, verify or promote a generation; only the distinct verification
request/status result can later authorize promotion.
Subscription acquisition likewise uses the fixed pair
`knowledge.subscriptions.acquire.request.v1` and
`knowledge.subscriptions.acquire.status.get.v1`. The request freezes the exact
subscription/Corpus generation, owner-scope digest and policy digest and
pre-admits one stable Work/Job. Its worker pages owner extraction and Knowledge
ingestion functions directly under that same authority; it never calls
`knowledge.sources.acquire.v1` or another durable command from inside the Job.
Resolution owns runs/evidence/results,
Resource-dependency edges, dirty causes, current/last-good Result pointers and
incorporation receipts. The owning Resource family owns editable Output,
visible/last-good display state and its ordinary family history. A Resource may
retain an exact immutable Result provenance reference on incorporated display,
but it does not become authority for Result selection or dirty causes.

KLR embeds but never generates. Retrieval returns verbatim contiguous regions
with exact artifact/source spans and relevance/density under a character budget.

## Intelligence construction

Intelligence accepts semantic casts, not provider names:

- inference strength/latency/price/reasoning/structured-output needs;
- embedding domain/dimensions/order; and
- media description when explicitly requested.

It resolves allowed provider/model routes from Organization/Project policy,
entitlement, region/compliance, budget, and health. Intelligence owns semantic
cast validation, route-selection rules and normalized receipts, not a runtime
queue, worker, provider client or durable Product truth. The Host/handler
envelope owns admission and durable jobs; concrete adapters own provider I/O.

Control handlers persist Cast/route/provider policy and immutable route epochs.
Cast publication validates a complete immutable endpoint/schema/tool/limit
contract; deprecation conditionally denies only new admissions and leaves old
receipts reproducible.

Bound Project handlers persist the exact call reservation, receipt,
continuation and usage ledger stamped with that route epoch. No transaction
spans Control and Project; an epoch is read as immutable admitted input before
the Project reservation is committed.

Initial real provider can be OpenRouter behind a provider-neutral adapter; test
providers are deterministic. Secrets remain SecretRefs. Equivalent route
failover is allowed only when semantics/policy remain satisfied and is recorded.

## Resolution construction

A Resolution owns:

- immutable request intent, actor/delegation, target Resource/component and
  expected versions;
- plan revision and bounded retrieval/inference steps;
- exact Evidence items, source versions/spans, contradictions, and exclusions;
- decisions and reason codes;
- normalized provider requests/receipts/usage without secret/raw transport;
- immutable Result;
- exact Resource/source dependency edges and typed dirty causes;
- conditional current/last-good Result pointers;
- canonical run state: queued/planning/retrieving/sealing/
  checking_contradictions/reasoning/validating/awaiting_resolution/
  awaiting_review/settling/succeeded/failed/canceled/superseded;
- pause/resume checkpoint and idempotency; and
- output incorporation proposal/receipt linked to exact owner versions, not
  editable Resource Output itself.

It distinguishes Evidence, Result, and Output. It may pause for missing source,
contradiction, ambiguity, budget, policy, or approval instead of fabricating a
best guess.

## Prompt Block flow

1. Document handler validates exact block/head, preselects stable
   `PromptRequestID`, `ResolutionRunID`, `WorkAuthorityID` and `JobID`, creates
   pending Control work authority under the current session, and commits the
   exact Resolution Job/receipt with queued Document state under a
   session-sourced permit; trusted receipt acknowledgement activates the work.
2. Knowledge retrieves bounded authorized evidence from already admitted
   active generations; missing/stale acquisition yields explicit insufficiency
   rather than starting acquisition from inside the Resolution Job.
3. Resolution constructs the normalized context and calls Intelligence under
   an explicit cast/policy/budget.
4. It validates structured result/citations and seals Evidence/Result/receipt.
5. Document handler incorporates editable Output through a normal Document
   ChangeSet against current head; Resolution records the exact settlement
   receipt without owning that display.
6. While the session is live, a Source/version owner mutation pre-admits one
   Resolution reconciliation Work/Job; the same Project transaction invokes
   internal `resolution.dependency_changes.reconcile.v1` to store its exact
   intent/receipt with the owner effect. That single worker conditionally
   records typed dirty causes in bounded pages under the same authority. Prior
   Resource display remains and UI staleness is projected from Resolution.
7. Refresh/force-refresh creates a new Resolution and visible version/diff.

The Documents-owned `PromptResolutionProvider` is implemented by a handler
adapter over Resolution operations; Documents imports none of these packages.

## Persistence and jobs

Knowledge, Project Intelligence usage, Resolution, and Document each own
separate Project tables and repositories. Control Intelligence policy has a
separate Control repository. Projection/lattice state is rebuildable; the
Source ledger and artifacts, Intelligence reservations/receipts/usage,
Resolution evidence/results/dependencies/dirty causes/Result pointers, and
Document visible Output/history are canonical according to their respective
contracts. Long acquisition, embedding, inference, refresh, and incorporation
steps use fenced durable jobs with exact operation/schema versions.

The durable operation-to-authority mapping is explicit:

| Workflow | Stable identities | Registered terminal-only finalization kind |
| --- | --- | --- |
| `knowledge.sources.acquire.v1` | `AcquisitionID`, `WorkAuthorityID`, `JobID`, exact Source/version/generation | `durable_job@1` |
| `knowledge.subscriptions.acquire.request.v1` | `SubscriptionAcquisitionID`, exact subscription/Corpus generation and owner-scope/policy digests, `WorkAuthorityID`, `JobID` | `durable_job@1` |
| `knowledge.generations.build.v1` | candidate generation, `WorkAuthorityID`, `JobID`, pinned source-set digest | `durable_job@1` |
| `knowledge.generations.verify.request.v1` | `VerificationID`, candidate/active generation manifests, `WorkAuthorityID`, `JobID`, exact verification-policy digest | `durable_job@1` |
| `resolution.start.v1`, each admitted `resolution.resume.v1`, and `resolution.force_refresh.v1` | `ResolutionRunID`, run generation, `WorkAuthorityID`, `JobID`, exact target/dependency digest | `durable_job@1` |
| live-session owner mutation plus internal `resolution.dependency_changes.reconcile.v1` | one `DependencyChangeID`, reconciliation generation, `WorkAuthorityID`, `JobID`, exact owner/version/change digest committed with the owner effect | `durable_job@1` |
| provider call within an admitted run | reservation/call ID and generation owned by the active WorkAuthority/Job | `intelligence_reservation_call@1` |

For each non-provider workflow row, the handler preselects IDs and Control creates
an exact bounded `DurableWorkAuthority{PendingProjectReceipt}` while the
initiating session is current. One Project transaction consumes a fresh
session-sourced permit and commits the workflow intent/current state, exact
Job, non-authoritative receipt, idempotency, required Project Audit, declared
fact and named finalization record. Trusted acknowledgement of the exact
receipt alone moves the work authority to `Active`.

Dependency reconciliation is the deliberate specialization of that admission
sequence: Control pending authority and stable identities are prepared before
the owner Project transaction; that one transaction commits the owner effect
and the one Resolution intent/Job/receipt. Its worker calls only bounded
`resolution.dependency_changes.apply_page.v1` settlements under fresh permits
from that authority. It does not consume an owner follow-up Job and cannot call
another durable-admission operation. Owner rollback leaves no Project work;
lost acknowledgement activates only the exact committed receipt.

A pending authority or receipt cannot issue an ordinary permit. Missing Project
state leaves an unusable expiring/revoked Control orphan; lost acknowledgement
is reconciled only after exact receipt verification at the trusted placement.
Each later canonical acquisition artifact/index pointer, run checkpoint,
provider reservation/call record, sealed Result, dependency/pointer, or
Document incorporation effect consumes a fresh permit sourced by the exact
active WorkAuthority and matching Job/receipt/generation. No permit is held
during extraction, retrieval computation, embedding or inference.

`durable_job@1` may only terminalize exact Job bookkeeping under the closed
registry; success requires prebound proof that the ordinary capability effect
already settled. It cannot change Knowledge or Resolution state. The
Intelligence finalizer may record the already-spent exact provider receipt and
settle/cancel its reservation. No finalizer may acquire/index a Source,
invoke/retry a provider, seal a Result, advance current/last-good pointers,
incorporate Resource output, enqueue work or widen authority. Such capability
state must commit under a fresh permit before revocation or remain nonterminal.

## Authority, transactions, failure, and recovery

Every retrieval reauthorizes exact Sources and filters inaccessible Evidence.
Resolution creation, state transitions, sealed Result and Document
incorporation are separate owner transactions linked by exact versions and
idempotency; no transaction spans capabilities. Each protected mutation
consumes a fresh work-sourced permit and appends required Project Audit in its
own commit once durable work is active.
Cast/route/policy publication is instead a Control transaction with current
Control authority, expected generation, required Control Audit and any declared
policy `SemanticFact`; it never joins a Project usage transaction.

Jobs carry exact operation/schema versions, lease fence, run generation and
input digest. Crash/retry can create Attempts but not a second sealed Result or
duplicate Document incorporation. Provider outage, policy/budget denial,
missing/contradictory Evidence, a typed dependency dirty cause, invalid
structured output and stale target are distinct states. Recovery resumes from
durable Resolution checkpoints; corrupt rebuildable KLR/index state is
discarded and rebuilt from Source/artifact truth. Last-good editable display
remains Resource-owned and is never erased by a failed refresh; current and
last-good Result pointers remain Resolution-owned.

Current-family sign-out preserves each explicitly admitted acquisition or run.
Sign out everywhere, User disable/removal, Project-grant/policy/entitlement
loss, work cancellation, expiry or explicit revoke denies new permits and
fences outstanding ones; only the exact terminal-only finalizers remain able
to close pre-admitted Job bookkeeping or Intelligence accounting; capability
state remains unchanged without a fresh permit.

## Production and test composition

Production requires durable Control-policy and Project Source/Intelligence-
usage/Resolution repositories, a real job runner,
an admitted provider/model route, managed credentials, hard budgets and the
exact embedding/KLR versions advertised by the graph. Missing policy, provider
or adapter makes the relevant operation unavailable or paused; no allow-all or
synthetic route is accepted. Tests use deterministic retrieval/inference fakes
and fault injection, while live promotion requires real provider outage,
timeout, receipt, usage, redaction and restart evidence.

## Proof matrix

- acquisition adapters for Document/File exact versions and authorization;
- declarative subscription create/update/remove prove zero hidden Work/Job;
  subscription acquisition request/status proves frozen scope/policy, stable
  Work/Job identity, exact/divergent replay, direct paged ingestion, crash/
  lease/revocation fencing and no nested durable admission;
- KLR deterministic build/add/update/remove/rebuild/snapshot coverage, exact
  candidate build Job/generation status with bounded progress/coverage/
  watermarks/manifest/integrity/failure and zero writes, plus durable exact-input
  verification request/status, complete report digest and stale/partial/policy-
  mismatch promotion refusal;
- every retrieved span resolves verbatim to retained artifact text;
- embedding order/dimension/space mismatch and provider failure;
- Source-ledger/artifact projection atomicity, Resolution dirty-cause
  derivation, and Resource last-good preservation during retry;
- owner-change transaction faults and exact replay prove one pre-admitted
  Resolution reconciliation Work/Job/receipt, direct page settlement, lost-
  acknowledgement recovery and no job-to-durable-command-to-job chain;
- Corpus/subscription lifecycle, scope, generation fencing, shadow promotion
  and authorization under concurrent owner changes;
- Intelligence cast resolution, hard compliance filters, queue bounds,
  equivalent failover, usage/budget, redaction, and provider outage;
- Cast publish/deprecate races, immutable versions and retained-call
  reproducibility after deprecation;
- Resolution state transitions, pause/resume/retry/cancel, contradiction and
  missing-evidence behavior;
- invented citations/types/source IDs are rejected;
- crash at every job/transaction boundary yields one sealed Result and at most
  one Document incorporation;
- stable Work/Job identity and pending→receipt→ack activation for Knowledge and
  Resolution, including lost-ack reconciliation, orphan expiry, and rejection
  of pending authority or bare receipt as a permit source;
- current-family sign-out survival versus User-wide/grant/policy/entitlement/
  cancel/expiry denial and permit fencing at every canonical effect;
- exact `durable_job@1`/`intelligence_reservation_call@1` confinement after
  revocation, including no capability-state change and inability to acquire/
  index, call providers, seal Results, incorporate output or enqueue work;
- stale source adds a Resolution dirty cause without erasing Resource display;
  refresh produces a new Result and conditional pointer advance;
- generated output is excluded from Knowledge base re-ingestion by default;
- two Users/Cells cannot retrieve unauthorized Project/source evidence; and
- headless live-MySQL prompt journey renders Document Markdown with inspectable
  Evidence, provider receipt, usage, and versions.

## Completion boundary

Prompt Blocks and grounded prompt resolution are real. Broad Agent planning,
cross-resource Action/Plan, Memory learning, and proactive recommendations wait
for Stage 12.

## Consequential decisions and source grounding

- **Knowledge retrieves; it does not generate or own outputs.** Resolution owns
  run/Evidence/Result truth and each Resource family owns editable/last-good
  output. Alternative: a Knowledge output registry, rejected as duplicate
  authority.
- **Intelligence is semantic policy, not a runtime service.** Host/handlers own
  queues/jobs and concrete provider adapters. Alternative: embed worker state
  in the capability, rejected because it breaks independent pure testing.
- **Resolution is the durable reasoning boundary.** Cross-owner settlement uses
  exact versions and idempotent commands rather than one distributed commit.
  Revisit only if an owner-specific atomic protocol is explicitly designed.

Grounding: [Knowledge](../capabilities/knowledge.md),
[Intelligence](../capabilities/intelligence.md),
[Resolution](../capabilities/resolution.md),
[prompt-resolution flow](../flows/prompt-resolution.md), and
[jobs/Audit/observability](../architecture/jobs-audit-observability.md).
