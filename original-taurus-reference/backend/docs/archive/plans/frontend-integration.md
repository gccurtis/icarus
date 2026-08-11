# Frontend integration plan

Every Alpha feature that is mocked, placeholder, or unavailable today, classified
by what Omega must build to unblock it. "Alpha wire" items can be done on the
Alpha side as soon as the corresponding Omega capability ships.

---

## Phase 1: Identity and attribution

Three small Omega changes (hours each). Together they unblock Alpha Goal 5
(document creator attribution), finish the identity resolution started in Goal
4, and enrich session presence (Goal 3).

### 1a — Document creator attribution (EP-DOC-CREATOR)

**What Omega needs.** The `Document` struct (`model.go:381`) carries `CreatedAt`
and `UpdatedAt` but no creator identity. Add two fields and set them at creation
time.

**Omega work**

- Add `CreatorID string` and `CreatorName string` to the `Document` struct in
  `core/capability/document/model.go`. Add JSON tags so they serialise in API
  responses.
- Set `CreatorID` and `CreatorName` in `Documents.Create()` at
  `core/capability/document/service.go:152` from the `Actor` argument.
- Add the two fields to the `Summary` struct at `model.go:427` so the resource
  catalogue carries them.
- Add columns to the SQLite `documents` table and a migration in
  `core/platform/storage/sqlite/sqlite.go`. Update `CreateDocument`, `DocumentByID`,
  `DocumentsByProject`, `DocumentSummaries`, and any other read paths.
- Update the `Store` interface in `model.go:481` if method signatures change.
- Add fields to the document handler's list/get response bodies (handlers already
  pass the model through — no change needed if JSON tags are correct).
- Service tests: verify `Create` sets creator; verify `Get`/`List` return it.
- SQLite tests: round-trip create/read with creator fields.
- Handler test: verify `GET /documents` and `GET /documents/:id` include creator.
- Update companion docs and write change record.

**Alpha wire.** Remove `mockDocumentCreator = getIdentityProfile('Maya Chen')`
from `systems/identity-directory/resolvers.ts:117`. `InfoPanel.svelte` reads
`document.creatorName` from the document descriptor returned by the API.
Goal 5 done.

### 1b — Identity profile enrichment (EP-IDENTITY-FIELDS)

**What Omega needs.** `GET /users/:userID` returns `{id, name}` only. Extend it
to return description, role, and creation date so Alpha can remove the mock
identities for real users.

**Omega work**

- Extend the `PublicUser` type in `core/capability/access/access.go:46` with
  `Kind` (always `"person"`), `Description`, `Role`, and `CreatedAt` fields.
- Update `PublicUserInProject` at `access.go:202` to populate the new fields.
  `Role` comes from the project membership; `Kind` is `"person"`; `Description`
  is a computed default until per-user descriptions exist; `CreatedAt` and
  `Email` already exist on the `User` struct.
- Extend the `publicUserJSON` shape in `core/handlers/user/user.go:18` to include
  `kind`, `description`, `role`, `createdAt`, and `email`.
- Update `GET /users/:userID` handler at `user.go:24` to return the richer
  response.
- Service tests: verify `PublicUserInProject` returns role and timestamps.
- Handler test: verify `GET /users/:userID` includes `kind`, `email`, `role`,
  `createdAt`.
- Update companion docs and write change record.

**Alpha wire.** The `resolveFromUserId()` function in
`systems/identity-directory/resolvers.ts` already calls `GET /users/:userID`.
Once the response carries `kind`, `description`, `role`, and `createdAt`, the
`mock` fallback branch is no longer hit for real users. Remove `mock: true` flag
from `IdentityProfile` for resolved users. The `IdentityHoverCard` mock badge
disappears.

### 1c — Session presence enrichment (EP-SESSION-ENRICH)

**What Omega needs.** `GET /sessions` returns `{userId, userName, ...}` but no
email. For identity resolution in the doc bar, the client needs the user's email
as a lookup key.

**Omega work**

- Add `UserEmail` to the `capability/session.Session` struct at
  `core/capability/session/session.go:21`.
- Populate `UserEmail` in `Sessions.Start()` — the user's email is available on
  the access context (`ctx.User.Email`).
- Persist `UserEmail` in the SQLite `project_sessions` table. Add column +
  migration.
