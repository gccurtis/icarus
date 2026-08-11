# Integration Completion & Companion Redo — Implementation Plan

> **Current driver.** Supersedes the archived `full-integration` plan
> ([../../archive/](../../archive/README.md)). Written 2026-07-26 after B2b, G4, and B6
> landed and after a course-correction on companion format.

**Goal:** Finish the Alpha↔Omega integration — every capability Omega backs is wired or
visibly tracked — while restoring the companion documents to their proper multi-section
form and writing the backend request that unifies chats with agentic work.

**Architecture:** SvelteKit + Svelte 5 runes; per-capability `systems/*` modules re-exported
through `data/*`; ProseMirror document editor; Vitest. Backend is Taurus Omega (Go). Verify
every contract against Omega source before wiring; UI E2E is manual (no headless browser).

## Global constraints (apply to every task)

- **Companions are multi-section and byte-exact.** A `<file>.md` is a title + short intro,
  then repeated `## Heading` + prose + a fenced slice of the source. The fenced slices,
  concatenated in order, reproduce the source **byte-for-byte** (AGENTS.md Practice 1);
  slices are contiguous and adjacent (blank lines between declarations belong to a slice).
  **Never** dump the whole file in one fence. Verify with `scripts/verify-companions.mjs`.
- **One change record per commit** (`docs/records/YYYY-MM-DD-<slug>.md`).
- **Gates green before every commit:** `pnpm check` (0 errors/warnings) + `pnpm test`.
- **Commit to `main`**, trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Parallelize independent work with subagents** (the companion redo especially).
- **Nothing hidden** — integrate, or surface + track; never silently drop a surface.

---

## Phase 1 — Companion redo (multi-section, byte-exact)

The B2b/G4/B6 commits wrote companions as a single whole-file fence. That is wrong: a
companion must explain the code in pieces. This phase restores the multi-section form and
fixes the latent byte-drift (blank lines between fenced sections had been dropped).

### Task 1.0 — Commit the verifier as a repo tool
- Create: `scripts/verify-companions.mjs` (+ `scripts/verify-companions.mjs.md` companion).
  Extracts every fenced block from `<file>.md`, concatenates, and diffs against the source;
  exits non-zero on any drift. This is the canonical extract-and-compare check.

### Task 1.1 — Redo the 22 single-fence companions → multi-section
Group and parallelize (one subagent per group; each self-verifies with the tool):
- **ai-agent (7):** `types.ts`, `store.ts`, `copy.ts`, `api.ts`, `actions.ts`,
  `../features/shell/QuarterbackDock.svelte`, `../features/shell/panels/QuarterbackPanel.svelte`
- **resources (7):** `types.ts`, `api.ts`, `store.ts`, `index.ts`, `registry.ts`,
  `ResourceSettingsDialog.svelte`, `ResourceTable.svelte`
- **organizations (7):** `types.ts`, `store.ts`, `api.ts`, `index.ts`,
  `data/organizations.ts`, `OrganizationsDialog.svelte`, `ShellTopBar.svelte`
- **name-manager (1):** `NameManagerPanel.svelte`

### Task 1.2 — Backfill the companion-less systems (`projects`, `session`)
- `systems/projects/*.ts` (5) and `systems/session/*.ts` (4) never had companions (predate
  the practice). Author multi-section companions. Parallelize with subagents.
- Test files (`*.test.ts`) are exempt; `src/lib/components/` is exempt.

**Verification:** `scripts/verify-companions.mjs` OK for every touched/created file; `pnpm
check` + `pnpm test` unchanged. Commit(s): "companions: restore multi-section format" and
"companions: backfill projects + session".

---

## Phase 2 — Backend request: unify chats + agentic work + personas-on-chats

### Task 2.1 — Write `docs/backend-requests/chat-agent-unification.md`
State the model: **the chat is the always-on user-facing interface; the agent endpoints are
the layer beneath (how the agent does things).** Specifics:
- Every chat carries a **persona** (a field on the chat).
- Actions/plans/tasks are spawned **from** a chat and stay addressable through it.
- A spawned task **adopts the chat's persona by default**, or the user declares a specific
  persona for that task; it can still speak back through the originating chat.
