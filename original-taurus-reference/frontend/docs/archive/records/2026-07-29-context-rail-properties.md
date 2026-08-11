# 2026-07-29 — The context rail gets an anatomy, and Properties gets a reason to open

First of five changes rebuilding the left rail's project-context set (plan:
[`docs/plans/2026-07-29-project-context-rail.md`](../../plans/2026-07-29-project-context-rail.md)).
This one lays the shared anatomy every following lens uses, carries two fields Omega was already
sending across the data boundary, and replaces the Properties placeholder.

## The anatomy problem, and why nothing in `SidePanel` changed

The user's requirement for the rail was that import/export and the search field stay visible while
results scroll under them. `SidePanel` puts all panel content in one
`min-h-0 flex-1 overflow-auto px-3 pb-3` box, so the obvious answers were sticky positioning (a
hack) or inverting the contract so every one of the 18 panel mount points owns its overflow (churn
across the whole app, including the document editor's ten panels).

Neither was needed. A lens whose root is `flex h-full flex-col` makes the outer scroller **inert**:
`h-full` resolves against that box's *content* height (panel height − the 12px `pb-3`), so its
`scrollHeight` (child + padding) equals its `clientHeight` and it never engages. The lens then owns
its own scroll region.

```svelte
<div class="panel-results min-h-0 flex-1 overflow-auto">
  {@render children?.()}
</div>
```

`components/PanelResults.svelte` is that region, carrying the hidden-scrollbar styling `SidePanel`
already uses on the rails. Panels that don't opt in are untouched.

## Project timestamps — a field we were already being given

Omega's `projectJSON` has always carried `createdAt` (RFC3339) and `updatedAt` (RFC3339Nano), and
`oneView` delegates to the same `views` builder as `GET /projects`, so a POST/PATCH/join reply
carries them too. Alpha's `ApiProject` simply dropped them.

```ts
function toTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}
```

`undefined` rather than `0`, so "we don't know" cannot render as 1970 — which matters because the
shell synthesizes a placeholder `Project` from the route before `GET /projects` answers, and that
object genuinely doesn't know them. `updateProject` now refreshes `updatedAt` from its own response
(`?? x.updatedAt`, so a response without it doesn't blank the field). Two tests pin the parse,
including the nanosecond tail.

Omega maxes the project's own update time against its newest activity event, so the UI labels this
**Last activity**, not "Updated" — the latter would imply a rename stamp it isn't.

## A cached roster for the read-only surfaces

```ts
export type RosterState = {
  projectId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  members: Member[];
  error: string;
};
```

`ProjectSharing` keeps its own roster copy deliberately — it writes, and wants its list to reflect
what it just did. The rail's Properties and Members lenses only read and mount one at a time as the
user flips sections, so they share `systems/projects/roster.ts` instead of re-fetching per flip. The
state names its project, which makes strict project isolation mechanical: a load for another project
replaces the record, and the post-await guard drops a reply for a project already left. `byAccess`
(owner → editors → viewers, alphabetical within a role) and `ownerOf` are pure and tested directly —
the ordering is the one thing the user specified exactly, so it is asserted in a unit test rather
than inferred from rendered DOM.

## Properties

Was three lines: the name, your role, and a sentence explaining that resource editors replace the
panel — documentation of the panel system aimed at the user, who does not need it. Now: identity and
purpose in a fixed head; Access (in the user's words, "Anyone with the link" / "Invite only"), your
role, the owner, Created, and Last activity in a scrolling middle; a `Contents` breakdown counted
from the fully-loaded catalog; and a fixed foot with Share and Settings.

Those two buttons mount the **existing** `ShareDialog` and `ProjectSettingsDialog`. The rail shows
and routes; it does not write. Every field here already has an owner, and standing up a second
editor beside them is exactly the drift that made the old mock Share dialog worth deleting
(workstream E).

## Verification

`pnpm check` 0 errors / 0 warnings · `pnpm test` 385 → **397 passing** (12 new: 10 for the roster,
2 for the timestamp parse) · `verify-companions` OK on all five non-exempt sources
(`src/lib/components/*` is exempt by AGENTS.md) · `pnpm build` clean.