- Update `Sessions.List()` to return the stored email.
- Update `Sessions.Update()` if needed (email never changes within a session, so
  the update path is mostly for caret/selection).
- Service tests: verify Start stores email, List returns it.
- Handler test: verify `GET /sessions` response includes `userEmail`.
- Update companion docs and write change record.

**Alpha wire.** The document bar presence store in
`systems/documents/collaboration.ts` already polls `GET /sessions` and maps
sessions to collaborator shapes. Add `userEmail` to the collaborator mapping.
No mock badge change — the mock badge was already removed in Goal 3. Just
richer data.

---

## Phase 2: AI infrastructure

Three capabilities that build on each other. The tool-loop endpoint (2a) must
ship first because the agent subsystem (2c) depends on it. Identity resolution
(2b) is independent and can ship in parallel.

### 2a — Tool-loop reasoning endpoint (EP-TOOL-REASON)

**What Omega needs.** `ReasonWithTools` exists at
`core/capability/intelligence/tool_loop.go:37`. No HTTP route exposes it. Add
a route and handler so the AI Agent can do multi-step reasoning with knowledge
retrieval.

**Omega work**

- Create a tool registry at `core/capability/intelligence/registry.go` that maps
  tool `name@version` to a `ToolHandler`. The registry is populated at server
  startup from configured capability bindings (e.g. `Knowledge.SearchTool`).
- Add a handler in `core/handlers/intelligence/intelligence.go` for
  `POST /intelligence/reason/tools`. Request body:
  ```json
  {
    "cast": {"provider": "...", "model": "..."},
    "messages": [{"role": "...", "content": "..."}],
    "tools": [{"name": "...", "version": "...", "description": "...", "inputSchema": {...}}],
    "limits": {"maxRounds": 5, "maxCalls": 10, "maxTotalTokens": 32000}
  }
  ```
- The handler resolves each requested tool definition against the registry. If
  a tool is not found, return 400. Build a `ToolSet` from the matched bindings
  and call `ReasonWithTools`.
- Response: `{ "text", "messages": [...], "toolResults": [...], "usage": {...} }`
- Register the route in `core/transport/transport.go`: `POST /intelligence/reason/tools`
- Service tests (or handler tests): verify a request with a registered tool runs
  the tool-loop and returns results; verify an unknown tool returns 400.
- Update companion docs and write change record.

**Alpha wire.** The `QuarterbackPanel` can now dispatch multi-step reasoning
requests. `systems/ai-agent/agent.ts` (or a new `actions.ts` path) calls
`POST /intelligence/reason/tools` with the conversation context and the
knowledge-search tool definition.

### 2b — Identity profile resolution (CP-IDENTITY)

**What Omega needs.** A unified, project-authorized identity profile that
combines user data, project membership, and activity into a single projection.
Batch resolution with deduplication and caching.

**Omega work**

- Define `IdentityProfile` type in a new package
  `core/capability/identity/profile.go`:
  ```go
  type Profile struct {
      ID          string    `json:"id"`
      Kind        string    `json:"kind"`        // always "person" for real users
      Name        string    `json:"name"`
      Email       string    `json:"email,omitempty"`
      Role        string    `json:"role"`        // from project membership
      Description string    `json:"description"` // computed default for now
      CreatedAt   time.Time `json:"createdAt"`
  }
  ```
- Add a `Resolver` that combines the user store, membership store, and activity
  store into profiles. Deduplicate in-flight requests so two concurrent resolves
  for the same user ID share one lookup.
- Cache resolved profiles for the request lifetime (or a short TTL).
- For deleted/departed members return a safe fallback: `{id, kind: "person",
  name: "Unknown member", role: "Former member"}`.
- `POST /projects/:projectID/identities/resolve` — accepts `{userIds: [...]}`,
  returns `{profiles: [...]}`. Batch resolve.
- `GET /projects/:projectID/identities/profile?userId=...` — single resolve.
- Service tests: batch resolve, dedup, cache, fallback for departed member.
- Handler tests: endpoint round-trip.
- Update companion docs and write change record.

