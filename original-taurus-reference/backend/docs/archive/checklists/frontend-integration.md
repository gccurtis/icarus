# Frontend integration — implementation checklist

Each entry in the plan ([`docs/plans/frontend-integration.md`](../plans/frontend-integration.md))
gets a detailed checklist here. Check the parent box when all children are
complete. Each checklist item implies tests, companion doc updates, and a
numbered change record.

---

## Phase 1: Identity and attribution

### 1a — Document creator attribution

- [x] Add `CreatorID string` and `CreatorName string` fields to the `Document`
      struct in `core/capability/document/model.go` with JSON tags.
- [x] Add `CreatorID` and `CreatorName` to the `Summary` struct in
      `model.go`.
- [x] Set `CreatorID` and `CreatorName` from the `Actor` argument in
      `Documents.Create()` at `service.go`.
- [x] Add `creator_id TEXT NOT NULL DEFAULT ''` and
      `creator_name TEXT NOT NULL DEFAULT ''` columns to the SQLite `documents`
      table. Write migration. Update `scanDoc`/row struct.
- [x] Update `CreateDocument` to persist creator fields.
- [x] Update `DocumentByID`, `DocumentsByProject`, and `DocumentSummaries`
      to read and return creator fields.
- [x] Update the memory `Store` (used in tests) to carry creator fields.
- [x] Verify `GET /documents` and `GET /documents/:id` include creator fields
      in responses (verified by handler tests).
- [x] Service tests: create document sets creator; get returns creator;
      list/summaries include creator.
- [x] SQLite tests: round-trip create → read with creator fields.
- [x] Handler tests: `GET /documents/:id` response includes
      `creatorId` and `creatorName`.
- [x] Update companion docs for model.go, service.go, the handler, and the
      SQLite store.
- [x] Write change record.

### 1b — Identity profile enrichment

- [x] Extend `PublicUser` in `core/capability/access/access.go` with
      `Kind`, `Description`, `Role`, `CreatedAt` fields.
- [x] Update `PublicUserInProject` at `access.go:202` to populate all
      fields. `Role` from membership. `Kind` hardcodes `"person"`. `Description`
      uses a computed default.
- [x] Extend `publicUserJSON` in `core/handlers/user/user.go` to include
      `kind`, `email`, `role`, `description`, `createdAt`.
- [x] Update the handler's `Get` method to map all fields.
- [x] Service tests: `PublicUserInProject` returns role, kind, description,
      createdAt, email for a member.
- [x] Service tests: `PublicUserInProject` returns error for non-member.
- [x] Handler tests: `GET /users/:userID` response includes `kind`,
      `email`, `role`, `description`, `createdAt`.
- [x] Update companion docs for access.go and user handler.
- [x] Write change record.

### 1c — Session presence enrichment

- [x] Add `UserEmail string` to `capability/session.Session` struct in
      `core/capability/session/session.go`.
- [x] Populate `UserEmail` from `ctx.User.Email` in `Sessions.Start()`.
- [x] Add `user_email TEXT NOT NULL DEFAULT ''` column to SQLite
      `project_sessions` table. Write migration.
- [x] Update `UpsertProjectSession` to persist email. Update `ListSessions`
      to read email. Update scan row.
- [x] Update memory `Store.UpsertProjectSession` to carry email.
- [x] Service tests: Start stores email; List returns it.
- [x] Handler tests: `GET /sessions` response includes `userEmail` per
      session.
- [x] Update companion docs for session.go and the session handler.
- [x] Write change record.

---

## Phase 2: AI infrastructure

### 2a — Tool-loop reasoning endpoint

- [ ] Create `core/capability/intelligence/registry.go` with a `ToolRegistry`
      type that maps `name@version` to `ToolHandler`.
- [ ] Add `Register(binding ToolBinding)` and `Lookup(name, version)`
      methods.
- [ ] Wire the knowledge `SearchTool` into the registry at server startup
      (in `core/transport/transport.go` or the main server composition).
- [ ] Add handler in `core/handlers/intelligence/intelligence.go`:
      `POST /intelligence/reason/tools`.
- [ ] Handler request body: `{cast: {...}, messages: [...], tools: [{name,
      version, description, inputSchema}], limits: {maxRounds, maxCalls,
      maxCallsPerRound, maxTotalTokens}}`.
- [ ] Handler logic: resolve requested tool names against registry → build
      `ToolSet` → call `ReasonWithTools` → return response.
