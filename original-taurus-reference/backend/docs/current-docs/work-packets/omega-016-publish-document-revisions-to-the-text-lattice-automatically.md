---
title: "Execute Ω-016 — Publish Document revisions to the Text lattice automatically"
packet_id: "Ω-016"
status: "ready-for-execution"
wave: "Wave 1 — Close the Project runtime"
depends_on: "Ω-002, Ω-003, Ω-004, Ω-005, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015"
source_mirror: "docs/current-docs/notion/work-packets/omega-016-publish-document-revisions-to-the-text-lattice-automatically.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-016 — Publish Document revisions to the Text lattice automatically

## Mission

Make every committed, caller-authorized Document revision discoverable through the Text lattice without a manual ingestion step. Document writes stay fast and canonical: the same transaction that commits a revision records an idempotent publication outbox entry; a Project-scoped job extracts a deterministic text projection and advances Knowledge asynchronously. Failures retry visibly and never roll back or corrupt the Document. Create, change, undo, redo, import, duplicate, template materialization, restore, trash, and purge all have defined publication behavior. Alpha can create or edit a Document, wait for its published revision, then Ask against it entirely through backend contracts.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-002, Ω-003, Ω-004, Ω-005, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015**.

Source dependency statement: Ω-002 through Ω-005 and Ω-009 through Ω-015

No later-packet integration gate was detected in the source dependency statement.

Start only after every hard predecessor is present on `main`. If a predecessor is intentionally being developed in parallel, do not guess across its contract: stop until it lands on `main` or request an agreed interface.

## Authority order

When sources disagree, use this order:

1. The latest explicit product decision from the user.
2. The current Primary documents under `docs/current-docs/notion/primary/`.
3. This execution directive and the packet-specific implementation specification below.
4. Current code, tests, migrations, and as-built architecture records on the actual starting `main`.
5. Supporting documents and frozen historical links.

`AGENTS.md` remains authoritative for repository workflow. The SHA in this file is the planning baseline, not an instruction to reset: always begin from the latest approved `main` that contains the required predecessors, and record the actual starting SHA.

## Required reading before editing

- `AGENTS.md` — repository rules; this is authoritative for workflow, validation, and documentation records.
- `docs/current-docs/README.md` — authority model and corpus layout.
- `docs/current-docs/notion/work-packets/omega-016-publish-document-revisions-to-the-text-lattice-automatically.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/document/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/knowledge/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/document/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/knowledge/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/sqlite_document*.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/sqlite_publication*.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/document_knowledge.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `dev-test/document-knowledge/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/superpowers/specs/2026-07-29-resilient-ingest-design.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

Follow links inside the embedded specification when they resolve to additional local mirrors. Search the current repository for every type, route, table, tool, and invariant named below; do not rely on an old path or assume absence without checking.

## Preflight

Before changing code:

1. Record the starting `main` HEAD SHA, merged predecessor packets, and relevant existing records.
2. Reproduce or characterize the current gap with a focused test, probe, route inventory, or schema inspection.
3. Compare the packet against current code. Preserve correct partial implementations and delete or migrate only what the specification makes obsolete.
4. Identify the capability owner, its inbound ports, outbound ports, adapters, durable state, authorization point, transaction boundary, and observability boundary.
5. Confirm every proposed third-party dependency is free/open-source, pinned, and compatible with product distribution. Prefer the standard library or existing dependencies.
6. Write the smallest ordered implementation plan that can land without leaving accepted-but-unusable intermediate states.

If the gap is already fully closed, do not manufacture changes. Prove it with the required tests/evidence, reconcile stale documentation, and produce the normal change record and a verified commit on `main`.

## Execution contract

