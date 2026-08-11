# Document editor — mock → wired transition plan

> **For agentic workers:** each Goal is an independently testable deliverable. Steps use
> checkbox (`- [ ]`) syntax. Fold the setup/tests/companions into the Goal they belong to;
> commit at each Goal boundary.

**Goal of this document:** transition every document-editor feature that is *mocked today but
already backable by Omega* into a real, wired integration — plus fix the two live bugs that make
already-supported features break or appear dead.

**Companion documents (this directory):**
- [omega-integration.md](omega-integration.md) — the audit this plan executes (feature-by-feature
  verdicts, evidence, and Omega tier). Section refs below (e.g. "§4a #1") point into it.
- [backend-contract.md](backend-contract.md) — the *other* half: features that are genuinely blocked
  because Omega has no capability. Not in this plan.

**Architecture:** Alpha talks to Omega only through `$data/*` → `$systems/*` clients over
`api()` (`src/lib/data/api.ts`). Document edits persist as revision-bound changeset **ops**
(`POST /documents/:id/changes`); read-side features call typed endpoints. Every un-mock replaces a
hardcoded store/`$state`/`MockBadge` with a real call and drops the `mock` flag.

**Global constraints (copied from repo conventions):**
- Every hand-authored source/config file has a verbatim `<file>.md` companion, updated in the same
  change (AGENTS.md Practice 1). Markdown docs (like this one) are exempt.
- Un-mock = remove the `<MockBadge>` and the mock data source in the *same* change; never leave a
  half-wired control that silently no-ops.
- Verify read-side wiring with a `*.api.test.ts` (vitest) following
  `systems/documents/api.test.ts`; verify UI behavior with the Playwright harness against a running
  Omega (`go run ./core`, dev account via `scripts/dev-setup.sh`).
- Pin the Omega SHA you integrate against (currently `2a7229f`); several Phase 3 capabilities landed
  2026-07-24 — verify the live response shape before trusting it.

**Tier legend (from the audit):** **A** = committed to Omega long ago · **A★** = committed
2026-07-24 (fresh) · both are safe to call today.

---

## Status at a glance — updated 2026-07-25

**✅ Done & pushed** (commit `0d4231e`; every op verified by round-trip against a fresh build of
Omega `main`):

| Goal | What shipped |
|---|---|
| **0.1** Row-height op break | `set_row_height` → `set_block_line_height` (relabeled "Line spacing") |
| **0.2** Presence | join / publish / leave `/sessions`, access from real member roles (remote-cursor rendering deferred as optional) |
| **1.1** Block alignment | `set_block_alignment` + live `text-align` node decoration |
| **1.2** Columns | `Track` + `Row.tracks`, side-by-side `inline-block` render, `addColumn` (`insert_block`) — equal widths; the unequal-width **slider** is the one follow-up |
| **1.3** Quote | wraps the selection in quotation marks (plain text edit) |

**✅ Also done & pushed since** (each verified against a fresh build of Omega `main`):

- **Phase 1 tail** (commit `1b91db1`) — 1.4 redo · 1.5 last-editor attribution · 1.6 layout-gate notice · 1.7 retired the dead `rows.ts` client.
- **3.1 creator attribution** + **3.2 identity enrichment** (commit `d7cd5ab`).
- **3.4 personas** → `/personas` (commit `5b150bd`) · **3.5 document AI tasks** → `/agent/tasks?documentId=` (commit `04a2fc9`).
- **Phase 2 — typography** — semantic style-registry foundation (`ac9195e`), then **2.1 inspector typography** + **2.2 layout body/heading styles** (`74512da`). All four style ops verified round-tripping on a fresh Omega `main`.

**⬜ Outstanding:**

- **Phase 3 — 3.3 AI dock → `/agent/*` engine** (large). Backend surface is richer than first scoped: persistent **Chats** (`/agent/chats`) exist alongside Plan/Action tasks, so the Alpha "chats" store maps directly. The dev backend on `:8443` **is** engine-enabled (`etc/config.local.yaml` configures an OpenRouter provider + cast tables), so chat turns / Ask / task execution can be verified end-to-end there. (An earlier note here claimed "no engine"; that was an artifact of a throwaway verify instance started with a bare config — corrected.) Per the user's sequencing, build after Phase 2.

