# Knowledge capability

## Purpose, ownership, and boundary

Knowledge maintains the exact, versioned Project content that can support a
fact and retrieves grounded spans from it. It is a capability library used by
Project-bound handlers; it is not a process, database client, model provider,
or general question-answering service.

Knowledge owns:

- source-version registration in Knowledge;
- deterministic content windows and their integrity identities;
- embedding and index identity metadata;
- corpora, subscriptions, Knowledge generations, and promotion state;
- exact-vector retrieval semantics, filters, sufficiency, and retrieval audit;
- hard and soft staleness classification caused by source/index changes; and
- explicit canonicalization eligibility and lineage.

Knowledge does not own source bodies, editable Resources, Resolution Results,
Resource Outputs, provider routing, contradiction decisions, Formula values,
Memory, authorization, Project placement, object storage, or SQL mechanics.
It never plans a natural-language query and never synthesizes an answer.

## Feature contract

| Feature | Required behavior | Initial boundary | Retained breadth |
| --- | --- | --- | --- |
| Source registration | Register an immutable eligible `SourceVersionRef`; repeated exact registration is idempotent and a changed version is a new identity | Text Sources | File regions, table ranges, slide regions, media segments |
| Extraction intake | Accept bounded normalized components from the owning Resource-family handler with exact offsets and digest | UTF-8 text | OCR, layout, tables, images, audio/video transcripts |
| Windowing | Deterministically produce stable, overlapping windows with component/range identities | One versioned algorithm | Family-aware and modality-aware window policies |
| Embedding | Request vectors through a Knowledge-owned `EmbeddingProvider`; persist semantic embedding identity, never provider SDK objects | One embedding cast | Compatible migrations and multiple embedding spaces |
| Knowledge Lattice | Organize windows into a versioned retrieval structure with explicit build generation and watermark | Exact scan plus small-project lattice | Incremental large-project lattice and tiered indexes |
| Incremental change | Add, supersede, remove, and rebuild without exposing a half-built generation | Source add/update/remove | Large-scale compaction and regional replicas |
| Shadow promotion | Build and verify a shadow generation, then atomically promote its pointer | One active plus one candidate | Multiple migration candidates and rollback windows |
| Retrieval | Accept authorized vectors and structured filters; return exact version/range hits and audit | Top-k exact spans | Hybrid/vector strategies behind the same semantics |
| Sufficiency | Return explicit `sufficient`, `insufficient`, or `indeterminate`; never invent fallback support | Deterministic threshold policy | Policy by task/corpus/data class |
| Staleness | Exact dependency changes are hard dirty; eligible subscribed-scope changes are soft dirty | Source-version and corpus generation | Field/region-level impact |
| Canonicalization | Generated output is excluded unless an authorized later command creates a normal immutable Source version | Explicit command only | Review/publish workflows |
| Auditability | Exact-scan and index paths expose bounded scores, filters, generations, identities, and exclusion reasons | Headless report | Operator comparison/rebuild tools |

## Domain model

The public model is plain, versioned, serializable data. IDs are opaque and
Project scope is injected by the handler rather than accepted as authority
from a payload.

```text
SourceVersionRef {
  source_id, version_id, media_type, content_digest, created_at
}

ExtractedComponent {
  component_id, kind, ordinal, text, source_range, component_digest
}

ContentWindow {
  window_id, source_version, component_id, range, text_digest,
  windowing_algorithm, windowing_version
}

EmbeddingIdentity {
  cast_id, route_epoch, semantic_model, dimensions, normalization,
  input_digest
}

Corpus {
  corpus_id, name, lifecycle, selection_policy, retrieval_policy,
  embedding_cast_ref, active_generation_id?, revision
}

CorpusSubscription {
  subscription_id, corpus_id, owner_kind, owner_ref,
  eligibility_filter, acquisition_policy, state, generation, revision
}

SubscriptionAcquisition {
  acquisition_id, subscription_id, subscription_generation,
  corpus_revision, owner_scope_digest, acquisition_policy_digest,
  work_authority_id, job_id, state, cursor?, counts, failure?
}

KnowledgeGeneration {
  generation_id, corpus_id, source_set_digest, embedding_identity,
  state, build_watermark, integrity_digest
}

RetrievalQuery {
  query_vectors, corpus_ids, source_filters, component_filters,
  minimum_score, maximum_hits, required_generation
}

EvidenceHit {
  source_version, component_id, range, quote_hash, score,
  generation_id, embedding_identity
}

RetrievalReport {
  hits, sufficiency, exclusions, index_watermark, audit
}
```

