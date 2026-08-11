# Backend outstanding — implementation plan

Turns Alpha's [`2026-07-25-backend-outstanding.md`](../../../taurus-alpha/docs/integration/current/2026-07-25-backend-outstanding.md)
into executable Omega work. Written against Omega `HEAD = f8774ab`. Thinking in
**tasks, not time**; every model-backed path is tested against a real provider
with cost printed and skips cleanly without a key.

## Decisions locked (2026-07-26)

- **PDF/DOCX (G3): deferred.** Markdown stays the only import/export format,
  tracked as a follow-up.
- **Block model overhaul — `text` kind with sub-kinds.** One `text` block kind
  carries a **`subKind`** (built-in `body` + `heading_1…heading_6`, **user
  extensible**). `code` is its **own** block kind (code blocks); `list` is its own
  kind (native, items internal). The old `paragraph` / `heading_N` / `quote` /
  `list_item` kinds are **removed**. **Quote is not a kind** (just body text with
  quote characters). Inline code is a **highlight-background mark**, separate from
  the `code` block kind.
- **No migration — existing documents are wiped.** This is a dev-stage reset: no
  back-compat, no dual-shape support. Document data (documents, change sets,
  history, anchors) is cleared and the new model is adopted outright.
- **Styling model — atoms are the leaves; higher levels are default providers.**
  The full styling vocabulary (font family, size, foreground color, background
  color, bold, italic, underline, strike, link) is **inline / atom-level**. Block,
  **sub-kind**, and document only set **defaults** the atoms inherit, document
  being the ultimate default. Effective atom style resolves **per property**:
  **inline mark → block override → sub-kind default → document default →
  built-in.** The "kind" layer *is* the document's per-sub-kind default.
- **Markdown is a lossy export, not the source of truth.** Our own format; on
  export we render what maps and **silently drop what doesn't** (font, size,
  colors, background, custom sub-kinds). No feature is constrained to Markdown.
- **Chat attachments: files _and_ directory manifests** in the first cut.

## Conventions (every phase follows these)

- TDD → build → `gofmt -w` changed files → `go build ./... && go vet ./core/... &&
  go test ./core/...` → free dev-test (plus a live, skip-on-no-key, cost-printing
  dev-test for any model-backed path) → regenerate the verbatim `FILE.go.md`
  companions (0 drift) → write `docs/records/00NN-*.md` → commit → `git push origin
  main`. Work directly on `main`.
- **New capability** = `core/capability/<x>/` (domain + memory store),
  `core/handlers/<x>/`, sqlite table + store methods + `var _ <x>.Store =
  (*Store)(nil)` with **globally-unique** method names, transport Options field +
  routes (+ `operationSync` entry for `documents.*`/`resources.*`-style ops),
  wiring injects. Everything project-scoped; `entity.ProjectID == scope.ProjectID`
  re-checked.
- **Adding a document change op** = touch ALL of `changeset.go` (const + ChangeOp
  fields), `changeset_apply.go`, `changeset_inverse.go`, `changeset_validate.go`
  (validate + normalize), `rebase.go` (footprint — read-vs-write conflicts both
  ways), `clone.go`, `history.go` (summarize). Mirror `set_block_line_height` for a
  block-scoped op, `set_page_layout` for a Base-level op.
- Next free record number: **0078**. Ordering is by priority/dependency; the
  document-editor phases (B→E) share the block/style model and are done in order.

---

## Phase A — Chat attachments (High)

**Goal.** A chat can carry uploaded files and browser directory manifests, stored
durably and surfaced as agent context. Reuses the `file` capability for bytes.

**Model.**
- Reuse `core/capability/file` for the actual bytes (project-scoped metadata +
  BLOB, uploader identity, size cap already there).
- New `ChatAttachment{ ID, ChatID, Kind: "file"|"directory", FileID?, Name,
  RelativePath, DirectoryUploadID?, Status, CreatedAt }`. A directory upload is one
  manifest whose files each become a `file`-backed attachment carrying its browser
  `RelativePath`; the manifest is the attachments sharing a `DirectoryUploadID`.
- Bounds live in **configuration** with sensible defaults (reuse the same size
  balance as documents/files; per-directory file-count + total-size caps). No
  content scanning — just the size/type bounds. Config-driven so we tune later
  without a code change.

