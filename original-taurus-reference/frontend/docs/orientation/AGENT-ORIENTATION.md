# Agent orientation — start here (current as of 2026-07-29)

You are a coding agent about to work in **`taurus-alpha`**. Read this top to bottom, then
skim [`AGENTS.md`](../../AGENTS.md) (the law) and the older evergreen
[`README.md`](README.md) (vocabulary, directory map, design system, gotchas — still
accurate). This file is the **current** picture: what's built, how the runtime is shaped,
**how to make companion docs correctly**, how to build/test/verify, and the open tasks.

The single fastest way to understand any file is to read its **`.md` companion** next to it,
not the code.

---

## 1. What this is

`taurus-alpha` is the **front-end cockpit** for **Taurus Omega**, a separate Go engine that
lives at **`../taurus-omega`** (sibling repo; HTTPS on `127.0.0.1:8443` in dev). Alpha is
front-end only: SvelteKit + **Svelte 5 runes**. Talk to Omega across the data boundary
(§4), never add backend logic here.

**Front-end first:** design the UX, then back it with Omega. When Omega's model differs, the
**UX shape wins in the interface** — translate at the edge (`src/lib/data/*`) and record the
translation in the [architecture doc](../architecture/README.md) for the subsystem that does
it. If the backend must build something, add an actionable entry in `docs/backend-requests/`
and badge or mock the UI until it lands.

## 2. Current state — essentially fully built (2026-07-29)

Almost everything is real and Omega-backed now. This supersedes the older README's real/mock
table.

**Real / wired:**
- Auth + session + persisted display name; projects (create/rename/icon/visibility/purpose/
  members+roles/role-carrying share links/timestamps); **organizations** (account-menu manager);
  **resource catalog** + access/pinning/attributes (project-wide vs restricted) ; **templates**;
  **member summary**; **workspace state** (Omega-backed with localStorage fallback); the
  **Activity feed**.
- **Document editor** (the big one): a real ProseMirror editor over Omega documents — change
  sets, inline **marks** (font/size/fg/bg + bold/italic/etc., partial-word), the block-kind model
  (7 `BlockKind`s — `text` with body/heading `subKind`s, `code`, `callout`, `list`, `divider`, `image`,
  `prompt`; *quote is an inline wrap, not a kind*), **Name Manager**
  (values + formulas), references/backlinks, history, comments, **collaboration presence**
  (real: last editor from the change history, open users from a polled `GET /sessions`), and the
  **Details inspector** with per-selection lenses.
