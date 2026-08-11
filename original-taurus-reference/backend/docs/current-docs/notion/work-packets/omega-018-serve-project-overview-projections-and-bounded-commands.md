---
title: "Work Packet — Ω-018 — Serve Project Overview projections and bounded commands"
notion_page_id: "3adb6410e50281c0a262e8580e8f03f2"
notion_url: "https://app.notion.com/3adb6410e50281c0a262e8580e8f03f2"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 00:07:14Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-018 — Serve Project Overview projections and bounded commands

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

## Outcome
Give Alpha one caller-aware backend surface for the Project Overview screen,
Context-panel lenses, and Inspector selections without moving enterprise
identity/Organization/entitlement ownership into the Project execution plane.
The default response is a small, coherent projection of Project identity,
Project-local brief, Resource summaries, recent/pinned work, Activity, active
Task/Run state, and synchronization hints. Larger collections keep their own
bounded cursor endpoints.
Add only the Project-local commands the Overview owns—updating its working brief
and managing Project pins (if enabled by the current Alpha contract). Resource
lifecycle, access administration, Organization membership, Project ownership,
license, and settings remain in their authoritative capabilities/routes.
## As-built evidence
Alpha has a Project Overview route plus Context and Inspector panel mocks/work
requests, while Omega exposes the underlying capabilities separately. Resource,
Activity, Agent, access, Context, and Project metadata can therefore be fetched,
but there is no versioned composite projection defining snapshot coherence,
redaction, independent pagination, lens selection payloads, or which commands
actually belong to Overview.
The new architecture separates the Enterprise Control Plane from Project
execution. Project name/owner/organization/grants/entitlements are control-plane
facts supplied through a narrow port or local modular adapter in the initial
monolith. Overview may display a caller-safe snapshot but must not become a
second authority for them.
## Scope
- Freeze the Overview projection and its mapping to current Alpha panels/lenses.
- Add a small default composite endpoint with strict per-section limits.
- Provide separate cursor endpoints for full Resources, Activity, and Task/Run
	lists instead of unbounded expansion.
- Define caller-safe counts, recent items, pinned items, active jobs/tasks,
	publication/sync warnings, and revision/ETag hints.
- Add a Project-local working brief/purpose field if Alpha's screen edits it.
- Add typed pin/unpin/reorder commands only if pins are Project-shared; otherwise
	model personal favorites as Workspace/user state and omit Project commands.
- Use Ω-010 redaction and Ω-009 caller-aware reads throughout.
- Add cache/recompute, event invalidation, and deterministic backend E2E.
## Non-goals
- No Organization administration, member/grant editing, billing, license, or
	entitlement mutation.
- No user settings or user-level library management.
- No giant “fetch the entire Project” endpoint.
- No duplicate Resource create/rename/trash endpoints.
- No frontend layout, card, icon, or animation decisions.
- No analytics warehouse or long-term audit dashboard.
- No hidden-resource counts that reveal more than the caller could enumerate.
## Projection contract
```go
type ProjectOverview struct {
    Project       ProjectIdentityProjection
    Brief         ProjectBrief
    Resources     ResourceOverviewPage
    Activity      ActivityPage
    Tasks         TaskOverviewPage
    Health        []ProjectHealthNotice
    Lenses        []LensDescriptor
    Revision      string
    GeneratedAt   time.Time
}

type ProjectIdentityProjection struct {
    ID               string
    Name             string
    OrganizationName string
    CallerRole       string
    Capabilities     []string
}

type ResourceOverviewPage struct {
    VisibleCounts map[string]int
    Recent        []ResourceProjection
    Pinned        []ResourceProjection
    NextCursor    string
}
```
Counts are computed over caller-visible rows, not total Project rows. If an exact
visible count is too expensive, return an explicit lower-bound/unknown shape
rather than the hidden total.
```go
type Count struct {
    Value    int
    Accuracy string // exact, lower_bound, unknown
}
```
Recommended endpoint surface:
```plain text
GET   /projects/:projectID/overview
GET   /projects/:projectID/overview/resources?cursor=&limit=
GET   /projects/:projectID/overview/activity?cursor=&limit=
GET   /projects/:projectID/overview/tasks?cursor=&limit=
PATCH /projects/:projectID/overview/brief
POST  /projects/:projectID/overview/pins
DELETE /projects/:projectID/overview/pins/:resourceID
```
Do not add pin routes until ownership is resolved. If pins represent an
individual's shortcuts, store them in Workspace and project them here through
the caller's Workspace.
## Lens mapping
Backend lens descriptors are stable identifiers and capabilities, not visual
instructions:
- `project.details` — caller-safe Project identity, Project-local brief,
	timestamps, and permitted commands;
- `project.resources` — visible family counts, recent/pinned Resources, search/
	list cursor link;
