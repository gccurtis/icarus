# Full Integration Implementation Plan (2026-07-26)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Each phase = one self-contained commit.

**Goal:** Integrate **everything Omega backs today** — finishing A2, un-mocking the AI dock, and wiring the newly-shipped capabilities (templates, notifications, resource access/pinning, windowed rows) — each end-to-end tested and documented.

**Architecture:** Front-end-first: translate Omega shapes at `src/lib/data|systems/*`; components read our UI-friendly types. Each capability gets a thin client in `systems/*`, then its UI surface is un-mocked.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript, Vitest (units), Playwright (E2E against the live `:8443` engine-enabled stack), Tailwind v4. Omega HEAD `f8774ab`.

## Global Constraints

- **Nothing hidden (revised principle).** Every surface is either integrated or **visibly tracked** — never hidden. The **one deliberate mock** is pdf/docx export/import options (Phase 7), badged as not-yet-supported per explicit request, so the affordance stays visible.
- **End-to-end tested.** Each phase: (a) vitest units for pure logic/clients, (b) an **E2E check against `:8443`** (Playwright where feasible, else a documented manual run with evidence), (c) Omega round-trip on `:8444` for document ops.
- **Companions (Practice 1)** updated in the same change, byte-verify; **change record (Practice 2)** per phase-commit; `pnpm check` + `pnpm test` green before each commit.
- **Config guards:** several routes sit behind `opts.*` — if one 404s on the running server, **surface the gap** (badge/notice), never hide. Note it in File B.
- Commit to `main`; trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Live view: [`../../integration/current/2026-07-25-integratable-now.md`](../../integration/current/2026-07-25-integratable-now.md) (what) + [`2026-07-25-backend-outstanding.md`](../../integration/current/2026-07-25-backend-outstanding.md) (gaps).

## Order (revised 2026-07-26 — the block-model migration has landed)

The migration landed and the frontend is fully adapted (**doc-model Stages 1–5 done**,
superseding A2 / Phase 1). Everything remaining is buildable now.

**Build now (in order):** B2b (finish the AI dock) → Resource access (G4) + Organizations →
Templates (G1) → Name Manager verify → the newly-shipped backend capabilities (per-user
workspace state / Phase F, project member summary / Phase G, windowed row reads).

**Deferred — build nothing yet:**

- **Notifications (G2)** — an ephemeral destructive-drain toast channel; discuss the shape
  first (Phase 4). The existing `toast()` UI feedback stays. **May be implemented soon.**
- **pdf/docx export/import options** (Phase 7) — the **most deferred** item, further out than
  notifications. A badged "coming soon" affordance when built; Markdown stays real.

---

## Phase 1 — A2: block kinds + inspector + Layout cleanup

> **✅ DONE 2026-07-26 — superseded by the doc-model adaptation.** The block-model migration
> landed (7 kinds: `text`+`subKind`, `code`, `callout`, `list`, `divider`, `image`, `prompt`;
> inline font/fg/bg typography + cascade; indent; native lists; document default font), so A2
> was rebuilt as a full adaptation to the new model rather than the old 3-commit plan. Shipped
> as doc-model Stages 1–5 (`447c1b3`, `c083906`, `1fcbbf3`, `63fb864`); see
> `docs/records/2026-07-26-doc-model-*.md`. The A2 spec/sub-plan below are historical.

Fully specified in **[2026-07-25-a2-block-kinds.md](2026-07-25-a2-block-kinds.md)** (3 commits: engine → inspector → layout). Execute that plan.

- [ ] Commit 1 — engine (registry, `code_block`/`divider` schema, bridge, CSS, `setTextType`/`insertElement`); bridge + registry unit tests; Omega round-trip on `:8444`.
- [ ] Commit 2 — inspector (Insert element, new-block typography, Extra formatting).
- [ ] Commit 3 — Layout cleanup (remove semantic controls + unused write actions).
- [ ] E2E: insert code/callout/divider; convert lines to headings; imported `>` quote renders.

---

## Phase 2 — B2: AI Quarterback dock (un-mock)

**Omega:** chat capability — `GET/POST /agent/chats`, `/agent/chats/:id/turns` (Chat`{mode, resourceId?}`; Turn`{role, body, taskId?}`); tasks — `/agent/tasks[/:id]` (states `queued|running|waiting|completed|partially_completed|failed|canceled` + `todos`), `/agent/plans`, `/agent/actions`, `…/plans/:planID/accept`; personas — `/personas`, `/personas/default`, `/personas/:id`; live-web per ask turn; model fallback chains.