**Alpha wire.** Replace `MOCK_IDENTITIES` array in
`systems/identity-directory/mocks.ts`. Add `resolveProfiles(userIds)` to a new
`systems/identity-directory/api.ts`. Wire `IdentityHoverCard`, `ActivityFeed`,
and `HistoryPanel` to resolve via the API instead of the mock fallback.

### 2c — AI Agent conversations (CP-AI-AGENT)

**What Omega needs.** Persistent conversations with message history, plan
generation, task tracking, and context resolution. Omega has the inference
primitives (`Reason`, `Infer`, `ReasonWithTools`) and the knowledge lattice
but no conversation layer.

**Omega work — Phase 1: Conversations**

- Define types in a new package `core/capability/agent/model.go`:
  - `Chat` — `{id, projectId, title, mode: "ask"|"action"|"plan", resourceId?,
    status, createdAt, updatedAt}`
  - `Message` — `{id, chatId, role: "user"|"agent"|"tool", body, context: {sources: [...]},
    createdAt}`
  - `AgentMode` constants
- Add SQLite tables: `agent_chats`, `agent_messages`. Add migration.
- Service in `core/capability/agent/service.go`:
  - `CreateChat(projectID, title?, mode, resourceId?)` → Chat
  - `ListChats(projectID, resourceId?, limit, cursor)` → []Chat (with preview)
  - `GetChat(projectID, chatID)` → Chat (with messages)
  - `SendMessage(projectID, chatID, userMessage)` → Message + agent response
- `SendMessage` orchestrates:
  1. Append user message
  2. Build messages array from chat history
  3. If mode is `plan`: generate plan (prompt → structured steps)
  4. If tools are configured: run `ReasonWithTools` via the tool-loop endpoint (2a)
  5. Otherwise: run `Reason` for a direct response
  6. Resolve context sources (document content, knowledge retrieval)
  7. Append agent response message
- Handlers in `core/handlers/agent/agent.go`:
  - `POST /projects/:projectID/agent/chats` → create chat
  - `GET /projects/:projectID/agent/chats?resourceId=...` → list chats
  - `GET /projects/:projectID/agent/chats/:chatID` → get chat with messages
  - `POST /projects/:projectID/agent/chats/:chatID/messages` → send message
- Routes in `core/transport/transport.go`
- Service tests: create/list/get chat, send message gets response, context
  sources populated.
- Handler tests: endpoint round-trips.
- Update companion docs and write change record.

**Omega work — Phase 2: Plans and tasks**

- Plan type: `{id, chatId, title, steps: [{id, label, detail}], status: "draft"|"accepted"|"running"}`
- Task type: `{id, planId, chatId, title, status: "pending"|"running"|"done"|"failed"}`
- SQLite tables: `agent_plans`, `agent_tasks`
- Service:
  - `GeneratePlan(chatID)` — model generates step sequence from conversation
  - `AcceptPlan(planID)` — creates tasks from steps, begins execution
- Handlers:
  - `POST /projects/:projectID/agent/chats/:chatID/plan` → generate plan
  - `POST /projects/:projectID/agent/plans/:planID/accept` → accept into tasks
- Tests, companions, record.

**Alpha wire.** Remove `systems/ai-agent/mocks.ts` (3 chats, 1 plan).
Add API functions in a new `systems/ai-agent/api.ts`. Wire `QuarterbackPanel`,
`QuarterbackBar`, `QuarterbackDock`, and `AiTasksPanel` to real endpoints.

---

## Phase 3: Document ecosystem

Capabilities that enrich documents themselves — comments, typography, settings,
and layout defaults. Comments (3a) depends on the anchor infrastructure built in
R19. Block typography (3b) and layout typography (3d) are independent. Per-resource
settings (3c) affects resources generally, not just documents.

### 3a — Document comments (CP-COMMENTS)

**What Omega needs.** Anchor-based comment threads on document content ranges.
Each comment references an atom/offset range, has an author, body, and resolved
state. Uses the `DocumentAnchor` type from R19 as the targeting mechanism.

**Omega work**

- Define types in `core/capability/document/comment_model.go`:
  - `Comment` — `{id, documentId, authorId, authorName, body, anchor: {atomId, offset, length},
    context, resolved: bool, createdAt}`
  - `CommentAnchor` — `{atomId string, offset int, length int}`
