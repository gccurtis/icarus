# Backend contract — what Omega must build to unblock the document editor

**Status:** Living contract. Every entry here is a document-editor feature that is **mocked in Alpha
today because Omega has no capability to back it** — not a wiring gap, a genuine build. Each entry
says what the feature is, why the editor needs it, why it's blocked, and the concrete Omega work to
unblock it. The companion [alpha-implementation-plan.md](alpha-implementation-plan.md) covers the
*other* half — mocks Omega can already back. The audit that produced both is
[omega-integration.md](omega-integration.md).

**Reading key.** Each blocker has a stable ref `BR-*` (Backend Request). **Type:** *Expose* = Omega
has the internal machinery, just needs a route; *Build* = no internal capability, full design +
implementation. **Verified against** Omega `main` @ `2a7229f` (routes in `core/transport/transport.go`,
capabilities in `core/capability/`).

> **Scope:** this list is the **document editor**. A few entries (import/export, "Create with AI")
> straddle the wider resource system; they're included because the editor surfaces them, and flagged
> where they're broader than the editor.

---

## 0. Recently RESOLVED (was blocked; now shipped — do NOT re-request)

The prior [../old/backend-contract.md](../old/backend-contract.md) listed these as blockers. Omega
shipped them (records 0049–0057, committed `2a7229f` on 2026-07-24). They move to
[alpha-implementation-plan.md](alpha-implementation-plan.md) as *wiring* work, not backend work:

| Was | Now | Shipped by |
|---|---|---|
| Document creator attribution (EP-DOC-CREATOR) | **Shipped** — `creatorId`/`creatorName` on the document | record 0055 |
| Identity profile enrichment (EP-IDENTITY-FIELDS) | **Shipped** — rich `GET /users/:userID` `{id,kind,name,email,role,description,createdAt}` | record 0056 |
| Session presence enrichment (EP-SESSION-ENRICH) | **Shipped** — `/sessions` with caret/selection + `userEmail` | records 0049/0057 |
| AI agent engine (part of CP-AI-AGENT) | **Partially shipped** — `/agent/*` Plan/Action/Ask + `/personas/*`. Chat history + attachments still absent (see BR-AI-CHAT / BR-AI-CONTEXT) | `861d099` |
| Document duplicate route (EP-DOC-DUPLICATE) | **Shipped** — `POST /documents/:id/duplicate` | record 0051 |
| Block alignment / line-height ops (part of CP-BLOCK-TYPOGRAPHY) | **Shipped** — `set_block_alignment`, `set_block_line_height`, `set_row_tracks` | records 0039/0047/0048 |

What remains genuinely blocked is below.

---

## 1. Document-editor blockers (priority order)

### BR-REFERENCES — Reference graph (outgoing / incoming links) — **P2 · Build**

**What it is.** The editor's **References panel** shows two lists for the open document: **outgoing
references** — other resources *this* document points at (a link, a mention, an embed) — and
**incoming references** — other resources that point *at this* document ("backlinks"). It's the
"what connects to what" graph across the project's resources, the way a wiki shows backlinks or a
docs tool shows "linked from."

**Why the editor wants it.** Writers need to see what a document depends on and what depends on it —
to navigate related material, understand blast radius before editing, and avoid orphaning links. The
panel is a first-class navigation surface, not decoration.

**Why it's blocked.** Omega has **no link/reference model and no endpoint**. It stores document
content (atoms/blocks/rows) and a `link` *mark* (an inline hyperlink with an `href`), but it does not
model a link as an edge between two **resources**, and it cannot answer "what points at document X."
The Activity feed can resolve a target's name (record 0034) but that is not a queryable graph. Today
the panel renders `mockDocumentReferences` — 5 hardcoded items in
`src/lib/systems/documents/context.ts:42-80`.

**What Omega must build.**
- A **reference edge model**: `{fromResource, toResource, kind (link|mention|embed), anchor?}`,
  extracted when a document is saved (walk the `link` marks + any resource-mention atoms) and stored
  as a directed edge set per project.
- Read endpoints:
  ```http
  GET /documents/:documentID/references            → outgoing edges from this doc
  GET /documents/:documentID/backlinks             → incoming edges to this doc
  # each edge: { fromResource:{id,kind,name}, toResource:{id,kind,name}, kind, anchor? }
  ```