---

## Status recap — already wired (do not re-touch)

From the prior integration pass (now in [../old/alpha-implementation-plan.md](../old/alpha-implementation-plan.md)):
document history, Name Manager, presence *polling* scaffold, and identity *name* resolution are
already real. Content editing, save-state, conflict reload, marks, links, block-kind, page
size/margins, prompt blocks + resolve, and the Outline are wired (audit §3). This plan covers what
remains mocked.

---

## Phase 0 — Fix what's broken (do first)

These are not new features — they are **currently-broken or dead** integrations for capabilities
Omega already provides. Treat them as blocking defects.

### Goal 0.1 — Fix the `set_row_height` op break — **P0 · broken today**

**Problem:** the runtime emits a `set_row_height` op that **no longer exists** in Omega's changeset
vocabulary (it was replaced by `set_block_line_height`). Any row-height change flushed to the running
backend is rejected → the changeset append fails → the document goes to save-`error`. Audit §7 #1.

**Omega dependency:** `set_block_line_height` op (Tier A, committed). There is **no** `set_row_height`
in Omega — confirmed absent in `core/capability/document/changeset.go`.

**Alpha files:**
- Modify: `src/lib/features/stages/document/runtime.ts:380,815-838` (emit + apply)
- Modify: `src/lib/systems/documents/types.ts:100` (op union) and `src/lib/systems/documents/api.ts:127`
  (op label map)
- Modify: `src/lib/systems/documents/api.test.ts:33` (label test)
- Modify: `src/lib/features/stages/document/panels/DetailsPanel.svelte:183` (the control)

- [x] Replace the `set_row_height`/`heightIncrease` op with `set_block_line_height`
      (`{op:'set_block_line_height', blockId, lineHeight}`) — line height is a **per-block** property
      in Omega, not per-row, so the control must target the block(s) in the row.
- [x] Update the op type union and the `operationLabel` map (`set_block_line_height` → "Changed line
      spacing"); fix the label test.
- [x] Decide the UX: if the Details control is conceptually "row height", either (a) apply line-height
      to every block in the row, or (b) relabel it "line spacing" on the block. Prefer (b) — it matches
      Omega's model and merges with Goal 2 typography.
- [x] Update companions for every touched `.ts`/`.svelte`.
- [x] **Verified:** vitest label test passes; API round-trip vs a fresh build of Omega `main` —
      `set_block_line_height` → `201`, `lineHeight` round-trips.
- [x] Committed (`0d4231e`).

### Goal 0.2 — Make presence actually join and publish — **P1 · dead today**

**Problem:** `collaboration.ts` only *reads* `GET /sessions`; it never calls `POST /sessions` (join)
or `PUT /sessions/current` (publish caret + current document). No client registers a session, so the
open-user list is perpetually just "You" and the polling machinery looks dead. Access level is also
hardcoded (`Viewer`/`You`). Audit §7 #2, §4a #6.

**Omega dependency (Tier A):** `POST /sessions` (join, body `{sessionId?}`),
`PUT /sessions/current` (body carries `currentDocumentId`, `caretAtomId`, `caretOffset`,
`selection{Start,End}{AtomId,Offset}`), `GET /sessions` (list), `DELETE /sessions/current` (leave).
Real role from `GET /projects/:id/members`. Note: this is **poll-based** — no realtime push (Omega
record 0049 deferred a socket); remote cursors update on the 30s poll, which is acceptable for v1.

**Alpha files:**
- Modify: `src/lib/systems/documents/collaboration.ts:41-101`
- Modify: `src/lib/features/stages/document/runtime.ts` (publish caret on selection change; a debounced
  hook off the existing dispatch)
- Modify: `src/lib/features/stages/document/DocumentStage.svelte:237-263,327` (join on mount, leave on
  teardown/visibility-hidden)
- Test: `src/lib/systems/documents/collaboration.test.ts` (extend)

- [x] On document open: `POST /sessions` then `PUT /sessions/current` with `currentDocumentId`.
- [x] On selection/caret change (debounced ~500ms): `PUT /sessions/current` with the caret + selection
      atom ids/offsets from the ProseMirror selection (map via the existing `editor/bridge.ts` offset
      bridge).
- [x] On teardown / `visibilitychange:hidden`: `DELETE /sessions/current`.
- [x] Derive each collaborator's real `access` from project role (`owner`→`Editor`, `editor`→`Editor`,
      `read`→`Viewer`) instead of the hardcoded `'Viewer'`.
