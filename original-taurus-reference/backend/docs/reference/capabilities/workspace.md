# Workspace capability

## Purpose, ownership, and boundary

Workspace preserves one User's durable view of one Project and gives every
Resource family a consistent shell mount. It is the backend product-view model
for permanent destinations, Resource tabs, active durable destination, and
panel geometry. It is not identity, authorization, canonical Resource content,
browser session state, or editor state.

Workspace owns per-User/per-Project workspace snapshots, durable destination
identity/order, Resource-tab identity/order, active durable view, Context and
Inspector panel preferences, optimistic revision, private ordered Resource/
Data favorites, and safe restoration rules.

It does not own Project selection, New Tab selection, current editor selection,
scroll, prompt drafts, transient Context/Inspector facets, connection truth,
Resource summaries, or the contents rendered inside a tab. Control owns the
Project list and access. The browser owns transient projection state.

## Feature and experience contract

| Feature | Required behavior | Initial boundary | Retained breadth |
| --- | --- | --- | --- |
| Permanent destinations | `overview`, `data`, and `agents` have stable identities and cannot be closed/reordered behind Resource tabs | Overview implemented; Data/Agents may show honest incomplete state | Complete permanent screens |
| Resource tabs | Closeable/reorderable tabs after permanent destinations; at most one per Resource in a workspace snapshot | Document/File tabs | All Resource families |
| Favorites | Private ordered shortcuts to currently visible Resource or Data identities; never an access grant or content copy | Resource/Data reference contract and safe unavailable pruning | Owner-decorated favorite views and saved-view grouping if separately accepted |
| New Tab | Plus opens one transient launcher; create/open converts it in place; launcher and selection never persist | Create Document/open recent | Five editable families and richer browse |
| Active view | Restore only an authorized durable destination; missing/inaccessible Resource falls back safely | Required | User-configurable fallback |
| Panel layout | Persist Context/Inspector expanded/collapsed state and bounded width | Required | Responsive per-device profiles if explicitly added |
| Stable shell | Two-row chrome, left Context, center stage, right Inspector, compact Quarterback/status regions | Browser contract | Rich responsive/focus modes |
| Project switch | Dispose old Project state, abort work, advance generation, and reject late responses | Required | Warm-cell reuse without weakening fence |
| Connection status | Textual Connecting/Synced/Reconnecting/Stale/Offline/Failed; hints do not establish canonical truth | Required | Rich recovery actions |
| Accessibility | Visible focus, keyboard path, labels, announcements, reduced motion, forced colors, 200% zoom | Required | Family-specific spatial adaptations |
| Responsive mode | Preserve reading/review; explicitly declare unsupported spatial authoring instead of unusable compression | Document/File | All families |

### Project Overview

Overview is the signed-in landing surface for one bound Project. It composes
authorized owner projections; it does not copy their canonical state into the
Workspace snapshot.

| Overview area | Complete product contract | Initial implementation | Retained breadth |
| --- | --- | --- | --- |
| Project profile | Show name and editable description; save through the versioned Control Project-profile command with authority and consequence feedback | Name, description, edit/save and explicit conflict/error | Rich policy/default indicators without moving profile ownership |
| Create | Five primary actions: Document, Workbook, Deck, Board and Chat | Show every action descriptor but enable only registered, entitled handlers; Document arrives first | Templates for Document/Workbook/Deck/Board, starter/settings presets for Chat, and recent choices |
| Unified catalog | One paged Resource list with upload, open, duplicate, favorite/unfavorite, search, family/lifecycle filters, allowlisted sort, archive and restore | Rebuildable owner-supplied summary projection, private favorite overlay and owner-routed lifecycle actions with honest family availability | Rich owner-supplied summaries and saved views if separately accepted |
| Members | Owner and authorized Project members with roles and a sharing entry point | Bounded read projection and link to Control action | Full Stage 14 administration, invite and ownership ceremony |
| Activity/history | Recent semantic Activity plus selected-Resource canonical history | Explicit unavailable state before Stage 12 | Bounded filters, review and owner-specific history projections |
| Data health | Counts and actionable items by current/stale/resolving/failed/needs-review state | Explicit unavailable state before Stage 07 | Lineage impact, refresh/review actions and health trends |
| Project Agent | Zero/one Project Agent identity and sparse evidence-linked recommendations | Explicit unavailable state before Stage 12 | Why-now, expiry, mute/accept and Quarterback draft conversion |
| Inspector | Selection-aware Project/Resource metadata, provenance, lifecycle, version and registered actions | Project and catalog metadata only | Family, Collaboration, Data and Agent facets |

