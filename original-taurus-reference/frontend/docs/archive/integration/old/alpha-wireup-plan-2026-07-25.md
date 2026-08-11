# Alpha wire-up implementation plan (2026-07-25)

The followable plan for un-mocking / wiring the remaining document + AI surfaces against Omega,
per the audit (`alpha-ux-audit-2026-07-25.md`) and the block/style model
(`../../architecture/document-block-and-style-model.md`). Ordered; check items off as they land.

## Working rules (every item)

1. **Nothing mocked** — un-mock against Omega, or hide if genuinely gapped (never fake data).
2. **Verify each op/route** round-trips against a fresh Omega build (`:8444`) or the live `:8443`
   (engine-enabled). Rebuild the `:8444` verify binary when an op is newer than the binary.
3. **Companions** (Practice 1) updated in the same change; byte-verify they reproduce source.
4. **Commit per item** with a change record (Practice 2); `svelte-check` + `vitest` green.
5. Capabilities are behind Omega `opts.*` guards — degrade gracefully (hide) if a route 404s on the
   running server; note it.

## Order & status

- [x] **A1 — Real fonts** (inspector font family/size/color → `set_block_custom_typography`).
      Done, verified, committed `5c663b4`.
- [ ] **IO — Import / Export** (Markdown) — **next; editor-bar buttons.**
- [ ] **B1 — Prompt-block editing** (instruction / evidence / resolve).
- [ ] **B3 — Comments** (+ replies) un-mock.
- [ ] **B5 — References + backlinks** un-mock.
- [ ] **B4 — AI-task polling** (live progress).
- [ ] **AI-create** dialog → `/resources/generate`.
- [ ] **A2 — Block type / text type / insert element** (large; own sub-plan).
- [ ] **B2 — AI dock / Quarterback** (large; Goal 3.3; own sub-plan).
- [ ] **Gaps G1–G4** — hide templates / notifications / pdf-docx / resource-options.
- [ ] **B6 — Name Manager** end-to-end verify.

---

## IO — Import / Export (Markdown) — buttons in the editor top bar

**Omega:** `GET /documents/:documentID/export` (Markdown, always on) → returns the doc as Markdown;
`POST /documents/import` (guarded by `opts.Files`) → creates a new document from an uploaded Markdown
file. pdf/docx are gapped (G3) — offer Markdown only.

**Alpha files:** `DocumentStage.svelte` (the three-zone top bar, ~L295 — add Export + Import buttons);
new `systems/documents/io.ts` (`exportDocument(id)` → download `.md`; `importDocument(file)` →
new doc → open it); replace the mock `ExportDialog.svelte` / `ImportDialog.svelte` (or repoint them).

**Steps:**
- `exportDocument(id)`: `GET …/export`, download as `<name>.md` (Blob + anchor).
- `importDocument(file)`: upload the Markdown (multipart or the import endpoint's expected body →
  confirm shape), get the new document id, open it as a resource tab.
- Add **Export** + **Import** buttons to the editor top bar (right zone). Import opens a file picker
  (`.md`); Export downloads the current doc.
- Confirm the import request/response shape against Omega before wiring.

**Verify:** export a doc → Markdown downloads; import a `.md` → new doc opens with the content.

**Done:** Editor bar has a single quick **Export** button (current doc → Markdown; no import there —
import creates a *new* doc). The **All resources** panel (renamed from "Resources") owns project-level
**Import** and **Export**, both as **modals** (import = Markdown file picker → new doc; export = pick a
document → download). Verified the export/upload/import round-trip on `:8444`.
**Follow-ups:** docx/pdf formats are G3 (backend); verify against live `:8443` (needs `opts.Files`).

---

## B1 — Prompt-block editing

**Omega:** `set_prompt` (instruction) + `resolve_block` ops; `POST /documents/:id/blocks/:blockID/resolve`
(async, 202 + jobId; poll the job). `Doc.PromptData` = instruction / status / evidence / lastOutput.
Runtime already has `setPrompt` / `resolvePrompt` / `resolvePromptBlock`. Has `prompt_test.go`.

