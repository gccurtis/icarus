# Change record — 2026-07-21 — Overview redesign (home, not a mini launcher)

Reshaped the Overview stage from "a simpler New tab" into a genuine **project home**.
It now answers the questions a member has when they land on a project: *what is this?*,
*what can I make?*, *what's been happening?*, and *what's here?* — while keeping the full
resource table so nothing is lost.

## New layout

Top to bottom (frame never scrolls; the activity feed and the table body scroll within
their own regions):

1. **Centered project name** — the hero.
2. **Purpose statement** — a centered, editable line (or few) describing the project.
3. **Create (left) + Activity (right)** — a two-column band.
4. **Resources** — the full existing `ResourceTable`.

## Purpose statement

```svelte
<PurposeStatement {projectId} />
```

An editable, centered field that reads as prose (borderless until hover/focus). Empty by
default; while empty it offers a mock **Draft with AI** button (mirrors "if no one writes
one, AI drafts it"). Persisted per project in `localStorage`.

**Why a mock:** Omega has no project purpose/description field yet. New data-boundary
functions `loadPurpose`/`savePurpose` live in `src/lib/data/overview.ts`; the gap is
recorded in `docs/discrepancies/overview.md` and asked for in
`docs/backend-requests/project-purpose.md`.

## Create column

```svelte
<CreateColumn {kindMeta} oncreate={create} />
```

The horizontal New-tab panel didn't fit a two-column home, so Overview gets a vertical
**Create** list: a "Create" eyebrow over one icon+label row per creatable kind
(Document / Sheet / Slides / Chat). A create adds the resource and opens it as a new tab
— same behavior as before. Overview no longer mounts the AI-create dialog; its AI
surfaces are the purpose's "Draft with AI" and the Quarterback bar.

## Activity feed

```svelte
<ActivityFeed {projectId} />
```

A scrollable **Activity** channel: `<actor> <action> <resource>` + a "time · day" stamp,
newest first, paging in more as you scroll near the bottom. Clearly badged **Mock**.

**Why a mock:** Omega exposes no activity/audit endpoint. `src/lib/data/overview.ts`
generates a stable, per-project pseudo-random stream and pages it (`loadActivityPage`).
Recorded in `docs/discrepancies/overview.md`; asked for in
`docs/backend-requests/activity-feed.md` (a cursor-paginated per-project feed).

## Files

- **New:** `src/lib/data/overview.ts` (+ companion) — purpose + activity mock boundary.
- **New:** `PurposeStatement.svelte`, `CreateColumn.svelte`, `ActivityFeed.svelte`
  (+ companions) under `src/lib/features/stages/`.
- **Changed:** `OverviewStage.svelte` (+ companion) — the new layout; dropped the
  `NewResourcePanel` + `AiCreateDialog` usage here (New tab still uses them).
- **Docs:** `backend-requests/project-purpose.md`, `backend-requests/activity-feed.md`,
  `discrepancies/overview.md`; updated both index READMEs. Also fixed a stale `board`
  kind reference in `discrepancies/resources.md` (board was removed earlier).

## Notes / decisions

- **Frame doesn't scroll** — kept the established non-scrolling stage pattern (as with
  New tab): the activity feed and the table each own a bounded, internally-scrolling
  region rather than making the whole stage a scroll page.
- **Create labels are nouns** ("Document", not "New document") — the verb is carried by
  the "Create" section header.
- The resource table itself is untouched (still the same mock from
  `discrepancies/resources.md`).