Optional sections carry `available`, `unavailable`, or `degraded` status and a
safe reason. An unavailable capability never appears as a successful empty
list. Failure of authority, placement, catalog integrity or workspace integrity
fails Overview; failure of an optional owner degrades only that named section.

### New Tab

New Tab is one transient launcher and browse surface over the registered
capability catalog. It supports:

- create Document, Workbook, Deck or Board through the owning family's
  operation and family-owned blank/template choices, or create Chat from blank
  or a starter/settings preset that is not a Template;
- upload a File through Files when upload is registered and entitled;
- open recent or searched Resources from the unified catalog;
- apply bounded family/lifecycle/creator filters and allowlisted sorting; and
- inspect a candidate's safe metadata before open.

The initial slice enables Document create and authorized recent/open; the
descriptor contract already represents all five families and upload with
truthful availability. Files enables upload, and the remaining family stages
enable their create actions. Choosing create/open converts the transient view
in place to one Resource tab. Closing, navigating away or reloading discards
launcher query, filters, selection, template choice, draft name and upload
progress; none enters `WorkspaceSnapshot`.

The stable visual grammar is:

```text
upper chrome: Project / export / status / identity
lower chrome: Overview · Data · Agents · Resource tabs · +
body:         Context | active work stage | Inspector
bottom:       status + compact/engaged Quarterback
```

Panel size/collapse is workspace-level. Resource selection, Context subview,
Inspector facet, prompt draft, scroll, editor session, hover, drag, and open
menus are per browser view/tab and never enter the canonical snapshot.

## Domain model

```text
WorkspaceSnapshot {
  workspace_id, user_id, project_id, revision,
  destinations[], active_destination, panels, updated_at
}

Destination = PermanentDestination | ResourceDestination

PermanentDestination {
  destination_id, kind = overview|data|agents
}

ResourceDestination {
  destination_id, resource_id, resource_kind, opened_at
}

PanelPreferences {
  context_open, context_width, inspector_open, inspector_width
}

WorkspacePatch {
  expected_revision, destination_operations[], active_destination?, panels?
}

FavoriteSet {
  user_id, project_id, revision, ordered_favorites[], updated_at
}

FavoriteRef = ResourceFavorite | DataFavorite

ResourceFavorite {
  resource_id, resource_kind
}

DataFavorite {
  data_object_id, data_kind
}
```

`user_id` and `project_id` are derived from the bound Cell key in handlers,
not trusted from request content. The serialized model has no Cell instance,
database placement, session token, selection, editor object, callback, mutex,
channel, provider object, or runtime handle.

Invariants:

- exactly one snapshot exists per User/Project once created;
- permanent destinations exist once in fixed order before Resource tabs;
- each Resource appears at most once;
- active destination refers to an included durable destination;
- New Tab and other transient views are never serialized;
- widths are clamped to versioned accessibility/layout bounds;
- inaccessible/deleted/archived Resources are pruned or represented by a safe
  unavailable shell state according to current authority; and
- a snapshot from one Project/session generation can never replace another;
- each favorite identity appears at most once in its tagged namespace;
- a favorite records no title, content, permission, Data value, provider
  object, query result or canonical owner version; and
- listing/opening a favorite reauthorizes and decorates it through its current
  Resource-family or Formula/Data owner, pruning or returning an
  undisclosing-unavailable ref when policy requires.

## Commands and queries

| Operation | Kind | Behavior |
| --- | --- | --- |
| `overview.get.v1` | Composition query | Returns bounded Project profile, catalog, members and registered optional sections with explicit availability |
| `launcher.get.v1` | Composition query | Returns five create descriptors, upload availability and authorized recent Resources; stores no launcher state |
| `resources.list.v1` | Catalog query | Returns an authorized bounded Resource page under versioned search/filter/sort input |
| `workspace.get.v1` | Query | Returns current authorized snapshot plus revision and safe Resource mounts |
| `workspace.initialize.v1` | Command | Idempotently creates the default permanent-destination snapshot |
| `workspace.open_resource.v1` | Command | Adds/deduplicates a currently visible Resource tab and activates it |
| `workspace.close_resource.v1` | Command | Removes a tab and deterministically selects the next durable destination |
| `workspace.reorder_resources.v1` | Command | Reorders only Resource destinations by expected revision |
| `workspace.activate.v1` | Command | Activates an included durable destination |
| `workspace.update_panels.v1` | Command | Conditionally stores bounded panel preferences |
| `workspace.replace.v1` | Command | Applies a fully validated conditional snapshot replacement for compact clients |
| `workspace.reconcile.v1` | Command | Prunes invalid mounts and conditionally commits a safe canonical revision |
| `workspace.favorites.list.v1` | Query | Returns the current private ordered favorite refs decorated only with currently authorized safe owner projections |
| `workspace.favorites.add.v1` | Command | Conditionally adds/moves one currently visible exact Resource or Data identity; it grants nothing |
| `workspace.favorites.remove.v1` | Command | Conditionally removes one expected favorite without changing owner state or access |
| `workspace.favorites.reorder.v1` | Command | Conditionally reorders exactly the current User's still-authorized favorite identities |