- **AI dock**: real chats / turns / tasks (Ask / Action / Plan), attachments, and **per-chat
  personas** (just shipped — the picker sets the chat's persona via `PATCH /agent/chats/:id/persona`;
  a spawned task inherits its chat's persona). Validated against real models.
- Shell surfaces: the **"All resources"** table with **Import/Export** (real Markdown transfer via
  the per-kind table in `features/shared/transfer.ts`) and a top-bar **Share** button (real —
  `features/projects/ProjectSharing.svelte`, the same component Project settings renders).
- **The project-context rail** (left rail, the fallback set every non-resource stage gets — rebuilt
  2026-07-29): **Properties** (project card + routes into the real Share/Settings dialogs),
  **All resources** (a navigator: fixed Import/Export + search over collapsible `Pinned` and
  per-kind groups), **History** (the whole day-grouped, *uncapped* activity timeline, filterable),
  and **Members** (roster ordered owner → editors → viewers; presence mocked, see below). Personas
  left the rail — `/library/agents` owns personality authoring. Every lens keeps a **fixed head over
  a scrolling `PanelResults`**, which works because a lens rooted at `flex h-full flex-col` makes
  `SidePanel`'s own scroller inert; `e2e/context-rail.spec.ts` asserts that directly, so **add rail
  UI as a lens with that anatomy — do not reach for sticky positioning**. The activity filter
  (`features/shared/activity-filter.ts` + `ActivityFilterDialog`) is shared with the Overview
  stage's Activity box: one resource takes Omega's `?targetID=` path, everything else is a predicate
  over loaded pages and the surface always states the scope it searched.

**Still mock / deferred (badged or documented):**
- **The asset library** — three spaces under `/library/*`, all real screens on **mock fixtures**,
  badged in the shared shell's top bar. `/library/{context,templates}` render the
  [library console](../../src/lib/features/library/LibraryConsole.svelte.md) (owner scope, search,
  set algebra with a live resolved list, template previews, authored context slots, sharing,
  provenance); `/library/agents` (+ `/library/agents/[id]` per personality) renders the
  [Agents console](../../src/lib/features/library/AgentsConsole.svelte.md) — a cross-project
  task monitor with a steering panel, and versioned personality authoring. **Agents was the
  workspace's second permanent tab until 2026-07-29**; it was promoted to the route because
  agents span projects, and the tab strip is now Overview plus resource tabs. Omega *has*
  contexts, document templates, and personas (with versions and per-persona task history) —
  all project-scoped, so the owner-scoped libraries do not exist yet
  ([contexts/templates request](../backend-requests/asset-library-owner-scope.md),
  [agents request](../backend-requests/agents-console-scope.md),
  [roadmap](../roadmap/README.md) §1). The **Templates rail panel** is a separate, older mock
  that does not know the library exists; retiring it is roadmap work.
- **Quarterback context** — the picker's sources cannot reach the backend at all; both halves are
  filed as requests (`chat-turn-context-items`, `document-knowledge-ingestion`).
- **Project-level presence** — the Members lens's `On now` group. Omega's presence is keyed by
  *document* (`byDoc`) and Alpha registers a session only when a document opens, so a member sitting
  on Overview is present to nobody, including themselves. `systems/presence` composes **you** (real,
  from the session) with a deterministic mock over the real roster — the people are real, only "here
  right now" is invented — badged per entry and requested in
  [project-level-presence.md](../backend-requests/project-level-presence.md). Document presence is
  unaffected and real.
- pdf/docx and the **notifications feed** — deliberately not building
  ([roadmap](../roadmap/README.md)); **windowed row reads** — removed with pagination, not shelved;
  a **per-turn/per-task persona override**; AI *resource generation*.
- **Slides** run on a local mock deck, and spreadsheet/chat resources have no stage at all
  ([roadmap](../roadmap/README.md) §3).

## 3. Architecture — the layers

```
src/lib/systems/*     Capability modules. Each is types.ts / store.ts / api.ts / actions.ts
                      (+ companions). e.g. ai-agent, documents, organizations, resources,
                      projects, personas, workspace-state, identity-directory, session, slides.
src/lib/data/*        THE data boundary — ONE facade per system (api, session, projects,
                      resources, documents, workspace, transfer, …), each a one-line
                      re-export of $systems/<system>/index. Reach a specific module
                      directly as $systems/<system>/<submodule>; no other facades.
src/lib/features/*    UI composition. shell/ (AppShell, bars, TabStrip, SidePanel,
                      WorkSurface=stage router, QuarterbackDock, dialogs, panels/),
                      stages/ (overview, document, new-tab, slides), projects/, shared/.
                      Ownership-is-the-tree: stages never import each other; the shell never
                      imports a stage except through WorkSurface.
src/lib/components/*  ~50 UI primitives (Lego blocks). Barrel index.ts. EXEMPT from companions.
src/routes/*          SvelteKit routes (companioned).
```

**Strict project isolation** is law: project-scoped stores reset when the active project
changes (they subscribe to `workspace` and re-seed on a `projectId` change); nothing bleeds
across projects.

## 4. The runtime system

**Svelte 5 runes everywhere:** `$state`, `$derived` / `$derived.by`, `$effect`, `$props`,
`$bindable`; snippets `{#snippet}` / `{@render}`. State lives in Svelte `writable` **stores**
(e.g. `aiAgent`, `workspace`); a store's actions live in a sibling `actions.ts` and mutate it
via `update`. The project-isolation reset pattern (subscribe to `workspace`, `set(freshState())`
on project change) recurs in every project-scoped store.

**The document editor** (`src/lib/features/stages/document/`) — read
[`docs/architecture/document-editor.md`](../architecture/document-editor.md) first, then the
companions:
- `runtime.ts` (**543 lines — a thin orchestrator**, workstream C done) — it composes the
  `model/*` units, runs the one presentation pass, projects the `EditorSession`, and implements four
  seams: `PmHost` / `IndentHost` / `SyncHost` / `ActionsHost`. **The behaviour lives in `model/`:**
  `pm-state.ts` (the `EditorState`, the dispatch pipeline, the attached view) · `sync.ts` (server
  truth + load/flush/reload/retry) · `overlay.ts` (optimistic pending edits) · `selection.ts`
  (`deriveSelection` → one of seven **inspector lenses**: `none | run` (Selected Text) `| new-text`
  (Next Text, a caret) `| new-block | block | blocks | row`) · `presentation.ts` · `actions.ts` (the
  ~25 inspector commands) · `search.ts` · `panels.ts`. Every save **diffs the whole doc** against the
  server-truth `snapshot` (`diffDoc`) → change sets. The whole doc is loaded: row windowing was
  **deleted** with pagination, not shelved, and the whole-snapshot diff is the accepted ceiling.
- `editor/session.ts` — the reactive `SelectionInfo` / `InspectedBlock` / `TypographyState` types
  and the session object the panels read.
- `editor/bridge.ts` — Omega doc ↔ ProseMirror (`charToAnchor`/`anchorChar` byte-offset ↔ char).
- `editor/schema.ts` — PM nodes + marks.
- `panels/DetailsPanel.svelte` — the inspector, now a **42-line dispatcher** (workstream A, done):
  it renders the empty state + canonical-layout notice and hands the narrowed selection to one of
  `panels/details/lenses/*` — **five components** (None/Run/NewText/NewBlock/Block); the frozen
  `SelectionInfo` keeps its `row`/`blocks` modes but they fall back to `NoneLens` after workstream
  D removed block-manipulation chrome (UX1). Each lens composes
  `panels/details/controls/*` (13 controls) and **names its own row/block targets**; each control
  owns its own state. Shared pure bits live in `panels/details/lens-helpers.ts`. Inline typography
  = **range-based marks**; line spacing = row height. **Add new inspector UI as a control or a
  lens — do not grow `DetailsPanel.svelte`.**

**The AI dock**: `systems/ai-agent` (chats/turns/tasks/personas: types/api/store/actions) +
`features/shell/QuarterbackDock.svelte` (the always-mounted floating composer) +
`components/QuarterbackBar.svelte` (the composer UI, exempt) + `panels/QuarterbackPanel.svelte`
(the inspector side). Chats carry a persona; a turn spawns a durable **task** the client polls;
tasks inherit the chat's persona.

**Verify Omega contracts against `../taurus-omega` source before wiring** — the docs have been
wrong more than once. Grep the Go transport/handlers/capabilities directly.

## 5. Companion docs — how to make them correctly (Practice 1)

**Every hand-authored source/config file has a `<file>.md` twin beside it** that **explains** it —
its structure, the key pieces, and why they're shaped that way. This is the repo's defining
practice.

**The format is prose in `##` sections** — one per logical part of the file: a short heading, an
**illustrative** fenced snippet (the representative lines, not the whole file), and a paragraph on
what it does and why. A companion is documentation, **not a byte-exact mirror** — quote what's
worth explaining, summarise the rest. (Changed 2026-07-27: companions used to mirror the source
byte-for-byte, which doubled every edit. Older companions still read that way and are fine — no
need to strip them down; just keep them accurate as you touch the file.)

**The gate is a staleness check:**
```
node scripts/verify-companions.mjs <source-path> ...
```
It confirms each companion exists and that the source hasn't changed more recently than its
companion (git-based; a pending working-tree edit ranks as newest). `OK` = fresh; `STALE` = you
changed the source without updating the companion; `NO COMPANION` = missing. Exit 0 = clean.

**The workflow:**
1. Make the source edit.
2. Update the `.md` companion's prose/snippets to match, in the **same change** — so they share a
   commit and the companion is never older than the source.
3. `node scripts/verify-companions.mjs <that file>` → must be `OK`.
4. New source file → write its companion in the same step.

**Exempt from companions:** `src/lib/components/*` (self-documenting primitives), `*.test.ts`,
`*.spec.ts`, generated/lock/asset files (`pnpm-lock.yaml`, `package.json`, `*.svg`, …), and
markdown itself.

## 6. Build / test / verify / ship

Node + pnpm come from the **Nix flake** (or the direnv shell) — run tooling through it.

**Gates (all must be green before "done"):**
```
pnpm check                         # svelte-check: 0 errors / 0 warnings
pnpm test                          # vitest unit tests
node scripts/verify-companions.mjs <changed sources>   # 0 drift
pnpm build                         # production build (for shippable changes)
```

**The dev stack + REAL models:**
- Omega is the sibling `../taurus-omega`. `pnpm dev:all` (or `dev:start`/`dev:status`/`dev:logs`/
  `dev:stop`) runs both; Vite proxies `/api/*` → `https://127.0.0.1:8443`.
- **Omega serves real models via `taurus-omega/etc/config.local.yaml`** (an OpenRouter provider +
  model cast tables). A config without a provider makes agent turns 500 — **test with real
  models; stubbed-model results don't mean anything.**
- **Gotcha — Omega is `go run`: it compiles once at startup and does NOT hot-reload Go changes.**
  After any Omega change you must **restart Omega**, or the running (stale) binary 404s new routes
  / errors. Symptom seen: a per-chat-persona `PATCH` 404'd until Omega was restarted; the first
  turn right after a restart can 500 while the model warms up (retry once).

**E2E / browser:**
- Use `pnpm exec playwright test` — it uses the **Nix flake's Chromium** and (non-CI) reuses a
  running stack. The **Playwright MCP browser wants system Chrome (not installed) — do not use
  it.**
- **Every e2e failure is real until you have diagnosed it.** There is no standing list of
  failures you may ignore, and this file will not grow one. A failure is either a product bug,
  a stale assertion you must update, or a harness defect you must fix — and which one it is
  gets established by measurement, not by assumption. "Backend drift" and "serial-run load"
  have both been wrong here before: a wandering failure was written off as load in July and
  turned out to be two genuine data-loss bugs
  ([record](../archive/records/2026-07-27-e2e-repair-and-two-real-bugs.md)).

**Shipping:** on commit-and-push write `docs/archive/records/YYYY-MM-DD-<slug>.md` per change (Practice 2:
`##` summary / fenced diff / why). The repo's established workflow **commits directly to `main`**
(no PR flow in its history) — make a **logical series of commits**, each with its record, then
push. End commit messages with the `Co-Authored-By` trailer.

## 7. Open tasks / next work

> **Next work lives in [`docs/roadmap/`](../roadmap/README.md)** — the standing list of what *we*
> build (Context/Templates for real, the whole-project default context, the other resource
> editors including the slide editor). Work *Omega* owes us is
> [`docs/backend-requests/`](../backend-requests/README.md). The docs were reorganized
> 2026-07-28: **everything outside `docs/archive/` is current**; dated material (records,
> shipped plans) moved into the archive. Start at [`docs/README.md`](../README.md) for the map.

**The document-subsystem reorg is ✅ COMPLETE (2026-07-27) — all workstreams (A–E) and every
catalog row are closed.** The **library console shipped 2026-07-29**, replacing the
`/library/{context,templates}` placeholders from the 2026-07-28 mock pass
(`docs/archive/plans/2026-07-28-context-templates-mock-pass.md`, which also brought the top-bar
nav, the mocked Templates rail panel, the sign-in theme toggle, and the app-wide `Toaster` fix its
e2e uncovered). The console lives in `features/library/` — read
[`LibraryConsole.svelte.md`](../../src/lib/features/library/LibraryConsole.svelte.md) first; its
data is mocked and badged pending
[owner-scoped contexts and templates](../backend-requests/asset-library-owner-scope.md).
**Session expiry now forces a return to sign-in (2026-07-28**, first
live-review finding, `docs/archive/records/2026-07-28-session-expiry-bounce.md`): a mid-session 401
(or a lapsed session caught by a tab-visibility probe) hard-bounces to `/login?expired=1&next=…`
via `$systems/session/expiry` + the `$data/api` unauthorized hook, instead of the old half-alive
stale-signed-in UI. **The project-context rail shipped 2026-07-29** — five commits, plan archived at
[`2026-07-29-project-context-rail.md`](../archive/plans/2026-07-29-project-context-rail.md), records
`2026-07-29-context-rail-{properties,all-resources,history,members}.md` and
`2026-07-29-activity-filter.md`; it added one backend request (row 10, project-level presence) and
four e2e cases. There is no active plan; next work is whatever gets queued (the open
backend requests in `docs/backend-requests/` are Omega-side, and [`docs/roadmap/`](../roadmap/README.md) also records what is
deliberately not being built). The reorg documents below remain the architecture reference —
read them before touching the editor:
- [`docs/archive/plans/2026-07-27-document-subsystem-reorg.md`](../archive/plans/2026-07-27-document-subsystem-reorg.md)
  — the plan: the target runtime model (a thin `DocumentRuntime` orchestrating
  `model/{pm-state, selection, overlay, sync, presentation, actions}`), a code layout that mirrors
  it, the settled decisions, and the staged workstreams. Has mermaid diagrams of the current and
  target model.
- [`docs/archive/plans/2026-07-27-document-subsystem-issues.md`](../archive/plans/2026-07-27-document-subsystem-issues.md)
  — the catalog: every bug, security gap, dead-code item, and layering issue, each with a location,
  a severity, and its fix.

**Workstreams (decisions settled in the reorg §8):**
- **A — DetailsPanel → `details/lenses/*` + `details/controls/*`** — ✅ **DONE 2026-07-27**
  (commits `34be0de`, `c640dd6`, `e3788a6`). 910 → 42 lines; 7 lenses + 13 controls, each owning
  its state and naming its own targets; bug **B1** fixed (a run selection now carries `rowIds`).
  Records: `docs/archive/records/2026-07-27-run-line-spacing-fix.md` and
  `…-details-panel-decomposition.md`.
- **B — Remove pagination entirely** — ✅ **DONE 2026-07-27** (commit `908b8bc`). `pagination/*`,
  the page sheets, the "Pages" metric, the LayoutPanel geometry controls, and the windowing
  scaffolding are deleted; block presentation lives in a slim `editor/presentation-plugin.ts` fed
  by ONE doc walk (`refreshPresentation`) whose `rowHeightsPx` also feeds the session. The session
  contract dropped `pages`/`pagePlan`/`requestedRowWindow`/`pageLayout`/`setPageLayout`;
  `canonicalPageLayout` stays as the read-only paper frame. Line spacing still persists
  (`set_block_line_height`). Record: `docs/archive/records/2026-07-27-remove-pagination.md`.
- **C — Split the runtime god-object** into `model/*` — ✅ **DONE 2026-07-27**, commits `5a16c74`,
  `70d5a13`, `9e6b198`, `f602f45`, `82e019b`, `15803a9`, `0809879`. **All six §4 units shipped**
  (plus two more): `selection` (11 tests) · `overlay` (**B2 fixed**, 9 tests) · `presentation` ·
  `sync` (**SyncEngine**) · `pm-state` (**PmStateHost** — the `EditorState`, the dispatch pipeline,
  the attached view) · `actions` (the ~25 inspector commands) · `panels` · `search` (12 tests, on
  logic that had none). **`runtime.ts` 1623 → 577** and **catalog A1 is closed**: it now composes
  the collaborators, runs the ONE presentation pass, projects the `EditorSession`, and implements
  four compiler-checked seams — `PmHost` (4), `IndentHost` (2), `SyncHost` (9), `ActionsHost` (9).
  The extraction ORDER was driven by measurement, not taste: the actions' coupling fell 31 → 24
  (`SyncEngine`) → 20 (`PmStateHost`) → a 9-member interface once the pure reads moved out.
  **When you add editor behaviour, put it in the owning `model/*` unit — do not grow `runtime.ts`.**
  Records: `docs/archive/records/2026-07-27-runtime-model-extraction.md`, `…-pm-state-host.md`,
  `…-editor-actions-extraction.md`.
- **E — Real Share (un-mock the top-bar Share dialog)** — ✅ **DONE 2026-07-27** (`8a0d087`).
  The 41-line mock is gone: `features/projects/ProjectSharing.svelte` (access mode, role-carrying
  links, members) is rendered by **both** the top-bar Share dialog and Project settings, so the
  two surfaces cannot drift. No backend work was needed — every call was already shipped and in
  use. `share-links.spec.ts` proves a link minted through the dialog comes back from
  `GET /projects/:id/links`. Record: `docs/archive/records/2026-07-27-workstream-e-real-share.md`.
- **D — Shell + layering cleanup — ✅ COMPLETE 2026-07-27. The reorg is DONE — no workstreams
  remain.**
  ~~D4/D5/D6~~ done 2026-07-27: `data/document-context` + `systems/documents/context` deleted;
  `QuarterbackDock`'s dead `currentDoc` derive dropped; `inspectAnchor` + `RowLens`/`BlocksLens`
  deleted per UX1 (frozen `SelectionInfo` keeps its `row`/`blocks` modes; the Details dispatcher
  falls back to `NoneLens`; `actions.inspectBlock` stays — frozen `EditorActions`).
  ~~L1/L2/L3~~ done 2026-07-27: the `document-inspector`/`document-layout`/`document-collaboration`
  facades deleted (plus `data/overview`, the same disease); importers rewired to
  `$systems/documents/<submodule>` / `$data/projects`; the convention is written down in
  AGENTS.md → *Import convention* (`$data/<system>` = one facade per system,
  `$systems/<system>/<submodule>` = precise import, no other facades).
  ~~L4~~ done 2026-07-27: document import/export moved out of the generic `ResourcesPanel` into
  the per-kind file-transfer table `features/shared/transfer.ts` (`importers`/`exporterFor`);
  the panel names no kind.
  ~~A4~~ done 2026-07-27: `AppShell`'s section policy (fallback sets, inspector merge, persisted
  repair) extracted to `shell/shell-sections.ts`; the shell is pure composition.
  ~~A3~~ done 2026-07-27: `QuarterbackPanel` 623 → ~80-line view switch; each concern is its
  own component under `shell/panels/quarterback/` plus pure `helpers.ts` and the unit-tested
  `context-items.ts` projection.
  ~~L5~~ done: the shared option lists moved to `features/shared/inspector-options.ts`;
  `systems/documents/inspector.ts` deleted. ~~L6~~ signposted: both typography systems are
  current — semantic tokens back block-type styling ("Text type"), `CustomTypography` + inline
  marks back real fonts; the semantic cascade is NOT retired. ~~PC1~~ done: the
  `2026-07-24-runtime-architecture.md` status header records the divergence and its
  registry-dispatch section is marked "Not shipped — decided against" (§8.3: the `tab.kind`
  switch stays).
  None of it touches the editor runtime — it is mostly mechanical, and good work for a cheaper model.

