# Document-editor backend build-out — implementation checklist

Each phase in the plan
([`docs/plans/document-editor-backend.md`](../plans/document-editor-backend.md))
is expanded here into checkable, test-first tasks. Phases are the contract's
priority order; **each phase is independently shippable** — finish, prove, and
commit one before starting the next.

**Applies to every task below (from the plan's Global constraints):**

- [ ] **Project-scoped.** Every new table keys on `project_id REFERENCES
      projects(id)`; every new route is on the `scoped` group; every service takes
      a trusted `Scope{ProjectID}` and re-checks `entity.ProjectID ==
      scope.ProjectID` (→ `ErrProjectScope`/404); mutations gate on
      `canWrite(ctx.Role)`. The **only** exception is BR-USER-AVATAR (user field).
- [ ] **No cross-capability imports** — cross-capability hooks are ports `wiring`
      injects (see the plan's port table).
- [ ] **Paired docs, same commit** — update each changed `*.go`'s verbatim
      `*.go.md`; add/append a `docs/records/NNNN-*.md` (next free: **0060**).
- [ ] **Green gates** — `go test ./...` and `go vet ./...` pass before commit.
- [ ] **Model quality is proven live**, not in unit tests, with cost surfaced and
      a no-key skip.

---

## Phase 1 — BR-AI-CHAT: persistent AI conversation history

### 1.1 Domain (`core/capability/agent/chat.go`, `chat_memory.go`)
- [ ] Write failing unit tests (`chat_test.go`) for: create chat (scoped),
      append user/agent turns, list by project, filter by `resourceId`, turn
      ordering, cross-project isolation (project B cannot read project A's chat),
      task-link recorded on an agent turn (fake engine).
- [ ] Define `Chat`, `Turn` types (fields per plan) and a `ChatScope{ProjectID}`.
- [ ] Define `ChatStore` interface: `CreateChat`, `ChatByID`, `ChatsByProject`
      (optional `resourceID` filter), `AppendTurn`, `TurnsByChat`, `TouchChat`.
- [ ] Implement `MemoryChatStore` for the unit tests.
- [ ] Implement `Chats` service: `Create`, `Get`, `List`, `PostTurn` — `PostTurn`
      appends the user turn, runs the chat's `mode` via the existing engine (Ask
      inline; Plan/Action enqueue a task and record `taskId`), appends the agent
      turn, and calls `TouchChat`. Re-check chat/`resourceId` project ownership.
- [ ] Run tests to green.

### 1.2 Persistence (`core/platform/storage/sqlite/sqlite.go`)
- [ ] Add `agent_chats` + `agent_chat_turns` CREATE TABLE and their indexes to
      `migrate()` (DDL in plan).
- [ ] Implement the six `ChatStore` methods against SQLite.
- [ ] Add `var _ agent.ChatStore = (*Store)(nil)`.
- [ ] Add `sqlite_test.go` cases: chat round-trip, turn append+order, project
      filter, `resourceId` filter.

### 1.3 Handler (`core/handlers/agent/chat.go`)
- [ ] Add handlers: `CreateChat`, `ListChats`, `GetChat`, `PostTurn` (+ optional
      `PatchChat`, `DeleteChat`). Resolve `ctx.Project`/`ctx.User`/`ctx.Role`;
      `canWrite` on writes. Map errors (not-found/scope→404, invalid→400).
- [ ] Add handler tests: create+list, post turn returns user+agent turns,
      reader-rejected on write, cross-project get → 404.

### 1.4 Transport + wiring
- [ ] `transport.go`: add `AgentChats *agent.Chats` to `Options`; register the
      route block on `scoped` gated by `opts.AgentChats != nil` (`POST/GET
      /agent/chats`, `GET /agent/chats/:chatID`, `POST /agent/chats/:chatID/turns`).
- [ ] `wiring.go`: construct `agent.NewChats(store, engine)`, pass to
      `transport.Options`.
- [ ] Add `TestAgentChatEndpoints` transport round-trip.

### 1.5 Live + docs
- [ ] Extend `dev-test/agents/` (or add `dev-test/chats/`): open chat → post turn
      → assert non-empty agent turn; **print token/dollar cost**; **skip on no key**.
- [ ] Regenerate every changed `*.go.md`; write `docs/records/0060-agent-chats.md`.
- [ ] `go test ./... && go vet ./...` green; commit.

---

## Phase 2 — BR-REFERENCES: reference / backlink graph

### 2.1 Domain (`core/capability/reference/`)
- [x] Write failing tests (`reference_test.go`): extract edges from a document's
      `link` marks; re-extract replaces the doc's outgoing set; backlink query
      returns incoming edges; an href to a non-in-project resource is dropped;
      cross-project isolation.
- [x] Define `Edge`, `Ref`, `TargetEdge` types and `Scope{ProjectID}`.
- [x] Define `Store` interface: `ReplaceOutgoing(projectID, fromKind, fromID,
      []Edge)`, `Outgoing(projectID, kind, id)`, `Incoming(projectID, kind, id)`.
- [x] Implement `MemoryStore` and the `References` service (`ReindexDocument`,
      `References`, `Backlinks`), resolving target names/kinds via a `ResourceNamer`
      port (Activity/resource resolver) at read time.
- [x] Run tests to green.

### 2.2 Extraction hook (port, no import)
- [x] In `document`, declare a `ReferenceIndexer` port:
      `ReindexDocument(projectID, docID string, edges []reference.TargetEdge) error`.
- [x] Add a document helper that walks a base's `link` marks → `[]TargetEdge`
      (target resolved from href to an in-project resource id/kind; unresolved
      dropped). Unit-test it.
- [x] Call the indexer after a successful `append_changes` (and on create). Guard
      nil (feature-flagged when the port isn't wired).

### 2.3 Persistence
- [x] Add `resource_references` CREATE TABLE + backlink/outgoing indexes to
      `migrate()`.
- [x] Implement the three `Store` methods; `var _ reference.Store = (*Store)(nil)`.
- [x] `sqlite_test.go`: replace-outgoing is atomic; backlink query; project scope.

### 2.4 Handler + transport + wiring
- [x] `core/handlers/reference/` (or fold into document handler): `References`,
      `Backlinks` for `GET /documents/:documentID/references` and `/backlinks`.
- [x] `transport.go`: register the two routes on `scoped` gated by the service.
- [x] `wiring.go`: construct `reference.New(store, resourceNamer)`, inject it into
      `document` as the `ReferenceIndexer`, pass to transport.
- [x] Transport round-trip test: create a doc with a link mark → references shows
      the edge → the target doc's backlinks shows it.

### 2.5 Docs
- [x] Regenerate `*.go.md`; `docs/records/00NN-reference-graph.md` (note:
      `link`-only for now; `mention`/`embed` await a mention atom). Green; commit.

---

## Phase 3 — BR-COMMENTS: anchored comment threads

### 3.1 Domain (`core/capability/comment/`)
- [x] Write failing tests (`comment_test.go`): create comment bound to an anchor,
      list open vs resolved, patch resolve/body, delete cascades replies, reply
      threading, cross-project 404, orphaned-anchor flag (via fake `AnchorReader`).
- [x] Define `Comment`, `Reply` types and `Scope{ProjectID}`.
- [x] Define `Store`: `CreateComment`, `CommentByID`, `CommentsByDocument`
      (`resolved` filter), `UpdateComment`, `DeleteComment`, `AddReply`,
      `RepliesByComment`.
- [x] Define an injected `AnchorReader` port:
      `AnchorInProject(projectID, docID, anchorID) (Anchor, error)` and a creator
      for inline `anchor:{...}` requests.
- [x] Implement `MemoryStore` + `Comments` service; re-check project on every op.
- [x] Run tests to green.

### 3.2 Persistence
- [x] Add `document_comments` + `comment_replies` CREATE TABLE + indexes to
      `migrate()`.
- [x] Implement the store methods; `var _ comment.Store = (*Store)(nil)`.
- [x] `sqlite_test.go`: comment/reply round-trip, resolved filter, delete cascade,
      project scope.

### 3.3 Handler + transport + wiring
- [x] `core/handlers/comment/`: `List`, `Create`, `Patch`, `Delete`, `Reply`
      (writes gated by `canWrite`; `/comments/:id` re-checks project).
- [x] `transport.go`: register `GET/POST /documents/:documentID/comments`,
      `PATCH/DELETE /comments/:commentID`, `POST /comments/:commentID/replies` on
      `scoped`, gated by the service.
- [x] `wiring.go`: construct `comment.New(store, documentAnchors)`, injecting
      `document` as the `AnchorReader`.
- [x] Transport round-trip test: add comment on an anchor → list → resolve →
      reply → delete.

### 3.4 Docs
- [x] Regenerate `*.go.md`; `docs/records/00NN-anchored-comments.md`. Green; commit.

---

## Phase 4 — BR-DOC-ROW-WINDOWS: windowed row reads

### 4.1 Projection (`core/capability/document/windows.go`)
- [x] Write failing tests (`windows_test.go`): descriptor omits row bodies and its
      `rowCount` matches a full read; manifest offsets/heights derive from
      `Paginate(base)`; a `rows` window returns exactly `from..from+count` rows;
      `locate` maps an atom id and an index to the right row/offset; `revision`
      changes after an edit.
- [x] Implement `Descriptor(projectID, docID)`, `RowManifest(...)`,
      `RowWindow(..., from, count)` (bounded count), `Locate(..., anchor|index)`
      over existing document state + `Paginate`. No new table.
- [x] Run tests to green.

### 4.2 Handler + transport
- [x] `core/handlers/document/`: add `Descriptor`, `RowManifest`, `Rows`,
      `RowsLocate`; every response revision-stamped.
- [x] `transport.go`: register the four `GET /documents/:documentID/{descriptor,
      row-manifest,rows,rows/locate}` routes on `scoped`; add `operationSync`
      entries (`documents.descriptor` etc. → `dispatchSync`).
- [x] Transport round-trip test: descriptor+manifest for a multi-row doc; a window
      matches the full read's rows; revision bumps after an `append_changes`.

### 4.3 Docs
- [x] Regenerate `*.go.md`; `docs/records/00NN-windowed-row-reads.md`. Green; commit.

---

## Phase 5 — BR-AI-TASK-DOCSCOPE: document-scoped agent tasks

- [x] Write failing tests: `TasksByDocument(projectID, docID)` returns only tasks
      whose `TargetDocumentID` matches; a task created with no target is excluded;
      cross-project doc filter is empty.
- [x] Add `TargetDocumentID string` to `agent.Task`; thread it through
      `CreatePlan`/`CreateAction` (optional `targetDocumentId` in the request) and
      Phase-1 chat turns (from the chat's `resourceId`).
- [x] SQLite: `ALTER TABLE agent_tasks ADD COLUMN target_document_id TEXT NOT NULL
      DEFAULT ''`; add index `(project_id, target_document_id, created_at)`;
      implement `TasksByDocument`; update `decodeTask`/insert.
- [x] Handler/transport: `GET /agent/tasks?documentId=…` filters (still
      project-scoped); document must belong to `ctx.Project.ID`.
- [x] Transport test: create a plan with `targetDocumentId` → the doc filter shows
      it, another doc's filter does not.
- [x] Regenerate `*.go.md`; `docs/records/00NN-doc-scoped-tasks.md`. Green; commit.

---

## Phase 6 — File storage: uploads, attachments, import, export

### 6.1 File capability (`core/capability/file/`)
- [x] Write failing tests: upload→meta→download round-trip; size cap rejected;
      cross-project read → 404; uploader recorded.
- [x] Define `File` type + `Scope{ProjectID}`; `Store`: `Put`, `Meta`, `Content`,
      `ByProject`. Implement `MemoryStore` + `Files` service (enforce max size).
- [x] SQLite: `files` CREATE TABLE (+ `content BLOB`) + index; store methods;
      `var _ file.Store = (*Store)(nil)`; round-trip + size-cap + scope tests.
- [x] Handler/transport: `POST /files` (multipart or base64, `canWrite`),
      `GET /files/:fileID` (bytes, Content-Type), `GET /files/:fileID/meta`;
      re-check file project == `ctx.Project.ID`.

### 6.2 Import + image-block producer
- [x] `POST /documents/import { fileId }` → parse a Markdown upload into a new
      document via existing create/change machinery. Unit-test Markdown → rows.
- [x] Confirm the image block's `ImageData.FileID` now resolves to a real
      uploaded file; add a test creating an image block from an uploaded `fileId`.

### 6.3 Export (BR-EXPORT)
- [x] Write failing test: `GET /documents/:id/export?format=markdown` serializes a
      small document to deterministic Markdown.
- [x] Implement the Markdown serializer in `document`; register the route
      (`operationSync` sync). (`pdf`/`docx` are follow-ups — note, don't build.)

### 6.4 Docs
- [x] Regenerate `*.go.md`; `docs/records/00NN-file-storage-import-export.md`.
      Green; commit.

---

## Phase 7 — AI context web + AI generation

### 7.1 BR-AI-CONTEXT (web)
- [x] Define a `WebRetriever` port the agent context resolver consumes; add
      `core/integration/…/web` adapter (bounded query/result/token caps + fetch
      safety). Unit-test the adapter with a fake HTTP client.
- [x] Wire the provider behind config (key under `intelligence`/`agents`); a chat
      turn may request the `web` source. Retrieved text is transient evidence,
      never written to the lattice.
- [x] Live gate behind the key; **print cost**; **skip on no key**.

### 7.2 BR-AI-GENERATE ("Create with AI")
- [x] Write failing test (fake agent Action): `POST /resources/generate {kind,
      prompt}` creates a resource in `ctx.Project.ID` then populates it via Action.
- [x] Implement the orchestration in the `resource` handler composing `agent`
      (wiring injects the Action runner); project-scoped, authored by `ctx.User`.
- [x] Register `POST /resources/generate` on `scoped` (`canWrite`).
- [x] Add `dev-test/generate/`: generate a small resource, assert non-empty,
      **print cost**, **skip on no key**.
- [x] Regenerate `*.go.md`; `docs/records/00NN-web-context-and-generate.md`.
      Green; commit.

---

## Phase 8 — avatars & custom typography (P3)

### 8.1 BR-USER-AVATAR (user-scoped exception)
- [x] Write failing tests: set/read `color` and `avatarUrl` on the user; they
      appear in `GET /users/:userID` and the `PATCH /auth/me` response.
- [x] `access`: add `Color`, `AvatarURL` to `User` and `PublicUser`; extend
      `SetUserName` (or add `UpdateProfile`) to accept them; validate (`color` a
      bounded token/hex, `avatarUrl` a `fileId`-derived URL).
- [x] SQLite: `ALTER TABLE users ADD COLUMN color …` / `avatar_url …`; update
      user read/write.
- [x] Handler: `PATCH /auth/me` accepts `{name?, color?, avatarUrl?}`; enrich
      `GET /users/:userID`. Transport tests.
- [x] Regenerate `*.go.md`; `docs/records/00NN-user-avatar.md`. Green; commit.

### 8.2 BR-BLOCK-TYPOGRAPHY-CUSTOM (decision-gated — build only if product confirms)
- [x] **Product confirmed: BUILT** (the backend stores arbitrary typography
      values, record 0069). Original item: confirm with product whether arbitrary
      values are required.
- [x] Added a bounded `{fontFamily?,fontSize?,color?}` (`StyleOverrides.Custom`)
      and the `set_block_custom_typography` changeset op (length-bounded,
      document-scoped, ungated by allowOverrides); op round-trip + HTTP dev-tests;
      companions regenerated; record 0069. Green; committed.

---

## Final sign-off (per the plan's coverage table)

- [x] Every contract `BR-*` maps to a shipped phase (see plan coverage table).
      Phases 1–8 shipped (records 0060–0068); BR-BLOCK-TYPOGRAPHY-CUSTOM is
      decision-gated and intentionally deferred (record 0068).
- [x] No feature except the user avatar introduced a non-project-scoped table or
      route — `color`/`avatar_url` on `users` is the only user-scoped identity.
- [x] Every model-backed `dev-test` skips without a key and prints its cost
      (`action`, `generate`, `web`, `chats`, `agents`); the deterministic suites
      (`references`, `comments`, `windows`, `task-scope`, `files`,
      `import-export`, `profile`) always run.
- [x] Realtime co-typing was **not** built (non-goal, record 0049).
