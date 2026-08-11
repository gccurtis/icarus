# Resolution capability

## Purpose, ownership, and boundary

Resolution turns a persistent, versioned instruction into a grounded Result
backed by an exact sealed EvidenceSet. An owning Resource family then settles
an editable native Output at its stable mount. Resolution is a Project-bound
capability library; it is not a chat completion wrapper, search engine, or
generic write coordinator.

Resolution owns Resolvables, runs, plans, EvidenceSets, Results, claims,
citations, dependencies, contradiction records and decisions, dirty causes,
refresh policy, and current/last-good Result pointers.

Resolution does not own the editable Output, Resource transaction, Knowledge
index, Source body, provider route, Formula evaluation, authorization, Memory,
or browser Prompt Block. A model may identify conflicts; it may not decide
truth or silently choose precedence.

## Feature contract

| Feature | Required behavior | Initial boundary | Retained breadth |
| --- | --- | --- | --- |
| Stable Resolvable | Versioned instruction, expected answer schema, scope subscriptions, policy, and family mount | Document Prompt Block | Workbook Cells/Ranges, Deck placeholders, Board widgets, saved outputs |
| Planning | Produce bounded semantic subqueries and filters; no direct Project search | One planner cast | Multi-stage plans and specialized planners |
| Sealed evidence | Reauthorize and pin exact Source/version/component/range/quote-hash hits | Text evidence | Structured fields, regions, and multimodal evidence |
| Contradictions | Record material conflicts, applicability, impact, and user-governed decisions | Pause on material conflict | Scoped precedence policies and impact graph |
| Result | Validate answer schema, claims, citations, dependencies, route receipts, and run provenance | Text answer with citations | Typed/structured results and family-specific render forms |
| Settlement | Return a settlement proposal; the Resource family atomically creates/updates editable Output | Document output revision | All standing mounts |
| Last good | Failed refresh preserves the last-good Output/Result and exposes failure separately | Required | Policy-controlled history and selective rollback |
| Dirty state | Hard dirty for exact dependency change; soft dirty for eligible subscribed-scope change | Manual refresh | Selective automatic refresh policies |
| Refresh | Ordinary refresh preserves user edits; force refresh previews replacement and never silently discards work | Manual/force | Scheduled and policy-triggered refresh |
| Pause/resume | Durable run can pause for conflict, review, approval, budget, or provider recovery | Conflict/review | Rich human checkpoints |
| Canonicalization | Explicitly publish an Output as a later normal Source; never self-feed the producing run | Manual | Governed batch publication |

## Domain model and states

```text
Resolvable {
  resolvable_id, owner_resource_id, owner_component_id, instruction_version,
  instruction, answer_schema, subscriptions, refresh_policy, state,
  current_result_id?, last_good_result_id?
}

ResolutionRun {
  run_id, resolvable_id, observed_instruction_version, state, attempt,
  plan_id?, evidence_set_id?, route_receipts, started_by, started_at,
  pause_reason?, failure?
}

RetrievalPlan {
  plan_id, semantic_queries[], filters, limits, rationale_digest
}

EvidenceSet {
  evidence_set_id, sealed_at, items[], source_set_digest,
  knowledge_generations, authorization_generation, integrity_digest
}

EvidenceItem {
  source_id, version_id, component_id, range, quote_hash,
  admitted_excerpt, retrieval_audit
}

Contradiction {
  contradiction_id, claim_key, evidence_items[], materiality,
  state, decision_id?
}

Result {
  result_id, run_id, answer, answer_schema_version, claims[], citations[],
  dependencies[], result_digest, state
}

SettlementProposal {
  resolvable_id, expected_owner_version, result_id, output_projection,
  replacement_policy, provenance
}

DependencyChange {
  dependency_change_id, owner_kind, owner_id, component_id?,
  prior_exact_version?, current_exact_version?, change_kind,
  owner_change_digest, reconciliation_generation, work_authority_id,
  job_id, state, cursor?, counts
}
```

Run states are `queued`, `planning`, `retrieving`, `sealing`,
`checking_contradictions`, `reasoning`, `validating`, `awaiting_resolution`,
`awaiting_review`, `settling`, `succeeded`, `failed`, `canceled`, and
`superseded`. State transitions require the expected state/generation. Terminal
run history is immutable.

