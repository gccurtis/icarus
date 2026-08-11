---
title: "Work Packet — Ω-016 — Publish Document revisions to the Text lattice automatically"
notion_page_id: "3adb6410e50281208968d066f28cab27"
notion_url: "https://app.notion.com/3adb6410e50281208968d066f28cab27"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 00:01:21Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-016 — Publish Document revisions to the Text lattice automatically

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