`KnowledgeGeneration.state` is one of `building`, `verifying`, `candidate`,
`active`, `superseded`, or `failed`. Only a verified `active` generation may
serve ordinary retrieval. An explicitly pinned prior generation may be read
for reproduction while retained by policy.

`Corpus.lifecycle` is `active`, `archived`, or retention-governed
`tombstoned`. `CorpusSubscription.state` is `active` or `removed`; removal is a
generation-advancing tombstone, not deletion of prior registration/generation
lineage. Unknown states fail closed.

Invariants:

- every hit names one immutable Source version and an exact component/range;
- `quote_hash` is derived from the admitted exact bytes, not generated text;
- one generation uses one compatible embedding identity;
- a Corpus owns retrieval/selection policy and a generation pointer, not source
  bodies or authorization; its subscription is a declarative acquisition scope,
  never an authority grant;
- a subscription names one exact owner kind/reference and policy generation;
  changing it advances the subscription generation and fences stale acquisition;
- promotion cannot change the source-set or integrity digest being promoted;
- removed or unauthorized Sources are absent even if an index still contains
  stale vectors;
- generated Results and Outputs are ineligible as Sources by default; and
- retrieval insufficiency is a normal result, not an internal failure.

## Operations

Stable operation names are transport-neutral. Commands requiring substantial
work create explicit Project-local durable jobs in their handlers.

| Operation | Kind | Result and key preconditions |
| --- | --- | --- |
| `knowledge.sources.register.v1` | Command | Registers an eligible exact Source version; requires current source-read authority and idempotency |
| `knowledge.sources.mark_changed.v1` | Command | Records a newer exact owner version and classifies affected dependencies/corpora without rewriting history |
| `knowledge.sources.remove.v1` | Command | Marks a version ineligible and advances affected corpus generations |
| `knowledge.sources.acquire.v1` | Durable command | Acquires the owner extraction and materializes windows/vectors/index facts; resumes by stable job/step identity |
| `knowledge.corpora.create.v1` | Command | Creates a bounded Corpus with explicit selection/retrieval policy and compatible embedding Cast |
| `knowledge.corpora.update.v1` | Command | Conditionally changes Corpus name/policies or embedding migration plan under expected revision |
| `knowledge.corpora.set_lifecycle.v1` | Command | Archives/restores or retention-tombstones a Corpus without erasing retained source/evidence lineage |
| `knowledge.corpora.get.v1` | Query | Returns one authorized Corpus definition, current generation and bounded status |
| `knowledge.corpora.list.v1` | Query | Lists authorized Corpus definitions and current generations |
| `knowledge.subscriptions.create.v1` | Command | Adds one declarative owner scope and acquisition policy to a Corpus under a new generation; creates no Job or acquisition work |
| `knowledge.subscriptions.update.v1` | Command | Conditionally changes declarative selection/acquisition policy and fences the prior subscription generation; creates no replacement work |
| `knowledge.subscriptions.remove.v1` | Command | Removes one expected subscription, advances its generation and classifies affected corpus state |
| `knowledge.subscriptions.get.v1` | Query | Returns one authorized subscription, generation and bounded acquisition status |
| `knowledge.subscriptions.list.v1` | Query | Lists authorized subscriptions for an exact Corpus under explicit bounds |
| `knowledge.subscriptions.acquire.request.v1` | Idempotent durable command | Freezes one exact active subscription/Corpus generation, owner scope and acquisition policy and admits one durable acquisition Job |
| `knowledge.subscriptions.acquire.status.get.v1` | Query | Returns bounded safe progress/counts/cursor/failure for one exact subscription-acquisition identity without creating work |
| `knowledge.generations.build.v1` | Durable command | Builds a shadow generation from a pinned source set |
| `knowledge.generations.build.status.get.v1` | Query | Returns one exact candidate generation and build Job state, bounded progress/coverage/watermarks, manifest/integrity metadata and safe failure without building, verifying or promoting |
| `knowledge.generations.verify.request.v1` | Idempotent durable command | Freezes one candidate manifest, active comparison generation and exact verification policy and admits a complete integrity/exact-scan verification Job |
| `knowledge.generations.verify.status.get.v1` | Query | Returns exact verification Job state, coverage/watermarks, report digest and bounded safe findings/failure |
| `knowledge.generations.promote.v1` | Command | Conditionally promotes one unchanged candidate only with its exact ready complete verification identity/report digest |
| `knowledge.retrieve.v1` | Query | Returns exact authorized hits, sufficiency, and audit |
| `knowledge.sources.get.v1` | Query | Returns eligibility, acquisition, active generation, failures, and staleness |