Resolvable display state is derived and always names one of `current`,
`dirty`, `resolving`, `failed_with_last_good`, `needs_resolution`, or
`unresolved`. It is not a browser-only status.

Invariants:

- every citation resolves to one item in the sealed EvidenceSet;
- every admitted item was authorized and integrity-checked at seal time;
- a Result cannot cite a Source version outside its EvidenceSet;
- the current pointer advances only after Resource-family settlement commits;
- a failed run cannot erase last-good Result/Output;
- a material unresolved contradiction prevents settlement;
- user edits to an Output are distinct from the Result that seeded it; and
- no run may retrieve content generated by that same run.

## Commands and queries

| Operation | Kind | Behavior |
| --- | --- | --- |
| `resolution.create_resolvable.v1` | Command | Creates a stable mount-bound definition with exact instruction/schema version |
| `resolution.update_resolvable.v1` | Command | Conditionally changes instruction/subscriptions/policy and marks affected state dirty |
| `resolution.start.v1` | Durable command | Creates or reuses an idempotent run and its durable job |
| `resolution.resume.v1` | Durable command | Resumes an expected paused run after review/decision |
| `resolution.cancel.v1` | Command | Requests bounded cancellation without corrupting last-good state |
| `resolution.record_contradiction_decision.v1` | Command | Records attributable, versioned, scoped resolution policy or one-time choice |
| `resolution.dependency_changes.reconcile.v1` | Idempotent internal admission command | In the live-session owner mutation, atomically records one exact dependency change plus its pre-admitted Resolution Work/Job/receipt; never starts a second Job |
| `resolution.dependency_changes.apply_page.v1` | Internal settlement command | Conditionally records one bounded page of typed hard/soft dirty causes against exact dependency-index and reconciliation generations |
| `resolution.dependency_changes.status.get.v1` | Query | Returns bounded progress/counts/failure for one exact dependency-change reconciliation without owner content |
| `resolution.preview_refresh.v1` | Query | Computes dependency/Output impact without mutation |
| `resolution.force_refresh.v1` | Durable command | Starts a replacement candidate; requires explicit consequence acknowledgement |
| `resolution.get.v1` | Query | Returns definition, derived state, current/last-good, and safe failure summary |
| `resolution.get_run.v1` | Query | Returns bounded stage/provenance/status |
| `resolution.get_evidence.v1` | Query | Returns authorized exact evidence/citations for inspection |
| `resolution.list_history.v1` | Query | Returns immutable Result/run history and Output settlement links |
| `resolution.canonicalize_output.v1` | Command | Delegates explicit publication to Source ownership with lineage |

The library exposes validation and transformation primitives plus a bounded
orchestrator over consumer-owned ports. Durable step/checkpoint transitions and
all storage are handler responsibilities.

## Consumed and provided ports

Resolution defines the minimum interfaces it consumes:

```go
type SemanticPlanner interface {
    Plan(ctx context.Context, req PlanRequest) (PlanResult, error)
}
type EvidenceRetriever interface {
    Retrieve(ctx context.Context, req RetrievalRequest) (RetrievalResult, error)
}
type GroundedReasoner interface {
    Start(ctx context.Context, req ReasoningStart) (ReasoningTurn, error)
    Continue(ctx context.Context, req ReasoningContinue) (ReasoningTurn, error)
}
type ContradictionReader interface {
    Relevant(ctx context.Context, req ContradictionQuery) (ContradictionSet, error)
}
```

Handler adapters satisfy these via bounded nested operations to Intelligence
and Knowledge. Reasoning tool calls may read only already admitted exact
evidence or other explicitly declared, authorized, version-pinned inputs. The
reasoner never receives an unbounded Project-search tool.

Resource families own ports such as `PromptResolutionProvider`. Their handler
adapter invokes Resolution and accepts a `SettlementProposal`; the family
validates its mount and commits the editable Output. This direction prevents
Resolution from importing Documents, Workbooks, Decks, or Boards.

## Persistence and concurrency

Handlers own repositories for definitions, runs, checkpoints, plans, sealed
evidence, contradiction decisions, Results, dependencies, and pointers.

- Definitions use an aggregate revision and conditional update.
- Runs are immutable identities plus expected-state transitions and durable
  job leases/fences.
- EvidenceSets and Results become immutable once sealed/succeeded.
- Current/last-good pointers advance conditionally against the observed
  definition and owner Resource versions.