**Alpha:** `systems/ai-agent/{store,actions,mocks}.ts` + `data/ai-agent.ts` (mock) → real clients; `features/shell/QuarterbackBar.svelte` / `QuarterbackDock.svelte` / `panels/QuarterbackPanel.svelte`; `systems/personas` (exists).

- [ ] **Read current mock surface** (`systems/ai-agent/store.ts`, `actions.ts`, `data/ai-agent.ts`, the three Quarterback components) and map each mock field to a real route.
- [ ] **Chats client:** `listChats(resourceId?)`, `createChat(mode, resourceId?)`, `listTurns(chatId)`, `postTurn(chatId, body, {web?})` → real routes; map to UI types.
- [ ] **Tasks client:** `listTasks()`, `getTask(id)` (poll non-terminal), `createPlan`/`createAction`, `acceptPlan(taskId, planId)`.
- [ ] **Persona picker:** dropdown beside the mode selector, options from `/personas`, default from `/personas/default` (General); persist selection per chat.
- [ ] **Compose:** send a turn under the selected mode (Ask/Action/Plan) + persona; render the agent turn reply; show usage if present.
- [ ] **Task ↔ chat:** double-click a task → open its chat (via `turn.taskId` / a task-pinned chat).
- [ ] **Live progress:** poll active tasks; render `state` + `todos` (open/doing/done/blocked) as progress.
- [ ] **Web toggle:** per-turn Web flag on Ask turns.
- [ ] **Drop** the mock store/`mocks.ts` + MockBadge + "execution remains mocked" copy. **Attachments** stay a visible, disabled-with-note affordance (tracked in File B — not removed).
- [ ] **Units:** client mappers (chat/turn/task shape → UI type).
- [ ] **E2E (`:8443`):** create a chat, send an Ask turn → agent reply; start an Action task → watch it advance to a terminal state; double-click it → its chat opens; persona dropdown defaults to General.
- [ ] Companions + change record; `pnpm check` + `pnpm test` green; commit.

---

## Phase 3 — Templates (G1)

**Omega:** `GET /documents/templates`; `Base.Template = TemplateInfo{ isTemplate, contextVariables[] }` (versioned via changesets). Create-from-template via new doc / duplicate with the template's context.

**Alpha:** `features/stages/new-tab/NewTabStage.svelte` (mock `TEMPLATES`), `AiCreateDialog.svelte` neighbors; new `systems/documents/templates.ts`.