**P0 items: all closed (2026-07-27).** The run-mode line-spacing no-op (A), the fragile
live-`Block` invariant (C2), and the whole **security** section (S1–S4, `417ca97`).

**Do not re-trust the old premise:** `bridge.ts` used to claim Omega sanitizes marks server-side,
and the catalog was written on that basis. It was checked — Omega validates colours but **not**
link href schemes and **not** font-name charsets. So Alpha's `$systems/documents/sanitize` is the
last line of defence for those, not a second one; it is applied at the schema `toDOM`/`parseDOM`,
at `customTypographyCss`, and at `setLink` (the write boundary, because Omega stores what it is
given). A server-side fix is requested in `docs/backend-requests/document-mark-payload-validation.md`.
There is now a **CSP** (`svelte.config.js`); its `style-src` must stay `'unsafe-inline'` because the
editor renders decorations as `style` attributes.

Do not add new monoliths; do not build against the frozen contracts.

**e2e: the whole suite is GREEN — 30/30 as of the context rail (2026-07-29).** It was 22/22 at the
Agents console the same day, and 14/14 at
the L4 seam on 2026-07-27; the library rewrite replaced the two placeholder assertions and added
a spec driving the real flow (resolve a nested context, fill a template slot, flip the preview),
and the Agents spec drives the monitor → steering → personality sub-route path — and caught a
real bug on its first run (a second `Toaster` mounted by the library shell rendered every toast
twice). There are no known-failing specs. If something fails, it is real; investigate it.

