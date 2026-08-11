# Document Editor Completion Audit — Mocks vs Taurus Omega Capabilities

**Date:** 2026-07-24
**Scope:** The document editor in Taurus Alpha (`src/lib/features/stages/document/**`,
`src/lib/systems/documents/**`, and the panels/identity/ai-agent systems it composes),
audited against what Taurus Omega can actually back.
**Method:** Verified against live code, not docs — Alpha's op-emitting runtime, Omega's
registered routes (`core/transport/transport.go`), Omega's changeset vocabulary
(`core/capability/document/changeset.go`), and the session/agent model shapes. Where the
committed API contract (`taurus-omega/docs/backend-guide.md`) disagrees with the code, the
**code wins** — the guide is materially stale (it documents neither sessions, restore/purge,
revision-hints, duplicate, diff, nor anchors).

> **Update (2026-07-24, later same day):** Omega's newest editor capabilities — the agent/persona
> engine, identity enrichment, anchors, duplicate, and diff — were **committed and pushed** after
> this audit's first pass. Omega is now clean at HEAD `2a7229f` (`861d099` "Add identity, agent, and
> persona capabilities"; `0d4719e` docs/records), in sync with `origin/main`. **The former Tier B
> "uncommitted" risk is resolved — everything below is now committed.** The tier column is retained
> only to flag which capabilities *just landed* (fresh, less battle-tested) versus long-stable ones.

---

## 0. Executive summary

The **editing substrate is real**. Document load/create/rename/delete, the actual content
editing (every keystroke flushes as a revision-bound changeset via `POST /documents/:id/changes`),
the save-state machine, conflict reload, history, undo, prompt-block AI resolution, the Name
Manager, and the Outline are all genuinely wired to Omega. What remains mocked is the **social and
assistive layer wrapped around the editor**: presence/attribution, comments, references, the AI
Agent dock, document-scoped AI tasks, and most of the typography/layout inspector.

Headline numbers (document editor only):

- **~18 features already WIRED** to real Omega endpoints (§3).
- **~12 mocked features CAN be un-mocked now** — Omega already exposes the endpoint/op (§4), and
  **all of it is now committed** at HEAD `2a7229f`. §4a lists the small/committed-long-ago quick
  wins; §4b lists the larger ones that rely on capability that *just landed* (2026-07-24).
- **~7 mocked features are genuinely BLOCKED** on backend that does not exist in any form (§5).
- **3 things are local-by-design** and never needed a backend (§6).

Three problems demand attention regardless of the roadmap (§7):

1. **P0 — live contract break (FIXED):** the editor emitted a `set_row_height` op that **no longer exists**
   in Omega. Row-height edits are rejected by the running backend.
2. **P1 — presence is half-wired:** the editor polls `GET /sessions` but never *starts or updates*
   its own session, so the open-user list is effectively always empty and the machinery looks dead.
3. **Freshly landed:** the AI agent engine, anchors, duplicate, diff, and rich identity profiles
   are now **committed** (HEAD `2a7229f`) but only landed 2026-07-24 — treat their shapes as stable
   but newly integrated (verify against the running server as you wire each one).

---

## 1. Reliability tiers (provenance) — CRITICAL

Omega repo: branch `main`, HEAD `2a7229f`, clean and in sync with `origin/main`. The agent/persona
engine, identity enrichment, anchors, duplicate, and diff — uncommitted during this audit's first
pass — were **committed and pushed** the same day (`861d099`, `0d4719e`), so records `0050`–`0057`
and their routes are all in version control now. The former commit-state risk is gone; this audit
retains a lighter tier only to mark *recency*:

| Tier | Meaning | Trust for planning |
|---|---|---|
| **A — Committed, long-stable** | In version control well before this audit. | **Depend on it.** |
| **A★ — Committed, just landed (2026-07-24)** | Committed at HEAD `2a7229f` today (sessions/presence, agent/persona, identity, anchors, duplicate, diff). Reviewed and pushed, but freshly integrated. | **Depend on it; verify the exact response shape as you wire it.** |
| **C — Absent** | No code or route. | **Backend must build it.** |