**Store.** `chat_attachments(id, project_id, chat_id, kind, file_id,
directory_upload_id, name, relative_path, status, created_at)` +
`CreateChatAttachment` / `ChatAttachmentsByChat` / `ChatAttachmentByID` /
`DeleteChatAttachment`. `var _ chat.AttachmentStore = (*Store)(nil)`.

**Routes** (carry `:chatId`, behind the existing project gate):
- `POST /agent/chats/:chatId/attachments` — multipart `{ file }` or
  `{ directoryManifest: {paths[], files[]} }` → `201` (batch for a manifest).
- `GET  /agent/chats/:chatId/attachments` → `{ attachments: [...] }`.
- `DELETE /agent/chats/:chatId/attachments/:attachmentId` → `204`.

**Agent context wiring.** Extend the chat→agent context assembly so an
attachment's text is offered as a `ContextItem` to Ask/Action/Plan alongside
document/selection/web; non-text bytes are listed, not inlined.

**Tasks.** (1) attachment domain + memory store (TDD); (2) sqlite table + methods +
assertion; (3) config for size/count caps; (4) handlers: single upload, manifest
batch, list, delete, bounds + scope; (5) attachments → `ContextItem`s; (6) free
`dev-test/chat-attachments` (upload text file appears + becomes context; small
manifest → per-file relative paths; oversized rejected; delete removes); (7) live
dev-test (skip-on-no-key): an Ask turn answers from an attached file, print cost;
(8) companions, record `0078-chat-attachments.md`, commit.

---

## Phase B — Block-kind model overhaul (`text` + sub-kinds, `code`) 

**Goal.** Collapse the semantic block kinds into a single `text` kind carrying a
**sub-kind**, add a first-class `code` block kind, and drop the old kinds. No
migration — document data is reset.

**Model (`core/capability/document`).**
- Block kinds become `text`, `code`, `list` (Phase C). The existing **`prompt`**
  block kind **stays as-is** — it's a distinct, already-shipped and tested block
  type (AI prompt blocks), not a text sub-kind and not affected by this overhaul.
- **`text` block** carries `subKind string` — the name of a **style definition**
  in the document's style registry. Built-in sub-kinds shipped in the registry:
  `body`, `heading_1`…`heading_6`. **User-extensible:** a new sub-kind is a new
  style definition (name + default typography). `subKind` defaults to `body`.
- **`code` block** — its own kind, monospace + highlight-background rendering; a
  code block is not a text sub-kind and has no sub-kind.
- Remove `BlockKindParagraph` / `BlockKindHeadingN` / `BlockKindQuote` /
  `BlockKindListItem` from `knownKinds` and the unmarshal/registration switches.
  Sub-kinds replace them; `list`/`code` are their own kinds.

