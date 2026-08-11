# Taurus Alpha backend-request inventory

**Status:** audited; the accepted deterministic Resource, Project-purpose, and
Activity work is implemented on `feature/backend-requests-audit`.

**Accepted scope update:** Resource catalog/lifecycle, persisted Project purpose
and timestamp semantics, and Project Activity are approved for implementation on
this branch. Their detailed decisions are in
[Resource, Project purpose, and Activity design](2026-07-21-resource-purpose-activity-design.md),
with file-by-file work in the
[implementation plan](../plans/2026-07-21-resource-purpose-activity.md).
AI Resource generation and integration/rebasing of the Quarterback and Slides
feature branches remain outside this branch.

This document inventories the current backend requests in the sibling
`taurus-alpha/docs/backend-requests/` directory, compares them with Taurus
Omega's actual `main` branch and known unmerged feature branches, and identifies
the backend work that remains. It is not a frontend plan and does not adopt
Alpha's proposed HTTP shapes without an Omega architecture review.

## Source snapshot

The audit read Taurus Alpha at commit `11a3a89` on `main`, plus its currently
staged revision of `docs/backend-requests/resources.md`. Alpha has other active
working-tree changes; none were modified by this audit.

The source directory currently contains:

- `README.md` — priority/status index;
- `resources.md` — unified Project Resource metadata and lifecycle;
- `project-members.md` — membership reads and owner-managed changes;
- `ai-generation.md` — generate a new Resource from a prompt;
- `project-purpose.md` — persisted Project purpose plus optional AI drafting;
- `activity-feed.md` — cursor-paginated Project activity;
- `project-updates.md` — rename, visibility, timestamps, and icon; and
- the one-line user display-name request in `README.md`.

Alpha's index currently marks every item Open. That status is stale relative to
Omega `main`; the inventory below is based on executable Omega code, tests, and
current branch contents instead.

## Status vocabulary

- **Implemented on main** — domain behavior, persistence, HTTP route, and tests
  exist on the branch this audit is based on.
- **Implemented with explicit semantics** — the capability exists, but Omega
  deliberately selected one interpretation of an open Alpha question.
- **Needs contract confirmation** — the requested field exists, but the product
  meaning may be broader than the events that currently update it.
- **Partially enabled** — some prerequisites exist, but the requested end-to-end
  capability does not.
- **Open** — no complete backend capability or route satisfies the request.

## Complete request inventory

| Alpha request | Alpha priority | Omega status | Evidence and remaining boundary |
| --- | --- | --- | --- |
| Unified Resource list/create/rename/delete | High | Implemented on this branch | The fixed Resource catalog uses canonical `(kind, family ID)` identity, global cursor paging, four `/resources` routes, and a real Document owner adapter. Other known kinds remain honestly unavailable. |
| Project member list/add/change role/remove | High | Implemented on main | `access.ProjectMembers`, member mutators, SQLite/memory storage, four `/projects/:projectID/members` routes, and last-owner protection exist. Add is intentionally restricted to existing user accounts; pending invitations are later work. |
| AI Resource generation | Medium | Partially enabled | Main has Intelligence and Jobs. `feature/quarterback-ask` has a durable Action runner and Document mutation tools, but no create-Resource generation workflow exists and that branch is not part of this branch. |
| Persist Project purpose | Medium | Implemented on this branch | Purpose is persisted plain text (≤1,000 runes), returned everywhere, owner/editor writable, clearable, no-op aware, and protected by whole-patch authorization. |
| AI-draft Project purpose | Optional/later | Open | This depends on the purpose field plus the generation/reasoning workflow. It should not block deterministic purpose persistence. |
| Project activity feed | Medium | Implemented on this branch | Atomic Document create/edit/rename/delete facts populate durable safe snapshots; `GET /activity` provides bounded Project-scoped cursor reads. |
| Rename Project | Medium | Implemented on main | Owner-only partial `PATCH /projects/:projectID` persists and validates `name`. |
| Project visibility/link access | Medium | Implemented with explicit semantics | Omega persists `private`/`link`. A signed-in link holder calls `/projects/:projectID/join` and receives a durable read membership. Anonymous and ephemeral non-member access were deliberately excluded. |
| Project timestamps | Low | Implemented on this branch | Persisted profile time is composed with latest Resource Activity in every Project response; Document append advances visible time and rebase does not. |
| Project icon | Low | Implemented on main | The owner-only Project patch persists a bounded opaque icon key. Alpha's request index omits this row even though `project-updates.md` requests it. |
| User display name | Low | Implemented on main | Registration accepts `name`; `GET /auth/me` returns it; `PATCH /auth/me` persists it. Member rows use the same identity. |

