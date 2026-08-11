# Alpha UX audit + Alpha↔Omega integration notes (2026-07-25)

Persistent record of everything in the document + AI surfaces that is **not built out, doesn't work,
or doesn't match the product's mental model / Omega's real capabilities** — from user review feedback
plus a source + Omega-route/capability sweep. Written *before* fixing. Each item:
**Observed → Omega support → Action → Priority.** Facts verified against `taurus-omega` source
(`core/transport/transport.go`, `core/capability/document/*`, `core/capability/{comment,chat,agent,
persona}`).

> **Guiding principle (user):** *nothing should be mocked.* Every surface is either un-mocked against
> Omega, or — if Omega genuinely can't back it — hidden / filed as a backend request. Never leave fake
> data showing as if real.

## TL;DR — ready vs gapped (verified against Omega routes 2026-07-25)

Almost everything is **backable now** (frontend work only). The genuinely-gapped set is small and
lives in its own backend TODO: [`../../backend-requests/alpha-remaining-gaps-2026-07-25.md`](../../backend-requests/alpha-remaining-gaps-2026-07-25.md).

- **READY (implement now):** real fonts (custom typography), block-type/text-type/insert-element,
  prompt-block editing, AI dock (chats/tasks/personas), comments (+replies), **references + backlinks**,
  **Markdown import/export**, files/images, AI-create (`/resources/generate`), Name Manager.
- **GAPPED (backend):** document **templates**, **user notifications**, **PDF/DOCX** export/import
  (Markdown works), **resource visibility/options** (verify). That's it.
- **Internal model + decisions:** [`../../architecture/document-block-and-style-model.md`](../../architecture/document-block-and-style-model.md)
  (the three-axis block model; the semantic style registry is internal).

> Correction: an earlier draft of this audit wrongly listed **references, import, and export as
> blocked** — they have real Omega routes. Fixed below.

---

# Part A — Typography & block-type model (the biggest area)

## A0. Omega's real block model — THREE independent axes (reference)

A block in Omega carries three orthogonal typography/structure axes. Alpha currently conflates them
(and my Goal 2.1/2.2 only touched axis 2). Getting these straight is the key to the fixes below.

| Axis | What it is | Omega field | Op(s) | Values |
|---|---|---|---|---|
| **1. Kind** | structural block type | `block.kind` | `set_block` (SetKind), `insert_block`, `split_block`, `join_blocks` | paragraph, heading_1..6, **quote, code, divider, callout, list_item, image**, prompt |
| **2. Semantic style** | named style + semantic facets | `block.styleRef` (`styleId` + `overrides`) + doc `styleRegistry` | `assign_block_style`, `set_block_style_overrides`, `set_style_default`, `put_style_definition` | typography token (body/heading/title/display/label/quote/code/body_small), tone, spacing, padding, border, background |
| **3. Custom typography** | free-form real fonts | `block.styleRef.overrides.custom` (`CustomTypography`) | **`set_block_custom_typography`** | `fontFamily` (str), `fontSize` (str, any CSS unit), `color` (str) — per **block**, ungated, length-bounded only |

Two of these were previously thought unavailable but **are** real:
- Axis 3 (**real font family / size / color**) — via `set_block_custom_typography`. Alpha references
  it nowhere today. **This is what "add font size and color back" needs — no backend request.**
- Axis 1 has **more kinds than Alpha exposes** (see A3).

## A1. Character typography (font family / size / color) — REGRESSION — **P0**

**Observed:** Goal 2.1 (commit `74512da`) replaced the inspector's real **font family + font size +
foreground/background color** controls with a single semantic **Typography** token select. The user
wants the real controls back; the semantic-token control should go.

**Omega support:** ✅ **fully backable via axis 3** (`set_block_custom_typography` →
`customTypography:{fontFamily, fontSize, color}`, stored at `styleRef.overrides.custom`). `fontSize`
is a free CSS-unit string; `color` a string. **No backend request needed** — my earlier
"BR-TYPOGRAPHY-REAL" note was wrong; I'd missed this op.

