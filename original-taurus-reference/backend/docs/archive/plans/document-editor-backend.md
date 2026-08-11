# Document-editor backend build-out — implementation plan

Build the Omega capabilities the Taurus Alpha **document editor** still mocks
because Omega has nothing to back them. The source of truth is Alpha's living
[backend contract](../../../taurus-alpha/docs/integration/current/backend-contract.md)
(verified against Omega `main` @ `2a7229f`); its companion audit is
`omega-integration.md`. Each item below carries the contract's stable `BR-*` ref.

The paired granular task list is
[`docs/checklists/document-editor-backend.md`](../checklists/document-editor-backend.md).
Each BR is an **independently shippable increment** — build them in the phase
order here, but any one can go out on its own.

**Goal.** Turn ten mocked editor features into real, project-scoped Omega
capabilities: persistent AI chats, a reference/backlink graph, anchored comment
threads, windowed document reads, document-scoped agent tasks, a file-storage
primitive (uploads / attachments / import / export / avatars), web retrieval, and
AI resource generation.

**Architecture.** Each feature is a **capability** under `core/capability/` (or a
focused extension of an existing one) behind narrow ports, wired in
`core/wiring`, exposed through the project-scoped transport group, and persisted
in the one SQLite store. No capability imports another; cross-capability needs
(reference extraction on document save, comment↔anchor validation, chat↔task
links) are satisfied by **ports that `wiring` injects**, never direct imports.

**Tech stack.** Go 1.26, pure-Go SQLite (`modernc.org/sqlite`), Echo transport,
the existing intelligence/knowledge/agent/document capabilities. New model-backed
work rides the existing `intelligence` cast tables and the `agent` tool-use
engine.

---

## Global constraints

Every task inherits these. They are not restated per task.