The implemented access work is documented in records
[`0014`](../../records/0014-project-and-user-fields.md),
[`0015`](../../records/0015-project-members.md), and
[`0016`](../../records/0016-project-visibility.md).

## New and changed Alpha material

The Alpha request set changed after the first Project/access requests were
created:

- `activity-feed.md` and `ai-generation.md` were added on 2026-07-21. They are
  genuinely new backend work.
- `project-purpose.md` was added and then revised to make the current frontend
  explicitly non-persisting rather than pretending a save succeeded.
- `project-updates.md` was revised to remove simulated rename behavior and to
  keep the missing backend contract visible.
- The staged `resources.md` update recognizes that real Document CRUD now
  exists, requires Resource entries to reference actual Document IDs, and
  removes `board` from Alpha's current `ResourceKind` vocabulary.

The Resource revision changes the backend design requirement materially. A
catalog entry cannot be an unrelated duplicate that happens to share a name
with a Document. It must address the canonical family object by stable ID and
keep lifecycle behavior coherent.

One source ambiguity also needs correction during integration: `resources.md`
says the request unblocks per-Resource download, but its proposed API and
“content is out of scope” boundary define no download contract. Metadata CRUD
cannot by itself implement download. Export/download should be designed as a
separate family-aware operation rather than silently counted as complete.

## Work that remains

### 1. Persisted Project purpose

Candidate ownership is the existing Access/Project capability because purpose
is Project metadata returned with Project reads. The design pass must resolve
field length, empty/clear behavior, SQLite migration, and field-level
authorization: Alpha requests editor/owner writes, while the existing Project
patch is owner-only for name, icon, and visibility.

The smallest implementation is deterministic persistence only. AI drafting is
a separate consumer that returns a proposal or applies an explicit later
mutation; it must not be embedded in the basic Project update transaction.

### 2. Unified Resource catalog and lifecycle

Omega needs a Project-scoped metadata owner that can list all Resource families
without pretending it owns each family's content. A candidate Resource record
contains a stable Resource ID, Project ID, kind, display name, timestamps,
origin, and a typed link to the canonical family object when one exists.

The detailed design must choose between a registry-led lifecycle and a
projection assembled from family owners. It must define:

- whether the Resource ID is also the family object ID or maps to a separate
  stable target ID;
- how create/rename/delete remain coherent when metadata and family content are
  persisted by different capability stores;
- how existing Documents are adopted without name matching or duplicate rows;
- behavior for kinds whose content capability is not built yet (`spreadsheet`,
  `chat`, and uploaded `general` Files);
- list/filter/search/sort/pagination bounds;
- authorization and deletion semantics; and
- how Decks from `feature/slides` join the catalog after that branch is merged.

The catalog should not become a generic JSON content store. Documents, Decks,
future Workbooks, Chats, and Files remain canonical owners of their content and
specialized mutation rules.

### 3. Project activity ledger

Activity should be a Project-scoped append-only read model populated from
accepted application mutations. The first useful producers are Resource
create/rename/delete and Project/member/access changes; content-edit events can
follow once event granularity and noise limits are deliberate.

The design must settle event identity, stable action vocabulary, actor and
target snapshots, cursor ordering, tombstoned/deleted targets, retention, and
write consistency. It should not scrape request logs, replay unrelated internal
change records on every read, or allow a model/client to assert that an event
occurred. Events are emitted only after the owning capability confirms the
effect.

### 4. AI Resource generation

Generation is an application workflow above Resource metadata, family content,
Intelligence, Knowledge, Agent tools, and Jobs/Tasks. Intelligence should not
create a Resource directly. Trusted application code selects the Project,
permitted kind, creator adapter, tools, limits, and final persistence path.

The next design pass must decide:

- whether the public asynchronous identity is a platform Job, an Agent Task,
  or a Task with an associated Job rather than two competing status models;
- when Resource metadata becomes visible and what happens after generation
  failure or cancellation;
- idempotency and retry behavior so one request cannot create duplicate
  Resources;
- which kinds are honestly supported at each increment;
- whether kind inference is allowed and how a requested/selected kind bounds it;
- how templates are represented without mixing them into the model prompt; and
- how usage, errors, and confirmed tool effects are returned.