- Edges must update as content changes (re-extract on `append_changes`) and resolve target
  names/kinds (reuse the Activity reference resolver).

**Estimated effort:** Medium — a new edge store + extraction on save + two read routes. The hardest
part is defining what counts as a "reference" (inline link only, or also resource-mention atoms — the
atom model has no mention kind today, so mentions may need BR alongside this).

**Alpha unblocks:** `ReferencesPanel.svelte` + `mockDocumentReferences`; "Go to reference" navigation.

---

### BR-DOC-ROW-WINDOWS — Windowed row reads (bounded document loading) — **P2 · Build**

**What it is.** Today `GET /documents/:id` returns the **entire** document — every row, block, and
atom — in one response. **Windowed reads** split that into: (1) a lightweight **descriptor**
(document metadata + total row count + page geometry), (2) a **row manifest** (an ordered list of row
IDs with just their heights/offsets — enough to lay out the scrollbar and pages *without* the row
content), and (3) **windowed row fetches** that return only the rows in the currently-visible range,
streaming more as the user scrolls. Plus a **locate** call to jump to an arbitrary row/anchor.

**Why the editor wants it.** For a large document (hundreds of pages), shipping and parsing the whole
thing on open is slow and memory-heavy. Windowed reads let the editor open instantly (descriptor +
manifest are tiny), render only what's on screen, and fetch the rest on demand — the standard
virtualization pattern, but *network-level* rather than just DOM-level. It's the difference between
"load a 500-page doc in one 8 MB payload" and "load the outline instantly, stream pages as you
scroll."

**Why it's blocked.** Omega only serves the whole document. Alpha **already built the client** for
this — `src/lib/systems/documents/rows.ts` has typed calls for
`GET /documents/:id/descriptor`, `/row-manifest`, `/rows`, and `/rows/locate` — but **none of those
routes exist in Omega**, so the client is **dead code** with no consumer, and the runtime loads the
full document instead. (Alpha's local pagination engine is correct and stays — this is about the
*network read*, not page composition.) See the discrepancy `docs/discrepancies/document-row-windows.md`.

**What Omega must build.**
```http
GET /documents/:documentID/descriptor
  → { id, name, revision, pageLayout, layoutRules, styleRegistry, rowCount }   # no row bodies

GET /documents/:documentID/row-manifest
  → { rows: [{ id, height, offset }], revision }                                # ids + metrics only

GET /documents/:documentID/rows?from=<rowId|index>&count=<n>
  → { rows: [Row], revision }                                                   # a window of full rows

GET /documents/:documentID/rows/locate?anchor=<atomId>|?index=<n>
  → { rowId, index, offset }                                                    # jump target
```
- All must be **revision-stamped** so the client can detect a mid-scroll edit and re-sync (the
  changeset machinery already carries `revision`).
- The internal `Paginate(base)` function (record 0041) already knows row heights — the manifest can be
  derived from it without recomputing layout client-side.

**Estimated effort:** Medium — the content model already addresses rows by stable id; this is
projection + range queries + four routes. The subtlety is keeping windowed reads consistent with
in-flight changesets (revision checks + a re-sync path).

**Alpha unblocks:** deletes the dead `rows.ts` fallback (or activates it); bounded startup and scroll
loading for large documents.

---

### BR-COMMENTS — Anchored comment threads — **P2 · Build (foundation shipped)**

**What it is.** Comments anchored to a range of document content, with author, body, replies, and a
resolved/open state — the standard margin-comment thread.

**Why the editor wants it.** Review and collaboration. The **Comments panel** and the "Add comment"
inspector action are core editor surfaces; today they render `mockDocumentComments` (2 hardcoded
items, `context.ts:82-111`) and toast on interaction.

**Why it's blocked.** Omega has the **positioning foundation but not the threads.** Record 0054 added
**document anchors** (`POST/GET /documents/:id/anchors`, `…/validate`) — stable pointers that follow
edits and orphan on delete — but they **explicitly store no thread content** (no author, body, reply,
or resolution). There is no comment CRUD.

**What Omega must build (on top of anchors):**
```http
GET    /documents/:documentID/comments?resolved=false
POST   /documents/:documentID/comments   { anchorId | anchor:{atomId,offset,length}, body }
PATCH  /comments/:commentID              { body? | resolved? }
DELETE /comments/:commentID
POST   /comments/:commentID/replies      { body }
```
Each comment binds to a document **anchor** (reuse BR-COMMENTS's foundation — anchors already follow
moves), carries author identity (already available), and threads replies.