- [ ] (Optional — **deferred**) render remote carets/selections as colored markers; the caret/
      selection *is* published now, so rendering it is a later polish, not a blocker.
- [x] Update companions.
- [x] **Verified:** API round-trip vs a fresh build of Omega `main` — join / publish-caret / list /
      leave all `200`; the session carries `currentDocumentId` + `caretAtomId`.
- [x] Committed (`0d4231e`).

---

## Phase 1 — Committed quick wins (Tier A ops; no Omega work)

Small, high-confidence un-mocks. Each turns a mocked inspector control into a real changeset op.

### Goal 1.1 — Block alignment — **P2 · §4a #1**

**Omega dependency (A):** `set_block_alignment` op (BlockStyle `horizontalAlign∈left/center/right`,
`verticalAlign∈top/middle/bottom`).
**Alpha files:** `panels/DetailsPanel.svelte:388-438` (control, remove `MockBadge`);
`runtime.ts` (add an `alignBlock(blockId, {horizontal?,vertical?})` that pushes the op);
`systems/documents/types.ts` (add op to union).

- [x] `set_block_alignment` already in the op union + label map (`Changed alignment`).
- [x] Added `setBlockAlignment(blockIds, patch)` action (`runtime.ts`); bound the Details alignment
      controls to it; removed the `MockBadge`. Alignment renders live via a `text-align` node
      decoration (pagination-plugin) and the toggles reflect real state from `editorSession.blockAligns`.
- [x] Companions updated.
- [x] **Verified** (API round-trip vs a fresh build of Omega `main`): `set_block_alignment {blockId, horizontalAlign:center}` → `201`, round-trips (`b1.style.horizontalAlign=center`).
- [x] Committed (`0d4231e`).

### Goal 1.2 — Columns (multiple blocks in a row) — **P2 · §4a #3**

**Corrected 2026-07-24 (was mislabeled "blocked" — it isn't).** Columns are just multiple blocks
sharing a row, and **Omega already models and supplies them**: `Row.tracks` ships in
`GET /documents/:id` (`model.go:364`), and `set_row_tracks` / `resize_adjacent_tracks` /
`insert_block` ops all exist. Alpha even *keeps* the tracks — `normalizeDocument`'s `...row` spread
preserves them on the runtime row objects; they're just untyped and unread. The only real gap is
front-end: the editor is a flat vertical block list and never (a) exposes tracks on its type,
(b) renders same-`rowId` blocks side-by-side, or (c) creates a multi-block row.

**Enter behavior (per product):** Enter in a column makes a **new single-block row** below — which is
already ProseMirror's default (a new block gets a fresh `rowId`), so **no custom keyboard handling**.
A multi-block row otherwise behaves exactly like a single-block row.

**Approach:** reuse the node-decoration mechanism just built for alignment — `display:inline-block` +
`width:<weight>%` per block instead of `text-align`. Equal widths need no tracks (Omega defaults to
equal); tracks only carry *unequal* widths, which layer on later with the width slider.

**Alpha files:** `systems/documents/types.ts` (add `Track` + `Row.tracks` + `set_row_tracks`/
`insert_block` to the op union); `systems/documents/api.ts` (type-preserve tracks + `operationLabel`);
`editor/pagination-plugin.ts` + `runtime.ts` (side-by-side width decoration); `runtime.ts` +
`panels/DetailsPanel.svelte` (add-column action + wire the buttons, remove `mockAction`/`MockBadge`).

- [x] Exposed `Track` + `Row.tracks` on the type; kept through `normalizeDocument`.
- [x] Render rows with 2+ blocks side-by-side at track weights (equal if no tracks), via a
      `display:inline-block; width:%` node decoration (mirrors the alignment decoration).
- [x] `addColumn(afterBlockId, side)` action — inserts a block sharing the row's `id` (direct
      `insert_block` op + snapshot + PM node); wired "Add column left/right"; removed the mock.