The capability package should expose deterministic functions such as
`ValidateSource`, `BuildWindows`, `PlanEmbeddingBatches`, `RankExactHits`,
`AssessSufficiency`, `ClassifyDirty`, and `VerifyGeneration`. Handlers own
loading, nested provider calls, durable job transitions, transactions, Audit,
and response shaping.

Subscription create/update/remove are declarative metadata mutations with
fixed interactive request classes. They never enumerate the owner scope,
extract content, embed, create a WorkAuthority/Job, or silently schedule a
follow-up. `knowledge.subscriptions.acquire.request.v1` is the only Product
operation that admits acquisition for a subscription generation. Exact replay
returns its stable acquisition/Work/Job identity; replaying the idempotency key
with a different subscription generation, Corpus revision, owner scope or
policy digest conflicts. Its status operation is a read-only Query.

## Consumed and provided ports

Knowledge owns only the narrow interfaces it consumes:

```go
type EmbeddingProvider interface {
    Embed(ctx context.Context, req EmbeddingRequest) (EmbeddingResult, error)
}

type SourceContentProvider interface {
    ReadExact(ctx context.Context, ref SourceRangeRef) (ExactContent, error)
}
```

The handler supplies adapters. `EmbeddingProvider` normally uses bounded nested
dispatch to `intelligence.embed.v1`. `SourceContentProvider` resolves authorized,
immutable bytes through the owning Resource-family handler. Neither adapter
may widen the Cell key, delegation chain, deadline, or budget.

Knowledge provides serializable retrieval contracts to Resolution and Data.
Consumers define their own ports and adapt those ports to
`knowledge.retrieve.v1`; they do not import Knowledge persistence or index
implementations.

## Persistence and concurrency

The Knowledge handler owns narrow repositories for registrations, windows,
embedding receipts, Corpus definitions/subscriptions/membership, generations,
and index projections.
The capability package imports no database or object-store client.

- Source registration is an immutable insert keyed by exact source version.
- Corpus and subscription metadata use expected revisions; subscription
  generation changes fence stale acquisition, and Corpus current-generation
  promotion remains a separate conditional transition.
- Subscription acquisition requests pin the exact subscription generation,
  Corpus revision, owner-scope digest and acquisition-policy digest. Their
  worker pages that frozen scope directly through owner read/extraction ports
  and Knowledge's deterministic ingestion functions under the same one
  acquisition Work/Job; it must not call `knowledge.sources.acquire.v1` or any
  other durable-admission command from inside the Job.
- Generation state advances by expected-state and generation conditional
  updates.
- Candidate construction freezes the candidate generation, source-set manifest,
  embedding/window/index versions and build bounds at admission. Its exact
  read-only build-status Query reports the matching Job/generation, bounded
  source/window/vector progress, coverage/watermarks, candidate manifest and
  integrity metadata, and safe failure. Build status creates no work and is not
  verification evidence or promotion authority.