- [ ] Unknown tool returns 400 with message listing missing tools.
- [ ] Response: `{text, messages: [...], toolResults: [...], usage: {...}}`.
- [ ] Register `POST /intelligence/reason/tools` route in
      `core/transport/transport.go`.
- [ ] Handler tests: registered tool runs tool-loop; unknown tool returns
      400; limits are passed through; usage/rounds are returned.
- [ ] Update companion docs for intelligence handler and transport.
- [ ] Write change record.

### 2b — Identity profile resolution

- [ ] Create `core/capability/identity/` package.
- [ ] Define `Profile` type in `profile.go`: `{id, kind, name, email,
      role, description, createdAt}`.
- [ ] Define `Resolver` that wraps access user store, membership store,
      and computes safe projections.
- [ ] Implement `Resolve(userID string)` → `Profile` — fetches user,
      membership, constructs profile.
- [ ] Implement `ResolveBatch(userIDs []string)` → `[]Profile` — deduplicates
      in-flight requests with a sync.Map or singleflight pattern.
- [ ] Cache: resolved profiles held for request lifetime via context or
      a short-lifetime LRU.
- [ ] Fallback for deleted/departed members: return profile with
      `name: "Unknown member"`, `role: "Former member"`, `kind: "person"`.
- [ ] Create handler in `core/handlers/identity/identity.go`:
  - [ ] `GET /projects/:projectID/identities/profile?userId=...`
  - [ ] `POST /projects/:projectID/identities/resolve {userIds: [...]}`
        → `{profiles: [...]}`
- [ ] Register routes in `core/transport/transport.go`.
- [ ] Service tests: resolve single, resolve batch, dedup concurrent
      resolves, fallback for deleted member, fallback for non-member.
- [ ] Handler tests: endpoint round-trips for both routes.
- [ ] Update companion docs for the identity package and handler.
- [ ] Write change record.

### 2c — AI Agent conversations

#### Conversations (Phase 1)

- [ ] Create `core/capability/agent/` package.
- [ ] Define types in `model.go`:
      `Chat {id, projectId, title, mode, resourceId?, status, createdAt, updatedAt}`,
      `Message {id, chatId, role, body, context, createdAt}`,
      `ContextSource {type, title, excerpt, resourceId?}`.
- [ ] Define `AgentMode` constants: `ModeAsk`, `ModeAction`, `ModePlan`.
- [ ] Define `ChatStatus` constants: `active`, `archived`.
- [ ] Define `Store` interface in `store.go`:
  - [ ] `CreateChat(chat Chat) error`
  - [ ] `ChatByID(projectID, chatID string) (Chat, error)`
  - [ ] `ListChats(projectID string, opts ListChatsOpts) ([]Chat, error)`
  - [ ] `AppendMessage(message Message) error`
  - [ ] `MessagesByChat(chatID string) ([]Message, error)`
- [ ] Add SQLite tables `agent_chats` and `agent_messages`. Write migration.
  - [ ] `agent_chats`: id, project_id, title, mode, resource_id, status,
        created_at, updated_at.
  - [ ] `agent_messages`: id, chat_id, role, body, context_json,
        created_at.
- [ ] Implement SQLite store methods.
- [ ] Implement memory store for tests.
- [ ] Create `service.go` with an `Agent` service:
  - [ ] `CreateChat(projectID, title, mode, resourceId)` — initialises
        chat, returns it.
  - [ ] `ListChats(projectID, resourceId?, limit, cursor)` — paginated
        list with last-message preview.
  - [ ] `GetChat(projectID, chatID)` — returns chat + messages.
  - [ ] `SendMessage(projectID, chatID, body)` — orchestrates:
    1. Append user message.
    2. Load chat history as messages array.
    3. Build context (document content if resourceId set, knowledge
       retrieval).
    4. Run `Reason` or `ReasonWithTools` via the Intelligence capability.
    5. Resolve context sources from the response.
    6. Append agent response message with context.
    7. Return the agent message.
- [ ] Create handlers in `core/handlers/agent/agent.go`:
  - [ ] `POST /projects/:projectID/agent/chats`
  - [ ] `GET /projects/:projectID/agent/chats?resourceId=...&limit=20`
  - [ ] `GET /projects/:projectID/agent/chats/:chatID`
  - [ ] `POST /projects/:projectID/agent/chats/:chatID/messages`
- [ ] Register routes in `core/transport/transport.go`.
- [ ] Service tests: create chat, list chats, send message gets response,
      context sources populated, pagination.