- Stay inside this packet's scope and explicit prerequisites. Do not opportunistically implement later packets.
- Preserve the modular-monolith, ports-and-adapters boundary. User Cells and per-user Project Subcells are logical runtime scopes; durable database state, revisions, CAS/idempotency, jobs, and outbox/change streams are correctness authorities.
- Enforce authorization at the owning application service/store boundary, not only in HTTP handlers. Reads, listings, search, events, history, jobs, and model/tool hydration must be caller-aware.
- Make durable mutations atomic at the stated aggregate boundary. Couple canonical state and required outbox/audit/idempotency writes in one transaction where the specification requires it.
- Keep retries, pagination, resource limits, concurrency, shutdown, and failure behavior explicit and bounded. No correctness may depend on sticky routing or one in-memory cell.
- Add or update typed errors and stable wire mappings without leaking hidden resource existence or secrets.
- Prefer focused tests first, then implementation, then broader integration, race, recovery, and load evidence required by the specification.
- Do not add placeholder handlers, no-op adapters, unbounded defaults, silent fallbacks, or TODO-only completion.
- Do not create companion `.go.md` files; that convention is retired. Add the numbered change record required by `AGENTS.md`.

## Decision authority

You may decide internal naming, package decomposition, private helper design, migration mechanics, indexes, test fixtures, and the exact FOSS library when the packet leaves those open. Choose the smallest production-grade option consistent with existing conventions. Record every material choice and rejected alternative in the change record.

Stop and ask for direction before proceeding if any choice would:

- contradict a settled Product/Primary architecture decision or another merged packet;
- weaken tenant, user, organization, project, or resource privacy boundaries;
- introduce destructive or irreversible migration without a tested rollback/restore path;
- add a non-FOSS, source-available-only, or materially costly external dependency/service;
- change a public contract outside this packet or make a later packet impossible;
- require guessing an unmerged predecessor's interface; or
- make an acceptance criterion impossible or only cosmetically satisfied.

## Validation and evidence

Run the narrowest relevant tests while iterating. Before commit, run the repository gates from `AGENTS.md`:

```bash
./scripts/check-format.sh
go build ./...
go test ./...
```

Also run every packet-specific test, race test, integration test, migration test, recovery test, load test, or live-provider certification required below. Live-provider tests may be skipped only when the required credential is unavailable; report the skip, fixture coverage, token/cost estimate where applicable, and the exact command for a credentialed rerun. Never claim a skipped gate passed.

Review the final diff for secret leakage, hidden-resource inference, unsafe logs, accidental broad scope, stale generated files, and unclassified dependencies.

## Required deliverables

1. Production implementation and migrations/adapters required by the specification.
2. Focused and broad automated tests proving the acceptance criteria.
3. API/schema/error/operations documentation actually changed by the implementation.
4. One new numbered `docs/records/NNNN-<slug>.md` record describing baseline, decisions, files, tests, operational effects, and remaining risks.
5. A commit scoped to this packet, pushed directly to `origin/main`.

The change record and completion handoff must state:

- actual baseline SHA and prerequisite packet status;
- outcome and user-visible/operational behavior;
- architecture and data-model decisions;
- migrations, compatibility, rollback, and rollout notes;
- security/privacy analysis;
- tests and exact commands/results, including skips;
- observability and operator impact;
- unresolved risks or follow-up packets; and
- a checklist mapping every acceptance criterion below to code/tests/evidence.

## Completion response

Return a concise handoff containing: commit SHA, changed areas, test results, migration/rollout notes, record path, and any explicit residual risk. Do not report this packet complete while an acceptance criterion is unproven or a required gate is failing.

---

## Embedded implementation specification

Source mirror: `docs/current-docs/notion/work-packets/omega-016-publish-document-revisions-to-the-text-lattice-automatically.md`

<callout icon="🧬" color="orange_bg">
	**Frozen-baseline addendum.** Automatic Document publication targets the active Text-lattice generation and advances a durable source-generation cursor on add, replace, remove, withdraw, trash, restore, and purge. Do not use surviving-row timestamps as change authority. Publishing a new embedding identity requires Ω-005's explicit shadow re-embed and atomic promotion, never an ordinary edit/sync side effect. Knowledge stores immutable indexed revision/hash provenance while Resource reads current or explicitly pinned Document representations.