- [ ] **Templates client:** `listTemplates()` → `GET /documents/templates` → UI `{id, name, kind, contextVariables}`.
- [ ] **NewTabStage:** replace the mock `TEMPLATES` array + MockBadge with the real list; empty-state when none.
- [ ] **Create-from-template:** picking a template creates a document seeded from it (new doc with the template's rows/context, or `POST /documents` with a template id — confirm the exact create path against Omega) and resolves the tab into it.
- [ ] **(Optional) Save as template:** mark the current document `isTemplate` via a changeset op.
- [ ] **Units:** template mapper.
- [ ] **E2E (`:8443`):** the Templates carousel lists real templates; picking one opens a new document.
- [ ] Companions + change record; gates green; commit.

---

## Phase 4 (DEFERRED — do last, after every other phase) — Notifications (G2)

> **DEFERRED per user (2026-07-26):** build **nothing** notification-related for now. The
> existing `toast()` UI feedback stays; do **not** wire `/notifications`, a feed, or preferences
> yet. **Discuss the shape first** (the checkpoint below). Update (2026-07-26): notifications
> **may be implemented soon** — it's the next-to-last item, *before* pdf/docx (Phase 7), which is
> the most deferred. The tasks are kept here for when we return.

**Finding (verified):** `/notifications` is an **ephemeral, destructive-drain toast channel** (`Toast{level,title,body,projectId}`; `GET` returns *and deletes* the caller's queued toasts for the selected project). It is **not** a persistent inbox and **not** the *preference toggles* the UserSettings "Notifications" panel mocks.

- [ ] **CHECKPOINT — confirm with the user** (per their instruction): integrate the **toast channel** (poll `GET /notifications`, surface real toasts — e.g. "your AI task finished"); keep the UserSettings **preferences** panel **visible + badged** as not-yet-configurable (tracked in File B), not hidden. Proceed once confirmed / discuss if they want a different shape.
- [ ] **Notifications client** `systems/notifications.ts`: `drain(projectId)` → `GET /notifications` (destructive); typed `Toast`.
- [ ] **Poll loop:** while a project is selected, poll on an interval; render each toast via the existing `toast()` system, keyed/deduped by `id`; stop on project switch/teardown.
- [ ] **UserSettings Notifications:** replace the mock with a **"Preferences aren't configurable yet"** note + Badge (visible, tracked) — do **not** hide the section.
- [ ] **Units:** drain mapper + dedupe.
- [ ] **E2E (`:8443`):** trigger a toast-producing task (e.g. AI-create or prompt resolve) → a real toast appears in the app.
- [ ] Companions + change record; gates green; commit.

---

## Phase 5 — Resource access / options (G4)

**Omega:** `GET/PUT /resources/:kind/:id/access` (`AccessScope{ projectWide, orgIds[], userIds[] }`), `/resources/:kind/:id/attributes`, resource **pinning**. Orgs: `/organizations*` feed `AccessScope.orgIds`.

**Alpha:** `features/stages/shared/ResourceSettingsDialog.svelte` (mock visibility/options), `systems/resources/api.ts`, the resource table.

- [ ] **Resources client:** `getAccess`/`setAccess` (scope), `getAttributes`/`setAttributes`, `pin`/`unpin`.
- [ ] **ResourceSettingsDialog Visibility:** project-wide vs restricted (pick users; orgs later); **Pin** toggle. Drop MockBadge.
- [ ] **Resource table:** show a pin indicator; optionally pinned-first sort.
- [ ] **Units:** access-scope mapper (normalize/validate).
- [ ] **E2E (`:8443`):** restrict a resource's access; pin it; reload reflects both.
- [ ] Companions + change record; gates green; commit.

---

## Phase 6 — Windowed row reads

> **Re-ordered 2026-07-26 (not deferred):** runs **after** the block-model migration — it
> reads row/block payloads, whose shape the migration changes. Still on the roadmap.

**Omega:** `GET /documents/:id/row-manifest`, `/rows` (windowed), `/rows/locate`, `/revision-hints`, `/missing`, `/missing/changes`.

**Alpha:** `features/stages/document/runtime.ts` (the `ensurePageRange` + `DocumentRowRepository` seam already scaffolds this) + `systems/documents/api.ts`.

- [ ] **Client:** `getRowManifest(id)`, `getRows(id, window)`, `locateRows(id, …)`.
- [ ] **Runtime:** on `ensurePageRange`, fetch the missing row window (bounded) instead of relying on the full initial load; seed the row repository from the manifest.
- [ ] **Guard:** keep the full-load path as a fallback when the route is unavailable (surface, don't hide).
- [ ] **Units:** manifest/window mappers.
- [ ] **E2E/perf (`:8443`):** a large document loads a **bounded** window (not the whole doc); scrolling fetches more.
- [ ] Companions + change record; gates green; commit.

> Note: this changes the document load model; scope carefully and keep it behind the capability check.

---

## Phase 7 — pdf/docx export/import options (deliberate badged mock)

> **Most deferred (2026-07-26):** further out than notifications — the last thing to build.
> Not "soon". When we do it, the options are a badged "coming soon" affordance in the modals.

Build the **options** in the resource-table modals, badged as not-yet-supported (G3 is a real backend gap). Markdown stays real.

**Alpha:** `features/shell/panels/ResourcesPanel.svelte` (import/export modals), `features/stages/shared/ExportDialog.svelte` / `ImportDialog.svelte`.

- [ ] **Export modal:** add **As PDF** / **As DOCX** options beside Markdown, each with a **Mock**/"coming soon" badge; selecting one toasts "not yet supported." Markdown export stays real.
- [ ] **Import modal:** accept `.pdf`/`.docx` in the picker, badged mock; `.md` stays real.
- [ ] Track in File B (G3) — already filed.
- [ ] **E2E:** modal shows pdf/docx options badged; Markdown round-trip still works.
- [ ] Companions + change record; gates green; commit.

---

## Phase 8 — Name Manager verify (B6)

**Alpha:** `features/stages/document/panels/NameManagerPanel.svelte` → `/projects/:id/names/*` (already wired).

- [ ] **E2E (`:8443`):** create / edit / delete a name → the panel reflects each.
- [ ] Fix any defect found; otherwise record "verified end-to-end."
- [ ] Change record (verification note); commit if code changed.

---

## E2E harness note

Use the Playwright harness (`docs/superpowers/specs/2026-07-21-playwright-harness-design.md`) against the **live `:8443`** stack (engine-enabled via `etc/config.local.yaml`). Where a Playwright flow is impractical for a phase, run a documented manual verification against `:8443` and capture the evidence (request/response or screenshot) in the change record. Document ops also round-trip on a fresh `:8444`.

## Self-review checklist (run before starting each phase)

- Re-read the phase's Omega routes against the current source (shapes drift).
- Confirm the Alpha files still match (companions exist for each).
- Confirm the capability isn't `opts.*`-gated off on the running server; if it is, surface + track, don't hide.