- The task/agent produces raw output; the chat's persona relays a **user-facing version**
  into the chat as a turn (task-queue → chat relay; backend owns the mechanism).
- Frontend contract we would consume: a per-chat `persona` field on create/read; task↔chat
  linkage; task output surfacing as chat turns.
- Note the **interim**: today persona is a per-user default (`/personas/default`); the
  Alpha picker sets that until this lands.

---

## Phase 3 — Documentation fixes

### Task 3.1 — Correct stale contracts in the live docs
- `docs/integration/current/ORIENTATION.md`, `2026-07-25-integratable-now.md`,
  `2026-07-25-backend-outstanding.md`:
  - Remove `/missing` + `/missing/changes` from row-windowing — **they do not exist** in
    Omega. The real primitives are `descriptor` / `row-manifest` / `rows` / `rows/locate` /
    `revision-hints`.
  - Template descriptor field is **`variables`**, not `contextVariables`.
  - Resource access is **PATCH-only, owner-only, read off the summary**.
  - Point ORIENTATION's "driver" at this plan; note the chat-unification request + interim
    persona; mark the companion-format rule (multi-section, byte-exact).

---

## Phase 4 — Remaining features (verify contract → wire → companion → record)

### Task 4.1 — Project member summary (Phase G) — small
- `GET /projects` returns `members: { items: [{userId, name, avatarUrl}], total }` (items
  capped at 5, `total` exact).
- Modify: `systems/projects/types.ts` (add `MemberSummary` + `Project.memberSummary`),
  `systems/projects/api.ts` (`toProject` maps `members`), `routes/projects/+page.svelte`
  (render the real avatar stack + `+N` from the summary instead of self-only).

### Task 4.2 — Per-user workspace state (Phase F) — medium
- `GET/PUT /workspace` (opaque JSON object ≤64 KiB, keyed by user×project, **gated by
  `opts.Workspaces` → can 404**).
- New: `systems/workspace-state/{api,index}.ts` (`getWorkspaceState`/`putWorkspaceState`).
- Modify: `data/workspace.ts` (hydrate from server on enter; push on change, debounced) and
  `services/project-runtime.ts` (load/flush at the project-switch seam).
- **Degrade:** on 404 (capability off), keep today's localStorage behavior — surface, don't
  hide.

### Task 4.3 — Windowed row reads — DEFERRED (decided 2026-07-26)

**The editor keeps loading the whole document** (`GET /documents/:id`); windowed reads are
deferred. This is not a data-layer bolt-on like the others — it reaches into the editor core.

Why it's deferred: the ProseMirror editor's model **is** the whole document, and every edit is
computed by diffing the entire server-truth `snapshot` against the entire current doc
(`diffDoc(snapshot, currentDoc)`, plus ~15 other whole-`snapshot` reads for styleRef/alignment/
lookup). To load only a viewport window of row **bodies**, off-screen rows must live in the
editor as lightweight **placeholders** (bodies swapped in on scroll), and the diff must **skip
rows whose body isn't loaded** so a placeholder isn't mistaken for a delete/change on save.

The routes exist on Omega (`descriptor` / `row-manifest` / `rows?from=&count=` /
`rows/locate` / `revision-hints`; **no `/missing`**) and the scaffolding is in place
(`DocumentRowRepository` with missing/loading/ready states, `pagePlan`, `ensurePageRange`,
`requestedRowWindow`). Pagination already only needs row **heights** (the manifest), not bodies.
When picked up, the shape is: load `descriptor` + `row-manifest` → build the page plan and
placeholder rows from the manifest → load viewport bodies via `/rows` → fetch `missing()` on
`ensurePageRange` → make the diff window-safe. A perf win for very large docs; not blocking.

---

## Phase 5 — Deferred (build nothing yet)

- **Notifications (G2)** — discuss the shape first (ephemeral drain-toast channel, not the
  settings panel's preference toggles). The existing `toast()` stays.
- **pdf/docx export/import options** — most deferred; badged "coming soon" in the export/
  import modals. Markdown import/export stays real. (G3 is a real backend gap.)

---

## Backlog (not scheduled)

- **Admin dashboard** — a surface to set up and manage projects, organizations, and users
  during the contracting phase (org manager currently lives only in the account menu).
  Revisit when contracting workflows firm up.