The first three operations are read-only shell compositions outside the
Workspace aggregate. Profile, family create, upload, lifecycle, sharing,
refresh and recommendation actions route to their canonical owners. Overview
and launcher never acquire mutation permits themselves.

Create/open flows do not persist New Tab. After a Resource owner successfully
creates or resolves a Resource, the browser calls `workspace.open_resource.v1`
or the handler uses an explicit bounded nested operation. If the workspace
update conflicts, Resource creation remains successful and the client reloads
then retries the idempotent open; no distributed transaction is implied.

## Mount and shell ports

Workspace stores stable references only. The catalog is likewise a rebuildable
cross-family projection, never Resource identity or lifecycle truth. Resource
families expose shell
contracts through handler adapters:

```go
type ResourceMountReader interface {
    ResolveMount(context.Context, ResourceRef) (ResourceMount, error)
}

type ResourceMount struct {
    ResourceID ResourceID
    Kind       ResourceKind
    Title      string
    Lifecycle  Lifecycle
    Version    VersionRef
    Route      RouteRef
    Actions    []ActionRef
}

type FavoriteTargetReader interface {
    ResolveFavorites(context.Context, []FavoriteRef) ([]FavoriteProjection, error)
}
```

The Workspace handler may batch authorized mount queries through the Resource
family registry and favorite decoration through a wiring-owned adapter over the
Resource-family registry and Formula/Data handler. Workspace never imports
their implementations or treats a generic summary as canonical family
content.

The web shell owns a client `WorkspaceProjection` adapter that maps snapshots
to routes/tabs/panels. Family screen adapters mount their Context, work stage,
Inspector, Quarterback context, selection registry, responsive state, and
recovery behavior. These adapters cannot persist canonical Resources directly.

## Persistence and concurrency

Workspace uses a compact aggregate revision with conditional replacement or
normalized equivalent preserving the same semantics.

Favorites are a separate compact per-User/per-Project aggregate with their own
revision so a frequent shortcut change cannot conflict with tab/panel layout.
They store only the closed `FavoriteRef` union. Resource and Data owners remain
canonical; favorite listing batches current authorized decoration through
registered owner adapters and is correct with caches disabled.

- Every mutation supplies expected revision and idempotency where required.
- Exact replay returns the committed snapshot; divergent replay conflicts.
- Concurrent non-overlapping client intents may be reloaded and retried by the
  client/handler. The server never silently overwrites an unknown newer
  snapshot.
- Panel preferences are intentionally replaceable fields only after expected-
  revision validation; this is not universal last-write-wins.
- Resource truth and Workspace tab state are separate transactions. Safe
  reconciliation handles a missing/deleted/inaccessible Resource.
- Realtime carries only a committed versioned invalidation hint. Missed/gapped
  hints cause `workspace.get.v1`; correctness does not require delivery.
- No Workspace goroutine, mailbox, event stream, or browser-affinity lock
  exists. Multiple same-scope Cells converge through Project state.

Every mutation rechecks current durable authority and consumes a fresh one-use
permit with Workspace state, idempotency, and required Audit in one Project
transaction.

## Security, privacy, and errors

Workspace queries authorize every returned Resource mount under current
authority. A stale tab may not disclose a Resource title, kind, existence, or
last version after access is revoked. Private User workspace state is not
visible to other Project members or Agents unless an explicit future feature
defines that access.

The snapshot contains no secrets, Resource bodies, prompts, selections, or
provider data. Required Audit records safe view-operation metadata but not the
whole tab list by default. Activity should not report ordinary private tab and
panel/favorite manipulation.

