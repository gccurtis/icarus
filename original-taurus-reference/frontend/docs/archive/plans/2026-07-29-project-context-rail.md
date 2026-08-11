# Plan — the project context rail (2026-07-29)

**Status: ✅ SHIPPED 2026-07-29 — all five workstreams (A–E) landed.** Records:
`docs/archive/records/2026-07-29-context-rail-properties.md`, `…-context-rail-all-resources.md`,
`…-context-rail-history.md`, `…-activity-filter.md`, `…-context-rail-members.md`.

Two things diverged from the plan below, both because the browser said so and both recorded:
**"mark the active resource"** in All resources became **"already open in a tab"** (a resource stage
contributes its own context set, so the project rail is off screen while a resource is active), and
the activity filter shipped to the **Overview stage's Activity box as well as** the rail's History
lens, sharing one dialog and one predicate. `Properties` also adopted `ProjectSharing`'s own words for
access modes ("Private" / "Anyone with link") rather than inventing "Invite only".

The left rail's project-context set is the fallback every non-resource
stage gets — in practice, Overview's context panel. Two of its four sections were holding copy
(`History` was one paragraph promising a later increment; `Properties` was three lines and a
sentence explaining that resource editors replace it), and a fourth (`Personas`) no longer earns
a rail slot now that agent authoring lives at `/library/agents`. This plan replaces the set with
four lenses that are worth opening.

Design settled in conversation with the user on 2026-07-29; the shape below is what they approved.

---

## 1. The set

| Section | Was | Becomes |
| --- | --- | --- |
| Properties | 3 lines of text | A read-only project card + routes into the existing dialogs |
| All resources | flat list + import/export | Fixed head (import/export + search) over collapsible groups |
| History | placeholder paragraph | The whole activity timeline, day-grouped, paged, filterable |
| Personas | read-only persona list | **Deleted** — `/library/agents` owns personalities now |
| Members | — | **New** — who can reach this project, and who is on it |

The `personas` store stays: the dock's persona picker reads it. Only the rail panel goes.

## 2. Settled decisions

**D1 — The rail shows and routes; it does not write.** Rename, icon, purpose, access mode and
member roles all already have an owner (`ProjectSettingsDialog`, the stage's `PurposeStatement`,
`ProjectSharing`). The rail mounts those components rather than reimplementing them — the lesson
from workstream E, where a 41-line mock Share dialog drifted from the real settings UI for weeks.

**D2 — The head block is fixed and the results scroll, with no change to `SidePanel` and no
sticky positioning.** `SidePanel` renders panel content inside one `min-h-0 flex-1 overflow-auto
px-3 pb-3` box. A lens whose root is `flex h-full flex-col` makes that box *inert*: the child
resolves `h-full` against the content box (panel height − the 12px `pb-3`), so `scrollHeight`
(child + padding) equals `clientHeight` and the outer scroller never engages. The lens then owns
its own scroll region — one new primitive, `components/PanelResults.svelte` — and the other 15
panel mount points are untouched.

**D3 — Search in the rail is a navigator filter, not a second table.** It filters the rail's own
list by name over the fully-loaded catalog (`enterProjectResources` pages `/resources` to
exhaustion, so the client's list is complete). The stage's `ResourceTable` keeps its own in-surface
search and filter popover for working with rows. Searching *inside* documents is not offered:
Omega has no content-search route, and the knowledge lattice's search is an agent tool, not an
HTTP endpoint.

**D4 — Activity filtering is client-side but complete in the limit.** `/activity` accepts only
`limit`, `cursor` and `targetID` (`activity.ts`), so person and type filters are predicates over
loaded events — every event already carries `actor.id` and `target.kind`. `Load more` keeps
fetching and applying the predicate, and the footer says either `Load more` or that the history is
exhausted, so the filter is never silently partial. A filter naming exactly one resource takes the
server path (`targetID`) instead, which is exact and cheap. The cap stays `FEED_EVENT_CAP` (100),
Omega's own `activity.MaxLimit`.

**D5 — History rows open their target; they do not drive the inspector.** The Activity lens that
renders a change lives in Overview's *inspector* contribution, and the rail outlives the Overview
stage — a row click from inside a document would have nowhere to render. The actor keeps the
stage feed's `IdentityHoverCard` and the redaction rule (`isTargetRedacted`) is shared, so a
deleted or restricted target reads the same in both places.

**D6 — Project-level presence is mocked, badged, and requested from Omega.** Omega's presence
capability is keyed by *document* (`core/capability/presence/presence.go`: `byDoc map[string]
map[string]Entry`), and `joinSession()` is called only by `DocumentStage` — so today "active in
this project" means "has a document open", and a user sitting on Overview is invisible to
everyone including themselves. Rather than lift Alpha's session plumbing to paper over that, the
`On now` group runs on a project-keyed **mock** carrying a `MockBadge`, and
`docs/backend-requests/project-level-presence.md` asks Omega for the real thing. The current user
is real in that list (from `session`), because "you should see yourself" is the whole point.

## 3. Workstreams

Each ends in a committable, verified deliverable with its own change record.

- **A — Panel anatomy + Properties.** `components/PanelResults.svelte`; `createdAt`/`updatedAt`
  carried through the projects edge (Omega has always sent them on `GET /projects` — Alpha's
  `ApiProject` dropped them); `ProjectPropertiesPanel` becomes the project card.
- **B — All resources.** Fixed head (import/export, search) over `PanelResults`; a `Pinned` group
  and one group per kind, each collapsible with its count; the open resource marked; restricted
  resources marked. Grouping/filtering is a pure, tested module.
- **C — History.** Day-grouped paged timeline sharing the stage feed's identity and redaction
  rules.
- **D — The activity filter.** A pure predicate module + a filter modal (person from the member
  roster; resources chosen by name, with per-kind select-all) + removable chips in the head. Used
  by History, and offered in the stage feed's header.
- **E — Members.** The roster ordered owner → editors → viewers; the mocked `On now` group;
  `Manage access…` mounting `ProjectSharing`. Drops `PersonasPanel` and wires the new set into
  `shell-sections.ts`. Files the backend request.

## 4. Gates

`pnpm check` · `pnpm test` · `node scripts/verify-companions.mjs <changed sources>` · `pnpm build`,
per workstream. New pure modules get unit tests (grouping, the activity predicate, the roster
ordering). This plan moves to `docs/archive/plans/` when E lands.