`taurus-omega/docs/backend-guide.md` is a **conservative, stale lower bound** — treat it as the
floor, not the ceiling. The verified route/op inventory is in **Appendix A**.

---

## 2. How the editor is wired (orientation)

- Route `/projects/[id]` → `AppShell` → `WorkSurface` renders `DocumentStage` for a
  `resource`/`document` tab, keyed by tab id.
- `DocumentStage.svelte` is a thin view over a long-lived `DocumentRuntime`
  ([runtime.ts](../../../src/lib/features/stages/document/runtime.ts)) that owns the ProseMirror
  `EditorState` and the whole save/sync loop; it publishes an `editorSession` store the panels read.
- `$data/document-*` files are re-export shims over `$systems/documents/*` — the real logic lives in
  [src/lib/systems/documents/](../../../src/lib/systems/documents/).
- All backend calls go through `api()`
  ([src/lib/data/api.ts](../../../src/lib/data/api.ts)) → `fetch('/api' + path, {credentials:'include'})`,
  dev-proxied to Omega.
- Context rail panels: Info, Search, Outline, Layout, References, Name Manager, Comments, AI Tasks,
  History. Inspector rail: Details + the AI Agent (Quarterback) dock.

---

## 3. Already WIRED to real Omega (for context)

These are done — listed so "finish the editor" work doesn't accidentally re-touch them.

| Feature | Endpoint / mechanism | Where (Alpha) | Omega tier |
|---|---|---|---|
| Document load / fetch | `GET /documents/:id` (+ `GET /documents`) | `systems/documents/api.ts:38`; `runtime.ts:285` | A |
| Create | `POST /resources` (→ `POST /documents`) | `resources/api.ts:62`; `documents/api.ts:42` | A |
| Rename | `PATCH /resources/document/:id` | `resources/api.ts:83`; `DocumentStage.svelte:142` | A |
| Delete | `DELETE /resources/document/:id` (soft trash) | `resources/api.ts:71` | A |
| **Content editing → persistence** | debounced 700ms → `POST /documents/:id/changes` (id-addressed ops, `expectedRevision`) | `runtime.ts:355`; `editor/bridge.ts` | A |
| Save-state (saved/saving/pending/error) | driven by real flush lifecycle; 409→reload, error→retry | `runtime.ts:143,367` | A |
| Conflict reload | `GET /documents/:id` re-fetch on 409, cursor preserved | `runtime.ts:397` | A |
| History panel | `GET /documents/:id/history[/:changeSetId]` | `panels/HistoryPanel.svelte`; `documents/api.ts:162` | A |
| Undo (history panel) | `POST /documents/:id/changes/:changeSetId/undo` | `HistoryPanel.svelte:82` | A |
| Inline marks (bold/italic/underline/strike/code) | `add_mark`/`remove_mark` ops | `runtime.ts:872` | A |
| Link mark | `link` mark op | `runtime.ts:902` | A |
| Block kind (paragraph/heading/prompt) | `set_block` op | `runtime.ts:799` | A |
| Page size / margins | `set_page_layout` op (capability-gated — see §7) | `runtime.ts:839`; `LayoutPanel.svelte` | A |
| Prompt blocks (indicators + set instruction) | live `prompt` nodes; `set_prompt` op | `DocumentStage.svelte:186`; `runtime.ts:926` | A |
| Prompt resolve (AI generation) | `POST /documents/:id/blocks/:blockId/resolve` → poll `GET /jobs/:id` | `runtime.ts:934`; `documents/api.ts:64` | A |
| Name Manager (formula names) | `GET /projects/:id/names`, `POST …/evaluate`, `PUT …/function` | `panels/NameManagerPanel.svelte`; `projects/api.ts:137` | A |
| Outline | derived from live headings | `panels/OutlinePanel.svelte` | — |
| Collaborator identity (name/email only) | `GET /auth/me` + `GET /sessions` names | `DocumentCollaboratorAvatar.svelte` | A |

---