- Add SQLite table `document_comments`. Add migration.
- Extend `Store` interface with `CreateComment`, `ListComments`, `UpdateComment`,
  `DeleteComment`.
- Service methods in `core/capability/document/service.go` (or a new
  `comment_service.go`):
  - `CreateComment(projectID, docID, author Actor, anchor CommentAnchor, body string)`
    — validates anchor target exists against resolved head (reuse
    `validateAnchorTarget`), returns created comment.
  - `ListComments(projectID, docID, resolved *bool, limit, cursor)` — paginated
    list with context excerpt.
  - `UpdateComment(projectID, commentID, body?, resolved?)` — edit or toggle
    resolved.
  - `DeleteComment(projectID, commentID)` — hard delete.
- Handlers in `core/handlers/document/document.go` (or a new comments handler):
  - `GET /documents/:documentID/comments?resolved=false&limit=50`
  - `POST /documents/:documentID/comments`
  - `PATCH /comments/:commentID`
  - `DELETE /comments/:commentID`
- Routes in `core/transport/transport.go`
- Comment anchor rebase: when a ChangeSet commits and `RebaseAnchors` runs,
  comments referencing deleted atoms become orphaned (their context snippet is
  preserved but the anchor target is gone).
- Service tests: create, list, update, delete, resolve, anchor validation,
  pagination.
- Handler tests: endpoint round-trips.
- Update companion docs and write change record.

**Alpha wire.** Remove `mockDocumentComments` from
`systems/documents/context.ts`. Add `fetchComments()`, `createComment()` etc.
to `systems/documents/api.ts`. Wire `CommentsPanel.svelte`. Remove mock badge.

### 3b — Block typography change ops (CP-BLOCK-TYPOGRAPHY)

**What Omega needs.** The Inspector's Details lens has font family, font size,
foreground/background colour, and line spacing controls. These need server-side
persistence through new change op types.

**Omega work**

- Add change op constants to `core/capability/document/change_op.go` (or
  `model.go`):
  - `OpSetBlockFont {BlockID, FontFamily?, FontSize?}`
  - `OpSetBlockColor {BlockID, Foreground?, Background?}`
  - `OpSetBlockLineSpacing {BlockID, LineSpacing?}`
- Add op types to the `ChangeOp` struct or use a payload field.
- Implement apply logic in `core/capability/document/apply.go`:
  - `OpSetBlockFont` — update block's `Style.FontFamily` and/or `Style.FontSize`.
  - `OpSetBlockColor` — update block's `Style.Foreground` and/or `Style.Background`.
  - `OpSetBlockLineSpacing` — update block's `Style.LineSpacing`.
- Extend `BlockStyle` in `model.go` with `FontFamily`, `FontSize`, `Foreground`,
  `Background`, `LineSpacing` if not already present.
- Implement inverse, replay, and history display (operation label mapping).
- Service tests: apply each op, verify style updated; inverse returns original;
  history shows correct label.
- Update companion docs and write change record.

**Alpha wire.** The DetailsPanel already sends change ops through
`submitChanges`. Wire the font/color/spacing controls to emit the new op types.
Remove 3 `MockBadge` components from `DetailsPanel.svelte`. Remove mock actions
for "Quote formatting" and "Adding comments".

### 3c — Per-resource settings (CP-RESOURCE-SETTINGS)

**What Omega needs.** Per-resource metadata beyond `{id, kind, name, timestamps}`:
visibility and pin status. The `ResourceSettingsDialog` currently has local-state
toggles that never persist.

**Omega work**

- Add a `Settings` field to the resource store (`core/platform/storage/sqlite/sqlite.go`
  and the memory store). Store as a JSON blob: `{visibility: "private"|"link",
  pinned: bool}`.
- Extend `PATCH /resources/:kind/:resourceID` to accept `{visibility?, pinned?}`.
  Merge with existing settings.
- Return settings from `GET /resources/:kind/:resourceID` and `GET /resources`.
- The existing resource handler at `core/handlers/resource/resource.go` already
  handles `PATCH` for rename. Extend it to also accept settings fields.
- Service tests: patch visibility, patch pinned, verify persistence, verify
  GET includes settings.
- Handler test: verify `PATCH /resources/document/:id` with settings body.
- Update companion docs and write change record.

