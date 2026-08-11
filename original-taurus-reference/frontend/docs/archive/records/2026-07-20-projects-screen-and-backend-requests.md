# Change record — 2026-07-20 — Projects screen (real data) + backend-requests

The project selection screen is wired to real Omega data (with clearly-badged
mocks for the gaps), a popover-clipping bug is fixed, and a new
`docs/backend-requests/` directory separates actionable backend asks from
front-end reconciliation notes.

## Projects screen on real Omega data

```ts
// src/lib/data/projects.ts — REAL: fetchProjects/createProject/deleteProject/
// leaveProject/openProject; MOCK (local, *Mock): rename/visibility/members.
```

**Why:** the screen ran on mock data. **Purpose:** list/create/delete/leave/open
are now real; a `MemberAvatar` shows name/email/access on hover (you only — the
API exposes no other members); the settings modal keeps its full design with real
delete/leave/copy-link and mock-badged rename/visibility/members. **Why this way:**
front-end roles (`owner/editor/viewer`) are translated from Omega's
`owner/edit/read` at the boundary; mocks are named `*Mock` and badged in the UI so
the gaps are obvious and the later swap to real endpoints is mechanical.

## Fixed popover clipping in the projects list

```svelte
<!-- was: overflow-hidden (clipped the hover card + kebab menu) -->
<div class="mt-6 rounded-panel border border-border"> ... rounded-t-panel header,
     last:rounded-b-panel row ...
```

**Why:** with one short row, the member hover card and the three-dots dropdown were
cut off. **Purpose:** let popovers escape the list box. **Why this way:** the box's
`overflow-hidden` (used only to clip corners) was the clip; corners are now rounded
on the header + last row instead, and the member card opens downward so it doesn't
fight the header. (General note: these dropdowns still clip under any
`overflow-hidden`/scroll ancestor — a portal is the eventual robust fix.)

## Added docs/backend-requests/ (actionable backend backlog)

```text
docs/backend-requests/{README, project-members, project-updates}.md
```

**Why:** feature gaps (things the backend must build) were mixed into
`discrepancies/` alongside terminology notes the backend needn't act on. **Purpose:**
a prioritized "build this" list Omega can plan against, separate from the
front-end's current-state reconciliation. **Why this way:** a terminology/shape
difference is only a discrepancy (translate it); a feature gap is both a discrepancy
(mock now) and a request here (build later), cross-linked. `project-members` is High
(unblocks real members + hover); `project-updates` covers rename, visibility, and
timestamps. The convention is documented in AGENTS.md and the discrepancy READMEs.