`resources.spec.ts` had been failing since 2026-07-23 and was repaired in that pass. Two things
worth knowing, because they were nearly written off as "flakiness":

1. **A real bug was hiding behind it.** Omega answers **409 for two unrelated things** — a revision
   conflict *and* the `requireProject` gate (`"select a project first"`). `SyncEngine.flush` treated
   every 409 as the first, so a stale session cell made it discard queued ops and reload the
   document: unsaved edits gone, selection collapsed. Fixed by wrapping the append (and `reload`)
   in `withProject`, like every other project-scoped call; pinned by `model/sync.test.ts`.
   **A wandering e2e failure is evidence, not noise.**
2. **`RowLens` and `BlocksLens` are unreachable — and that is now BY DESIGN** (decided
   2026-07-27, catalog UX1; **clarified by the user the same day — this is about FEEL, not the
   data model**). The left gutter's row/block handles were their only entry point and were
   removed on 2026-07-23 (`3866771`); the decision is to keep it that way. Precisely: **the
   block model stays** — Omega documents ARE blocks in rows, and the runtime/ops/sync all speak
   blocks — but the *editing surface* must **feel like a smooth text editor**: no gutters, drag
   handles, or row/multi-block manipulation chrome ("that's not what sells"). Judge changes by
   what they do to the feel of editing, not by whether they touch blocks — Text type, Insert
   element, and inline typography are all block ops that surface as text editing, and that is
   the intended shape. Do not re-add a block-manipulation entry point. Workstream D deleted
   `inspectAnchor` and the two dead lens files (the frozen `SelectionInfo` keeps its
   `row`/`blocks` modes). Alignment and add-column remain reachable via a non-text block (e.g.
   code).