- `project.activity` — Ω-010 Activity projection and next cursor;
- `project.tasks` — Project Agent/Task summaries, needs-user/running/failed
	counts, and detail links;
- `project.health` — actionable Project-level publication, connector, or job
	failures the caller may see.
The Inspector selection for a Resource/Activity/Task item returns its canonical
capability projection or link, not a copied unbounded object inside Overview.
## Likely paths
- `core/capability/projectoverview/` or the repository's projection convention
- `core/handlers/projectoverview/`
- `core/capability/resource/`
- `core/capability/activity/`
- `core/capability/agent/`
- `core/capability/workspace/`
- `core/capability/access/`
- Enterprise Control Plane port/adaptor in `core/wiring/`
- `core/platform/storage/sqlite/sqlite_project_overview*.go`
- `core/transport/routes.go`
- `dev-test/project-overview/`
## Ordered implementation
1. Compare Alpha's current Overview, Context panel, and Inspector request shapes
	with Ω-001's available Omega projections. Freeze a field/owner/access/source/
	limit/cursor matrix. Mark enterprise-owned fields read-only.
2. Define `ProjectIdentityPort` that supplies caller-safe control-plane facts to
	the Project façade. Implement it over the current monolith without importing
	Organization/access internals into the Overview capability.
3. Define default section limits, independent cursors, count accuracy,
	consistency rules, ETag/revision, typed health notices, and lens ids. Write
	golden JSON before code.
4. Build each section from Ω-009 caller-aware query ports. Use one SQLite read
	transaction/snapshot for locally stored sections where practical and report
	a revision vector when control-plane identity is from another snapshot.
5. Implement the small composite with parallel bounded reads, shared
	cancellation/deadline, deterministic section order, and explicit partial
	failure policy. Prefer a typed unavailable section over failing unrelated
	sections, except authorization/scope failure fails the entire request.
6. Implement full per-section cursor endpoints using Ω-010 contracts. Do not
	embed subsequent pages in the composite.
7. Add Project-local brief persistence with revision CAS, size/format limits,
	edit authorization, Activity source, and Project event if the product owns
	that field. Otherwise omit the command rather than writing control-plane
	metadata from the execution plane.
8. Resolve pin ownership. Implement Project-shared pins with edit authority,
	stable ordering, missing/trashed cleanup, and limits; or adapt caller
	Workspace favorites read-only. Document the decision.
9. Add event-driven cache invalidation keyed by Project and caller access
	revision. Cache only bounded projections; never cache one caller's redacted
	result for another.
10. Update Alpha contract fixtures, backend guide, companions, completion
	matrix, and change record.
## Security, concurrency, persistence, and observability
All sections run with the same `ProjectScope`; no subquery is allowed to
downgrade to Project-only scope. Counts, warnings, names, and source ids can all
leak hidden resources and therefore pass the same filter. Project admin/custody
does not automatically imply content access where the enterprise model separates
them.
Brief/pin mutations use expected revision and idempotency. Composite reads are
bounded by deadline and work budget; a slow section cannot spawn unbounded
queries or goroutines. Cache keys include caller/access revision, Project,
requested sections, and relevant projection revisions.
Metrics include overall/section latency, partial section code, rows scanned/
visible, cache result, payload bytes, and count accuracy with bounded labels.
Logs do not contain brief content, Resource names, Task objectives, or hidden
warning detail.
## Tests and gates
- Golden Overview and lens descriptors for owner/editor/viewer/denied caller.
- Hidden Resources do not affect names, counts, recent/pinned lists, Activity,
	Tasks, Health, ETag differences visible to the caller, or response bytes.
- Independent cursor correctness under dense denial.
- Control-plane adapter unavailable/stale and local section partial-failure
	policy.
- Brief validation/CAS/idempotency/access and pin ownership/order/limits if
	implemented.
- Concurrent Resource/Activity/Task changes produce coherent revision hints and
	invalidate the right cache only.
- Load test enforces query count, deadline, payload, and allocation budgets.
- Backend E2E across restart and two callers with different resource grants.
- Race detector and standard repository gates.
## Completion evidence
- Alpha can render and refresh every Project Overview panel from documented
	backend projections.
- The default endpoint is bounded and has no N+1 authorization pattern.
- Enterprise-owned fields are never mutated through Overview.
- Hidden Project content leaves no identifying or count side channel.
- Every Overview command has one authoritative owner and deterministic evidence.
## Dependencies
Depends on Ω-009 through Ω-015 and consumes Ω-019 Task summaries when available.
It can land initially with an empty/typed-unavailable Task section, then must be
re-certified after Ω-019. Blocks the Project Overview Alpha integration and the
final backend demonstration.
## Sources
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Workstreams — Taurus Product Completion](https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd)
- [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf)
---

