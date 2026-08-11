---
title: "Work Packet — Ω-017 — Close the Document Project vertical slice"
notion_page_id: "3adb6410e50281999781e35c8dfacd05"
notion_url: "https://app.notion.com/3adb6410e50281999781e35c8dfacd05"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 00:07:14Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-017 — Close the Document Project vertical slice

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

## Outcome
Certify Document as the first fully complete Project resource from persistence
through HTTP: lifecycle, typed revision changes, undo/redo, history effects,
comments and anchors, references, Context/prompt resolution, project-local
template behavior already in scope, collaboration, access, Activity, Workspace,
automatic Knowledge publication, and backend-only demonstration. Every current
Document route has a bounded, caller-aware contract and deterministic evidence.
There are no mocks, hidden manual steps, unowned TODOs, or handlers whose
success cannot be reproduced after a restart.
This packet is a closure pass, not a new Document model. It integrates and proves
the mature capability Omega already has plus the safety/runtime work in
Ω-006–Ω-016.
## As-built evidence
Document is Omega's most complete resource. It already has a structured
base/change-set/revision model, optimistic submit, undo/redo, comments,
references, presence, Context and prompt-block behavior, template-related
surfaces, import/export paths, history, and extensive handlers/tests. It is also
the only editor model Alpha currently exercises end to end.
Its remaining risk is integration fragmentation. Access filtering, mark
admission, Activity source provenance, automatic Knowledge publication,
Workspace unified undo, Project events, Resource lifecycle conformance, and
failure/redaction contracts have been owned by preceding packets. Existing
row-window endpoints are shipped behavior but Alpha's latest runtime no longer
requires them. They should remain tested and documented until a separate removal
decision; do not rebuild or expand them merely to satisfy an old request.
## Scope
- Build a complete Document operation/route/state/authorization matrix.
- Resolve every partial, dead, nil-gated, dev-only, or untested current
	Document path.
- Verify create/get/snapshot/change/undo/redo/history/lifecycle and idempotency.
- Complete comments, stable anchors/rebasing, threads, resolve/reopen, and
	caller-aware visibility.
- Complete references/backlinks and Context/prompt-block resolution.
- Complete current project-local Document template and Markdown/plain-text
	import/export behavior.
- Integrate Resource, Workspace, Activity, Presence, Project events, and
	automatic Text-lattice publication.
- Define limits, errors, cursors, revision conflicts, cancellation, and
	observability consistently.
- Add a canonical backend-only Document demonstration and a closure report
	mapping every matrix row to evidence.
## Non-goals
- No redesign of Document base, row/block/atom address model, or change-set
	semantics.
- No Spreadsheet, Slides, or Chat editor work.
- No DOCX or PDF conversion; Wave 4 owns those adapters.
- No user-level Template library or cross-resource template parameter contract;
	Ω-020 and Wave 5 own them.
- No new visual editor/layout behavior in Alpha.
- No new Formula capability semantics.
- No removal or redesign of stable row-window routes in this packet.
- No ingestion of inferred/generated blocks as authoritative evidence.
## Completion invariants
1. Every mutation is admitted by the Document domain, authorized with explicit
	Project/caller scope, revision-CAS protected, idempotent, and atomic with its
	required outbox records.
2. Reads never depend on handler-only filtering and use Ω-010 wire semantics.
3. A comment/reference/prompt anchor is either resolved to the exact caller-
	visible structure, reported missing/stale explicitly, or redacted; it never
	silently points at different content.
4. Undo/redo exposes semantic effects while private inverse operations stay
	private. Workspace coordination cannot undo invisible content.
5. A successful committed revision is durable after restart and enters the
	automatic publication pipeline exactly once.
6. Import, duplicate, template materialization, and restore pass the same
	whole-base invariants and mark/style validation as ordinary edits.
7. Every list is bounded and cursor-safe; every payload has explicit byte/item/
	nesting limits.
8. “Complete” means deterministic service, store, transport, integration, race,
	recovery, negative-security, and backend-E2E evidence.
## Representative service contract
```go
type DocumentService interface {
    Create(context.Context, ProjectScope, CreateDocument) (DocumentSnapshot, error)
    Get(context.Context, ProjectScope, string, ReadOptions) (DocumentSnapshot, error)
    Submit(context.Context, ProjectScope, string, SubmitChangeSet) (SubmitResult, error)
    Undo(context.Context, ProjectScope, string, HistoryCommand) (SubmitResult, error)
    Redo(context.Context, ProjectScope, string, HistoryCommand) (SubmitResult, error)
    History(context.Context, ProjectScope, string, Page) (HistoryPage, error)
    Effects(context.Context, ProjectScope, string, string) (ChangeEffects, error)
}

type SubmitChangeSet struct {
    BaseRevision   int64
    IdempotencyKey string
    Operations     []Operation
}

type SubmitResult struct {
    Revision   int64
    ChangeSet  string
    Effects    []PublicEffect
    Published  PublicationHint
}
```
Lifecycle remains available through Ω-015's Resource contract. Comment,
reference, prompt/template, and collaboration services use `ProjectScope` and
stable Document addresses rather than accepting arbitrary embedded content
copies.
## HTTP closure matrix
The exact existing routes come from Ω-001; target groups after Ω-011 are:
```plain text
/projects/:projectID/documents
/projects/:projectID/documents/:documentID
/projects/:projectID/documents/:documentID/changes
/projects/:projectID/documents/:documentID/history
/projects/:projectID/documents/:documentID/undo
/projects/:projectID/documents/:documentID/redo
/projects/:projectID/documents/:documentID/comments
/projects/:projectID/documents/:documentID/references
/projects/:projectID/documents/:documentID/presence
/projects/:projectID/documents/:documentID/prompts
/projects/:projectID/documents/:documentID/publication
```
Keep existing route names where established. For each operation record:
method/path, permission, serial key, request/response schema, limits, expected
revision/idempotency, success, typed 4xx/409/422/429/5xx behavior, Activity
source, Project event, Knowledge effect, and test.
## Likely paths
- `core/capability/document/`
- `core/handlers/document/`
- `core/capability/comment/`
- `core/capability/reference/`
- `core/capability/contexts/`
- `core/capability/presence/`
- `core/capability/resource/`
- `core/capability/workspace/`
- `core/capability/knowledge/`
- `core/platform/storage/sqlite/sqlite_document*.go`
- `dev-test/documents/`
- `docs/backend-guide.md`
## Ordered implementation
1. Generate the Document closure matrix from routes, dispatch, wiring, store
	ports, migrations, tests, Alpha requests, and active Yesod pages. Classify
	each row complete, integration gap, defect, intentionally preserved, or
	Wave-4 deferred.
