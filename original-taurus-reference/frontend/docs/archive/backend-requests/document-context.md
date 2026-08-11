# Backend request — document context services

**Priority:** Medium · **Status:** Partially shipped
**Unblocks:** the remaining semantic layout defaults, reference graph, anchored
comments, document-scoped AI-task projection, and creator/rename attribution. Omega's
page geometry, formula names, document history, and targeted undo are already
available; their remaining work is Alpha integration where noted below.

## What the front-end needs

Alpha now presents the intended context-panel vocabulary around a document:

- **Info** and **Outline** are derived from the real open document; rename,
  word/character counts, and the page count derived from ordered row heights plus
  active page geometry are live.
- **Search/Replace** operates locally on the real editor state and needs no new endpoint.
- **Page geometry and row height are real** through Omega's document base plus
  `set_page_layout` / `set_block_line_height` change operations. Layout's typography and
  heading-style controls remain clearly badged mocks.
- Omega exposes a real **project-scoped formula name manager and evaluator**. Alpha's
  document **Name Manager** is still mock-backed because its client and shared-project
  scoping have not been wired—not because Omega lacks names.
- Omega exposes bounded **document history, detail, undo, and redo**. Alpha's History
  panel remains mock-backed until those shipped endpoints are integrated.
- **References** and **Comments** still lack production Omega endpoints and use
  clearly badged projections from `src/lib/data/document-context.ts`.
- **AI Tasks** now uses the same clearly badged boundary to preview scoped work,
  explicit review policy, task state, and task detail.
- **Raw row and line counts are intentionally absent from Info.** Rows are an
  implementation unit, while “line” is ambiguous once a row has columns.

## Shipped Omega capabilities awaiting or completing Alpha integration

```http
GET    /projects/:projectID/names
GET    /projects/:projectID/names/:name
PUT    /projects/:projectID/names/:name/value
POST   /projects/:projectID/names/:name/table
PUT    /projects/:projectID/names/:name/table
PUT    /projects/:projectID/names/:name/function
DELETE /projects/:projectID/names/:name
POST   /projects/:projectID/evaluate

GET  /documents/:documentID/history?limit&cursor
GET  /documents/:documentID/history/:changeSetID
POST /documents/:documentID/changes/:changeSetID/undo
POST /documents/:documentID/changes/:changeSetID/redo
```

History summaries already include trusted actor snapshots, timestamps, lineage,
operation types, affected stable IDs, detail availability, and viewer-specific
`canUndo`/`canRedo`. Undo and redo append compensating revisions and never rewrite
history. Alpha should consume this contract directly rather than route History through
the semantic Activity feed.

Formula names are intentionally project-scoped shared data. The document panel should
present that scope honestly and use Omega's existing value/table/function vocabulary;
it should not create a duplicate document-local namespace merely to match the panel's
location.

## Remaining Omega capability boundaries

Omega owns the final routes and schemas. The UX needs boundaries equivalent to:

```http
GET   /documents/:documentID/references
      -> { "outgoing": [...], "incoming": [...] }

GET   /documents/:documentID/comments
POST  /documents/:documentID/comments
PATCH /documents/:documentID/comments/:commentID

GET   /documents/:documentID/tasks
POST  /documents/:documentID/tasks
PATCH /documents/:documentID/tasks/:taskID

GET   /activity?targetID=:documentID&limit=...&cursor=...
```

The shipped Document base/change operations cover page size, margins, and durable row
heights. The remaining Layout request is semantic body defaults plus per-heading
font/size/foreground color. References need stable resource identities and both graph
directions.
Comments need public actor profiles, threads, resolution state, and durable document
anchors expressed in Omega ids/byte offsets rather than browser positions.
Tasks need instruction, document selection/section scope, assigned agent, review
policy, explicit lifecycle state, output/change-set references, and public actor
profiles. Those actor references should feed the centralized Alpha resolver described
in the [identity profile manager plan](../plans/2026-07-23-identity-profile-manager.md),
rather than requiring each panel to assemble its own person/persona card. The task
execution lifecycle should align with [AI Agent](ai-agent.md), not become a second
unrelated agent system.

Target-filtered Activity remains useful for resource creation/rename attribution that
does not belong to a document content ChangeSet. The document projection or descriptor
also needs a stable creator identity reference for Info. Shared identity resolution is
tracked separately in [identity-profiles.md](identity-profiles.md).

Omega persists canonical layout inputs, not a page count. Alpha now consumes those
whole-point values, derives exact `PagePlan` membership, renders distinct page sheets,
and repaginates immediately when Layout or Details submits a real change. Bounded
descriptor/manifest/row reads are tracked separately in
[document-row-windows.md](document-row-windows.md). A line count remains deferred
until the product defines how simultaneous column lines are counted.

## Front-end follow-up when it lands

First wire the already-shipped project Names and document History contracts, removing
their **Mock** badges independently. For capabilities Omega still lacks, replace each
mock collection with a client in `src/lib/data/*` as it ships, map comment/reference
anchors to the live editor through the session boundary, connect task output to
reviewable change sets, and add project-authorization, conflict, and multi-user
browser tests. Physical page rendering is already live and is not follow-up work.