</callout>
## Outcome
Make every committed, caller-authorized Document revision discoverable through
the Text lattice without a manual ingestion step. Document writes stay fast and
canonical: the same transaction that commits a revision records an idempotent
publication outbox entry; a Project-scoped job extracts a deterministic text
projection and advances Knowledge asynchronously. Failures retry visibly and
never roll back or corrupt the Document.
Create, change, undo, redo, import, duplicate, template materialization, restore,
trash, and purge all have defined publication behavior. Alpha can create or edit
a Document, wait for its published revision, then Ask against it entirely
through backend contracts.
## As-built evidence
Document and Knowledge are both mature capabilities, but automatic publication
between them is not complete. Alpha's backend request still requires a manual
ingestion path before newly created or edited Document text appears in
retrieval. Existing Document changes already have revision CAS and stable
structure; Knowledge's resilient-ingest phases Ω-002–Ω-005 establish
self-contained windows, resumable commits, bounded streaming, and unified
ascent.
Publication must not call embeddings synchronously from the Document mutation
path. It must also avoid feedback: inferred/generated blocks that Knowledge or
Agents write cannot be indiscriminately re-ingested as authoritative source
text.
## Scope
- Define a versioned deterministic Document-to-text projection.
- Persist a publication outbox record atomically with every relevant committed
	Document revision.
- Add a Project-scoped publication job with idempotency, retry, stale-revision
	coalescing, and observable state.
- Carry stable Document structural addresses and Resource origin into Knowledge.
- Define publish, withdraw, restore, and purge semantics.
- Backfill all existing active Documents.
- Expose bounded publication status and explicit authorized resync.
- Integrate access-safe retrieval without baking caller grants into embeddings.
## Non-goals
- No synchronous embedding on a Document request.
- No Spreadsheet, Slides, Chat, structured-data, or media publication.
- No OCR or Office/PDF work.
- No inclusion of `Inferred` blocks in V1 source projection.
- No guarantee that an immediately committed revision is retrievable before its
	publication status reaches `ready`.
- No re-embedding solely because a caller's access changed.
## Projection contract
```go
type DocumentTextProjector interface {
    Project(
        ctx context.Context,
        scope ProjectScope,
        documentID string,
        revision int64,
    ) (TextProjection, error)
}

type TextProjection struct {
    ProjectID        string
    ResourceID       string
    ResourceFamily   string
    ResourceRevision int64
    ProjectionVersion int
    Title            string
    Segments         []TextSegment
    ContentHash      string
}

type TextSegment struct {
    Address SegmentAddress
    Kind    string
    Text    string
}

type SegmentAddress struct {
    RowID   string
    BlockID string
    AtomID  string
}
```
Text extraction is semantic, not a UI scrape. It preserves reading order and
meaningful separators; normalizes unstable presentation whitespace; includes
admitted user-authored text such as headings, list items, table text, alt text,
and prompt-block static instructions according to one documented policy; and
excludes `Inferred` output and non-semantic layout metadata.
## Publication state
```go
type Publication struct {
    ProjectID         string
    ResourceID        string
    ResourceRevision  int64
    ProjectionVersion int
    ContentHash       string
    State             string // pending, running, ready, withdrawn, failed
    Attempt           int
    FailureCode       string
    PublishedAt       *time.Time
}
```
Use a uniqueness key on
`(project_id, resource_id, resource_revision, projection_version)`. Knowledge
stores origin `(family=document, resourceID, revision, segment address)` on
every source/window/region needed for Ω-009 final authorization and citations.
Lifecycle policy:
- create/change/undo/redo/import/materialize/duplicate/restore → publish the
	resulting active revision;
- a newer pending revision supersedes queued older revisions before embedding,
	but an already running older attempt may finish harmlessly and must not become
	the current pointer;
- trash → withdraw the Resource from retrieval immediately through a small
	transactional visibility tombstone, then asynchronously clean projections;
- purge → permanently delete all Document-derived Knowledge artifacts after the
	Resource purge preconditions succeed;
- restore → republish current content and clear the withdrawal only when a ready
	projection exists, or use an explicitly documented temporary-unavailable
	state.
## Likely paths
- `core/capability/document/`
- `core/capability/resource/`
- `core/capability/knowledge/`
- current durable job/outbox packages
- `core/wiring/document_knowledge.go`
- `core/platform/storage/sqlite/sqlite_document*.go`
- `core/platform/storage/sqlite/sqlite_publication*.go`
- `core/handlers/document/`
- `core/handlers/knowledge/`
- `dev-test/document-knowledge/`
Keep the adapter in wiring/composition. Document must not import Knowledge, and
Knowledge must not import Document.
## Ordered implementation
1. Freeze the projection version, reading-order/whitespace rules, admitted block
	kinds, inferred-block exclusion, address scheme, content hash, and golden
	fixtures for all current Document structures.