Stable failures include invalid destination/order/width, duplicate or missing
Resource, expected revision conflict, stale Project/session generation,
unauthorized/inaccessible Resource, unsupported snapshot version, and
integrity failure. Favorite-specific failures include unknown favorite kind,
invalid target, duplicate/reorder mismatch and inaccessible Resource/Data
identity. Unauthorized existence maps to `not_found`; stale async
responses are discarded client-side and rejected server-side when submitted.

## Cross-capability contracts

- Control supplies authorized Project selection before a Cell exists;
  Workspace begins only after immutable User/Project binding.
- Resource families own identity, content, lifecycle, title, attribution,
  actions, routes, and screen adapters. The catalog projects their bounded
  summaries; Workspace stores references and layout only.
- Data and Agents permanent destinations query their owning capabilities; an
  honest incomplete state is preferable to placeholder data.
- Collaboration provides optional presence/update hints but not Workspace
  authority or truth.
- Quarterback uses active scope/target projection; Workspace does not own Ask,
  Task, or Result state.
- Translation/export actions shown in chrome invoke their owner operations and
  do not become Workspace state.
- Control owns Project profile/members/sharing. Resource families own create,
  lifecycle, history and Inspector facets. Files owns upload, Data Catalog owns
  data health, Activity owns its feed, and Agents owns Project Agent and
  recommendations. Workspace/Overview only composes authorized projections.

## Headless and browser proof plan

1. Initialize produces exactly the three permanent destinations in fixed order.
2. Open is idempotent, one tab per Resource, conversion from transient New Tab
   persists no launcher/selection state.
3. Close/reorder/activate/panel commands enforce revisions and deterministic
   fallback under concurrent clients and race.
4. Persist/restart restores durable tabs/order/active/panels and none of the
   prohibited transient fields.
5. Project switch/sign-out aborts requests, advances generation, disposes old
   projection, and late responses cannot overwrite the new Project.
6. Deleted/archived/revoked Resource restoration discloses nothing and falls
   back safely.
7. Multiple same-scope Cells converge through conditional Project state with
   caches/realtime disabled and after hint gaps.
8. Cross-User and cross-Project snapshot access, forged IDs, stale permits, and
   replay fail closed.
9. Browser keyboard/focus/announcement/200%-zoom/forced-colors/reduced-motion
   tests cover chrome, tabs, panels, status, and recovery.
10. Responsive tests preserve reading/review and explicitly announce any
    unsupported spatial editing mode.
11. Overview profile conflict, five create descriptors, unified catalog query,
    upload availability, members, optional-section degradation and Inspector
    selection all preserve their owning authority and stable errors.
12. New Tab cancel/reload stores none of its query/filter/template/draft/upload
    interaction state; create/open converts exactly once to a durable tab.
13. Resource/Data favorite add/remove/reorder is private and revision-safe;
    forged/cross-Project IDs, access loss and deletion disclose nothing, and a
    favorite never changes owner state or grants access.

The initial journey is Sign-in -> Project Selection -> Overview -> transient
New Tab -> create/open Document/File -> Resource tab -> reload restoration ->
Project switch disposal, fully reproducible through Product operations and a
browser projection.

## Source grounding

- [SOL X 15 — Workspace shell](https://app.notion.com/p/39ab6410e502815993f9c185aaa5ff4b)
- [SOL X 25 — Workspace persistence](https://app.notion.com/p/39ab6410e502815181b3d2823db55262)
- [SOL X 16 — Project Overview and catalog](https://app.notion.com/p/39ab6410e5028101ab70d2f429b67174)
- [SOL X 79 — Two-Row Top Chrome, Project Menu & Identity Menu](https://app.notion.com/p/39ab6410e50281ddab3cd0b8ab372495)
- [Original Shell, Surfaces & Screens](https://app.notion.com/p/37fb6410e50281a4806dd3834c392b2c)
- [Omega system map](../architecture/system-map.md)
- [Omega request dispatch](../architecture/request-dispatch.md)
- [Omega product experience map](../product/experience-map.md)

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
Nova working durable evidence includes the composed
[`productworkspace` graph](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/app/productworkspace/durable.go)
and its [live MySQL composition test](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/test/integration/durable_composition_integration_test.go).
They prove per-User/Project permanent destinations, Resource tabs, active view,
panel state, restart, revocation and isolation. Data and Agents destinations,
complete route-backed sharing, offline/multi-device convergence and Omega's
full shell remain target-only.