## 4. MOCKED → CAN be un-mocked now (Omega supports it)

The actionable core of this audit. Each item is mocked in Alpha **today** but Omega already exposes
the capability. Split by reliability tier.

### 4a. Against COMMITTED Omega (do these now — no backend work needed)

| # | Mocked feature (Alpha) | Un-mock via (Omega) | Evidence | Effort |
|---|---|---|---|---|
| 1 | **Block alignment** (horizontal/vertical) — local `$state`, MockBadge, no op | `set_block_alignment` op (BlockStyle `horizontalAlign`/`verticalAlign`) | Alpha `DetailsPanel.svelte:388`; Omega `changeset.go` op, `layout.go:61` | S |
| 2 | **Line spacing / "row height"** — wired via `set_block_line_height` (was broken op; fixed §7 #1) | `set_block_line_height` op (BlockStyle `lineHeight`) | Alpha `DetailsPanel.svelte:75`, `runtime.ts:815`; Omega `changeset.go` | S |
| 3 | **Column widths / add column** — computed locally, MockBadge, toast | `set_row_tracks` + `resize_adjacent_tracks` ops (Row `tracks:[{blockId,weight,gap,minWidth}]`) | Alpha `DetailsPanel.svelte:458`, `inspector.ts:66`; Omega `track.go:15` | M |
| 4 | **Typography** (font family/size, fg/bg color) — `inspectorMockDefaults`, local `$state` | Semantic **style registry** ops: `put_style_definition`, `assign_block_style`, `set_block_style_overrides`, `set_style_default`, `replace_style` | Alpha `inspector.ts:39`, `DetailsPanel.svelte:283`; Omega `style.go` | L |
| 5 | **Layout body/heading styles** (LayoutPanel) — `mockDocumentLayout`, local preview | Same style-registry ops + `set_style_default` per block kind | Alpha `LayoutPanel.svelte:132`, `context.ts:21` | L |
| 6 | **Presence / open-user avatars + live cursors** — polls `/sessions` but never *joins*; access hardcoded `Viewer`/`You` | `POST /sessions` (join) + `PUT /sessions/current` (publish caret/selection/currentDocumentId) + consume `GET /sessions` caret fields to render remote cursors | Alpha `collaboration.ts:41`; Omega `session.go:21` (caret/selection present) | M |
| 7 | **Last-editor attribution** ("Edited … by X") — always the current user | Latest changeset `authorName` from `GET /documents/:id/history` (already fetched) | Alpha `collaboration.ts:65`; Omega `history.go:56` | S |

Notes:
- Items **1–3** are the highest-value quick wins: small, committed ops that turn three mocked
  inspector controls real and (item 2) simultaneously fix the P0 break in §7.
- Items **4–5** share one substrate (the style registry). This is a *mapping* project — Alpha's
  free-form font/size/color controls must map onto Omega's **semantic** tokens
  (`body|title|heading|…`, `neutral|accent|…`), not arbitrary values. Scope the UI to the semantic
  model or add a "custom overrides" path via `set_block_style_overrides`.
- Item **6**: Omega's session record already carries `caretAtomId`, `caretOffset`, and full
  `selection*` fields — so *poll-based* live cursors are possible on committed HEAD. What's missing
  is only **realtime push** (no WebSocket/SSE — Omega record 0049 explicitly deferred it); presence
  refreshes on the 30s poll. Also derive real access from project role (`GET /projects/:id/members`).

### 4b. Against just-landed Omega (Tier A★ — committed 2026-07-24; larger wiring efforts)

| # | Mocked feature (Alpha) | Un-mock via (Omega) | Evidence |
|---|---|---|---|
| 8 | **AI Agent dock** (Ask/Action/Plan chats) — entire `ai-agent` system, canned replies | `/agent/plans` (Plan), `/agent/actions` (Action), Ask flow with grounded citations, `/agent/tasks` lifecycle, `document.get`/`document.append_changes` tools | Alpha `systems/ai-agent/*`, `QuarterbackPanel.svelte`; Omega `capability/agent/*` (`861d099`) |
| 9 | **AI personas** (persona picker in dock) — `MOCK_IDENTITIES` personas | `/personas/*` (CRUD, versions, default) | Alpha `identity-directory/mocks.ts`; Omega `capability/persona/*` (`861d099`) |
| 10 | **Document AI Tasks panel** — `mockDocumentAiTasks` | `/agent/tasks` (needs a document-scoped filter/projection) | Alpha `panels/AiTasksPanel.svelte`, `context.ts:113`; Omega `/agent/tasks` (`861d099`) |
| 11 | **Creator attribution** ("Created … by") — hardcoded to "Maya Chen" | `creatorId`/`creatorName` on the document (record 0055) | Alpha `panels/InfoPanel.svelte:114`, `resolvers.ts:117`; Omega `model.go` creator fields (committed) |
| 12 | **Identity hover-card enrichment** (role/description) — pulled from `MOCK_IDENTITIES` even for real users | rich `GET /users/:userID` → `{kind,name,email,role,description,createdAt}` (record 0056) | Alpha `identity-directory/resolvers.ts:11`; Omega `handlers/user/user.go` (committed) |

Notes:
- Item **8**: Omega's engine maps cleanly onto the three modes — **Ask** = grounded Q&A with
  citations/evidence (`capability/agent/ask.go`), **Action** = direct edits via the
  `document.append_changes` tool, **Plan** = workflow with steps/operations. What it still does
  **not** provide (§5): persistent multi-turn **chat threads**, **attachments**, and a **web**
  context source. Un-mocking the dock means adopting a task/plan/action model, not a chat-log
  model — the Alpha "chats" store would become a thin client cache over tasks.
- Items **11–12**: `GET /users/:userID` now returns the full enriched profile, so both the mock
  *name* and the *role/description* can be dropped in one pass.

---

## 5. MOCKED → BLOCKED on Omega (backend must build)

Genuinely absent in both committed and working-tree state. These cannot be un-mocked until Omega
builds new capability.

| Feature (Alpha, mocked) | What's missing in Omega | Substrate that exists | Alpha evidence |
|---|---|---|---|
| **Comments / annotations / threads** | No comment CRUD, no thread/reply/resolution storage. Anchors store **pointers only** and explicitly hold no thread content. | Document anchors (`/documents/:id/anchors`, committed A★) give stable, move-following positions — the *foundation* a comment system would build on. | `panels/CommentsPanel.svelte`, `context.ts:82` (`mockDocumentComments`) |
| **References graph** (outgoing/incoming resource links) | No references endpoint or link model. | Activity reference-resolution (0034) resolves target names, but there is no link graph. | `panels/ReferencesPanel.svelte`, `context.ts:42` (`mockDocumentReferences`) |
| **Windowed / streaming row reads** | No `/documents/:id/descriptor`, `/row-manifest`, `/rows`, `/rows/locate`. `GET /documents/:id` returns **every row**. | Deterministic client pagination already runs on the full doc; Alpha's `rows.ts` client for these routes is **dead code** (no consumer). | `systems/documents/rows.ts` (unwired) |
| **Batch identity resolve** | No `/identities/resolve`; only single `GET /users/:userID`. | Single lookups work (N requests). | `identity-directory/resolvers.ts` |
| **Per-user avatar image / color** | No avatar or per-user hue field anywhere (`icon` is a *project* field). | Initials-based avatars from name. | `DocumentCollaboratorAvatar.svelte` |
| **AI context: "web" source + file/folder attachments** | No web-retrieval capability; no file/blob/multipart upload endpoint (the `image` block's `fileId` has no producer). | Knowledge lattice covers *project* sources; `document`/`knowledge`/`selection` context items are real. | `QuarterbackPanel.svelte:102` (hardcoded `sources`/`web`), `:153` (`mockUpload`) |
| **"Create with AI" new-tab generation** | No `/resources/generate`; document resource can't be AI-populated on create. | Prompt blocks generate *within* an existing doc; the agent Action tool (A★) could be repurposed. | `backend-requests/ai-generation.md` (mock flow) |

Absent by design decision (Omega record 0049): **realtime multiplayer sync (OT/CRDT + push
transport)**. Omega's collaboration model is async, revision-bound changesets with proven semantic
rebase, plus poll-based presence — not live co-typing. This is a deliberate architecture choice, not
a gap to be filled incrementally.

---

## 6. Local-by-design (never a backend concern)

- **Pagination / page sheets** — deterministic client function over real row heights + page
  geometry; Omega intentionally exposes no `/pages` (record 0041). ✔ correct as-is.
- **In-editor undo/redo (Mod-Z/Y)** — ProseMirror `history()` plugin, client-side. Distinct from
  the server history-panel undo. ✔ correct.
- **Search / replace** — client regex over the loaded doc. No search endpoint needed for a
  single-doc find. ✔ correct.

---

## 7. Critical issues & breakages (independent of roadmap)

1. **P0 — `set_row_height` was a dead op (FIXED).** The runtime emitted `set_row_height`
    ([runtime.ts:380,827,829](../../../src/lib/features/stages/document/runtime.ts#L380);
    [types.ts:100](../../../src/lib/systems/documents/types.ts#L100)) but Omega's changeset vocabulary
    had **no such op** — it is `set_block_line_height` (per-block) and `set_row_tracks` (columns).
    Any row-height change flushed to the running backend was rejected → the changeset append failed and
    the save-state went to error. **Fix (applied):** replaced `set_row_height`/`heightIncrease` with
    `set_block_line_height` (item 2 in §4a). This was the single highest-priority correction.

2. **P1 — presence never joins.** `collaboration.ts` only *reads* `GET /sessions`; it never calls
   `POST /sessions` (join) or `PUT /sessions/current` (publish caret/current doc). No client ever
   registers a session, so the open-user list is perpetually just "You" and the polling machinery
   appears dead. **Fix:** join on document open, publish caret on selection change, close on teardown
   (item 6 in §4a).

3. **Silent capability-gating.** `set_page_layout`/row-height ops are only emitted when
   `supportsCanonicalLayout` is true (backend returned both `pageLayout` **and** `layoutRules`;
   [documents/api.ts:9](../../../src/lib/systems/documents/api.ts#L9)). When false, geometry edits are
   local-only **with no mock badge** — a silent partial that reads as "saved" but isn't. Consider a
   badge or a hard requirement.

4. **Dead client code.** `systems/documents/rows.ts` implements four row-window endpoints with **no
   consumer** (§5). Either delete it or gate it behind a feature flag so it isn't mistaken for a live
   integration.

5. **Freshly-landed Omega surface (was a risk; now resolved).** Items 8–12 (§4b) and the anchors
   substrate are now committed at Omega HEAD `2a7229f` and pushed. Residual caution is only that they
   landed today — verify the exact response shapes against the running server as you wire each, and
   pin the Omega SHA you integrate against.

---

## 8. Full per-feature matrix

Status legend: **WIRED** · **PARTIAL** · **MOCK** · **LOCAL** (by design). Omega tier: A (long-stable) / A★ (committed 2026-07-24) / C (absent).

| Feature | Alpha status | Omega support | Tier | Verdict |
|---|---|---|---|---|
| Load / create / rename / delete | WIRED | doc CRUD + resources | A | done |
| Content editing (changesets) | WIRED | `POST …/changes`, 36 ops | A | done |
| Save-state / conflict reload | WIRED | revision + 409 semantics | A | done |
| History panel | WIRED | `GET …/history` | A | done |
| Undo (panel) | WIRED | `…/undo` | A | done |
| Redo (panel) | **MOCK/unused** | `…/redo` exists | A | **wire it** (client method exists, no UI) |
| Marks B/I/U/strike/code, link | WIRED | mark ops | A | done |
| Block kind | WIRED | `set_block` | A | done |
| **Alignment** | MOCK | `set_block_alignment` | A | **§4a #1** |
| **Line spacing / row height** | WIRED | `set_block_line_height` | A | **§4a #2 + §7 #1** |
| **Columns / widths** | MOCK | `set_row_tracks` | A | **§4a #3** |
| **Typography (font/size/color)** | MOCK | style registry | A | **§4a #4** (semantic mapping) |
| **Layout body/heading styles** | MOCK | style registry / `set_style_default` | A | **§4a #5** |
| Quote formatting | MOCK | `set_block` → `quote` kind exists | A | wire to `set_block` |
| Header / footer | not exposed | `set_header`/`set_footer` | A | opportunity |
| Page size / margins | WIRED (gated) | `set_page_layout` | A | done (fix gating §7 #3) |
| Prompt blocks + resolve | WIRED | resolve (async) | A | done |
| Outline / Search | LOCAL | n/a | — | correct |
| Name Manager | WIRED | names/evaluate | A | done |
| **Presence / cursors** | PARTIAL | `/sessions` + caret/selection | A | **§4a #6** (join+publish; no realtime push) |
| **Last-editor** | PARTIAL | history author | A | **§4a #7** |
| **Creator ("Created by")** | MOCK | creator fields (0055) | A★ | **§4b #11** |
| **Identity hover enrichment** | MOCK | rich `GET /users/:id` (0056) | A★ | **§4b #12** |
| Collaborator avatar image/color | MOCK | — | C | **blocked** |
| **AI Agent dock** (Ask/Action/Plan) | MOCK | `/agent/*` engine | A★ | **§4b #8** |
| **AI personas** | MOCK | `/personas/*` | A★ | **§4b #9** |
| **Document AI Tasks** | MOCK | `/agent/tasks` (+doc filter) | A★ | **§4b #10** |
| AI context: document/knowledge/selection | PARTIAL | resources/knowledge real | A | wire remaining |
| AI context: sources/web + attachments | MOCK | — | C | **blocked** |
| **Comments** | MOCK | anchors substrate only (B) | C | **blocked** (build on anchors) |
| **References graph** | MOCK | — | C | **blocked** |
| **Row-window virtualization** | MOCK/dead | — | C | **blocked** (or drop client) |
| "Create with AI" new tab | MOCK | — (agent Action, B) | C | **blocked** |
| Pagination / in-editor undo | LOCAL | n/a | — | correct |
| Duplicate / trash-restore / diff | not exposed | present | A/A★ | opportunities |

---

## 9. Recommended completion sequence

**Phase 1 — Correctness + committed quick wins (no Omega work; do now).**
1. ~~Fix the `set_row_height` break → `set_block_line_height` (§7 #1).~~ **Done.**
2. Wire alignment (§4a #1), columns via row tracks (§4a #3).
3. Wire presence properly: join + publish caret + real access role; render poll-based remote
   cursors (§4a #6). Wire last-editor from history author (§4a #7).
4. Wire the already-defined-but-unused `redo` and the `quote` block kind.
5. Badge or harden the silent layout capability-gate (§7 #3); delete/flag dead `rows.ts` (§7 #4).

**Phase 2 — Typography/style registry (committed, larger).**
6. Map the inspector typography + LayoutPanel body/heading styles onto Omega's **semantic** style
   registry (§4a #4–5). Decide semantic-only vs. custom-overrides UX first.

**Phase 3 — Wire the just-landed Omega surface (now committed; pin the SHA).**
7. Pin the integrated Omega SHA (currently `2a7229f`) and verify response shapes against the running
   server.
8. Un-mock creator + identity enrichment (§4b #11–12).
9. Replace the AI Agent dock's canned store with the `/agent/*` + `/personas/*` engine (§4b #8–10),
   accepting the task/plan/action model (no chat-thread persistence, no attachments).

**Phase 4 — New backend (file real backend-requests).**
10. Comments (on the anchor substrate), references graph, AI attachments/web context, "Create with
    AI" generation. These need new Omega capability — tracked in
    [backend-contract.md](backend-contract.md) (this directory) and badged in the UI until they ship.
    Realtime co-typing is explicitly out of scope per Omega's architecture (record 0049).

---

## Appendix A — Verified Omega capability reference (document-relevant)

Routes from `core/transport/transport.go`; ops from `core/capability/document/changeset.go`.
All committed at Omega HEAD `2a7229f`; **A★** marks capability that landed 2026-07-24 (`861d099`).

**Documents (A):** `GET/POST /documents`, `GET/PATCH/DELETE /documents/:id`,
`POST /documents/:id/restore`, `DELETE /documents/:id/purge`,
`POST /documents/:id/changes`, `GET /documents/:id/history[/:changeSetID]`,
`POST /documents/:id/changes/:changeSetID/undo|redo`, `GET /documents/revision-hints`,
`POST /documents/:id/blocks/:blockID/resolve` (async).
**Documents (A★):** `POST /documents/:id/duplicate`, `GET /documents/:id/diff`,
`POST/GET /documents/:id/anchors`, `DELETE …/anchors/:id`, `POST …/anchors/:id/validate`.
**Sessions/presence (A; `userEmail` field A★):** `POST /sessions`, `PUT /sessions/current`,
`DELETE /sessions/current`, `GET /sessions`. Session carries `currentDocumentId`, `caretAtomId`,
`caretOffset`, `selection{Start,End}{AtomId,Offset}`, `userName`, `userEmail?`.
**Users (A basic; enriched profile A★):** `GET /users/:userID`.
**Agent/personas (A★):** `/agent/tasks|plans|actions|tasks/:id|…/accept`, `/personas/*`.
**Resources/activity (A):** `GET/POST/PATCH/DELETE /resources[/:kind/:id]`, `GET /activity`.
**Projects/members/links (A):** full CRUD, `/members`, `/links`, `/join/:token`, `/session/project`.
**Intelligence (A):** `POST /intelligence/reason|infer|embed`. **Knowledge (A, `/dev` only):** index/remove/retrieve.

**Changeset op vocabulary (A — 36 ops, all committed):**
`insert_row, delete_row, move_row, insert_block, delete_block, set_block, move_block, split_block,
join_blocks, insert_atom, delete_atom, move_atom, set_atom_text, splice_atom_text, add_mark,
remove_mark, update_mark, set_page_layout, set_block_alignment, set_block_line_height, set_row_tracks,
resize_adjacent_tracks, set_row_flow, set_header, set_footer, put_style_definition,
delete_style_definition, set_style_default, assign_block_style, set_block_style_overrides,
replace_style, set_prompt, resolve_block, restore_prompt_output, set_atom_formula, refresh_formula`.
**No `set_row_height`.** All targets addressed by stable id.

**Block kinds (A):** `paragraph, heading_1..6, quote, code, divider, callout, list_item, image, prompt`.
**Mark kinds (A):** `bold, italic, underline, strike, code, link`.

## Appendix B — Confirmed genuinely-absent (Tier C)

Realtime push/OT/CRDT · comment threads (anchors are pointers only) · references/link graph ·
windowed row reads (`/descriptor`, `/row-manifest`, `/rows`, `/rows/locate`) · batch identity
resolve · per-user avatar image/color · file/image upload (no `fileId` producer) · web-retrieval
context · AI resource generation · export (PDF/docx) · document templates.

## Appendix C — Existing gap-doc reconciliation

The team's `docs/backend-requests/README.md` status table (last audited 2026-07-23) is a good
scaffold but **understates current Omega** because it predates records 0049–0057. Notable staleness:
- `document-inspector.md` "row widths have no canonical representation" — **stale**; `set_row_tracks`
  exists.
- `documents.md` "real semantic rebase remains future work" — **stale**; committed (record 0046).
- `document-collaboration.md` / `identity-profiles.md` list creator + rich user lookup as pending —
  **now committed** (records 0055/0056, HEAD `2a7229f`); ready to wire.
- `document-inspector.md` etc. previously described `set_row_height` as the shipped op — **stale and now corrected**
  (§7 #1): the op was removed in favor of `set_block_line_height`.

Refresh these once Phase 1–3 land, and close each discrepancy as its mock is replaced.