2. Implement a pure projector behind the Resource `KnowledgeProjector` optional
	interface. Add property tests proving identical bases produce identical
	bytes/hash independent of map iteration.
3. Add publication/outbox persistence. In the Document revision transaction,
	append one row after create/change/undo/redo and all other revision-producing
	paths. Idempotent replay of a Document command cannot enqueue a second row.
4. Register a `document.text.publish` job under Ω-014. Coalesce queued stale
	revisions, acquire the Project Cell, reload the exact committed revision,
	project it, and feed Ω-002–Ω-005's resumable Knowledge ingestion.
5. Make Knowledge accept external stable origin and source revision. Commit all
	windows for a publication before atomically advancing that Resource's current
	Knowledge pointer.
6. Compare embedding/index model identity and projection version. If either
	differs, rebuild; never query incompatible rows or silently mix spaces.
7. Implement withdrawal tombstone, cleanup, restore, and purge. Retrieval checks
	current Resource lifecycle/access at query time even if old vectors still
	await cleanup.
8. Backfill active Documents with a resumable ordered scan and bounded batch
	enqueue. Record checkpoint, counts, failures, bytes, estimated provider usage,
	and completion. Rerun is idempotent.
9. Add caller-aware
	`GET /projects/:projectID/documents/:documentID/publication` and writer-only
	resync. Return revision/state/code/timestamps, never source text or provider
	internals.
10. Integrate Activity/notification only for actionable prolonged/terminal
	failures, not every successful publication. Emit Project revision events.
11. Update Ask E2E, backend guide, companions, baseline, migration/rollback
	notes, and record.
## Security, concurrency, persistence, and observability
The publication job uses service-level execution within its Project Cell, but
the Knowledge origin never becomes globally readable. Ω-009 authorizes every
retrieval against current Resource access immediately before model/tool
delivery. A hidden or trashed Document is ineligible even during projection
cleanup lag.
Document commit and outbox append are atomic. Delivery is at least once; the
publication uniqueness key and Knowledge source id make effects idempotent. CAS
on the current publication pointer prevents an older slow job from replacing a
newer ready revision. Job cancellation leaves a resumable Knowledge commit, not
partial visible windows.
Metrics include queue age, projection latency/bytes/segments, Knowledge ingest
latency, retries, stale coalesces, publication lag in revisions, withdrawal lag,
and failure code. Provider usage/cost is recorded per job without text.
## Tests and gates
- Golden projection fixtures for headings, lists, tables, marks, links,
	typography, prompt blocks, inferred blocks, deleted structures, and Unicode.
- Determinism/hash and maximum-size/chunk-boundary tests.
- Every revision/lifecycle path creates exactly the expected outbox effect.
- Crash after Document commit, after outbox claim, during Knowledge chunks,
	before pointer swap, and after pointer swap; restart converges once.
- Concurrent revisions with older job finishing last.
- Trash during publish, restore, purge, access removal, duplicate, and
	idempotent command replay.
- Embedding/model identity and projection-version migration tests.
- Backfill interruption/resume/rerun and derived-capacity/load assertions.
- Backend E2E: create Document → poll ready → Ask cites it → edit → Ask sees new
	revision and not old text → trash → retrieval absent → restore → present.
- Race detector, live-provider usage/cost suite, and standard gates.
## Completion evidence
- No manual Knowledge ingestion is needed for a Document.
- Document writes do not wait on provider calls.
- Publication is idempotent, resumable, and tied to an exact Resource revision.
- Trashed/hidden content is never retrieved during cleanup lag.
- Alpha's automatic-ingestion backend request passes end to end.
## Dependencies
Depends on Ω-002 through Ω-005 and Ω-009 through Ω-015. Blocks Ω-017, Ω-019,
and multi-resource lattice work in Wave 3.
## Sources
- [Alpha automatic-ingestion request](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/document-automatic-ingestion.md)
- [Omega resilient-ingest design](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/docs/superpowers/specs/2026-07-29-resilient-ingest-design.md)
- [Omega Document capability](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/document)
- [Omega Knowledge capability](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/knowledge)