**Caveat (model nuance):** custom typography is **per block**, not per text run. Omega has no
per-character font/size/color (marks are only bold/italic/underline/strike/code/link). So "set the
font of *this selected phrase*" maps to setting the **block's** custom typography (or splitting the
line — see A2). A single background color is also block-level. Document this in the UI (it changes
the whole line's font/size/color).

**Action:** revert the semantic Typography select; restore font-family (Combobox) + font-size
(NumberField/units) + color (FG/BG pickers), wired to a new runtime `setBlockCustomTypography` action
→ `set_block_custom_typography`. Applies to the selected block(s). Re-evaluate whether the LayoutPanel
body/heading controls should also be real fonts (likely yes, via `set_style_default` custom on a style
+ or per-kind defaults). Verify round-trip on `:8443`.

## A2. Block type + "insert element" — inspector redesign — **P1**

The user's spec (there is no longer a "select block" control; this replaces it):

**On an empty / new line** (call it **"New line"**, not "Block"):
- **Top: an "Insert element" dropdown** — pick a non-text **element** to insert here (image, divider,
  callout, code block, prompt/AI, …). Selecting one inserts that element.
- **Below: a "Text type" dropdown** (paragraph, heading 1-6, quote, list, …) + the same **next-character
  formatting** shown for typed text (font family/size/color + marks for what you type next).

**When text is selected** (a run):
- Character formatting at top (font/size/color + marks).
- **At the very bottom: a "Text type" dropdown** (paragraph/heading/…) with an explanation: *"Changes
  the whole line — use this to make headers, etc. Applies to every selected line."*
- Only **text-based types** appear here; elements are inserted via New line → Insert element.

**Semantics of a Text-type change over a selection:** the selection is contiguous by definition. If
it spans parts of multiple blocks, split at the selection bounds into their own contiguous block(s),
then convert those to the chosen kind.

**Omega support:** ✅ all present — `set_block` (change kind), `insert_block` (insert an element kind),
`split_block` + `join_blocks` (the split-at-bounds behavior), `move_block`. The non-text element kinds
(image, divider, callout, code) and extra text kinds (quote, list_item) already exist in Omega's kind
set.

**Action:** build the New-line (Insert element + Text type) and text-selection (Text type at bottom)
inspector sections, mapping to `set_block` / `insert_block` / `split_block`+`join_blocks`. Expand
Alpha's `BlockKind` to Omega's full set (see A3). Wire the split-on-multi-block-selection behavior.

## A3. Model conflicts in this area (Alpha ↔ Omega)

Both prior "open decisions" are now **resolved** by the user (2026-07-25); the full model lives in
[`../../architecture/document-block-and-style-model.md`](../../architecture/document-block-and-style-model.md):

1. **Semantic style registry = INTERNAL (kept).** It is *not* a user-facing control; it defines what
   each **text type** (Body, Header 1-6, …) looks like. Do not surface it raw (that was Goal 2.1's
   error), but keep it — it backs the text types + layout defaults.
2. **"Text type" is the semantic type; "element" is the kind.** "Add/Create element" (new-line, top)
   sets the *element* (text default / image / table / divider …) = Omega kind (axis 1). "Text type"
   (bottom for a selection) picks paragraph/body/heading/… — the semantic types. **"body" stays.**
3. **Two separate axes in the data model** (kind × semantic style) — matches Omega. Custom typography
   (axis 3, real fonts) is **per block, not per run**.
4. **Alpha exposes 8 of Omega's 14 kinds** (missing quote, code, divider, callout, list_item, image) —
   the element/text-type work must grow the `BlockKind` type + editor schema/bridge/rendering.
5. **Remaining open question** (recorded in the architecture doc): does picking "Header 1" map to
   Omega kind `heading_1`, a style, or **both** (recommended)? Confirm before building A2.

---

# Part B — Other surfaces

## B1. Prompt-block editing UI — MISSING — **P1**

**Observed:** no UI edits a prompt block's instruction, shows its evidence, or resolves it. Only
right-gutter prompt *indicators* render (`DocumentStage.svelte`); no component calls
`actions.setPrompt`/`resolvePrompt`. The user recalls "a whole section of what goes in the prompt
block."

**Omega support:** ✅ `set_prompt` + `resolve_block` ops; runtime already exposes `setPrompt`/
`resolvePrompt`/`resolvePromptBlock`; `Doc.PromptData` carries instruction/status/evidence/lastOutput.

**Action:** re-add the prompt inspector section (instruction textarea → `setPrompt`; Resolve button →
`resolvePrompt` reload/refresh; render status + evidence + last output). Pure frontend; Omega-ready.

## B2. AI Quarterback dock — FULLY MOCKED (= Goal 3.3) — **P1**

**Observed:** composer + dock ride the mocked `ai-agent` store (`store.ts` seeds `initialChats`/
`initialPlans`; `submitAiPrompt`/`acceptAiPlan` canned; `QuarterbackPanel.svelte:361` MockBadge +
"execution remains mocked"). User observations:
- A task can be initiated but shows **no progress** — can't tell it's mock.
- **Tasks should have their own chats** — double-click a task → open its chat.
- Need a **persona dropdown beside the mode (Ask/Action/Plan) selector**, default **General**.
- Nothing here should be mocked.

**Omega support:** ✅ rich — persistent **Chats** (`/agent/chats` +`/turns` → {userTurn, agentTurn};
chat may pin `resourceId`; a `Turn` carries `taskId`), **Plan/Action tasks** (`/agent/plans|actions`,
`GET /agent/tasks[/:id]`, `…/plans/:planID/accept`), **Personas** (`/personas`), internal **Ask**.
`:8443` is engine-enabled (`etc/config.local.yaml` → OpenRouter + casts) so generation runs for real.

**Action (Goal 3.3):** replace the mock store with real chats (+ turn/task polling), plan/action
creation, and the `$systems/personas` picker; add the persona dropdown (default General); model
**task ↔ chat** (open a task's chat on double-click, via the turn `taskId` link or a task-pinned
chat); show real task **state/progress**; drop the MockBadge + mock copy; hide genuinely-absent bits
(attachments; persistent "web" source — `web` is only a per-turn flag).

## B3. Comments — MOCKED but now BACKABLE — **P2**

**Observed:** `CommentsPanel.svelte` renders `mockDocumentComments` (+MockBadge); inspector "Add
comment" is `mockAction` (`DetailsPanel.svelte:367`). User sees fake comments for a feature they
believe is unsupported.

**Omega support:** ✅ **now available** — `GET/POST /documents/:documentID/comments` +
`PATCH /comments/:commentID` (anchored threads, replies, resolve), gated on `opts.Comments`. This
**reverses** the old "comments blocked" note in `backend-contract.md`.

**Action:** un-mock against the real routes; wire "Add comment" to a real create; remove
`mockDocumentComments` + MockBadges. Confirm `:8443` has `opts.Comments` enabled.

## B4. AI Tasks panel — no live progress — **P2**

**Observed:** the document AI Tasks panel (Goal 3.5, real) loads once and doesn't poll, so a running
task's state never advances in the UI.

**Omega support:** ✅ `GET /agent/tasks/:id` returns live `state`/`runs`.

**Action:** poll active (non-terminal) tasks; surface run progress. Shares Goal 3.3's polling.

## B5. References — MOCKED but BACKABLE (corrected) — **P2**

**Observed:** `ReferencesPanel.svelte` renders `mockDocumentReferences`; inspector Reference control
offers "Document (Mock)"/"Named reference (Mock)" via `mockAction`.

**Omega support:** ✅ **real reference graph** — `GET /documents/:documentID/references` +
`GET /documents/:documentID/backlinks` (edges derived from the inline links each document carries),
gated on `opts.References`. *(Earlier draft wrongly called this blocked.)*

**Action:** un-mock the References panel against `/references` + `/backlinks` (outgoing + incoming);
remove `mockDocumentReferences` + MockBadge. The inspector's "named reference" type may still need the
Names API — wire plain + document links now. Confirm `opts.References` enabled on `:8443`.

## B6. Name Manager — REAL (confidence check) — verify

**Observed:** user "can't tell if it works."

**Omega support:** ✅ `NameManagerPanel.svelte` → `/projects/:projectID/names/*` (List/Get/SetValue/
SetTable/Delete — routes confirmed `transport.go:277-282`). Wired to real endpoints.

**Action:** verify end-to-end on `:8443` (create/list/edit/delete a name reflects in the panel). No
mock here; should already work.

## B7. Other mocked surfaces (MockBadge sweep) — **P3**

| Surface | File | Omega backable? | Action |
|---|---|---|---|
| Comments panel | `CommentsPanel.svelte:17` | ✅ | un-mock (B3) |
| References panel | `ReferencesPanel.svelte:30` | ✅ | un-mock (B5) |
| Inspector ref/comment (`mockAction`) | `DetailsPanel.svelte:279,367` | ✅ both | wire comment + reference |
| AI dock | `QuarterbackPanel.svelte:361` | ✅ | Goal 3.3 (B2) |
| AI create dialog | `AiCreateDialog.svelte:39` | ✅ `/resources/generate` | map to a real task |
| Import / Export (Markdown) | `ImportDialog.svelte:33`, `ExportDialog.svelte:27` | ✅ Markdown | wire Markdown; pdf/docx gapped (G3) |
| Templates | `NewTabStage.svelte:93` | ❌ | GAP G1 — hide |
| Resource visibility/options | `ResourceSettingsDialog.svelte:79,98` | ? | GAP G4 — verify |
| User notifications | `UserSettingsDialog.svelte:91` | ❌ | GAP G2 — hide |
| Identity "Mock" badge | `IdentityHoverCard.svelte:123` | n/a | legit — flags a mock-fallback profile |

`MOCK_IDENTITIES` (`identity-directory/mocks.ts`) is a legitimate offline fallback (real users/personas
resolve from Omega), but its fake people (Maya/Owen) can surface in fallback cards.

---

# Part C — Alpha ↔ Omega model conflicts (consolidated)

For the integration record — where Alpha's model diverges from Omega's:

1. **Typography is three axes in Omega** (kind / semantic style / custom fonts), not one. Alpha's
   inspector historically presented a flat "font + type" mix. See A0/A3.
2. **"body" is a style token, not a block kind.** Don't list it alongside paragraph/heading as a
   peer "text type" (A3.1).
3. **Alpha exposes 8/14 block kinds.** Missing: quote, code, divider, callout, list_item, image —
   needed for Insert-element + richer text types (A3.2).
4. **Real fonts are per-block** (custom typography), not per-character-run (A1 caveat).
5. **Comments are now backable** — reverses the old "blocked" contract (B3).
6. **Persistent Chats now exist** (`/agent/chats`) — the old plan assumed "no persistent chat
   thread"; the Alpha chats store maps directly (B2).
7. **No persistent "web" context source** — Omega exposes `web` only as a per-turn boolean flag on a
   chat turn; attachments are absent.
8. **Semantic style registry (Goal 2.1/2.2)** exists + verified but may be dropped/repurposed
   depending on the A3.3 decision.

---

# Part D — Backend requests to file

The full backend TODO is its own doc:
[`../../backend-requests/alpha-remaining-gaps-2026-07-25.md`](../../backend-requests/alpha-remaining-gaps-2026-07-25.md).
In short:

- ~~BR-TYPOGRAPHY-REAL~~ — **not needed**; real fonts exist via `set_block_custom_typography`.
- ~~BR-REFERENCES~~ — **not needed**; `/documents/:id/references` + `/backlinks` exist.
- **G1 templates**, **G2 notifications**, **G3 pdf/docx export-import** (Markdown works),
  **G4 resource visibility/options** (verify) — the only real gaps.

---

# Part E — Suggested address order

1. **A1** — real font/size/color via `set_block_custom_typography` (P0, live regression, Omega-ready).
2. **A2** — block-type / insert-element inspector redesign; expand `BlockKind` to Omega's set (P1).
   Confirm the one open mapping question (A3.5 / architecture doc) first.
3. **B1** — prompt-block editing section (P1, pure frontend, Omega-ready; has `prompt_test.go`).
4. **B2** — Goal 3.3 AI dock: real chats/tasks/Ask + persona dropdown + task↔chat + progress (P1).
5. **B3 + B4 + B5** — un-mock comments, references+backlinks, and add AI-task polling (P2).
6. **Markdown import/export** + **AI-create** (`/resources/generate`); **B6** verify Name Manager.
7. **Gaps only** (G1–G4): hide templates / notifications / pdf-docx / resource-options and file the
   backend requests — [`../../backend-requests/alpha-remaining-gaps-2026-07-25.md`](../../backend-requests/alpha-remaining-gaps-2026-07-25.md).

## One open question (see architecture doc)

Does "Header 1" text type map to Omega kind `heading_1`, a semantic style, or **both** (recommended)?
Everything else is decided.