2. Add a black-box conformance harness covering Resource lifecycle plus
	Document snapshot/change/history semantics before closing individual gaps.
3. Complete create/get/list/snapshot/title and lifecycle integration. Assert
	family/resource identity, caller scope, trash/restore, duplicate lineage,
	pagination, and restart behavior.
4. Complete change admission: all operation kinds, whole-base/style invariants,
	bounded payloads, stable ids, expected revision, idempotent replay, conflict
	body, Activity source, Project event, publication outbox, and failure
	atomicity.
5. Complete undo/redo/history/effects. Cover concurrent history, pruning,
	unavailable before-values, unified Workspace coordination, and event/
	publication behavior.
6. Complete comments and anchors: create/edit/delete/resolve/reopen, thread
	paging, change rebasing, deleted/stale address, hidden author/resource,
	mention/notification bounds, and purge cleanup.
7. Complete references/backlinks and Context/prompt resolution. Validate both
	ends, prevent cycles/unbounded expansion, preserve source provenance, and
	guarantee caller-visible material only.
8. Complete current project-local template and Markdown/plain-text interchange
	paths. Route generated bases through the same validators and disclose
	best-effort losses. Do not pre-empt Ω-020 or Wave 4.
9. Complete Presence and live events with Ω-014, including join/move/leave,
	snapshot, revision notification, hidden selections, disconnect, and polling
	fallback.
10. Preserve current row-window endpoints with honest contract tests and mark
	them compatibility/stable rather than a new preferred frontend path.
11. Remove or implement all Document TODO/panic/mock/nil-gated production paths.
	A disabled external provider must return a typed unavailable error and leave
	state unchanged.
12. Build the canonical backend-only demo, run every gate/live suite, publish
	closure evidence, update companions/baseline/backend guide, and add the
	numbered record.
## Security, concurrency, persistence, and observability
Serial execution is keyed by Project+Document while persistence CAS remains the
cross-process correctness boundary. Reads take coherent revision snapshots.
Comments/references/presence do not grant access to the Document or an opposite
edge. Prompt resolution and Ask integration send only currently authorized
sources to a model.
Every committed revision atomically records required Activity/event/publication
outboxes. Recoverers reconcile from authoritative change sets without replaying
external side effects twice. Purge verifies dependent comments, references,
Workspace targets, jobs, and Knowledge cleanup.
Metrics include operation/outcome, conflict rate, base/change bytes, revision
latency, history depth, anchor status, publication lag, and subscriber counts
using bounded labels. Logs contain ids/codes/revisions, not Document text,
comments, prompts, resolved Context, or marks.
## Tests and gates
- Domain property/fuzz tests for all operations and structural invariants.
- SQLite store contract, migration rerun, restart, rollback/crash matrix, and
	reconciliation tests.
- HTTP golden contracts for every closure-matrix row and typed failure.
- Owner/editor/viewer/denied/nonmember tests over Document, comments,
	references, presence, Context resolution, history, and publication.
- Concurrent submit/undo/redo/comment/rename/trash cases under race detector.
- Anchor rebasing across insert/delete/move and history pruning.
- Maximum-size/nesting/page/rate/cancellation tests.
- Alpha contract smoke suite and preserved row-window suite.
- Canonical backend demo:
	create → edit/format/comment/reference → resolve prompt Context → collaborate
	→ publish → Ask/cite → undo/redo → close tab/unified undo → restart/resume →
	trash/restore/duplicate.
- Live provider suites print usage/cost and skip explicitly without credentials.
- Standard build/test/format/companion gates.
## Completion evidence
- Every matrix row links to passing deterministic evidence.
- The canonical demo runs without Alpha or manual database/file intervention.
- New/edited Document text becomes Ask evidence automatically.
- No current Document production path is mock, nil-gated without a typed error,
	or dependent on a dev route.
- The closure report names only Office/PDF and future cross-resource/user-library
	work as deferred.
## Dependencies
Depends on Ω-006 and Ω-008 through Ω-016. Blocks Ω-019's complete Agent demo,
Ω-020 template generalization, and Document conversion work in Wave 4.
## Sources
- [Omega Document capability](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/document)
- [Alpha backend-request index](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/README.md)
- [Model — Workspace Capability](https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb)
- [Workstreams — Taurus Product Completion](https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd)
---