1. **Everything is project-scoped. This is the overriding rule.** There are
   exactly two entities that live *above* a project: the **User** (an account —
   identity only: name, email, and, new here, avatar/color) and the **Project**
   itself. A Project is shared by many Users through membership + role.
   **Everything else — documents, agent tasks, chats, references, comments,
   files, generated resources — belongs to exactly one Project.** Concretely, for
   every new feature except the per-user avatar:
   - Every new table's key includes `project_id TEXT NOT NULL REFERENCES projects(id)`.
   - Every new route sits on the **project-scoped group** (`requireProject`); the
     handler reads the caller's *selected* project from `ctx.Project.ID`, never a
     client-supplied project id.
   - Every new capability takes a trusted `Scope{ProjectID}` and re-checks that
     each entity it loads satisfies `entity.ProjectID == scope.ProjectID`,
     returning an `ErrProjectScope` (→ `404`) otherwise — exactly as `persona`,
     `agent`, and `document` already do. A resource id is only meaningful inside
     its project.
   - Mutations are gated by the caller's role (`canWrite(ctx.Role)` → owner/edit).
   - Routes addressed by a bare resource id (`/comments/:commentID`,
     `/files/:fileID`) still run on the scoped group and still re-check
     `resource.ProjectID == ctx.Project.ID` before acting.
   - **The one exception is [BR-USER-AVATAR](#br-user-avatar--p3--build): an
     avatar image/color is a *User* attribute (identity), so it lives on the user
     row, not a project.** Every other file is a project-scoped resource.

2. **Ports and adapters.** A capability declares interfaces for what it needs and
   never imports another capability or a concrete store/provider. `wiring`
   supplies the concrete types. New cross-capability hooks are ports (below).

3. **Paired docs, in the same commit** (see [`AGENTS.md`](../../AGENTS.md)): every
   non-test `*.go` under `core/` gets its verbatim `FILE.go.md`; every increment
   gets a numbered `docs/records/NNNN-*.md`. The next free record number at the
   time of writing is **0060**.

4. **Prove plumbing with unit tests; prove model quality live.** Deterministic
   logic (stores, scoping, extraction, projection) is unit-tested with in-memory
   fakes. Whether a model-backed feature *works well* (a chat turn's answer, an
   AI-generated resource) is proven only in a `dev-test/` suite that makes real
   provider calls, **skips (exit 0) without an OpenRouter key**, and **prints the
   summed token + dollar cost** (`track_usage`/`usage_summary`). Keep live inputs
   tiny.

5. **Small, working steps.** Build the smallest useful slice, exercise it, then
   move on. Don't scaffold ahead of need.

---

## Priority & phase overview

Order follows the contract's recommended backend order. Type: **Build** = new
capability; **Expose/extend** = existing machinery + a route.

| Phase | BR | Feature | New capability / home | New routes (all project-scoped) | Type |
|---|---|---|---|---|---|
| 1 | BR-AI-CHAT | Persistent AI conversation history | `agent` (conversation store) | `POST/GET /agent/chats`, `GET /agent/chats/:id`, `POST /agent/chats/:id/turns` | Build |
| 2 | BR-REFERENCES | Reference / backlink graph | new `reference` | `GET /documents/:id/references`, `GET /documents/:id/backlinks` | Build |
| 3 | BR-COMMENTS | Anchored comment threads | new `comment` (on shipped anchors) | `GET/POST /documents/:id/comments`, `PATCH/DELETE /comments/:id`, `POST /comments/:id/replies` | Build |
| 4 | BR-DOC-ROW-WINDOWS | Windowed row reads | `document` (projection) | `GET /documents/:id/descriptor`, `/row-manifest`, `/rows`, `/rows/locate` | Build |
| 5 | BR-AI-TASK-DOCSCOPE | Document-scoped agent tasks | `agent` (task field + filter) | `GET /agent/tasks?documentId=` | Build (small) |
| 6 | BR-FILE-IMPORT · BR-AI-CONTEXT(files) | File storage primitive: uploads, attachments, import | new `file` | `POST /files`, `GET /files/:id`, `POST /documents/import` | Build |
| 6 | BR-EXPORT | Content export | `document` (serializers) | `GET /documents/:id/export?format=` | Build |
| 7 | BR-AI-CONTEXT(web) | Web retrieval as agent context | new `integration` web provider | (no new route; context source in a chat turn) | Build |
| 7 | BR-AI-GENERATE | "Create with AI" resource generation | `resource` + `agent` orchestration | `POST /resources/generate` | Build |
| 8 | BR-USER-AVATAR | Per-user avatar image / color | `access` (user field) — **user-scoped** | extends `PATCH /auth/me`, `GET /users/:id` | Build (small) |
| 8 | BR-BLOCK-TYPOGRAPHY-CUSTOM | Arbitrary block font/size/color | `document` style (`StyleOverrides.Custom`) | `set_block_custom_typography` op | Built (record 0069) |
| — | Realtime co-typing | (OT/CRDT + push) | — | — | **Non-goal (record 0049)** |

---

## Cross-cutting integration pattern

Every Build phase touches the same five seams the way the agent/persona
integration did. Rather than repeat this per BR, the shape is:

- **`core/platform/storage/sqlite/sqlite.go`** — add `CREATE TABLE`/`CREATE INDEX`
  to `migrate()` (every table keyed by `project_id`), implement the capability's
  `Store` methods, add a `var _ <cap>.Store = (*Store)(nil)` compile-time
  assertion, and a `*_test.go` round-trip + project-scope-isolation test.
- **`core/capability/<cap>/`** — the domain: model types, a `Scope{ProjectID}`,
  a `Store` interface, a `memory.go` in-memory store for unit tests, and the
  service. Plus each file's verbatim `.go.md`.
- **`core/handlers/<cap>/`** — thin HTTP adapter: read request, resolve
  `ctx.Project`/`ctx.User`/`ctx.Role`, call the domain, map sentinel errors to
  status codes. `canWrite(ctx.Role)` on mutations.
- **`core/transport/transport.go`** — an `Options` field (`*<cap>.Service`), a
  route block on the `scoped` group gated by `opts.<cap> != nil`, and (for
  document sub-routes) `operationSync` entries.
- **`core/wiring/wiring.go`** — construct the service over the shared `store`,
  inject any ports (below), pass it to `transport.Options`, and register any job
  types. Plus `etc/config.yaml` keys if the feature is configurable.

**Injected ports (how cross-capability hooks avoid an import):**

| Consumer | Port it declares | `wiring` supplies | Used for |
|---|---|---|---|
| `document` | `ReferenceIndexer{ ReindexDocument(projectID, docID, edges) }` | `*reference.References` | Re-extract outgoing edges after a successful `append_changes` |
| `comment` | `AnchorReader{ AnchorInProject(projectID, docID, anchorID) (Anchor, error) }` | `*document.Documents` | Validate a comment binds to a real, in-project anchor |
| `agent` chats | `Runner{ Ask/Plan/Action }` (already internal) | existing agent engine | A chat turn runs the engine and links any task it spawns |
| `file` consumers | `FileRef` (a `fileId` string) | `*file.Files` | Image blocks, agent attachments, avatars, import all resolve a `fileId` |

---

## Phase 1 — BR-AI-CHAT: persistent AI conversation history (P1 · Build)

**What / why.** Durable multi-turn chat threads for the AI dock: a list of past
conversations, each with message history, surviving reloads. Today Alpha uses
`initialChats` mocks with canned replies. Omega's agent engine persists
Plan/Action *tasks* and answers one-shot *Ask* calls, but has **no conversation
container** — no "list my chats", no "append a turn".

**Design.** Extend the **agent** capability with a project-scoped conversation
store (new `core/capability/agent/chat.go`; keep it in `agent` because a turn
drives the same Ask/Plan/Action engine). A **chat belongs to a project**, is
created by a user, and is visible to that project's members per role; an optional
`resourceId` associates it with a document (or other resource) *within the same
project*.

Types:

```go
type Chat struct {
    ID         string    `json:"id"`
    ProjectID  string    `json:"projectId"`
    RequesterID string   `json:"requesterId"`   // the user who opened it
    Title      string    `json:"title"`
    Mode       string    `json:"mode"`          // ask | plan | action
    ResourceID string    `json:"resourceId,omitempty"` // in-project association
    CreatedAt  time.Time `json:"createdAt"`
    UpdatedAt  time.Time `json:"updatedAt"`
}

type Turn struct {
    ID        string    `json:"id"`
    ChatID    string    `json:"chatId"`
    ProjectID string    `json:"projectId"`
    Role      string    `json:"role"`     // user | agent
    Body      string    `json:"body"`
    TaskID    string    `json:"taskId,omitempty"` // set if this turn spawned a Plan/Action task
    CreatedAt time.Time `json:"createdAt"`
}
```

Tables:

```sql
CREATE TABLE IF NOT EXISTS agent_chats (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id),
    requester_id TEXT NOT NULL,
    title        TEXT NOT NULL DEFAULT '',
    mode         TEXT NOT NULL,
    resource_id  TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_chats_project_updated ON agent_chats(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_chats_resource ON agent_chats(project_id, resource_id);

CREATE TABLE IF NOT EXISTS agent_chat_turns (
    id         TEXT PRIMARY KEY,
    chat_id    TEXT NOT NULL REFERENCES agent_chats(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    role       TEXT NOT NULL,
    body       TEXT NOT NULL,
    task_id    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_chat_turns_chat ON agent_chat_turns(chat_id, created_at);
```

Routes (scoped group, gated on the chat store; writes require `canWrite`):

```http
POST /agent/chats                 { title?, mode, resourceId? }         → Chat
GET  /agent/chats?resourceId=…                                          → { chats:[{id,title,mode,updatedAt,preview}] }
GET  /agent/chats/:chatID                                               → { chat, turns:[Turn] }
POST /agent/chats/:chatID/turns   { message }                          → { userTurn, agentTurn }  (agentTurn.taskId set if it spawned a task)
PATCH  /agent/chats/:chatID       { title? }                           → Chat        (optional, second pass)
DELETE /agent/chats/:chatID                                            → 200         (optional, second pass)
```

**Turn execution.** `POST …/turns` appends the user turn, runs the chat's `mode`
through the existing engine (Ask synchronously; Plan/Action enqueue a task and
record its `taskId` on the agent turn), appends the agent turn, and bumps
`agent_chats.updated_at`. Reuse the `agent.Workflows`/`Ask` services; the chat
layer only threads turns and links tasks.

**Project-scoping specifics.** `chatID`/`resourceId` are validated to belong to
`ctx.Project.ID`. Listing filters by `project_id` (+ optional `resource_id`).
Cross-project chat access returns 404.

**Testing.** Unit: chat/turn round-trip, project-scope isolation, resource
filter, turn ordering, task-link recording (fake engine). Live
(`dev-test/agents/`): open a chat, post a turn, assert an agent turn returns with
cited/nonempty content; print cost.

**Effort:** Medium. **Unblocks:** `systems/ai-agent/*` chat list + history.

---

## Phase 2 — BR-REFERENCES: reference / backlink graph (P2 · Build)

**What / why.** The editor's References panel shows a document's **outgoing**
references (resources it points at) and **incoming** references (backlinks). Today
it renders `mockDocumentReferences`. Omega stores a `link` *mark* (inline href)
but models no edge between resources and cannot answer "what points at X".

**Design.** New project-scoped **`reference`** capability owning a directed edge
set. Extraction runs on document change via an injected port (document walks its
own `link` marks — it owns the content model — and hands the resulting target
list to the indexer).

Types + table (edges are per project; no cross-project edges):

```go
type Edge struct {
    ProjectID string `json:"-"`
    From      Ref    `json:"fromResource"`   // {id, kind, name}
    To        Ref    `json:"toResource"`
    Kind      string `json:"kind"`           // link | mention | embed
    Anchor    string `json:"anchor,omitempty"`
}
type Ref struct { ID, Kind, Name string }
```

```sql
CREATE TABLE IF NOT EXISTS resource_references (
    project_id TEXT NOT NULL REFERENCES projects(id),
    from_kind  TEXT NOT NULL,
    from_id    TEXT NOT NULL,
    to_kind    TEXT NOT NULL,
    to_id      TEXT NOT NULL,
    kind       TEXT NOT NULL,                       -- link | mention | embed
    anchor     TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, from_kind, from_id, to_kind, to_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_refs_backlinks ON resource_references(project_id, to_kind, to_id);
CREATE INDEX IF NOT EXISTS idx_refs_outgoing  ON resource_references(project_id, from_kind, from_id);
```

Routes (scoped group):

```http
GET /documents/:documentID/references   → { references:[Edge] }   # outgoing from this doc
GET /documents/:documentID/backlinks    → { backlinks:[Edge] }    # incoming to this doc
```

**Extraction port.** `document` gains a `ReferenceIndexer` port called after a
successful `append_changes`: `ReindexDocument(projectID, docID string, edges []reference.TargetEdge)`
where `document` builds `edges` by walking `link` marks (target = the linked
resource id/kind parsed from the href, when it resolves to an in-project
resource). The reference capability replaces that document's outgoing set
atomically. Target names/kinds are resolved through the resource catalog / the
Activity reference resolver (record 0034) at read time.

**Scope note (matches the contract).** Ship `link`-mark edges first. The atom
model has **no resource-mention kind today**; `mention`/`embed` edges are a
follow-up that needs a mention atom (raise as its own BR). The `kind` column and
the resolver are built for all three now so the follow-up is additive.

**Project-scoping specifics.** Edges only ever connect two resources in the same
project; extraction ignores hrefs that don't resolve to an in-project resource.

**Testing.** Unit: extract edges from a document with link marks; re-extract on
edit replaces the set; backlink query returns incoming edges; cross-project
hrefs are dropped. No provider needed.

**Effort:** Medium. **Unblocks:** `ReferencesPanel.svelte`, "Go to reference".

---

## Phase 3 — BR-COMMENTS: anchored comment threads (P2 · Build, foundation shipped)

**What / why.** Margin comments anchored to a content range, with author, body,
replies, and resolved/open state. Today `mockDocumentComments`. Omega shipped
**document anchors** (record 0054) — stable pointers that follow edits and orphan
on delete — but they **store no thread content**. There is no comment CRUD.

**Design.** New project-scoped **`comment`** capability built on the existing
anchor machinery. A comment binds to a `document_anchors` row (reuse it — anchors
already follow moves); author comes from `ctx.User`.

Types + tables:

```go
type Comment struct {
    ID, ProjectID, DocumentID, AnchorID string
    AuthorID, AuthorName, Body          string
    Resolved                            bool
    CreatedAt, UpdatedAt                time.Time
}
type Reply struct {
    ID, CommentID, ProjectID       string
    AuthorID, AuthorName, Body     string
    CreatedAt                      time.Time
}
```

```sql
CREATE TABLE IF NOT EXISTS document_comments (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    document_id TEXT NOT NULL REFERENCES documents(id),
    anchor_id   TEXT NOT NULL REFERENCES document_anchors(id),
    author_id   TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    body        TEXT NOT NULL,
    resolved    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_doc ON document_comments(document_id, resolved);

CREATE TABLE IF NOT EXISTS comment_replies (
    id          TEXT PRIMARY KEY,
    comment_id  TEXT NOT NULL REFERENCES document_comments(id),
    project_id  TEXT NOT NULL REFERENCES projects(id),
    author_id   TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_replies_comment ON comment_replies(comment_id, created_at);
```

Routes (scoped group; writes require `canWrite`):

```http
GET    /documents/:documentID/comments?resolved=false   → { comments:[Comment], replies keyed by commentId }
POST   /documents/:documentID/comments   { anchorId | anchor:{atomId,offset,length}, body }   → Comment
PATCH  /comments/:commentID              { body? | resolved? }                                → Comment
DELETE /comments/:commentID                                                                   → 200
POST   /comments/:commentID/replies      { body }                                             → Reply
```

**Anchor reuse.** If the request gives an inline `anchor:{atomId,offset,length}`,
create a `document_anchors` row first (via the document `AnchorReader`/creator
port), then bind the comment to it. If it gives an `anchorId`, validate it via
the injected `AnchorReader` (must exist and belong to `ctx.Project.ID` + the doc).
A comment on an orphaned anchor is returned with an `orphaned` flag.

**Project-scoping specifics.** `/comments/:commentID` and
`/comments/:commentID/replies` run on the scoped group and re-check
`comment.ProjectID == ctx.Project.ID` before mutating. Replies inherit the
comment's project.

**Testing.** Unit: create comment on an anchor, list open vs resolved, patch
resolve, delete cascades replies, reply threading, cross-project 404, orphaned
anchor flag. Threading can land in a second sub-pass.

**Effort:** Medium. **Unblocks:** `CommentsPanel.svelte`, inspector "Add comment".

---

## Phase 4 — BR-DOC-ROW-WINDOWS: windowed row reads (P2 · Build)

**What / why.** `GET /documents/:id` returns the whole document. Large docs need
bounded loading: a tiny **descriptor** + a **row manifest** (ids + heights/offsets,
no bodies) to lay out the scrollbar instantly, then **windowed row fetches** and a
**locate** call. Alpha already wrote the client (`systems/documents/rows.ts`) —
it's dead code because the routes don't exist.

**Design.** A projection over the `document` capability. `Paginate(base)` (record
0041) already computes row heights/offsets, so the manifest derives from it with
no client-side layout. No new table — these are read projections over existing
document state. Every response is **revision-stamped** so the client detects a
mid-scroll edit and re-syncs.

Routes (scoped group, sync via `operationSync`):

```http
GET /documents/:documentID/descriptor
  → { id, name, revision, pageLayout, layoutRules, styleRegistry, rowCount }     # no row bodies
GET /documents/:documentID/row-manifest
  → { revision, rows:[{ id, height, offset }] }                                  # ids + metrics only
GET /documents/:documentID/rows?from=<rowId|index>&count=<n>
  → { revision, rows:[Row] }                                                     # a window of full rows
GET /documents/:documentID/rows/locate?anchor=<atomId>|?index=<n>
  → { rowId, index, offset }                                                     # jump target
```

**Consistency.** A window read carries the `revision` it was computed at; if the
client's cached `revision` differs, it re-fetches the manifest. Reuse the
changeset machinery's `revision`. `count` is bounded (default/max, e.g. 50/200).

**Project-scoping specifics.** Same as documents (already project-scoped);
handlers resolve `ctx.Project.ID` and the doc must belong to it.

**Testing.** Unit: descriptor/manifest derive from `Paginate` and match a full
read's totals; a window returns exactly the requested rows; `locate` maps an
atom/index to the right row; revision changes after an edit. No provider needed.

**Effort:** Medium. **Unblocks:** activates `rows.ts`; bounded large-doc loading.

---

## Phase 5 — BR-AI-TASK-DOCSCOPE: document-scoped agent tasks (P2 · Build, small)

**What / why.** The AI Tasks panel lists agent tasks **for the open document**.
`GET /agent/tasks` returns all project tasks; the panel needs a document filter.

**Design — verified.** The agent `Task` struct carries **no document target**
today (fields: id, projectId, requesterId, mode, state, objective, context,
persona, workspace, plans, runs). So this is a small Build, not a pure Expose:

- Add `TargetDocumentID string` to `agent.Task` (+ a `target_document_id TEXT NOT
  NULL DEFAULT ''` column via `ALTER TABLE agent_tasks`, index
  `(project_id, target_document_id, created_at)`).
- Set it when a Plan/Action task is created from a document context (Phase 1 chat
  turns pass the chat's `resourceId`; `POST /agent/plans|actions` accept an
  optional `targetDocumentId`).
- Add `GET /agent/tasks?documentId=…` → filters `TasksByProject` by target doc
  (still project-scoped first).

**Project-scoping specifics.** The `documentId` filter is *within* the selected
project; the document must belong to `ctx.Project.ID`.

**Testing.** Unit: `TasksByDocument(projectID, docID)` returns only matching
tasks; empty filter returns all project tasks; cross-project doc filter is empty.

**Effort:** Small. **Unblocks:** `AiTasksPanel.svelte`.

---

## Phase 6 — File storage: uploads, attachments, import (BR-FILE-IMPORT, BR-AI-CONTEXT files) + export (BR-EXPORT) (P2 · Build)

**What / why.** There is **no file-upload endpoint** anywhere — the image block's
`ImageData.FileID` (which exists) has no producer, agent attachments can't be
uploaded, and import/export are placeholders. This is the shared storage
primitive several BRs need.

**Design.** New project-scoped **`file`** capability: a metadata row + bytes.
Store bytes in SQLite (bounded max size, e.g. a few MB) to keep the "one file, no
external deps" property; larger blobs can move to `var/files/` behind the same
`Store` port later.

```go
type File struct {
    ID, ProjectID, UploaderID string
    Name, MimeType            string
    Size                      int64
    CreatedAt                 time.Time
}
```

```sql
CREATE TABLE IF NOT EXISTS files (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    uploader_id TEXT NOT NULL,
    name        TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size        INTEGER NOT NULL,
    content     BLOB NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id, created_at DESC);
```

Routes (scoped group; `POST` requires `canWrite`):

```http
POST /files                      (multipart or {name,mimeType,contentBase64})   → { id, name, mimeType, size }
GET  /files/:fileID                                                             → bytes (Content-Type from mime_type)
GET  /files/:fileID/meta                                                        → File
POST /documents/import           (fileId | upload)  { fileId, name? }           → Document   # parse → document
```

**Consumers.** The returned `fileId` is what an **image block** stores, what an
**agent chat turn** attaches as context (Phase 1/7), and what **import** parses.
Import parses a supported upload (Markdown first) into a new document via the
existing document create/change machinery.

**Export (BR-EXPORT).** A document-capability serializer:
`GET /documents/:documentID/export?format=markdown|pdf|docx` → serialized bytes.
Ship `markdown` first (pure, deterministic, unit-testable); `pdf`/`docx` are
heavier follow-ups.

**Project-scoping specifics.** Files are **project resources** — keyed by
`project_id`, uploaded into the selected project, readable by its members.
`GET /files/:id` re-checks the file's project == `ctx.Project.ID`.

**Testing.** Unit: upload→meta→download round-trip, size cap enforced,
cross-project 404, markdown export of a small document, markdown import creates a
document. No provider needed for storage; import/export are deterministic.

**Effort:** Medium (shared across BR-FILE-IMPORT, BR-AI-CONTEXT files, BR-EXPORT,
and the image-block producer). **Unblocks:** image uploads, attachments, transfer.

---

## Phase 7 — AI context web + AI generation (BR-AI-CONTEXT web, BR-AI-GENERATE) (P2 · Build)

**BR-AI-CONTEXT (web).** Add a **web-retrieval provider** as an integration
adapter (`core/integration/knowledge/web/` or `…/context/web`) behind a port the
agent context resolver consumes, so a chat turn can pull live-web evidence
alongside project knowledge. Bounded (query/result/token caps + fetch safety).
Usage is **within a project's agent turn** — the retrieved text is transient
evidence, never written into the project lattice (mirrors prompt-block
`inferred` handling). Provider key/config under `intelligence`/`agents`.

**BR-AI-GENERATE ("Create with AI").** Orchestration over the existing agent
**Action** tool: `POST /resources/generate { kind, prompt }` → create the resource
through the canonical family owner (project-scoped, like `POST /resources`) → run
an agent Action to populate it → return the resource. Lives in the `resource`
handler composing `agent` via wiring (no cross-capability import). Project-scoped:
creates a resource in `ctx.Project.ID`, authored by `ctx.User`.

**Project-scoping specifics.** Both operate strictly inside the selected project.
Web results feed one turn; generated resources are ordinary project resources.

**Testing.** Web: unit-test the provider adapter with a fake HTTP client; live
gate behind the model/web key and print cost. Generate: unit-test the
orchestration with a fake agent Action; a live `dev-test` asserts a generated
resource is non-empty and reports cost.

**Effort:** Web = Medium (provider + safety); Generate = Medium (orchestration
over shipped Action). Lower priority than P1/early-P2.

---

## Phase 8 — avatars & custom typography (BR-USER-AVATAR, BR-BLOCK-TYPOGRAPHY-CUSTOM) (P3 · Build)

**BR-USER-AVATAR (the user-scoped exception).** Add per-user identity fields to
the **`access`** capability's `User`: a stable `color` (cheap; client renders) and
optionally `avatarUrl` (an uploaded image — reuses the Phase 6 file primitive,
but the *file* is still a project-independent user asset). Settable via
`PATCH /auth/me`, surfaced in `GET /users/:userID`
(`{id,kind,name,email,role,description,createdAt,color,avatarUrl?}`).

```
ALTER TABLE users ADD COLUMN color      TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
```

This is the **only** feature that is *not* project-scoped — identity lives on the
User, which spans projects. Ship `color` first (no storage), `avatarUrl` with the
file primitive.

**BR-BLOCK-TYPOGRAPHY-CUSTOM — BUILT (record 0069).** Product confirmed the need
for arbitrary values. A bounded `{fontFamily?,fontSize?,color?}` (`StyleOverrides.Custom`)
is stored verbatim, set/cleared through a dedicated `set_block_custom_typography`
changeset op that is document-scoped and **ungated** by the semantic
`allowOverrides` list (a block can carry custom typography with or without an
assigned style). The semantic style registry (`assign_block_style`,
`set_block_style_overrides`, tokens/tones) is unchanged and still available.

**Testing.** Avatar: unit-test set/read color + avatarUrl on the user; enrichment
appears in `GET /users/:id`. Typography (if pursued): op round-trips through a
changeset. No provider needed.

**Effort:** Avatar Small (color) / Medium (image). Typography Small if pursued.

---

## Not in scope — realtime co-typing (non-goal by design)

Record **0049** deliberately chose **not** to build an OT/CRDT engine or a push
socket. Collaboration is async, revision-bound changesets with proven semantic
rebase, plus poll-based presence (`/sessions`, with caret/selection). Live
character-by-character multiplayer merge is a separate large initiative, not a
document-editor blocker — do not add it here.

---

## Testing strategy (whole build)

- **Unit (per phase, no provider):** store round-trips + **project-scope
  isolation** (a request scoped to project A can never read/write project B's
  chats/edges/comments/files/tasks), extraction/projection correctness, error→
  status mapping in handlers. Every capability ships a `memory.go` fake.
- **Transport (per phase):** route round-trips with a selected project; write
  routes reject read-only members (`403`); cross-project ids return `404`.
- **Live (`dev-test/`, model-backed phases only — chats, generate, web):** real
  provider calls, **skip (exit 0) without a key**, tiny inputs, and **cost
  summed + printed** (`track_usage`/`usage_summary`). Extend `dev-test/agents/`
  for chats; add `dev-test/generate/` for BR-AI-GENERATE.
- Every phase ends green on `go test ./...` and `go vet ./...`, with each changed
  `.go` file's `.go.md` regenerated and a `docs/records/NNNN-*.md` written.

---

## Coverage self-review (every contract BR maps to a phase)

| Contract BR | Priority | Covered by |
|---|---|---|
| BR-AI-CHAT | P1 | Phase 1 |
| BR-REFERENCES | P2 | Phase 2 |
| BR-COMMENTS | P2 | Phase 3 |
| BR-DOC-ROW-WINDOWS | P2 | Phase 4 |
| BR-AI-TASK-DOCSCOPE | P2 | Phase 5 |
| BR-AI-CONTEXT (files) | P2 | Phase 6 |
| BR-FILE-IMPORT | P2 | Phase 6 |
| BR-EXPORT | P2 | Phase 6 |
| BR-AI-CONTEXT (web) | P2 | Phase 7 |
| BR-AI-GENERATE | P2 | Phase 7 |
| BR-USER-AVATAR | P3 | Phase 8 |
| BR-BLOCK-TYPOGRAPHY-CUSTOM | P3 | Phase 8 (built, record 0069) |
| Realtime co-typing | — | Non-goal (record 0049) |

## Open decisions to confirm with product

- **BR-BLOCK-TYPOGRAPHY-CUSTOM** — build arbitrary values, or scope the inspector
  to semantic tokens (recommended, no backend work)?
- **BR-USER-AVATAR** — stored `color` only, or also uploaded `avatarUrl`?
- **File storage** — SQLite `BLOB` (simplest, keeps one-file property) vs
  `var/files/` on disk (better for large media). Plan assumes SQLite BLOB with a
  size cap; revisit if large media is required.
- **References** — `link`-mark edges only for now; add `mention`/`embed` when a
  mention atom exists (its own BR).