- Promotion is a short Project transaction that verifies candidate identity
  and its exact complete verification identity/report digest, then swaps the
  active pointer; readers see the old or new generation, never a mixture.
- Generation verification is never a Query that may become expensive. The
  idempotent durable request freezes candidate/active manifests, source-set and
  verification-policy digests, exact-scan bounds and stable Verification/Work/
  Job identities. Its separate status Query writes nothing and reports honest
  coverage, watermarks, report digest and safe failure. A stale, partial or
  differently configured report cannot authorize promotion.
- Ingestion/build workers use leases and fencing tokens. A stale worker cannot
  publish or complete after lease loss.
- Index structures are rebuildable projections. Canonical registration,
  window identities, embedding receipts, and generation manifests remain in
  Project state.
- Cache keys include Project, generation, embedding identity, filters, and
  exact query-vector digest. Correctness passes with caches disabled.
- No global change cursor, event bus, or capability-owned goroutine exists.

The mutation envelope follows D007. Interactive commands check current session
authority and consume a fresh session-sourced permit with their Project-local
effect, idempotency and required Audit.

Effectful durable `knowledge.sources.acquire.v1` and
`knowledge.subscriptions.acquire.request.v1` and
`knowledge.generations.build.v1` and
`knowledge.generations.verify.request.v1` requests additionally preselect stable
acquisition/generation-work identity, `WorkAuthorityID` and `JobID`. Under the
current session, Control creates exact
`DurableWorkAuthority{PendingProjectReceipt}`; one session-permitted Project
transaction stores the intent/current state, exact Job, non-authoritative
receipt, idempotency, required Audit/fact and
`durable_job@1`. Trusted acknowledgement of that exact receipt
alone activates the work.

For subscription acquisition, the stable identity is
`SubscriptionAcquisitionID` plus the frozen subscription/Corpus generation,
`WorkAuthorityID` and `JobID`. Each bounded source/window/embedding/index
commit consumes a fresh permit sourced by that same active WorkAuthority and
matching Job/receipt/generation. Owner-scope or subscription generation change,
removal, cancellation, lease loss or authority revocation fences later pages;
the worker never starts a second durable workflow to finish one page.

Pending authority or a bare receipt cannot issue a permit. Missing Project
state leaves an unusable expiring/revoked orphan; lost acknowledgement
reconciles only after exact receipt verification at the trusted placement.
Every later canonical window/artifact/embedding receipt/generation-manifest or
pointer effect consumes a fresh permit sourced by the active WorkAuthority and
matching Job/receipt/generation. No permit is held while extracting, embedding,
ranking or verifying.

Current-family sign-out preserves explicitly admitted Knowledge work;
User-wide, grant/policy/entitlement, cancel/expiry or explicit revocation denies
and fences later effects. `durable_job@1` may only terminalize exact Job
bookkeeping; success requires prebound proof that the ordinary Knowledge effect
already settled. It cannot change Knowledge state, read a provider, acquire/
index a Source, publish/promote a generation, enqueue work or widen authority.
Capability state must commit under a fresh permit before revocation or remain
nonterminal.

## Security, privacy, and errors

Retrieval is authorized twice: the handler validates the requested corpus and
Source scope, and returned candidates are re-filtered against current Source
eligibility/authority before exact content is admitted. Index possession never
grants access. Source text, query text, vectors, and provider payloads are not
placed in required Audit, logs, metrics, or arbitrary errors.

Stable capability details map to kernel categories:

| Detail | Category |
| --- | --- |
| malformed filters, dimensions, or bounds | `invalid_argument` |
| source/corpus not visible | `not_found` without existence disclosure |
| unsupported window/index/embedding version | `unsupported_version` |
| candidate generation or verification input changed | `conflict` |
| verification incomplete, partial, stale or policy-mismatched | `precondition_failed` |
| source bytes or digest do not match | `integrity_failure` |
| no adequate support | successful `insufficient` result |
| provider/index temporarily unavailable | `temporarily_unavailable` |
| deadline/budget exhausted | `deadline_exceeded` / `rate_limited` |

