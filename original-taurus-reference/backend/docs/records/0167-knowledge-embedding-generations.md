# Establish Knowledge embedding-space generations

Ω-005 starts from `559748b5337f5125c53be96ab7258bd68422abab` on
`main`. Ω-001, Ω-003, and Ω-004 are present as records 0162, 0165, and 0166,
including their executable baseline, bounded Knowledge admission, and enforced
ports-and-adapters graph.

## `core/capability/knowledge`

### Make vector comparability immutable Project state

`EmbeddingSpace` canonically identifies provider, model, dimensions,
normalization, vector format, schema version, and KLR algorithm by SHA-256.
`ProjectLatticeState` names one active Text generation, a pointer revision, and
a monotonically increasing source cursor. Adds, replacements, removals, queries,
and corpus rebuilds resolve and operate through that generation.

Ordinary reconciliation may initialize an empty Project, but it may not change
an established space. Configuration drift returns
`knowledge.embedding_space_change_required`; active retrieval uses the retained
generation's exact provider/model instead of the deployment's current alias.
Every write verifies source, window, and node dimensions/identity before its
active-generation transaction.

### Build a durable, operator-controlled shadow lifecycle

The capability exposes owner-authorized preview, idempotent start, status,
pause, resume, cancel, explicit promote, and bounded rollback operations.
Previews freeze the target space, source cursor, size/vector/token/request
estimate, unsupported items, hard policy, actor, and expiry. Runs retain their
source manifest watermark, target generation, checkpoints, attempts, source
failures, usage, request count, provider-reported cost, validation, and error
state.

Workers reauthorize the actor, read each current canonical source through an
injected adapter, rebuild it into an isolated generation, and atomically commit
the shadow artifacts with the checkpoint and accounting receipt. A retry of the
same source/version is idempotent. Full re-enumeration catches replacements and
removals; a final source-cursor gate prevents a missed change. Hard source,
byte, vector, prompt-token, request, cost, and exact Ω-003 artifact budgets fail
the run without changing the active pointer.

Startup recovery requeues interrupted running/validating work, settles pause
requests, and preserves terminal work. Promotion repeats owner authorization
and atomically commits the pointer CAS, old/new generation states, run state,
rollback deadline, and generation event. Rollback performs the inverse CAS
within seven days only when no source change followed promotion. Artifact
cleanup remains separated from the pointer transaction, so promotion never
destroys its recovery generation.

### Certify retrieval and immutable evidence

Every retrieval captures an active `ReadToken`, embeds in its exact space, and
reads all candidates and literal evidence through a generation-pinned store
view. Hydration verifies source/window presence, project/identity/dimensions,
finite vectors, ranges, exact `end-start` text, block spans, block coverage,
overlap bytes, graph membership, node levels, counts, and centroids. Missing or
malformed data fails closed as `knowledge.evidence_corrupt`.

A replacement or generation switch between ranking and hydration invalidates
the token. Retrieval retries the complete operation once; a second race becomes
`knowledge.evidence_changed`. Returned regions now retain generation ID,
indexed source revision/hash, and all contributing window IDs. Agent and
Document evidence models preserve those fields rather than weakening the
provenance at their boundaries.

The source cursor advances transactionally for add, update, and remove; removal
also writes a durable tombstone. Pointer changes invalidate currentness through
the state revision and durable generation event.

### Close ING-5 and ING-6 with executable evidence

The scale certification fixture pins Project, Connector, source, embedding, and
KLR configuration identities for 64 Connector sources and builds independent
stores. Its certified lattice hash is
`a103d414b6c0e0c89f1784cc44c3a383598d269cfe3fa010e6e7e99a2ed94bac`.

Regression coverage proves that configured drift cannot mix the active space,
the old exact space remains queryable, a complete shadow can promote and roll
back, a concurrent replacement is caught up before promotion, over-budget and
cancelled work leave the active token unchanged, checkpoint recovery is
idempotent, and replacement during evidence hydration cannot emit stale,
shortened, or mixed citations. ING-5 and ING-6 are closed.

## Intelligence and composition adapters

### Route exact spaces without importing provider details

Intelligence adds `EmbeddingRoute` and `EmbedExact`. The production Knowledge
adapter uses the configured route for drift reporting and the generation-frozen
provider/model for ordinary queries and migration work. It propagates
provider/model/dimensions plus prompt/total tokens, request count, and cost.
OpenRouter's provider-reported `usage.cost` is retained when available.

Wiring supplies current-owner authorization, Resource/Document/Connector/File
snapshot readers, the durable re-embed job handler, and startup recovery.
Production readiness requires these late-bound ports. Workers never log source
content or credentials.

## Handlers and transport

### Add an explicit owner operation surface

The project-scoped development surface now includes:

- `POST /dev/knowledge/reembed/preview`
- `POST /dev/knowledge/reembed/runs`
- `GET /dev/knowledge/reembed/runs/:runID`
- `POST /dev/knowledge/reembed/runs/:runID/{pause,resume,cancel,promote}`
- `POST /dev/knowledge/reembed/rollback`