- The owning Resource commits Output state under its own concurrency protocol.
  Document Output, for example, is a normal Document ChangeSet.
- A cross-domain illusion is forbidden: Result settlement and Resource Output
  may use a durable state machine if they cannot share a Project transaction,
  with idempotent recovery and explicit intermediate state.
- Duplicate start/resume/settle requests return the same recorded result when
  the canonical input digest matches; mismatched replay conflicts.

Dependency change intake is explicit and idempotent, with one durable workflow
only. While the initiating session is still live, the owning Resource or Source
handler preselects `DependencyChangeID`, reconciliation generation,
`WorkAuthorityID` and `JobID` and obtains the pending Control work authority.
Inside the same Project transaction as the exact owner mutation, its bounded
handler adapter invokes `resolution.dependency_changes.reconcile.v1` to store
the exact prior/current versions, immutable owner-change digest, Resolution
reconciliation intent, the one Job, non-authoritative receipt, idempotency,
required Audit/fact and finalization record. It does not enqueue an owner Job
whose worker later calls another durable command.

After trusted receipt acknowledgement activates that exact WorkAuthority, the
single worker rereads the immutable exact owner change through a consumer-owned
port and pages the dependency index directly. It uses
`resolution.dependency_changes.apply_page.v1` to write bounded typed dirty
causes under fresh work-sourced permits matching the same Job/receipt/
generation. A page is conditional on the dependency-index and reconciliation
generations; stale pages cannot mark a newer definition. Exact owner-mutation
replay returns the same reconciliation/Work/Job identities, recovery continues
from the committed cursor, and a failed owner transaction leaves only an
unusable pending Control orphan for expiry. There is no implicit event
subscription or job-to-command-to-job chain.

There is no global event cursor, hidden mailbox, or capability goroutine.
Durable jobs are reconstructed by the Host and call the same versioned handler
operations under trusted Cell scope and fresh authority.

`resolution.start.v1`, every admitted `resolution.resume.v1`, and
`resolution.force_refresh.v1` preselect stable `ResolutionRunID`, run
generation, `WorkAuthorityID` and `JobID`. Under the initiating current session,
Control creates exact `DurableWorkAuthority{PendingProjectReceipt}`; a fresh
session-sourced permit commits the run transition, exact Job,
non-authoritative receipt, idempotency, required Project Audit/fact and
`durable_job@1`. Trusted acknowledgement of that exact receipt
alone activates the work.

Dependency reconciliation follows the same ordinary durable-work protocol, but
admission occurs inside the live-session owner mutation described above. The
owner transaction is the single Project receipt for stable
`DependencyChangeID`, reconciliation generation, `WorkAuthorityID` and
`JobID`; the internal admission operation is not a permit source and its worker
cannot admit replacement work.

Pending authority and a bare Project receipt cannot issue a permit. Missing
Project state leaves an unusable expiring/revoked orphan; lost acknowledgement
reconciles only from exact trusted receipt verification. Each later canonical
checkpoint, Evidence seal, Result seal, dependency/pointer, or owner-settlement
proposal consumes a fresh permit sourced by the active WorkAuthority and
matching Job/receipt/generation. Provider-call admission separately precommits
`intelligence_reservation_call@1`; no permit is held during retrieval or
inference.

Current-family sign-out preserves the explicitly admitted run; User-wide,
grant/policy/entitlement, cancel/expiry or explicit revocation denies/fences
later effects. `durable_job@1` may only terminalize exact Job bookkeeping and
cannot change Resolution state; the Intelligence finalizer may settle only its
exact spent call/reservation. Neither can retrieve, invoke/retry a provider,
seal a Result, advance pointers, incorporate Resource output, enqueue work or
widen authority. Capability state must commit under a fresh permit before
revocation or remain nonterminal.

## Security, privacy, and errors

Every stage inherits immutable User/Project scope, actor/delegation, deadline,
budget, idempotency lineage, and trace. Source authority is rechecked when
sealing and again when evidence is displayed. A prior Result may remain
historical while its evidence becomes inaccessible; queries then redact rather
than leak former access.

Prompts, evidence text, model inputs/outputs, and contradiction contents are
not written to required Audit or general logs. Audit records safe identities,
operation, policy/authority generations, decision, and outcome. Provider
payloads remain inside Intelligence adapters and governed receipts.