- [ ] Handler tests: endpoint round-trips.
- [ ] Update companion docs for model.go, service.go, handler, SQLite store.
- [ ] Write change record for conversations.

#### Plans and tasks (Phase 2)

- [ ] Add plan and task types to `model.go`:
      `Plan {id, chatId, title, steps: [{id, label, detail}], status}`,
      `Task {id, planId, chatId, title, status}`.
- [ ] Plan status constants: `draft`, `accepted`, `running`, `complete`.
- [ ] Task status constants: `pending`, `running`, `done`, `failed`.
- [ ] Extend `Store` interface:
  - [ ] `CreatePlan(plan Plan) error`
  - [ ] `PlanByID(planID string) (Plan, error)`
  - [ ] `PlanByChat(chatID string) (Plan, error)`
  - [ ] `UpdatePlan(plan Plan) error`
  - [ ] `CreateTask(task Task) error`
  - [ ] `TasksByPlan(planID string) ([]Task, error)`
  - [ ] `UpdateTask(task Task) error`
- [ ] Add SQLite tables `agent_plans` and `agent_tasks`. Write migration.
  - [ ] `agent_plans`: id, chat_id, title, steps_json, status, created_at.
  - [ ] `agent_tasks`: id, plan_id, chat_id, title, status, created_at,
        updated_at.
- [ ] Implement SQLite store methods.
- [ ] Service methods:
  - [ ] `GeneratePlan(projectID, chatID)` — model generates step sequence
        from conversation context. Returns Plan with `draft` status.
  - [ ] `AcceptPlan(projectID, planID)` — transitions to `accepted`,
        creates Task objects for each step, returns plan + tasks.
- [ ] Handlers:
  - [ ] `POST /projects/:projectID/agent/chats/:chatID/plan`
  - [ ] `POST /projects/:projectID/agent/plans/:planID/accept`
- [ ] Service tests: generate plan returns structured steps; accept plan
      creates tasks; task status transitions.
- [ ] Handler tests: endpoint round-trips.
- [ ] Update companion docs and write change record for plans + tasks.

---

## Phase 3: Document ecosystem

### 3a — Document comments

- [ ] Define `Comment` and `CommentAnchor` types in a new file
      `core/capability/document/comment_model.go` (or alongside the existing
      model types).
- [ ] `CommentAnchor`: `{atomId string, offset int, length int}`.
- [ ] `Comment`: `{id, documentId, authorId, authorName, body, anchor:
      CommentAnchor, context string, resolved bool, createdAt}`.
- [ ] Extend `Store` interface:
  - [ ] `CreateComment(comment Comment) error`
  - [ ] `ListComments(documentID string, opts ListCommentsOpts) ([]Comment, error)`
  - [ ] `UpdateComment(documentID, commentID string, changes map[string]any) error`
  - [ ] `DeleteComment(documentID, commentID string) error`
- [ ] Add SQLite table `document_comments`. Write migration:
      `id, document_id, author_id, author_name, body, anchor_json,
       context, resolved, created_at`.
- [ ] Implement SQLite store methods.
- [ ] Implement memory store methods.
- [ ] Service methods in `core/capability/document/service.go`:
  - [ ] `CreateComment(projectID, docID, author Actor, anchor CommentAnchor,
        body string) (Comment, error)` — validates anchor target exists
        against resolved head, creates comment, returns it with context
        excerpt.
  - [ ] `ListComments(projectID, docID, resolved *bool, limit, cursor)
        ([]Comment, error)` — paginated, filtered.
  - [ ] `UpdateComment(projectID, commentID, newBody *string, resolved *bool)
        (Comment, error)` — partial update.
  - [ ] `DeleteComment(projectID, commentID) error`.
- [ ] Comment anchor rebase: extend `RebaseAnchors` or add a new `RebaseComments`
      in `service.go`. When an atom is deleted, comments referencing it are
      orphaned (context preserved, anchor cleared or marked invalid).
- [ ] Handlers in `core/handlers/document/document.go`:
  - [ ] `GET /documents/:documentID/comments?resolved=bool&limit=50&cursor=...`
  - [ ] `POST /documents/:documentID/comments`
  - [ ] `PATCH /comments/:commentID`
  - [ ] `DELETE /comments/:commentID`
- [ ] Register routes in `core/transport/transport.go`.
- [ ] Service tests: create comment with valid anchor, create with invalid
      anchor returns error, list comments, filter by resolved, update body,
      toggle resolved, delete, pagination, comment orphaned after atom delete.