**Ops (full lifecycle each).**
- `set_block_subkind` `{blockId, subKind}` — convert a `text` block in place to a
  different sub-kind (the cockpit's Text-type control; text types "convert in
  place"). Validates the sub-kind exists in the registry. Footprint:
  `block-subkind:<blockId>` (shares nothing with content/style keys).
- The block **kind** transition to/from `code`/`list`/`text` uses the existing
  `set_block` (kind) op, extended to accept the new kind set and to require a valid
  `subKind` when the target kind is `text`.
- Defining a custom sub-kind reuses the existing **style-registry** op
  (`set_style_default` / add-style-definition) — a sub-kind *is* a style
  definition, so no new registry mechanism.

**Data reset.** A one-time reset clears `documents`, `change_sets`,
`document_history`, `document_anchors` (drop-and-recreate on startup for the new
model). This is the deliberate dev-stage wipe; there is no reader for the old
kinds.

**Markdown.** `text/body` ↔ paragraph, `text/heading_N` ↔ `#`…`######`,
`code` ↔ ```` ``` ```` fence, `list` ↔ markdown list. Custom sub-kinds render as
plain paragraphs (lossy). Parser produces `text`+subKind / `code` / `list`.

**Tasks.** (1) new kind set + `text.subKind` + `code` kind + registration/bounds
(TDD, replacing the old-kind tests); (2) built-in sub-kind style definitions
(body, heading_1..6) seeded in the registry; (3) `set_block_subkind` op — full
lifecycle; extend `set_block` for the new kind set; (4) markdown render/parse for
the new kinds; (5) startup data reset for document tables; (6) free
`dev-test/block-kinds`: create a text block, convert body↔heading via subkind,
create a code block, define a custom sub-kind and apply it, markdown round-trip of
the representable subset; (7) companions, record `0079-block-kind-model.md`, commit.

---

## Phase C — Native `list` block kind (G5.1)

**Goal.** A single `list` block holds its items internally; insert a list, Enter
adds an item, marker style is a list setting.

**Model.** `ListBlockData{ Type: "bullet"|"ordered"|"check", Start int,
Items []ListItem }`, `ListItem{ Level, Checked, Atoms, Marks }`. Registered as the
`list` block kind's `BlockData`. Bounds: ≤ **256 items**, level ≤ **8**, atom/mark
bounds reuse block limits.

**Ops (full lifecycle each).**
- `set_block_data` `{blockId, data}` — replace a block's typed `Data` wholesale
  (validated per kind). Footprint writes `block-data:<blockId>`.
- `set_list_type` `{blockId, type, start?}`.
- `set_list_item` `{blockId, index, item?}` — insert/replace/remove + re-level +
  check (nil item removes; `index==len` appends). Footprint writes
  `block-data:<blockId>` so it conflicts with a concurrent `set_block_data` on the
  same block; different lists don't conflict.

**Markdown.** Render to `- ` / `1. ` / `- [ ] `; the parser groups consecutive
markdown list lines into one `list` block.

**Tasks.** (1) `ListBlockData` model + registration + bounds (TDD);
(2) `set_block_data` op — lifecycle; (3) `set_list_type` + `set_list_item` —
lifecycle each; (4) markdown render + grouped parse; (5) free `dev-test/list-block`
(add/remove/re-level/check, change type, markdown round-trip); (6) companions,
record `0080-list-block.md`, commit.

---

## Phase D — General text indent (G5.2)

**Goal.** Any text block carries an indent level (independent of lists), like
alignment and line height.

**Model.** Add `Indent int` to `BlockStyle` (0 = flush left; bounded, e.g. ≤ 16).

**Op.** `set_block_indent` `{blockId, indent}` — mirrors `set_block_line_height`
through the full lifecycle; rebase footprint **shares** `block-style:<blockId>`
with the other block-style ops so a concurrent alignment/line-height edit is
detected (the record 0069/0070 lesson).

**Tasks.** (1) `BlockStyle.Indent` + bound (TDD); (2) `set_block_indent` op — full
lifecycle, shared block-style footprint; (3) free dev-test (extend
`dev-test/typography`); (4) companions, record `0081-block-indent.md`, commit.

---

## Phase E — Inline styling + cascading typography (G6, expanded)

**Goal.** The full styling vocabulary is inline; block, sub-kind, and document are
default providers; effective atom style resolves **inline mark → block override →
sub-kind default → document default → built-in**, per property.

### E1 — Complete the inline styling vocabulary (atom level)

Inline styling is expressed with **marks** (a `Kind` + `Attrs` over an atom range)
— already how `bold`/`italic`/`underline`/`strike`/`code`/`link` work. Add the
typographic marks:
- `font` — `Attrs{ family?, size? }`
- `color` — `Attrs{ value }` (foreground)
- `background` — `Attrs{ value }` (background / highlight; also what inline `code`
  renders with)
- Colors validated as safe CSS colors (hex / rgb(a) / named); family/size bounded,
  reusing the `CustomTypography` validation.
- Set via the existing `set_mark` op (and cleared via mark removal) — just a wider
  `markKinds` set + per-kind attr validation; the mark changeset lifecycle already
  exists.
- **Markdown:** render the representable subset (bold/italic/strike/code/link),
  **drop** `font`/`color`/`background` on export; the parser only produces
  representable kinds. No styling round-trip guarantee.

### E2 — Cascading defaults (block / sub-kind / document)

- **Block override:** `styleRef.overrides.custom` already exists
  (`set_block_custom_typography`); extend `CustomTypography` to carry **foreground
  + background color** if not already present, so a block override covers the same
  properties as an inline mark.
- **Sub-kind default:** the block's style definition (its `subKind`) carries a
  default `Custom` typography — resolved through the existing style registry
  (`set_style_default` extended to carry/validate `custom`). Built-in defaults ship
  for `body` + `heading_1…6`.
- **Document default:** `DefaultTypography *CustomTypography` on `Base`, set via a
  Base-level `set_default_typography` op (mirror `set_page_layout`; `DocumentWide`
  in summarize; nil clears).
- **Resolver:** read-time, per property — an atom takes each property (family,
  size, fg, bg, weight, style) from the first level that sets it: inline mark →
  block override → sub-kind default → document default → built-in.

**Ops (full lifecycle each).** Wider `markKinds` + attr validation for `font` /
`color` / `background`; `set_default_typography` (Base-level); `set_style_default`
carrying `custom`.

**Tasks.** (1) `font`/`color`/`background` marks + validation + bounds (TDD);
(2) markdown drops non-representable marks, parse emits only representable ones
(round-trip test for the subset); (3) `Base.DefaultTypography` +
`StyleDefinition.Custom` (+ color on `CustomTypography` if missing); (4)
`set_default_typography` op — lifecycle; `set_style_default` carries `custom`;
(5) per-property cascade resolver + unit test asserting the five-level order and
independent per-property resolution (inline color + inherited family); (6) free
`dev-test/typography`: document default + heading sub-kind default + block override
+ inline font/color/background, read back and assert effective per-property style,
export to Markdown and confirm non-representable styling drops without error;
(7) companions, record `0082-inline-styling-and-typography.md`, commit.

---

## Phase F — Per-user workspace state

**Goal.** A user's open tabs + panel geometry/sections follow them across devices,
per project.

**New capability `core/capability/workspace`.** `Workspace` = the opaque,
JSON-serializable object the cockpit sends (`tabs[]`, `activeTabId`,
`context{width,collapsed,section}`, `inspector{...}`), stored **whole** and
returned verbatim. Omega validates only size (≤ **64 KiB**) and valid JSON — it
does not model the interior (forward-compatible). Keyed **per user × per project**;
last-write-wins; server `updatedAt` so the client can skip redundant writes.

**Store.** `workspaces(user_id, project_id, state, updated_at, PRIMARY
KEY(user_id, project_id))` + `Workspace(userID, projectID)` /
`SetWorkspace(userID, projectID, state, now)`. `var _ workspace.Store =
(*Store)(nil)`.

**Routes** (project-scoped; user + project from the session):
- `GET /workspace` → `200 { ...state, updatedAt }` (or `{}`+null when unset).
- `PUT /workspace` `{ ...state }` → `200 { updatedAt }` (whole-state replace).

**Tasks.** (1) capability (opaque-blob validate + bound) + memory store (TDD);
(2) sqlite table + methods + assertion; (3) handlers + Options field + routes +
wiring; (4) free `dev-test/workspace` (PUT then GET; second user isolated; other
project isolated; oversized rejected); (5) companions, record `0083-workspace.md`,
commit.

---

## Phase G — Project member summary (Low)

**Goal.** `GET /projects` returns a bounded member summary per project so the list
renders avatar clusters without one members request per row.

**Change.** Augment the `GET /projects` projection with an additive `members`
field: `{ items: [{ userId, name, avatarUrl }], total }`. `items` bounded to a
small stack (**5**), `total` exact. Same project authorization + **public-profile**
safety as the full member endpoint (no email, no role here), reusing its
profile-projection helper. Efficient: one batched
`MembersSummaryByProjects(projectIDs)` store read, not N queries.

**Tasks.** (1) batched bounded member-summary store method (TDD); (2) thread into
the `GET /projects` projection (cap items, exact total, safe fields); (3) free
dev-test (multi-member stack + exact total; non-member sees nothing; public-safe
fields); (4) companions, record `0084-project-member-summary.md`, commit.

Default stack size **5** (a standard avatar-cluster size); trivially adjustable.

---

## Deferred (tracked, not built here)

- **G3 — PDF/DOCX import/export.** Revisit pure-Go, no-AGPL export-first later.
- **Notification preferences.** Deferred until there is a second notification type
  and/or a real email delivery channel to actually prefer — a preferences screen
  today would only store toggles that gate nothing. Revisit when either lands.

## Suggested order

A (attachments, High) → **B → C → D → E** (the document-editor model, in order:
kinds → list → indent → inline/typography) → F (workspace) → G (member summary,
Low). Each phase is its own commit + record.

## Open questions carried into execution

None outstanding — reversible / industry-standard defaults are chosen and noted
inline (attachment caps → config; member stack → 5), and notification preferences
are deferred. The plan is ready to execute.