**Alpha wire.** Remove the two `MockBadge` components from
`ResourceSettingsDialog.svelte`. Add `patchResourceSettings(id, kind, settings)`
to `systems/resources/api.ts`. Wire the visibility and Options toggles to the API.

### 3d — Document layout typography (EP-DOC-TYPOGRAPHY)

**What Omega needs.** Document-level typography defaults: body font family and
size, plus per-heading-level font, size, and colour overrides. Omega has page
geometry (`PageLayout`) but no typography metadata.

**Omega work**

- Define `TypographyDefaults` in `core/capability/document/model.go`:
  ```go
  type TypographyDefaults struct {
      BodyFontFamily string        `json:"bodyFontFamily"`
      BodyFontSize   float64       `json:"bodyFontSize"`
      Headings       []HeadingStyle `json:"headings"`
  }
  type HeadingStyle struct {
      Level      int     `json:"level"`
      FontFamily string  `json:"fontFamily"`
      FontSize   float64 `json:"fontSize"`
      Color      string  `json:"color"`
  }
  ```
- Add typography to the document store. Add a `document_typography` SQLite table
  or a `typography` JSON column on `documents`. Migration.
- Service methods in `core/capability/document/service.go`:
  - `GetTypography(projectID, docID)` → `TypographyDefaults`
  - `SetTypography(projectID, docID, TypographyDefaults)` — upsert.
- Handlers in `core/handlers/document/document.go`:
  - `GET /documents/:documentID/typography`
  - `PATCH /documents/:documentID/typography`
- Routes in `core/transport/transport.go`
- Service tests: get defaults, set body font, set heading styles, verify
  round-trip.
- Handler tests: endpoint round-trips.
- Update companion docs and write change record.

**Alpha wire.** Remove `mockDocumentLayout` from
`systems/documents/context.ts`. Add `fetchDocumentTypography()` and
`patchDocumentTypography()` to `systems/documents/api.ts`. Wire
`LayoutPanel.svelte` body defaults and heading styles sections. Remove 2
`MockBadge` components. The page geometry section (page size, margins) is
already wired through the editor session.

---

## Phase 4: Import, export, and generation

File import creates resources from uploaded files. Export serialises resources
to downloadable formats. AI generation creates populated resources from natural
language prompts.

### 4a — File import (CP-FILE-IMPORT)

**What Omega needs.** Accept file uploads, detect type, create appropriate
resources. Markdown → document (parsed into rows/blocks/atoms). CSV/XLSX →
spreadsheet (deferred until a spreadsheet content model exists). Everything
else → general (raw file store).

**Omega work**

- Add multipart upload handling. Echo already has multipart support; the handler
  reads the file from the form field.
- `POST /resources/import` — multipart form: `file` (binary), `name?` (optional),
  `projectId` (string).
- Type detection by extension: `.md` → document, `.csv`/`.xlsx` → spreadsheet,
  else → general.
- For Markdown → document:
  - Parse markdown into rows/blocks/atoms using the existing
    `core/capability/document/markdown.go` parser (if one exists) or a new
    minimal markdown-to-Base converter.
  - Create document with the parsed Base.
- For general: store the file bytes, create a general resource with a file
  reference.
- For spreadsheet: block for now — defer until spreadsheet content model exists.
  Accept but store as general until then.
- File storage: write to a configured upload directory or object store.
  Configuration via `etc/config.yaml` (upload path, max size).
- Store file metadata in SQLite (filename, path, size, mime type, resource ID).
- Service tests: import .md → document with parsed content; import .png →
  general resource; reject empty file; reject oversized file.
- Handler test: `POST /resources/import` with multipart form.
- Update companion docs and write change record.

**Alpha wire.** `ImportDialog.svelte` already picks a File object. Wire the
`onImport` handler to submit via `FormData` to `POST /resources/import`. Remove
mock badge. Wire resource redirect after import completes.

### 4b — Content export (CP-EXPORT)

**What Omega needs.** Serialise resources to downloadable formats. Document →
Markdown is the priority; other kinds follow.

**Omega work**

- `GET /resources/:kind/:resourceID/export?format=md|json|taurus`
- Content-Disposition: attachment; filename derived from resource name + extension.
- Document → Markdown serializer:
  - Walk the resolved Base: rows → sections, blocks → appropriate markdown
    (paragraphs, headings, lists, code blocks, quotes, dividers, images).
  - Prompt blocks export their last-good or current output.
  - Formula atoms export their current result.