Stable details include:

- `instruction_invalid` / `answer_schema_invalid` -> `invalid_argument`;
- `evidence_insufficient` -> successful needs-resolution state;
- `material_contradiction` -> successful `awaiting_resolution` state;
- `evidence_changed` / `owner_advanced` -> `conflict`;
- `evidence_integrity_failure` -> `integrity_failure`;
- `authority_changed` -> `stale_authority`;
- provider/index outage -> retryable `temporarily_unavailable` with last good;
- unsupported run/schema/cast version -> `unsupported_version`; and
- budget/depth/cycle violations -> `rate_limited` or `precondition_failed`.

Force refresh and contradiction decisions require explicit consequences and a
fresh permit at commit. Revocation stops new permits; old permits cannot commit
after revocation becomes effective.

## Cross-capability contracts

- Knowledge supplies exact hits and sufficiency; it does not plan or synthesize.
- Intelligence executes semantic casts; it does not retrieve, authorize,
  choose truth, or execute tools.
- The Resource family owns the native mount, editable Output, and settlement
  transaction. Resolution owns Evidence and Result.
- Formula may read an already committed exact Result through a consumer
  resolver; evaluation never starts or refreshes Resolution.
- Data Catalog projects Result/run/dependency state but owns none of it.
- Collaboration anchors comments to stable mount/Output components, never
  rewrites Result evidence.
- Activity and realtime derive only from committed state and carry no evidence
  bodies. Memory never becomes Evidence or contradiction authority.

## Headless proof plan

1. Golden full run: plan, vectorize, retrieve exact spans, seal, reason,
   validate, settle a Document Output, and inspect citations.
2. Planner cannot access Project search or undeclared tools; Intelligence never
   executes requested tools.
3. Citation/reference validation rejects invented Source versions, ranges, and
   quote hashes.
4. Insufficient evidence and material contradiction pause without fabricated
   output or loss of last good.
5. Ordinary refresh preserves user edits; force refresh produces an explicit
   replacement preview and requires acknowledgement.
6. Exact dependency change yields hard dirty; eligible scope change yields
   soft dirty; unrelated change yields neither. Exact replay, crash/resume,
   stale dependency-index pages, and duplicate delivery preserve one
   reconciliation and never erase last good. Owner-transaction fault injection
   proves exactly one pre-admitted Resolution Work/Job/receipt, no intermediate
   owner follow-up Job, direct page settlement, lost-ack recovery and no
   job-to-durable-command-to-job chain.
7. Crash/restart at every durable stage resumes idempotently; lease loss fences
   stale completion.
8. Concurrent owner edits cause conditional settlement conflict and bounded
   retry/preview rather than last-write-wins.
9. Cross-Project evidence substitution, revoked access, stale permit, and
   replay all fail closed without existence disclosure.
10. Result reproduction from pinned versions, schema-version rejection,
    cancellation, budget exhaustion, race, backup/restore, and redaction tests.

The initial completion proof is a Document Prompt Block with grounded current
Output, citation inspection, dirty refresh, failed-with-last-good behavior,
user-edit preservation, and explicit insufficient/conflict states through the
CLI/lab path.

## Source grounding

- [SOL X 33 — Standing Resolution](https://app.notion.com/p/39ab6410e50281f09729f532db04791c)
- [SOL X 34 — Contradictions, Decisions, Pause & Resume](https://app.notion.com/p/39ab6410e502813abfb2d4539404b237)
- [SOL X 35 — Retrieval Planning & Bounded Reasoning](https://app.notion.com/p/39ab6410e502810492e5e6245c0bfe97)
- [SOL Y Developer Guide](https://app.notion.com/p/39ab6410e50281928025cdf64f09426d)
- [Omega request dispatch](../architecture/request-dispatch.md)
- [Omega persistence and concurrency](../architecture/persistence-and-concurrency.md)

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
the working legacy
[`internal/document/promptblock`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/promptblock)
proves draft/resolve/refresh/dirty/failed lifecycle, grounded source references,
editable versus generated display, bounded history and last-good preservation.
Nova does not prove the complete Resolution aggregate, sealed EvidenceSets,
contradiction decisions, durable pause/resume, separate endpoint contracts or
Product-authorized settlement; those are target-only.