- [x] Companions + `operationLabel` test for `set_row_tracks` (TDD).
- [x] **Verified** (round-trip vs a fresh build of Omega `main`): `insert_block` → `201`, the row
      becomes a real 2-block row; `set_row_tracks` → `201` with weights persisted. *Follow-up:* the
      unequal-width slider (`resize_adjacent_tracks`) — not yet wired.
- [x] Committed (`0d4231e`).

### Goal 1.3 — Quote = wrap selection in quotation marks — **P2**

**Reframed per product intent (2026-07-24):** "Quote" wraps the selected text in quotation marks —
literally quote characters on both sides — **not** a quote-block kind. It is a plain text edit, so it
flows to Omega through the ordinary text-diff ops (no new op type, no block-kind change). Aligns with
Omega's model without touching it.
**Alpha files:** `runtime.ts` (new `quoteSelection` action); `panels/DetailsPanel.svelte` (Quote button).

- [x] Added `quoteSelection()` — wraps the selection in `"…"` (or inserts `""` at a bare caret);
      wired the Quote button; removed the mock toast + "Mock" label.
- [x] Companion updated.
- [x] **Verified**: the quoted text persists as ordinary text through the changeset pipeline (`201`).
- [x] Committed (`0d4231e`).

### Goal 1.4 — Wire redo — **P2**

**Omega dependency (A):** `POST /documents/:id/changes/:changeSetID/redo` (endpoint exists; the client
`redoChange()` in `systems/documents/api.ts:211` exists but is **never called**).
**Alpha files:** `panels/HistoryPanel.svelte` (add a redo affordance next to undo).

- [ ] Surface redo in the History panel for the viewer's own current-head undo; call `redoChange()`.
- [ ] Companion; **verify** undo→redo restores state. Commit.

### Goal 1.5 — Last-editor attribution — **P2 · §4a #7**

**Problem:** "Edited … by X" is hardcoded to the current user.
**Omega dependency (A):** latest changeset `authorName` from `GET /documents/:id/history` (already
fetched by the History panel).
**Alpha files:** `systems/documents/collaboration.ts:65-99`; `DocumentStage.svelte:318-323`.

- [ ] Derive `lastEditor` from the newest history entry's author instead of the session user; keep the
      real `updatedAt`. Remove the "you"-hardcoding.
- [ ] Companion + test; **verify** a second user's edit shows their name. Commit.

### Goal 1.6 — Harden the silent layout capability-gate — **P3 · §7 #3**

**Problem:** `set_page_layout`/line-height ops only emit when `supportsCanonicalLayout` is true
(`systems/documents/api.ts:9`); otherwise geometry edits are local-only **with no badge** — reads as
saved but isn't.
**Alpha files:** `systems/documents/api.ts`, `runtime.ts:315,833`, LayoutPanel/DetailsPanel.

- [ ] When `supportsCanonicalLayout` is false, either disable the control with a tooltip or show a
      "not persisted" badge — never a silent no-op.
- [ ] Companion; commit.

### Goal 1.7 — Retire the dead row-window client — **P3 · §7 #4**