- Document → JSON: raw Base as JSON (for tool consumption).
- General → raw file download (Content-Type from stored mime type).
- Spreadsheet/slides/chat — stub until content models exist.
- Serializer as a pure function in `core/capability/document/export.go`.
- Handler in `core/handlers/resource/resource.go` (or a new export handler):
  routes to the correct serializer by kind + format.
- Service tests: document → md with paragraphs, headings, lists; document → json;
  general → raw download.
- Handler tests: endpoint round-trips with Content-Disposition header.
- Update companion docs and write change record.

**Alpha wire.** `ExportDialog.svelte` currently builds a Blob from placeholder
strings in `src/lib/data/transfer.ts`. Replace with `fetch()` to
`/resources/:kind/:id/export?format=...`. The download mechanics (Blob + link
click) stay the same — only the content source changes. Remove mock badge.

### 4c — AI resource generation (CP-AI-GENERATE)

**What Omega needs.** Submit a natural language prompt + resource kind, receive a
populated resource. Orchestrates model inference → resource creation. Async
(returns job ID) for large generations.

**Omega work**

- `POST /projects/:projectID/agent/generate` — body: `{prompt, kind}`.
  Returns 202 `{jobId}`.
- The generation job:
  1. Build a prompt that instructs the model to generate content for the
     specified kind (e.g. "Write a document about X").
  2. If kind is `document`: run `Reason` to generate markdown content, then
     parse it into a Base via the markdown parser (same as 4a import path).
  3. If kind is other: run `Reason` to generate structured content, create
     the resource.
  4. Create the resource with generated content.
  5. Mark job complete, attach resource ID to job result.
- Job payload: `{projectId, prompt, kind, userId}`.
- Reuses the existing async job infrastructure: `JobTypeGenerate` registered
  in the job runner.
- Service tests: generate document job creates a populated document; generate
  general creates a resource; job result carries resource ID.
- Handler test: `POST /agent/generate` returns 202 + job ID; poll `GET /jobs/:id`
  returns completed resource.
- Update companion docs and write change record.

**Alpha wire.** `AiCreateDialog.svelte` calls `POST /projects/:id/agent/generate`
instead of the local `addResource` mock. Poll job status via the existing
`GET /jobs/:jobId`. On completion, navigate to the new resource. Remove mock
badge.

---

## Phase 5: Polish

Low-impact, independent items that complete the remaining mock surfaces.

### 5a — Notification preferences (CP-NOTIFICATIONS)

**What Omega needs.** Store per-user notification toggle preferences. Extend
the existing `PATCH /auth/me` endpoint.

**Omega work**

- Add `Notifications` field to the `User` struct in
  `core/capability/access/access.go`:
  ```go
  type Notifications struct {
      Email    bool `json:"email"`
      Mentions bool `json:"mentions"`
      Product  bool `json:"product"`
  }
  ```
- Add `notifications` column to SQLite `users` table (JSON). Migration.
- Extend `PATCH /auth/me` handler at `core/handlers/auth/auth.go` to accept
  `{notifications: {...}}` alongside the existing `name` field.
- Update the user store's `UpdateUser` to persist notifications.
- Service tests: set notifications, verify GetMe returns them.
- Handler test: `PATCH /auth/me` with notifications body.
- Update companion docs and write change record.

**Alpha wire.** `UserSettingsDialog.svelte` has local `$state()` for
email/mentions/product toggles. Wire them to `PATCH /auth/me` (the endpoint
already exists and is called for name changes). On load, populate from
`GET /auth/me`. Remove mock badge.

### 5b — Starter templates (CP-TEMPLATES, R16)

**What Omega needs.** Pre-built content templates that users can instantiate
into populated documents. Reuses the duplicate core from R15.

**Omega work**

- Define `Template` type in `core/capability/document/template.go`:
  ```go
  type Template struct {
      ID          string    `json:"id"`
      Name        string    `json:"name"`
      Kind        string    `json:"kind"`        // always "document" initially
      Description string    `json:"description"`
      Base        Base      `json:"base"`        // canonical content, all IDs final
      CreatedAt   time.Time `json:"createdAt"`
  }
  ```