**Alpha files:** `DetailsPanel.svelte` — add a prompt section shown when the inspected block is a
`prompt` kind: instruction textarea → `setPrompt`; Resolve button → `resolvePrompt`; render status +
evidence[] + last output. (Surface `PromptData` on the session if not already.)

**Verify:** set a prompt instruction (persists); resolve returns evidence/output (needs engine — use
`:8443`).

---

## B3 — Comments (+ replies)

**Omega:** `GET/POST /documents/:id/comments`, `PATCH/DELETE /comments/:id`, `POST /comments/:id/replies`
(guarded `opts.Comments`); anchored to a document anchor (`/documents/:id/anchors`).

**Alpha files:** new `systems/documents/comments.ts` client; `CommentsPanel.svelte` (un-mock; drop
`mockDocumentComments` + MockBadge); `DetailsPanel.svelte` "Add comment" → real create anchored to the
selection. Remove `mockDocumentComments` from `context.ts`.

**Verify:** create/list/resolve a comment on `:8443`; anchor persists.

---

## B5 — References + backlinks

**Omega:** `GET /documents/:id/references` + `GET /documents/:id/backlinks` (edges from inline links;
guarded `opts.References`).

**Alpha files:** new `systems/documents/references.ts` client; `ReferencesPanel.svelte` (un-mock;
outgoing = references, incoming = backlinks; drop `mockDocumentReferences` + MockBadge).

**Verify:** a doc with links shows real outgoing refs; the linked doc shows the backlink.

---

## B4 — AI-task polling

**Omega:** `GET /agent/tasks/:id` (live `state`/`runs`).

**Alpha files:** `AiTasksPanel.svelte` (poll non-terminal tasks on an interval; update status). Small.

**Verify:** a running task advances state in the panel on `:8443`.

---

## AI-create → /resources/generate

**Omega:** `POST /resources/generate` (`{documentId?, prompt}` → taskId; AI-generates a resource as an
Action task).

**Alpha files:** `AiCreateDialog.svelte` (un-mock → real generate; drop MockBadge). Ties into B2's task
surfacing.

**Verify:** generate returns a taskId; the task appears (with B2/B4).

---

## A2 — Block type / text type / insert element (LARGE — sub-plan when reached)

**Model:** "Add/Create element" (top of a new line) = block **kind** (text default; image/table/
divider/… ); "Text type" (bottom for a selection) = the semantic **text type** which maps to **both**
a text-based kind (`set_block`) **and** the internal semantic style (`assign_block_style`). Selection
spanning blocks → `split_block` at bounds then convert.

**Omega:** `set_block`, `insert_block`, `split_block`, `join_blocks`; 14 kinds. **Alpha:** expand
`BlockKind` (add quote/code/divider/callout/list_item/image) + ProseMirror schema/bridge/rendering;
new inspector sections; the internal registry maps each text type → {kind, style}. Needs a dedicated
sub-plan + likely staged commits (types+schema first, then kinds' rendering, then the inspector UX).

---

## B2 — AI dock / Quarterback (LARGE — Goal 3.3 — sub-plan when reached)

Real `/agent/chats` (+ turns polling), `/agent/plans|actions` + `/agent/tasks/:id` polling,
`/personas` picker (default General), task↔chat (open a task's chat on double-click), real progress;
drop the mocked `ai-agent` store + MockBadge. Own sub-plan; engine-enabled on `:8443`.

---

## Gaps G1–G4 (hide)

Hide Templates, Notifications, pdf/docx export-import, and resource visibility/options (verify G4);
file the backend requests (`../../backend-requests/alpha-remaining-gaps-2026-07-25.md`).

## B6 — Name Manager verify

Exercise `/projects/:id/names/*` end-to-end on `:8443`; confirm the panel reflects create/edit/delete.