Each operation derives Project and actor from trusted request scope. Stable
Knowledge lifecycle failures retain `knowledge.*` codes and deliberate HTTP
statuses; no source content, provider detail, or hidden Resource existence is
returned.

## SQLite persistence and migration

### Scope every lattice artifact to a generation

All seven artifact authorities (`knowledge_sources`, `knowledge_windows`,
`knowledge_nodes`, `knowledge_memberships`, `knowledge_corpus_state`,
`knowledge_corpus_index`, and `knowledge_corpus_edges`) use generation-composite
keys. Every adapter query is generation-filtered. New durable authorities store
embedding spaces, generations, active state/cursor, source changes,
re-embed previews/runs/checkpoints, and generation events.

Active writes and removals use immediate transactions to apply exact admission,
artifacts, corpus invalidation, source cursor, tombstone, and generation counts
together. Shadow checkpoint/artifact/accounting commits are likewise atomic.
Promotion and rollback atomically change the pointer and append their audit
event, eliminating the post-pointer/pre-outbox crash gap.

### Upgrade valid legacy data and quarantine ambiguity

Startup rebuilds the seven legacy artifact tables into generation-keyed shapes.
A legacy Project becomes generation 1 only when every stored identity is
homogeneous, valid, dimension-correct, and its encoded vectors are structurally
valid. Mixed, corrupt, or identity-less Projects are retained as
`reembed_required`: they are not queryable or writable, but their source
manifest remains available as an authorized full-repair base. No ambiguous
vector set is blessed active.

The migration is additive around lifecycle authorities and a transactional
table rebuild for derived artifacts. Rollout is a single-binary replacement.
Rollback to pre-Ω-005 code is not schema-compatible after migration; operational
rollback is therefore application restore plus database backup restore. The
active data path itself remains reversible through the seven-day generation
rollback operation.

## Documentation and completion evidence

The Knowledge overview, lifecycle, retrieval, Intelligence adapter description,
persistence model, runtime model, issue register, backend operator guide,
generated route/persistence inventories, and Ω completion matrix now describe
the generation-controlled implementation. Archived companion documents remain
historical and were not regenerated.

Caller-aware general Knowledge filtering remains owned by Ω-009, and automatic
Document-to-Text publication remains owned by Ω-016. Provider price discovery
is not inferred: preview cost is advisory and may be zero when no configured
price is known, while the hard monetary budget always uses durable
provider-reported cost.

## Security, privacy, and operations

- Preview, start, status/control, promotion, and rollback require a current
  Project owner; workers reauthorize at execution and promotion.
- Canonical source acquisition rechecks Resource access before I/O and is
  revision-bound. Revoked, removed, changed, unsupported, or oversized sources
  fail closed or are caught up.
- Source text, credentials, model secrets, and hidden existence are absent from
  lifecycle events and stable failures.
- Durable run status exposes progress, source totals, bytes, vectors,
  token/request/cost accounting, catch-up cursor, validation, and bounded error
  codes. Generation events provide the publication/rollback audit cursor.
- The previous complete generation is retained through its rollback TTL.
  Destructive artifact garbage collection is deliberately deferred until after
  the recovery gate and is never part of promotion.

## Acceptance evidence

- Lifecycle: Memory and SQLite generation/CAS/cursor/promotion/rollback tests.
- Recovery: queued/running/pausing checkpoint recovery and idempotent receipt
  tests.
- Concurrency: concurrent active admission, migration catch-up, source removal,
  promotion cursor CAS, and deterministic ranking/hydration replacement tests.
- Integrity: dimension, finite-vector, graph, source/window/range/block/overlap,
  missing-content, and evidence-token failures.
- Migration: fresh schema, homogeneous legacy generation-1 upgrade,
  mixed/corrupt quarantine, and quarantine repair-base tests.
- Reproducibility: pinned 64-source cross-store certified hash.
- Boundaries: exact Intelligence routing, owner and current-source adapters,
  stable handler failures, operation classification, and architecture gate.
- Repository: format, build, complete test/race baseline, and credential-free
  development suites.

## Verification

- `./scripts/check-architecture.sh`
- `./scripts/check-format.sh`
- `go build ./...`
- `go test ./...`
- `go test -race ./core/capability/knowledge ./core/platform/storage/sqlite ./core/wiring ./core/handlers/knowledge ./core/capability/intelligence`
- `./scripts/acceptance/omega-baseline.sh`
- `./dev-test/run.sh free`
- `./dev-test/knowledge/run.sh`
- `./dev-test/knowledge-scale/run.sh`

The complete repository baseline and credential-free black-box group passed.
The live Knowledge quality suite passed with 207 embedding tokens and an
estimated cost of `$0.000004`. The 596-file, 6.0 MiB live scale suite passed
initial sync, sparse corpus construction, three grounded probes, and one-file
repair with 1,208,533 embedding tokens and an estimated cost of `$0.024171`.
Provider cost remained visible in every operation response.