- Add `document_templates` SQLite table. Migration. Seed with initial templates:
  blank document, meeting notes, project brief (inline Go constants, no file
  loading).
- Service methods in `core/capability/document/service.go`:
  - `ListTemplates(projectID)` — list available templates.
  - `InstantiateTemplate(projectID, templateID, name?, actor)` — deep-copy the
    template's Base with fresh IDs (reuses `assignIDs` from create), insert as
    a new document. Return the new document.
- Handlers in `core/handlers/document/document.go`:
  - `GET /templates` → list templates.
  - `POST /templates/:templateID/instantiate {name?, projectId}` → 201 new document.
- Routes in `core/transport/transport.go`
- Service tests: list templates, instantiate creates document with fresh IDs
  and correct content.
- Handler tests: endpoint round-trips.
- Update companion docs and write change record.

**Alpha wire.** Remove the hardcoded `TEMPLATES` array from
`NewTabStage.svelte`. Add `fetchTemplates()` to `systems/documents/api.ts`.
Add `instantiateTemplate()` that redirects to the new document. Remove mock
badge.

### 5c — Multi-query knowledge retrieval (EP-KNOWLEDGE-RETRIEVE-MANY)

**What Omega needs.** `RetrieveMany` exists at
`core/capability/knowledge/knowledge.go`. Only single-query `POST /dev/knowledge/retrieve`
is routed. Extend to accept multiple queries.

**Omega work**

- Extend the existing `POST /dev/knowledge/retrieve` handler in
  `core/handlers/knowledge/knowledge.go` to accept a body with either:
  - `{query: "...", topK: 5}` (existing)
  - `{queries: ["...", "..."], topK: 5}` (new)
- When `queries` is present, call `RetrieveMany` instead of `Retrieve`.
- When `query` is present, call `Retrieve` (unchanged).
- Handler test: single query still works; multi-query returns results for each
  query; topK is respected.
- Update companion docs and write change record.

**Alpha wire.** The `QuarterbackPanel` context resolution can now batch multiple
retrieval queries in one call instead of N sequential calls. Performance
improvement, no UI change.

### 5d — Document pagination endpoint (EP-DOC-PAGINATE)

**What Omega needs.** `Paginate(base) ([]Page, error)` exists at
`core/capability/document/paginate.go`. No HTTP route exists. Expose for
validation and cross-client consistency.

**Omega work**

- Add handler in `core/handlers/document/document.go`:
  - `GET /documents/:documentID/pages` — loads resolved document, calls
    `Paginate(doc.Base)`, returns `{pages: [{number, rowIds, usedHeight}]}`.
- Route in `core/transport/transport.go`.
- Handler test: basic endpoint calls through.
- Update companion docs and write change record.

**Alpha wire.** Alpha already paginates correctly client-side. This endpoint is
for validation only. Alpha can optionally call it to compare client-computed
page breaks against the server-authoritative breaks.

---

## Summary by Alpha surface

| Alpha surface | Phase | Omega requirement |
|---|---|---|
| InfoPanel (creator) | 1a | CreatorID/CreatorName on Document |
| IdentityHoverCard | 1b | Enriched GET /users/:userID |
| Document bar presence | 1c | userEmail in GET /sessions |
| QuarterbackPanel | 2a, 2c | Tool-loop endpoint + conversations |
| ActivityFeed, HistoryPanel | 2b | Identity resolution |
| AiTasksPanel | 2c | Agent tasks |
| QuarterbackBar, QuarterbackDock | 2c | Chat list/get |
| CommentsPanel | 3a | Document comments |
| DetailsPanel (font/color) | 3b | Block typography ops |
| ResourceSettingsDialog | 3c | Per-resource settings |
| LayoutPanel (typography) | 3d | Layout typography endpoint |
| ImportDialog | 4a | File import |
| ExportDialog | 4b | Content export |
| AiCreateDialog | 4c | AI resource generation |
| UserSettingsDialog (notif) | 5a | Notification preferences |
| NewTabStage (templates) | 5b | Starter templates |
| QuarterbackPanel (batch) | 5c | Multi-query retrieval |
| (validation only) | 5d | Document pages endpoint |