**Estimated effort:** Medium — a comment/reply store keyed to existing anchors; anchor validation is
already done. Threading can ship in a second pass.

**Alpha unblocks:** `CommentsPanel.svelte`, the inspector "Add comment" action, `mockDocumentComments`.

---

### BR-AI-CHAT — Persistent AI conversation history — **P1 · Build**

**What it is.** Durable, multi-turn **chat threads** for the AI Agent dock: a list of past
conversations, each with its message history, that survive reloads and appear in the dock's chat list.

**Why the editor wants it.** The dock is modeled as ongoing conversations ("Structure the findings",
"Tighten the opening", …) the writer returns to. Today those are `initialChats` in
`src/lib/systems/ai-agent/mocks.ts` and replies are canned (`copy.ts`).

**Why it's blocked.** Omega's agent engine (`861d099`) is **task-oriented**, not conversational: it
persists **Plan/Action tasks** and answers one-shot **Ask** calls, but there is **no conversation or
message-thread store** — no "list my chats", no "append a turn to chat X". The Ask/Action/Plan
*execution* is available (wire it — plan Goal 3.3); the **chat container around it is not**.

**What Omega must build.**
```http
POST /agent/chats            { title?, mode, resourceId? }       → chat
GET  /agent/chats?resourceId=…                                   → chats (id,title,updatedAt,preview)
GET  /agent/chats/:chatID                                        → messages[]
POST /agent/chats/:chatID/turns { message }                      → agent turn (may spawn a task)
```
A conversation store that threads user/agent turns and links a turn to any Plan/Action task it spawns.

**Estimated effort:** Medium — a store + four routes over the existing agent engine. Streaming
(SSE/WebSocket) is a later enhancement.

**Alpha unblocks:** the AI dock's chat list + history (`systems/ai-agent/*`). Note: without this,
Goal 3.3 still wires Ask/Action/Plan — just without persistent threads.

---

### BR-AI-CONTEXT — AI context: web retrieval + file/folder attachments — **P2 · Build**

**What it is.** Two context sources the dock offers besides document/knowledge/selection: a **web**
source (retrieve from the live web) and **file/folder attachments** (upload a file as context).

**Why it's blocked.**
- **Web:** Omega's knowledge lattice retrieves from **project** sources only; there is no web-retrieval
  capability.
- **Attachments:** there is **no file upload endpoint** anywhere — the `image` block's `ImageData.fileId`
  has no producer. `QuarterbackPanel.svelte:102-129` hardcodes the `sources`/`web` items and
  `:153` toasts a `mockUpload`.

**What Omega must build.** (a) A web-retrieval provider behind the knowledge/agent context resolver;
(b) a file-upload endpoint (see BR-FILE-IMPORT — same storage primitive) producing a `fileId` usable
as agent context and by image blocks.

**Estimated effort:** Web retrieval = Medium (new provider + safety); uploads = Medium (shared with
import). Lower priority than BR-AI-CHAT.

**Alpha unblocks:** the dock's `sources`/`web` toggles + attachment upload.

---

### BR-AI-TASK-DOCSCOPE — Document-scoped agent task projection — **P2 · Expose**

**What it is.** The **AI Tasks panel** lists agent tasks **for the current document**. The generic
engine has `GET /agent/tasks` (all project tasks), but the panel needs tasks filtered/projected to the
open document.

**Why it's (partly) blocked.** `GET /agent/tasks` exists (`861d099`) but there's no confirmed
document-scoped filter. If a task carries its target document id, this is a query-param away (Expose);
if not, tasks need a document association (small Build).

**What Omega must provide.** `GET /agent/tasks?documentId=…` (or a `targetDocumentId` field on the
task + filter). **Verify against the running server** whether tasks already carry a document target.

**Estimated effort:** Small. **Alpha unblocks:** `AiTasksPanel.svelte`, `mockDocumentAiTasks`.

---

### BR-BLOCK-TYPOGRAPHY-CUSTOM — Arbitrary per-block font/size/color — **P3 · Build (mostly covered)**

**What it is.** Free-form typography on a block — an exact font family, point size, or hex color —
beyond Omega's **semantic** style tokens.