- [ ] Handler tests: endpoint round-trips for all four routes.
- [ ] Update companion docs for model, service, handler, SQLite store.
- [ ] Write change record.

### 3b — Block typography change ops

- [ ] Add change op constants to
      `core/capability/document/model.go` (or wherever ops live):
      `OpSetBlockFont`, `OpSetBlockColor`,
      `OpSetBlockLineSpacing`.
- [ ] Define op payload structs (inline in `ChangeOp` or as typed fields):
  - [ ] `SetBlockFontPayload {BlockID, FontFamily?, FontSize?}`
  - [ ] `SetBlockColorPayload {BlockID, Foreground?, Background?}`
  - [ ] `SetBlockLineSpacingPayload {BlockID, LineSpacing?}`
- [ ] Extend `BlockStyle` in `model.go` with `FontFamily`, `FontSize`,
      `Foreground`, `Background`, `LineSpacing` if not already present.
- [ ] Implement apply logic in `core/capability/document/apply.go`:
  - [ ] `OpSetBlockFont` — update block's style font fields.
  - [ ] `OpSetBlockColor` — update block's style colour fields.
  - [ ] `OpSetBlockLineSpacing` — update block's style line spacing.
- [ ] Implement inverse for each op (set back to previous values).
- [ ] Add history display labels (e.g. "Changed block font", "Changed
      block colour").
- [ ] Validate each op: block must exist, at least one field must be
      non-zero.
- [ ] Service tests: apply each op, verify block style updated; inverse
      returns original; history shows correct label; invalid block ID
      returns conflict; op with no changed fields returns error.
- [ ] Integration test: change block colour through service, verify
      it round-trips through SubmitChanges → Get → resolved base.
- [ ] Update companion docs.
- [ ] Write change record.

### 3c — Per-resource settings

- [ ] Add `Settings` field to the resource model in the resource
      capability (check current resource types — `core/capability/resource/`).
      If no unified resource model exists, add a settings column to the
      resource catalogue store interface.
- [ ] `Settings` shape: `{visibility: "private"|"link", pinned: bool}`.
- [ ] Add `settings TEXT` (JSON) column to the resource store.
      For SQLite resources table or documents table. Migration.
- [ ] Update `CreateResource` to accept or default settings.
- [ ] Update `GetResource` and `ListResources` to return settings.
- [ ] Extend `PATCH /resources/:kind/:resourceID` handler to accept
      `{visibility?, pinned?}` alongside existing `name` field.
- [ ] Merge logic: patch body merges with existing settings.
- [ ] Service tests: create with default settings, patch visibility,
      patch pinned, verify GET returns settings, set invalid visibility
      returns error.
- [ ] Handler tests: `PATCH /resources/document/:id` with settings
      body returns updated settings.
- [ ] Update companion docs.
- [ ] Write change record.

### 3d — Document layout typography

- [ ] Define `TypographyDefaults` and `HeadingStyle` types in
      `core/capability/document/model.go`:
  - [ ] `TypographyDefaults {BodyFontFamily, BodyFontSize, Headings []HeadingStyle}`
  - [ ] `HeadingStyle {Level int, FontFamily string, FontSize float64,
        Color string}`
- [ ] Add to `Store` interface:
  - [ ] `GetTypography(documentID string) (TypographyDefaults, error)`
  - [ ] `SetTypography(documentID string, t TypographyDefaults) error`
- [ ] Add SQLite table `document_typography`:
      `document_id TEXT PRIMARY KEY, typography_json TEXT NOT NULL`.
      Migration.
- [ ] Implement SQLite store methods.
- [ ] Implement memory store methods.
- [ ] Service methods:
  - [ ] `GetTypography(projectID, docID) (TypographyDefaults, error)` —
        loads document (scope check), reads typography, returns defaults
        for unset fields.
  - [ ] `SetTypography(projectID, docID, TypographyDefaults) error` —
        loads document (scope check), upserts typography.
- [ ] Handlers in `core/handlers/document/document.go`:
  - [ ] `GET /documents/:documentID/typography`
  - [ ] `PATCH /documents/:documentID/typography`
- [ ] Register routes in `core/transport/transport.go`.
- [ ] Service tests: get defaults for new doc, set and get body font,
      set and get heading styles, update partial fields, invalid heading
      level returns error.
- [ ] Handler tests: endpoint round-trips.
- [ ] Update companion docs.
- [ ] Write change record.

---

## Phase 4: Import, export, and generation

### 4a — File import

- [ ] Add file storage configuration to `core/platform/config`:
      upload directory path, max file size.
- [ ] Create `core/capability/resource/importer.go`:
- [ ] `DetectKind(filename string) string` — maps extension to resource
      kind (`.md` → `document`, `.csv`/`.xlsx` → `general` for now,
      other → `general`).
- [ ] `ImportFile(projectID, name, filename string, data []byte) (Resource, error)`:
  - [ ] Write file to upload directory under project-scoped path.
  - [ ] Record file metadata in SQLite (new `resource_files` table: id,
        resource_id, filename, path, size, mime_type).
  - [ ] For `.md`: parse markdown → create document with parsed Base.
  - [ ] For other: create general resource linking to file.
- [ ] Implement Markdown → Base parser (new or existing):
  - [ ] `ParseMarkdown(input string) (Base, error)` — converts markdown
        text to rows/blocks/atoms.
  - [ ] Headings → heading blocks, paragraphs → paragraph blocks,
        lists → list blocks, code fences → code blocks, blockquotes →
        quote blocks, images → image blocks.
- [ ] Handler: `POST /resources/import` — multipart form:
      `file` (required), `name` (optional, default to filename),
      `projectId` (taken from access context).
- [ ] Register route in `core/transport/transport.go`.
- [ ] Service tests: import .md → document with content; import .png →
      general resource; reject empty file; reject oversized file;
      detect kind correctly.
- [ ] Handler tests: multipart upload round-trip; response includes
      resource ID and kind.
- [ ] Update companion docs.
- [ ] Write change record.

### 4b — Content export

- [ ] Create `core/capability/document/export.go`:
- [ ] `SerializeMarkdown(base Base) (string, error)` — walk Base and
      produce markdown text:
  - [ ] Headings → `#`/`##`/`###` prefixed lines.
  - [ ] Paragraphs → text blocks with inline marks (bold → `**`, italic →
        `*`, link → `[text](url)`).
  - [ ] Lists (bulleted → `- `, numbered → `1. `, checklist → `- [ ]`).
  - [ ] Code blocks → fenced with language hint.
  - [ ] Blockquotes → `>` prefixed.
  - [ ] Dividers → `---`.
  - [ ] Images → `![alt](url)`.
  - [ ] Prompt blocks → output last-good or current content.
  - [ ] Formula atoms → current result.
- [ ] `SerializeJSON(base Base) (string, error)` — marshal Base as
      indented JSON.
- [ ] Handler: `GET /resources/:kind/:resourceID/export?format=md|json|taurus`
  - [ ] Resolves resource, loads content, routes to serializer by format.
  - [ ] Sets Content-Disposition: `attachment; filename="<name>.<ext>"`.
  - [ ] Sets appropriate Content-Type.
  - [ ] For `taurus` format: exports resource + content as a `.taurus`
        bundle.
  - [ ] For general resources with a stored file: streams the raw file.
  - [ ] For spreadsheet/slides/chat: 501 Not Implemented.
- [ ] Register route in `core/transport/transport.go`.
- [ ] Serializer tests: paragraph → md, heading → md, list → md,
      inline marks → md, empty doc → empty string, formula → result text,
      prompt → output text.
- [ ] Handler tests: document export as md returns markdown,
      document export as json returns valid JSON, general resource
      export streams file, Content-Disposition header present.
- [ ] Update companion docs.
- [ ] Write change record.

### 4c — AI resource generation

- [ ] Define generation job type: `JobTypeGenerate` constant in
      `core/capability/document/model.go` (or a new agent job type).
- [ ] Job payload: `{projectId, prompt, kind, userId, name?}`.
- [ ] Create generation runner in `core/capability/agent/generate.go`
      (or alongside the agent service):
  - [ ] Accepts job payload, runs model inference to generate content
        for the specified kind.
  - [ ] For `document`: prompt the model to write markdown, parse result
        with `ParseMarkdown`, create document.
  - [ ] For `general`: prompt the model to generate text content, create
        general resource with a description.
  - [ ] Job result: `{resourceId, kind, name}`.
- [ ] Register generation job handler in `core/transport/transport.go`
      or the main server composition alongside the existing resolve and
      rebase jobs.
- [ ] Handler: `POST /projects/:projectID/agent/generate`
      body: `{prompt, kind, name?}` → 202 `{jobId}`.
- [ ] Register route in `core/transport/transport.go`.
- [ ] Service tests: generate document creates populated doc; generate
      general creates resource; job result carries resource ID; invalid
      kind returns error.
- [ ] Handler tests: `POST /agent/generate` returns 202 + job ID; poll
      `GET /jobs/:id` returns completed status with resource.
- [ ] Update companion docs.
- [ ] Write change record.

---

## Phase 5: Polish

### 5a — Notification preferences

- [ ] Define `Notifications` type in
      `core/capability/access/access.go`:
      `{Email bool, Mentions bool, Product bool}`.
- [ ] Add `Notifications` field to `User` struct.
- [ ] Add `notifications TEXT` (JSON) column to SQLite `users` table.
      Migration. Default: `{"email":true,"mentions":true,"product":true}`.
- [ ] Update `UserByID` to scan notifications.
- [ ] Update `UpdateUser` to persist notifications.
- [ ] Extend `PATCH /auth/me` handler in
      `core/handlers/auth/auth.go` to accept `{notifications: {...}}`
      alongside existing `name`.
- [ ] Update `GET /auth/me` handler to include notifications in response.
- [ ] Service tests: set notifications, GetMe returns them; partial
      update preserves unset fields; defaults on new user.
- [ ] Handler tests: `PATCH /auth/me` with notifications body;
      `GET /auth/me` includes notifications.
- [ ] Update companion docs.
- [ ] Write change record.

### 5b — Starter templates

- [ ] Define `Template` type in
      `core/capability/document/template.go`:
      `{ID, Name, Kind, Description, Base Base, CreatedAt}`.
- [ ] Define `Store` extension: `ListTemplates`, `TemplateByID`.
- [ ] Add `document_templates` SQLite table:
      `id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL,
       description TEXT NOT NULL, base_json TEXT NOT NULL,
       created_at TEXT NOT NULL`. Migration.
- [ ] Implement SQLite store methods.
- [ ] Implement memory store methods.
- [ ] Seed initial templates (define in Go constants, inserted at
      migration time if table is empty):
  - [ ] Blank document: one empty paragraph row.
  - [ ] Meeting notes: heading + date + bullet list rows.
  - [ ] Project brief: heading + section headings + paragraph rows.
- [ ] Service methods in `core/capability/document/service.go`:
  - [ ] `ListTemplates(projectID string) ([]Template, error)`.
  - [ ] `InstantiateTemplate(projectID, templateID, name string, actor Actor)
        (Document, error)` — loads template, deep-copies Base with fresh
        IDs via `assignIDs`, creates document.
- [ ] Handlers:
  - [ ] `GET /templates`
  - [ ] `POST /templates/:templateID/instantiate {name?, projectId}`
        → 201 new document.
- [ ] Register routes in `core/transport/transport.go`.
- [ ] Service tests: list templates includes seeded defaults; instantiate
      creates document with correct name and content; fresh IDs differ
      from template; missing template returns error.
- [ ] Handler tests: endpoint round-trips.
- [ ] Update companion docs.
- [ ] Write change record.

### 5c — Multi-query knowledge retrieval

- [ ] Extend the existing `POST /dev/knowledge/retrieve` handler
      in `core/handlers/knowledge/knowledge.go`.
- [ ] Add `queries` field support to the request body parser:
      `{query: "...", topK: 5}` (existing) or
      `{queries: ["...", "..."], topK: 5}` (new).
- [ ] If `queries` is present and non-empty, call `RetrieveMany(ctx,
      projectID, queries, topK)`.
- [ ] If `query` is present, call `Retrieve(ctx, projectID, query, topK)`
      (unchanged).
- [ ] Both cannot be set simultaneously — return 400.
- [ ] Handler tests: single query still works; multi-query returns results
      for each query; topK is respected; both fields set returns 400.
- [ ] Update companion docs.
- [ ] Write change record.

### 5d — Document pagination endpoint

- [ ] Add handler in `core/handlers/document/document.go`:
      `GET /documents/:documentID/pages`.
- [ ] Handler: loads resolved document via `Documents.Get()`,
      calls `Paginate(doc.Base)`, returns `{pages: [{number, rowIds, usedHeight}]}`.
- [ ] Register route in `core/transport/transport.go`.
- [ ] Handler tests: basic document returns page breaks; empty document
      returns empty pages list.
- [ ] Update companion docs.
- [ ] Write change record.