Unknown source schema, generation state, embedding identity, or integrity
metadata fails closed. A last-good active generation may continue serving
authorized retrieval when a rebuild fails, with explicit degraded status.

## Cross-capability contracts

- The owning Resource family owns the exact body and eligibility; Knowledge
  owns Source registration and the retrieval representation.
- Intelligence embeds bounded text but knows nothing about Sources, corpora,
  scores, or evidence.
- Resolution owns semantic planning, sealed EvidenceSets, contradictions, and
  synthesis; it consumes exact Knowledge hits.
- Formula cannot call Knowledge, directly or indirectly.
- Data Catalog may project Knowledge status and lineage but cannot authorize or
  become evidence.
- Activity may report semantic ingestion/promotion/failure facts without
  content. Realtime may carry only a committed invalidation/status hint.
- Canonicalizing a generated Output is a later explicit Source command and
  cannot feed the run that produced it.

## Headless proof plan

Completion requires tests that run without a browser:

1. Golden deterministic window identities across repeats and supported Go
   platforms.
2. Exact Source/version/range/quote-hash retrieval from a small corpus.
3. Explicit insufficient result with no plausible unsupported fallback.
4. Source update/remove invalidates exact dependencies and classifies hard vs
   soft dirty correctly.
5. Corpus create/update/archive and subscription create/update/remove/get/list
   preserve exact owner scope, fence stale acquisition, create no hidden work,
   and never grant access. Subscription acquisition request/status proves
   stable Work/Job identity, exact/divergent replay, frozen scope/policy,
   crash/resume, lease/revocation fencing, direct bounded page commits and no
   nested durable admission.
6. Shadow build is invisible until verified promotion; its exact read-only
   build-status Query reports the matching candidate/Job, progress, coverage,
   watermarks, manifest/integrity metadata and safe failure without creating
   work or authorizing promotion. Durable verification request/status separately
   freezes exact inputs and reports complete coverage/digest; crash and stale
   lease cannot publish a partial report or generation, and promotion rejects
   partial/stale/policy-mismatched verification.
7. Exact scan and index path satisfy the same authorization and hit-integrity
   contract.
8. Generated output is rejected as a Source unless explicit canonicalization
   creates a new normal Source version.
9. Cross-Project and revoked-User retrieval attempts disclose nothing and a
   stale permit cannot commit.
10. Embedding batch retry is idempotent and a mismatched replay conflicts.
11. Race, cancellation, budget, corrupted digest, unsupported-version, cache-
    disabled, backup/restore, and rebuild equivalence proofs.

The initial product proof is: ingest a text Source, retrieve exact spans with
citations for a Document Prompt Block, update the Source, observe dirty state,
and reproduce the prior run from its pinned evidence while retained.

## Source grounding

- [SOL X 43 — Knowledge / KLR](https://app.notion.com/p/39ab6410e5028128ae01f244131c035a)
- [Original Knowledge construction](https://app.notion.com/p/393b6410e50281a584e7cebba0281402)
- [SOL Y Developer Guide](https://app.notion.com/p/39ab6410e50281928025cdf64f09426d)
- [Omega capability model](../architecture/capability-model.md)
- [Omega persistence and concurrency](../architecture/persistence-and-concurrency.md)
- [Omega jobs, Audit, and observability](../architecture/jobs-audit-observability.md)

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
Nova working legacy evidence includes the source/artifact/lattice model in
[`internal/knowledge/model.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/model.go),
Document ingestion in
[`ingest.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/ingest.go),
retrieval/exact-scan audit in
[`retrieve.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/retrieve.go),
and removal/staleness in
[`source_ledger.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/source_ledger.go).
Project-durable multi-family Sources, governed sufficiency, shadow-generation
operations and production rebuild/recovery remain target-only.