**Problem:** `systems/documents/rows.ts` implements four `/documents/:id/{descriptor,row-manifest,
rows,rows/locate}` calls with **no consumer**; Omega has no such routes (see
[backend-contract.md → BR-DOC-ROW-WINDOWS](backend-contract.md#br-doc-row-windows--windowed-row-reads)).

- [ ] Delete `rows.ts` (+ companion) **or** move it behind an explicit `// FUTURE:` flag with a comment
      pointing at the backend request, so it isn't mistaken for a live integration.
- [ ] Commit.

---

## Phase 2 — Typography via the semantic style registry (Tier A; larger)

Omega persists typography through a **semantic** style registry, not arbitrary per-property block
fonts. This is a mapping project: scope the UI to Omega's semantic model, with a custom-overrides
escape hatch. Audit §4a #4–5.

**Omega dependency (A):** ops `put_style_definition`, `assign_block_style`,
`set_block_style_overrides`, `set_style_default`, `replace_style`, `delete_style_definition`.
`StyleDefinition{typography∈body|body_small|label|title|heading|display|code|quote,
spacing,padding,border,background,tone∈neutral|accent|positive|caution|critical, allowOverrides[]}`.

### Goal 2.1 — Inspector typography → style registry — **P2**

**Alpha files:** `panels/DetailsPanel.svelte:75-91,283-370`; `systems/documents/inspector.ts:11-47`
(remove `inspectorMockDefaults`); `runtime.ts` (style ops); `types.ts`.

- [x] Replaced the free-form font/size/color controls with a semantic **Typography** select
      (the 8 tokens) persisting via `assign_block_style` (+ seeded `put_style_definition`). Effective
      typography renders live via a pagination decoration.
- [x] Removed `inspectorMockDefaults`, the local `$state`, and the `MockBadge`s. (Kept
      `inspectorFontOptions`/`inspectorColorPalette` — the Fabric slide editor uses them.)
- [x] Companions + tests; **verified** the assign op round-trips on a fresh Omega `main` :8444.
      Committed (`74512da`, foundation `ac9195e`).

### Goal 2.2 — Layout body/heading styles → style defaults — **P2**

**Alpha files:** `panels/LayoutPanel.svelte:132-201`; `systems/documents/context.ts:21-33`
(remove `mockDocumentLayout`).

- [x] Bound the LayoutPanel body + per-heading style controls to `set_style_default` (per block kind)
      + seeded `put_style_definition`. Removed `mockDocumentLayout` + the `MockBadge`s.
- [x] Companions; **verified** the default op round-trips + persists across reload on :8444.
      Committed (`74512da`).

---

## Phase 3 — Just-landed Omega surface (Tier A★; verify shapes as you wire)

These landed 2026-07-24 (Omega `861d099` + records 0055–0057). Pin the SHA; confirm each response
shape against the running server before trusting it.

### Goal 3.1 — Creator attribution — **P1 · §4b #11**

**Omega dependency (A★):** `creatorId`/`creatorName` on `GET /documents/:id` (record 0055).
**Alpha files:** `panels/InfoPanel.svelte:114-140` (remove `mockDocumentCreator`);
`identity-directory/resolvers.ts:117`; `systems/documents/api.ts` (surface the fields in
`normalizeDocument`).

- [ ] Read `creatorId`/`creatorName` from the document; render "Created by …" from real data; drop
      `mockDocumentCreator` (hardcoded "Maya Chen") and the InfoPanel `MockBadge` (:132-138).
- [ ] Companions; **verify** the creator shows the real account. Commit.

### Goal 3.2 — Identity hover-card enrichment — **P1 · §4b #12**

**Omega dependency (A★):** rich `GET /users/:userID` → `{id,kind,name,email,role,description,
createdAt}` (record 0056).
**Alpha files:** `systems/identity-directory/resolvers.ts:11-46`;
`systems/identity-directory/mocks.ts` (retire `MOCK_IDENTITIES` enrichment for real users).

- [ ] Replace the `MOCK_IDENTITIES` enrichment path with the enriched `GET /users/:userID` fields; keep
      the mock table only as an offline fallback (or delete if unused). Drop `mock:true` for resolved
      real users.
- [ ] Companions + resolver tests; **verify** a real user's card shows real role/description. Commit.

### Goal 3.3 — AI Agent dock → agent engine — **P1 · §4b #8**

**Omega dependency (A★):** `POST /agent/plans` (Plan), `POST /agent/actions` (Action), the Ask flow
(grounded answer + citations/evidence), `GET /agent/tasks[/:id]`,
`POST /agent/tasks/:id/plans/:planID/accept`; agent tools `document.get` + `document.append_changes`.
**Alpha files:** entire `src/lib/systems/ai-agent/*` (`mocks.ts`, `actions.ts`, `store.ts`, `copy.ts`,
`index.ts`); `shell/panels/QuarterbackPanel.svelte`; `QuarterbackDock.svelte`.

**Updated 2026-07-25 (backend surface is richer than first scoped):** Omega now ships a full
**Chats** capability — `POST/GET /agent/chats`, `GET /agent/chats/:id` (chat + ordered turns),
`POST /agent/chats/:id/turns` `{message, web}` → `{userTurn, agentTurn, usage}` (a chat may pin a
`resourceId`, e.g. the document). So the Alpha "chats" store maps *directly* to real chats, alongside
Plan/Action **tasks** and the internal grounded **Ask**. Attachments are still absent; `web` is a
per-turn flag, not a persistent context source.

**Engine config:** the `:8443` dev backend is engine-enabled — `etc/config.local.yaml` (gitignored
overlay) configures an OpenRouter provider + reasoning cast tables, so chat turns / Ask / task
execution run for real there and 3.3's generation can be verified end-to-end. (Note: a *throwaway*
verify instance started with a bare config logs `intelligence: 0 provider(s) configured` and returns
`500 "chat operation failed"` on any generation call — verify 3.3 against `:8443`, or point the
verify instance at the real overlay.) The wiring should still surface real pending/error states for
the case where no provider is reachable.

- [ ] Map the three composer modes: **Ask** → Ask flow (render answer + citations); **Action** → create
      an Action task (edits land via the `document.append_changes` tool); **Plan** → create a Plan task,
      render its steps, and `…/accept` to run it.
- [ ] Replace `initialChats`/`initialPlans` (mocks.ts) and the canned `submitAiPrompt`/`acceptAiPlan`
      (actions.ts/copy.ts) with real calls + polling of `GET /agent/tasks/:id`.
- [ ] Wire the real AI context items (document/knowledge/selection) that already exist; leave
      `sources`/`web`/attachments visibly disabled or hidden (they are blocked — backend-contract.md).
- [ ] Remove the `MockBadge` (QuarterbackPanel:361) and the "execution remains mocked" copy.
- [ ] Companions + tests; **verify** an Ask returns a grounded answer and an Action edits the doc.
      Commit.

### Goal 3.4 — AI personas → persona service — **P2 · §4b #9**

**Omega dependency (A★):** `/personas`, `/personas/default`, `/personas/:id` (+ revisions/versions/
tasks).
**Alpha files:** `identity-directory/mocks.ts` (the 4 persona entries); the dock's persona picker.

- [x] Added a `$systems/personas` store loading `GET /personas` + `/personas/default`; PersonasPanel
      lists real personas (Default badge). Dropped the four mock persona identities. Companions;
      **verified** live on :8444 (fresh project lists the seeded "General" default). Committed (`5b150bd`).

### Goal 3.5 — Document AI Tasks panel → agent tasks — **P2 · §4b #10**

**Omega dependency (A★):** `GET /agent/tasks?documentId=` — **document scoping is server-side**
(`TasksByDocument`; `Task.targetDocumentId`), so `BR-AI-TASK-DOCSCOPE` was **not** needed.
**Alpha files:** `panels/AiTasksPanel.svelte`; new `systems/documents/ai-tasks.ts`;
`systems/documents/context.ts` (removed `mockDocumentAiTasks`).

- [x] Added `ai-tasks.ts` (load `GET /agent/tasks?documentId=` + create `POST /agent/plans|actions`).
      AiTasksPanel loads the open document's real tasks and creates real Plan/Action tasks under the
      default persona; removed the mock array, `MockBadge`, and "· Mock" titles.
- [x] Document scoping confirmed available server-side — no `BR-AI-TASK-DOCSCOPE` filed.
- [x] Companion; **verified** create → `201` + document-scoped list on :8444. Committed (`04a2fc9`).

---

## Coverage check (this plan ↔ audit §4)

| Audit item | Goal | Tier |
|---|---|---|
| §7 #1 row-height break | 0.1 | A |
| §4a #6 presence/cursors | 0.2 | A |
| §4a #1 alignment | 1.1 | A |
| §4a #3 columns | 1.2 | A |
| quote kind | 1.3 | A |
| redo (unused) | 1.4 | A |
| §4a #7 last-editor | 1.5 | A |
| §7 #3 gate badge | 1.6 | A |
| §7 #4 dead rows.ts | 1.7 | — |
| §4a #4 typography | 2.1 | A |
| §4a #5 layout styles | 2.2 | A |
| §4b #11 creator | 3.1 | A★ |
| §4b #12 identity | 3.2 | A★ |
| §4b #8 AI dock | 3.3 | A★ |
| §4b #9 personas | 3.4 | A★ |
| §4b #10 AI tasks | 3.5 | A★ |

Everything mocked-but-backable in the audit has a Goal. Features with **no** Omega capability
(comments, references graph, windowed rows, avatars, AI web-context/attachments/chat-history, AI
generation, file import/export) are **out of scope for this plan** — they live in
[backend-contract.md](backend-contract.md).