Main already supplies Intelligence and basic Jobs. The unmerged
`feature/quarterback-ask` branch supplies useful Action/Persona/Task machinery
and Document authoring tools; `feature/slides` supplies the Deck data
foundation but no Deck HTTP/tool surface. Both are prerequisites to evaluate,
not capabilities this audit branch can assume are already merged.

### 5. Contract reconciliation for completed requests

No replacement implementation is planned for members, rename, icon, display
name, or current link access. The follow-up work is to compare Alpha's client
calls with the existing Omega routes and update Alpha's request statuses after
integration.

Two points need an explicit product answer during the design review:

- Does Project `updatedAt` mean metadata modification time, or the latest
  accepted mutation anywhere in the Project? If the latter, Resource/content
  mutations need a safe aggregate touch mechanism.
- Is authenticated read-member self-join sufficient for “anyone with the
  link”? If anonymous access is newly required, that is a separate identity and
  authorization design—not an adjustment to the existing visibility string.

## Dependency order

```text
Project purpose persistence ───────────────────────────────┐
                                                          ├─ optional purpose draft
Resource catalog ──┬─ Resource lifecycle activity ─────────┤
                   ├─ stable targets for tabs              │
                   └─ Resource generation ─────────────────┘

Quarterback Action + family creator tools ── Resource generation
Slides capability + Deck application surface ── slides catalog/generation support
Files/Workbooks/Chats ── their corresponding catalog content adapters
```

Purpose persistence is independent and can ship first. The Resource catalog is
the central dependency for the new Alpha work. Activity should consume
confirmed catalog/family effects, and generation should create through the same
ordinary lifecycle rather than establishing a second Resource path.

## Proposed implementation increments

The following is intentionally a high-level plan. Exact types, operations,
schemas, and transaction boundaries require the next design pass.

1. **Project purpose:** finalize ownership/authorization, implement domain and
   storage fields, expose the Project read/update contract, and add deterministic
   unit, SQLite, transport, and dev integration tests.
2. **Resource catalog foundation:** finalize identity/lifecycle ownership,
   implement list/get/create/rename/delete for metadata-only admitted kinds,
   adopt real Documents by stable ID, and expose a bounded Project-scoped API.
3. **Resource-family adapters:** connect Document lifecycle first, then Decks
   after the Slides branch is integrated; reject unsupported content operations
   explicitly rather than manufacture fake content.
4. **Activity foundation:** persist immutable Project events, add stable cursor
   pagination, emit events from confirmed Project/Resource mutations, and test
   ordering, scoping, deletion snapshots, and pagination.
5. **AI generation:** reconcile the Agent branch onto current main, define the
   Task/Job contract, add a create-Resource action tool and one real supported
   family generator, then expand kind coverage only with real family tools.
6. **Contract closeout:** settle aggregate `updatedAt`, verify link-join client
   integration, document download/export as a distinct request, and publish an
   Omega-to-Alpha status matrix.

Every source increment must update paired `*.go.md` companions verbatim and add
or append its change record. Deterministic behavior belongs in unit/transport
tests. Any claim about model generation quality requires a tiny live-provider
`dev-test` that reports tokens and estimated cost; fake providers prove only the
workflow plumbing.

## Architecture constraints for the detailed plans

- Everything is scoped by the trusted Project context; a request or model never
  selects a different Project through arguments.
- Resource metadata indexes content owners; it does not erase their capability
  boundaries or validation rules.
- All mutations pass through the owning application capability and ordinary
  role checks. Activity observes confirmed effects and grants no authority.
- Model generation uses the fixed application tool library and structured
  outputs. It cannot discover system tools or write storage directly.
- Unsupported Resource kinds and download/export formats fail explicitly.
- Pagination, text, list, batch, event, tool, and generation sizes are bounded.
- New code is added in working vertical increments, not as empty scaffolding for
  every future Resource family.

## Design-review outcome

The first three agenda items are now resolved in the linked design and expanded
into file-by-file tasks. The implementation will use family-owned Resource
identity and metadata, an owner-routed catalog with no duplicate Resource table,
field-specific Project-purpose authorization, aggregate Project `updatedAt`
projection, and an Activity feed populated only by facts committed atomically
with canonical Resource mutations.

AI generation Task/Job orchestration and feature-branch integration remain
deliberately deferred. They are not prerequisites for the accepted deterministic
work and will not be pulled into this branch indirectly.