**Writing e2e for the editor:** ProseMirror syncs its state from the DOM `selectionchange` event
*asynchronously*, and Playwright clicks/types far faster than a person — a key sent in the same
millisecond as a click can be applied to the selection the click was replacing (Enter then
*replaces* the old range instead of splitting at the caret, silently corrupting the document under
test). Settle after clicking into the editor: prefer waiting on the app's own signal (the lens
changing), else `waitForTimeout(150)`. Both specs do this and say why.

**Contracts to keep frozen through all of it:** `features/shared/surface.ts` and `editor/session.ts`.

**Awaiting Omega — see `docs/backend-requests/README.md` for the current list** (that directory
holds *only* open asks, and its README is the index). The largest is
[owner-scoped contexts and templates](../backend-requests/asset-library-owner-scope.md), which is
what the library console is waiting on.

**Deferred on purpose** — not gaps, nothing requested from Omega: the notifications feed and
pdf/docx import/export. See [`docs/roadmap/`](../roadmap/README.md). Do not re-file these as
gaps or backend requests.

**Everything shipped, withdrawn, or superseded moved to `docs/archive/` on 2026-07-27** — including
the whole `integration/` tree, whose "still needed from the backend" list had gone stale on six of
seven items and competed with `backend-requests/`. One list now, and it can be trusted.

## 8. Quick reference — "I need to… → read this"

| Task | Read first |
| --- | --- |
| Understand any file | its `.md` companion |
| The rules/conventions | [`AGENTS.md`](../../AGENTS.md) |
| Vocabulary, directory map, design tokens, gotchas | [`README.md`](README.md) (evergreen) |
| Style something | `docs/style/` + tokens in `src/app.css` |
| Touch Omega data / a mock | the `src/lib/data/*` companion + `docs/discrepancies/` + `docs/backend-requests/` |
| The document editor / sync | [`docs/architecture/document-editor.md`](../architecture/document-editor.md), then the `features/stages/document/` companions |
| The document reorg / target runtime model | the two `docs/archive/plans/2026-07-27-document-subsystem-*` docs (plan + issues catalog) |
| Why the repo looks like it does | `docs/archive/records/` |
