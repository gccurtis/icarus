---
title: "Work Packet — Ω-009 — Make Project reads and retrieval evidence caller-aware"
notion_page_id: "3acb6410e50281ab8fe4f7d97dcc0f91"
notion_url: "https://app.notion.com/3acb6410e50281ab8fe4f7d97dcc0f91"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:54:56Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-009 — Make Project reads and retrieval evidence caller-aware

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🔐" color="red_bg">
	**Frozen-baseline addendum.** Caller-aware scope applies to both semantic retrieval and Ω-002 exact Resource reading. Current Agent/Knowledge tools close over Project ID without requesting User ID and can therefore bypass Resource `AccessScope`. Require trusted `UserID + ProjectID + role/admission`, authorize before candidate loading and before final hydration/origin I/O, reauthorize continuations, and make inaccessible names, best-match windows, traces, citations, and errors undisclosing. Scope store reads by Project as defense in depth.
</callout>
## Outcome
Make unauthorized Project data impossible to obtain through a read capability,
relationship edge, presence record, activity target, resolved Context, or
Knowledge citation. Caller identity and organization reach become mandatory
inputs to every Project read that can reveal resource identity or content.
Authorization moves from handler memory into typed capability contracts and
fails closed on resolver errors.
## As-built evidence
Omega correctly establishes Project membership at the transport gate and
re-scopes records by Project in capabilities. It also has sound primitives in
`resource.Resources`: `CanAccessResource` and `FilterAccessible`.
`documentAccessGuard` protects direct routes containing `:documentID`, and
Document list filtering has already improved.
The remaining class is intra-Project disclosure through response bodies:
Activity, sessions, resolved Contexts, references/backlinks, revision hints,
templates, notifications, and future composite projections can name resources
that a caller cannot open. Current read signatures often accept only
`projectID` or `Scope{ProjectID}`. Retrieval introduces the highest-impact
version: project-wide Knowledge may contain text from a restricted source unless
evidence is filtered against the caller before ranking/tool return.
## Scope
- Introduce one caller-aware Project read scope.
- Add a batch authorization port over resource identities.
- Convert all Project read capability signatures that can reveal resource
	identity, metadata, relationships, presence, or content.
- Filter Knowledge entry frontiers, regions, citation resolution, and Agent
	`knowledge.search` tool results by caller-visible origins.
- Fail closed when access metadata or authorization resolution fails.
- Preserve direct Project isolation and storage-level Project predicates.
- Add negative-security tests for every converted surface.
## Non-goals
- Wire redaction and cursor representation; Ω-010 defines public shapes.
- Replace the membership/grant model or complete enterprise Organizations.
- Create user-level libraries.
- Encrypt the database or introduce row-level security external to SQLite.
- Re-embed content when access changes; access is evaluated at query time.
## Invariants
1. A Project read that can name or return a resource cannot be called without a
	caller scope.
2. Unknown access and resolver failure mean deny, never allow.
3. Access checks cover both ends of references/backlinks and every origin behind
	a resolved Context.
4. Ingestion may remain Project-wide; retrieval and citation emission are
	caller-aware at query time.
5. A shared persona, Context, or future library asset never grants access to
	Project content by association.
6. Authorization filtering happens before content reaches an Agent/model.
7. Batch checks avoid a new N+1 query pattern.
## Representative interfaces
```go
type ReadScope struct {
    ProjectID    string
    CallerID     string
    CallerOrgIDs []string
}

type ResourceRef struct {
    Kind string
    ID   string
}

type AccessDecision struct {
    Ref     ResourceRef
    Allowed bool
}

type ResourceAuthorizer interface {
    AuthorizeBatch(ctx context.Context, scope ReadScope, refs []ResourceRef) ([]AccessDecision, error)
}
```
Knowledge artifacts require traceable origin:
```go
type EvidenceOrigin struct {
    ResourceKind string
    ResourceID   string
    SourceID     string
}

func (k *Knowledge) Retrieve(ctx context.Context, scope ReadScope, q Query) (Result, error)
```
Every returned region must carry an origin that can be authorized. Legacy rows
without an origin are ineligible until backfilled; do not assume Project-wide
means visible to every member.
## Likely paths
- `core/capability/resource/`
- `core/capability/document/`
- `core/capability/activity/`
- `core/capability/session/`
- `core/capability/contexts/`
- `core/capability/reference/`
- `core/capability/notification/`
- `core/capability/knowledge/`
- `core/capability/agent/tool_knowledge.go`
- `core/handlers/*`
- `core/wiring/*access*.go`
- `core/platform/storage/sqlite/`
## Ordered implementation
1. Build a route/read inventory from Ω-001 and add failing leak tests for
	Activity, backlinks, resolved Contexts, sessions, and Knowledge retrieval.
2. Introduce `ReadScope` in a neutral Project-boundary package or as a
	capability-owned value that does not create imports between leaf
	capabilities.
3. Add a batch authorizer adapter in wiring over Resource access primitives.
	Implement a set-based SQLite read for access records.
4. Convert Resource and Document list/point projections first; remove handler
	filters only after capability enforcement tests pass.
5. Convert Activity, session/presence, Context resolution, references/backlinks,
	notifications, revision hints, and template lists.
6. Add resource origin to Knowledge sources/windows where absent. Backfill
	document and connector origins idempotently.
7. Filter the Knowledge frontier before scoring/descent where possible, and
	re-check every final region before returning it. The second check protects
	against access changes during retrieval.
8. Pass caller-aware scope through Ask retrieval planning and tools. Assert that
	denied text never appears in model context or tool traces.
9. Update all compile-broken call sites, companions, architecture, baseline, and
	record.
## Security, concurrency, persistence, and observability
Use one access snapshot per read where possible, but perform a final check before
content emission if the request spans model latency. Access changes racing a
read may conservatively remove data; they must never add it without a positive
decision. Cache only decisions keyed by caller, Project, resource, and access
revision with a short request lifetime—not process-global membership.
Log counts (`candidates`, `allowed`, `denied`) and codes, never denied names or
content. A store failure returns a typed internal error and an empty result to
the caller; it cannot downgrade to “project member therefore allowed.”
## Tests and gates
- Compile-time conversion of every inventoried read signature.
- Negative transport tests with owner, allowed member, denied member, and
	non-member.
- Backlink test where the hidden resource is the opposite edge.
- Context test with nested include/exclude and one denied leaf.
- Session/presence test hiding document id, caret, and selection.
- Knowledge test proving a semantically best but denied window is never scored,
	returned, cited, or sent to the model.
- Access-change-during-retrieval race test.
- Batch-query count/performance assertion.
- `go test -race` for converted packages and standard gates.
## Completion evidence
- No Project content-bearing read exists without caller scope.
- Alpha's restricted Activity reproduction no longer sends the name to the
	browser.
- Restricted Knowledge evidence is absent end to end.
- Denial and resolver-failure tests cover every surface in the baseline matrix.
## Dependencies
Depends on Ω-001 and Ω-006 for safe Document values. Blocks Ω-010, Ω-015 through
Ω-019, and every future resource family.
## Sources
- [Alpha access-enforcement request](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/resource-access-enforcement.md)
- [Omega middleware](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/transport/middleware.go)
- [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
---