**Why it's mostly not needed.** Omega's semantic **style registry** (`assign_block_style`,
`set_block_style_overrides`, `set_style_default`, tokens `body|title|heading|…`, tones
`neutral|accent|…`) already persists typography — plan Goal 2 wires it. Only **arbitrary custom values**
(a specific non-token font or hex) have no home.

**Decision needed.** Prefer scoping the inspector to the semantic model (no backend work). Only if
product requires arbitrary values does Omega need custom-value overrides on `BlockStyleRef.overrides`
(a bounded set of `{fontFamily?,fontSize?,color?}`). **Estimated effort:** Small if pursued.

---

### BR-USER-AVATAR — Per-user avatar image / color — **P3 · Build**

**What it is.** A real avatar image (or a stable per-user color/hue) for collaborator chips, history
authors, and comment authors.

**Why it's blocked.** Omega has **no avatar or per-user color** field. `GET /users/:userID` (enriched,
record 0056) returns `{id,kind,name,email,role,description,createdAt}` — no image, no hue. (The project
`icon` is a *project* field, not per-user.) Alpha renders initials.

**What Omega must build.** Either an uploaded avatar (`avatarUrl`, shares BR-AI-CONTEXT/import storage)
or a stored per-user color the client renders. **Estimated effort:** Small (color) / Medium (image
upload). **Alpha unblocks:** `DocumentCollaboratorAvatar.svelte` beyond initials.

---

## 2. Broader-than-editor (surfaced by the editor; lower priority)

### BR-AI-GENERATE — "Create with AI" resource generation — **P2 · Build**
The new-tab "Create with AI" flow submits a prompt + kind and expects a populated resource. Omega has
inference and the agent Action tool but no `POST /resources/generate` orchestration (create resource →
generate content → fill). Could be built on the agent Action tool. `backend-requests/ai-generation.md`.

### BR-FILE-IMPORT / BR-EXPORT — File import & content export — **P2 · Build**
No file-upload endpoint (import) and no content serializers (export: doc → Markdown/PDF/docx). Import
shares the upload primitive with BR-AI-CONTEXT/BR-USER-AVATAR. `transfer.ts` placeholders today.

---

## 3. Known non-goal (by Omega architecture decision)

### Realtime co-typing (OT/CRDT + push transport) — **intentionally not built**
Omega record **0049** explicitly chose **not** to build a realtime protocol. Collaboration is
**async, revision-bound changesets** with proven semantic rebase, plus **poll-based** presence
(`/sessions`, with caret/selection — wired in plan Goal 0.2). Live character-by-character multiplayer
merge and a push socket are **out of scope by design**, not a gap on this list. If product later wants
true co-typing, it's a large architectural project (CRDT/OT engine + WebSocket/SSE transport) — raise
it as a separate initiative, not a document-editor blocker.

---

## Priority summary

| Ref | Feature | Type | Priority | Omega effort |
|---|---|---|---|---|
| BR-AI-CHAT | AI conversation history | Build | P1 | Medium |
| BR-REFERENCES | Reference / backlink graph | Build | P2 | Medium |
| BR-DOC-ROW-WINDOWS | Windowed row reads | Build | P2 | Medium |
| BR-COMMENTS | Anchored comment threads | Build (foundation shipped) | P2 | Medium |
| BR-AI-CONTEXT | Web source + attachments | Build | P2 | Medium |
| BR-AI-TASK-DOCSCOPE | Doc-scoped agent tasks | Expose | P2 | Small |
| BR-AI-GENERATE | "Create with AI" generation | Build | P2 | Medium |
| BR-FILE-IMPORT / BR-EXPORT | Import / export | Build | P2 | Medium |
| BR-BLOCK-TYPOGRAPHY-CUSTOM | Arbitrary block typography | Build | P3 | Small (if pursued) |
| BR-USER-AVATAR | Avatar image / color | Build | P3 | Small–Medium |
| — | Realtime co-typing | (non-goal) | — | Large (by design, deferred) |

**Recommended backend order:** BR-AI-CHAT (completes the dock) → BR-REFERENCES + BR-COMMENTS (both
build on shipped anchors/graph primitives) → BR-DOC-ROW-WINDOWS (unblocks large docs) →
BR-AI-TASK-DOCSCOPE (small) → the rest as product demands.
