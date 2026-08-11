---
title: "Model — Chat Capability & Runtime Contract"
notion_page_id: "3abb6410e50281258d89d5719fa851fc"
notion_url: "https://app.notion.com/3abb6410e50281258d89d5719fa851fc"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-28 21:13:21Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Model — Chat Capability & Runtime Contract

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

The Chat capability is a project-scoped, collaborative conversation resource. Its canonical hierarchy is `Chat → Turn → Prompt + Response`: one Turn represents one user request and its corresponding agent response. This specification is a standalone implementation contract for a coding agent. It aligns Chat with the current Taurus Omega runtime and Document concurrency model: stable-ID operations, exact revision compare-and-swap, append-only ChangeSets, replayable bases, idempotent jobs, current-head compensation, and ports/adapters assembled in wiring. The runtime authority is the [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md); the existing [Chat capability](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/capabilities/chat.md) supplies the engine boundary and project-scoping baseline.
## 1. Product contract
- The resource is `Chat`.
- A Chat contains Turns.
- Each Turn contains exactly one Prompt and one Response.
- A Prompt is durable as soon as the turn is appended.
- A Response has a durable lifecycle: pending, running, complete, error, or cancelled.
- Ask, Plan, and Action are per-turn modes with a chat-level default.
- Branching uses parent-turn relationships; there is no separate Branch aggregate initially.
- Chat owns conversation presentation and durable response content. It does not own agent tool execution, approval policy, or external side effects.
- Attachments and contextual resources are stable references to their owning capabilities.
- Human editors, agents, and engine completions all commit through typed operations.
- Streaming deltas are transport state; accepted response content is canonical state.
## 2. Runtime placement
```plain text
core/capability/chat/
  model.go
  rich_content.go
  operations.go
  submission.go
  service.go
  service_submit.go
  service_history.go
  service_rebase.go
  engine.go
  validation.go
  errors.go
  memory_store.go

core/platform/storage/sqlite/
  sqlite_chat.go

core/transport/httpapi/
  chat_handlers.go

core/wiring/
  chat.go
```
Chat is a leaf capability. It receives an authorized `Scope{ProjectID}`, repeats project scope in storage, and exposes narrow reader/mutator interfaces. Wiring supplies adapters for the agent engine, persona, files, resources, Formula, activity, jobs, and search.
Use concurrent inline dispatch for reads, serial inline dispatch keyed by `ChatID` for mutations, and deferred durable dispatch for response generation, context assembly when expensive, rebase, export, and indexing. The keyed mutex reduces contention; SQLite revision CAS is the correctness boundary.
## 3. Aggregate
```go
type Chat struct {
    ID          string
    ProjectID   string
    Title       string
    Base        ChatBase
    CreatorID   string
    CreatorName string
    CreatedAt   time.Time
    UpdatedAt   time.Time
    Revision    int64
    BaseSeq     int64
    Lifecycle   string
    TrashedAt   *time.Time
}

type ChatBase struct {
    DefaultMode      ChatMode
    DefaultPersonaID string
    PinnedResourceID string
    ActiveLeafTurnID string
    Turns            []Turn
}
```
`Base` is a materialized snapshot through `BaseSeq`. Logical reads apply later ChangeSets through `Revision`. Rebase advances `BaseSeq` without changing the visible revision or rewriting history.
`PinnedResourceID` is an optional convenience for a chat primarily associated with one project resource. Individual prompts may cite any authorized resources through context references.
## 4. Turn, Prompt, and Response
```go
type Turn struct {
    ID           string
    ParentTurnID string
    Rank         string
    Mode         ChatMode // ask | plan | action
    Persona      PersonaSnapshotRef
    Prompt       Prompt
    Response     Response
    CreatedAt    time.Time
    UpdatedAt    time.Time
}

type Prompt struct {
    Content      RichContent
    Attachments  []AttachmentRef
    ContextRefs  []ContextRef
    IncludeWeb   bool
    Author       ActorRef
    SubmittedAt  time.Time
}

type Response struct {
    Status            ResponseStatus
    Content           RichContent
    TaskID            string
    Citations         []Citation
    Evidence          []EvidenceRef
    Usage             UsageSummary
    GenerationToken   string
    SourceRevision    int64
    DisplayRevision   int64
    StartedAt         *time.Time
    CompletedAt       *time.Time
    Diagnostic        *ResponseDiagnostic
}
```
`RichContent` is owned by the Chat capability. It mirrors the useful text semantics of Documents and Slides, but Chat does not import either domain:
```go
type RichContent struct {
    Blocks []TextBlock
}

type TextBlock struct {
    ID    string
    Runs  []TextRun
    Marks []TextMark
    Style ParagraphStyle
}

type TextRun struct {
    ID    string
    Atoms []TextAtom
}

type TextAtom struct {
    ID   string
    Kind TextAtomKind
    Text string
    Data TextAtomData
}
```
Atoms may be text or Formula-backed inline values. Formula retains its eight existing value kinds. Chat imports no Formula behavior; wiring supplies a Formula evaluator if inline evaluation is enabled.
`PlainText` is derived for indexing and accessibility and is not stored as competing authority. Citations refer to the exact response ranges they support through stable text anchors.
## 5. Conversation topology
`ParentTurnID` forms a directed tree:
- a root turn has no parent;
- a normal append uses the current `ActiveLeafTurnID` as parent;
- editing or retrying from an earlier point creates a child of that point;
- concurrent appends to the same parent are both valid and naturally form two branches;
- `ActiveLeafTurnID` selects the path shown by default.
There is no `Branch` table or branch lifecycle in the first implementation. A path is derived by walking parent pointers from the active leaf to the root. `ForkTurn` is therefore an append with an explicit parent, followed by an optional active-leaf change.
Deleting a turn with descendants is not allowed. The caller may redact content, hide an entire descendant subtree, or create a new branch. This preserves replayability and avoids orphan semantics.
## 6. Mode, persona, and engine boundary
`Chat.DefaultMode` is only the default for new turns. Each Turn snapshots the chosen Ask, Plan, or Action mode and persona identity. A later chat default change does not reinterpret earlier turns.
```go
type ChatEngine interface {
    Reply(ctx context.Context, scope Scope, req EngineRequest) (EngineReply, error)
}

type EngineRequest struct {
    ChatID          string
    TurnID          string
    ParentPath      []TurnView
    Mode            ChatMode
    Persona         PersonaSnapshotRef
    Prompt          Prompt
    ResourceContext []ResolvedContext
    GenerationToken string
    SourceRevision  int64
}
```
The wiring adapter maps mode to the appropriate agent behavior and resolves persona, resource, and file references. Chat stores `TaskID` and a concise durable result summary when an Action or Plan uses a task. Agent owns tool calls, approval state, execution logs, and external side effects.
Undoing or hiding a Chat response never reverses external side effects. An Action response must cite its task and expose whether work was proposed, awaiting approval, completed, or failed. Any compensating external action is a new Agent task, not Chat undo.
## 7. Response lifecycle and streaming
Canonical lifecycle:
1. `append_turn` writes Prompt plus an empty pending Response.
2. `begin_response` records running state, generation token, source revision, and optional task ID.
3. transport may stream transient deltas to connected clients.
4. `finalize_response` atomically stores accepted RichContent, citations, evidence, usage, and complete state.
5. `fail_response` preserves any last accepted content, records a diagnostic, and marks error.
6. `cancel_response` records cancellation when the engine confirms or the lease expires.
Streaming chunks are not individual ChangeSets and are not canonical persistence. A reconnect reads the last durable state and may reattach to the live stream through an ephemeral stream registry. If the process dies during generation, a durable job retry uses the same job and generation token. If it cannot resume, a reaper appends `fail_response` with a stable system submission ID.
`finalize_response` is accepted only if:
- the Turn still exists;
- its Response is pending or running;
- the generation token matches;
- the prompt and selected parent path still match the captured source revision;
- the Response display revision has not been edited or replaced.
Late output can never overwrite a newer retry or a human edit.
## 8. Change submission
```go
type ChatChangeSubmission struct {
    SubmissionID     string
    ExpectedRevision int64
    Operations       []ChatOperation
}

type ChatChangeSet struct {
    ID               string
    ChatID           string
    AuthorID         string
    AuthorName       string
    SubmissionID     string
    AuthoredRevision int64
    PriorRevision    int64
    Seq              int64
    CreatedAt        time.Time
    Operations       []ChatOperation
    UndoOf           string
    RedoOf           string
    Summary          ChatChangeSummary

    SubmissionHash   string
    InverseOps       []ChatOperation
}
```
The server normalizes operations and fingerprints them with chat, author, and expected revision. An identical retry returns the original ChangeSet. A reused `SubmissionID` with a different fingerprint conflicts.
Fresh submissions require the current head. A distinct stale submission may be admitted only when retained semantic footprints prove it disjoint from every intervening ChangeSet. Missing, ambiguous, or compacted proof fails closed.
Undo and redo append current-head compensation and are author-scoped by default. Only canonical Chat state is compensated. Agent side effects and sent external communications are explicitly outside Chat undo.
## 9. Operation vocabulary
<table header-row="true">
<tr>
<td>Area</td>
<td>Operations</td>
</tr>
<tr>
<td>Chat</td>
<td>`rename_chat`, `set_default_mode`, `set_default_persona`, `set_pinned_resource`, `set_active_leaf`</td>
</tr>
<tr>
<td>Turns</td>
<td>`append_turn` (an explicit parent creates a fork), `redact_turn`, `hide_subtree`</td>
</tr>
<tr>
<td>Prompt</td>
<td>`replace_prompt`, `splice_prompt_text`, `set_prompt_attachments`, `set_prompt_context`</td>
</tr>
<tr>
<td>Response</td>
<td>`begin_response`, `finalize_response`, `fail_response`, `cancel_response`, `replace_response`, `splice_response_text`</td>
</tr>
<tr>
<td>Citations</td>
<td>`set_response_citations`, `set_response_evidence`</td>
</tr>
</table>
Constraints:
- `append_turn` creates Prompt and pending Response together.
- Prompt edits are allowed only when the Turn has no descendants, unless the operation explicitly forks and edits the new Turn.
- An engine completion is a system-authored operation using the same submission path.
- Redaction preserves structural identity and audit metadata while replacing sensitive display content with a tombstone.
- `hide_subtree` is a presentation/lifecycle flag, not deletion.
## 10. Conflict footprints
```go
type ChatFootprint struct {
    Metadata       bool
    ActiveLeaf     bool
    TurnIDs        []string
    PromptTargets  []TextTarget
    ResponseTargets []TextTarget
    AttachmentIDs  []string
    ContextRefs    []string
    Structural     bool
}
```
- Changes to chat title and a response on an unrelated turn may rebase.
- Concurrent appends to the same parent are admitted and create sibling branches. If both request activation, the later accepted ChangeSet sequence becomes the active leaf; neither Turn is discarded.
- An explicit `set_active_leaf` conflicts with another explicit active-leaf change, but branch creation itself remains admissible.
- Edits to different turns may rebase.
- UTF-8 text splices to the same atom transform only when provably disjoint.
- Prompt edits conflict with any descendant append or response derived from the previous prompt.
- Response finalization conflicts with any token, source, display, or path mismatch.
- Redaction conflicts with text edits on the same turn.
Footprints are stored with ChangeSets for a bounded stale-rebase window. The server does not infer safety from timestamps or array positions.
## 11. Context, attachments, and citations
```go
type AttachmentRef struct {
    FileID   string
    Name     string
    MediaType string
}

type ContextRef struct {
    ResourceID string
    Kind       string
    Revision   int64
    Selector   string
}

type Citation struct {
    ID       string
    Target   TextRange
    Source   ContextRef
    Label    string
}
```
References are snapshots by identity and revision. `Selector` may identify a document block, spreadsheet range, slide/object, chat turn, or another resource-specific fragment. The owning capability resolves it through a wiring adapter. Chat stores the request and accepted evidence refs; it does not copy an entire foreign resource into its aggregate.
Files remain owned by the File capability. Chat validates that each file belongs to the project and stores stable references plus display metadata needed for history. Removing a file from a Prompt is a Chat edit; deleting the underlying file follows File lifecycle rules.
Citations use stable response text anchors. A response text edit transforms or invalidates affected citations in the same ChangeSet; it may not silently leave dangling offsets.
## 12. Jobs and idempotency
Deferred jobs:
- generate or retry a response;
- assemble expensive multi-resource context;
- compact/rebase a long chat;
- export a transcript;
- refresh search/index projections;
- mark abandoned running responses as failed.
Every job carries project, Chat ID, Turn ID, source revision, generation token, and deterministic completion submission ID. Jobs are at-least-once. Completion is safe because the same submission returns the original ChangeSet and a stale generation token is rejected.
Response generation may heartbeat a lease in the job table. Lease expiry makes the job eligible for retry; it does not itself change Chat state. The retry either resumes the same engine task or records a durable failure through `fail_response`.
## 13. Persistence
Use the shared pure-Go SQLite store in WAL mode:
<table header-row="true">
<tr>
<td>Table</td>
<td>Purpose</td>
</tr>
<tr>
<td>`chats`</td>
<td>Aggregate identity, project, defaults, active leaf, revision, base sequence, lifecycle</td>
</tr>
<tr>
<td>`chat_base_turns`</td>
<td>Rebased turn topology, prompt, response, status, generation metadata</td>
</tr>
<tr>
<td>`chat_base_attachments`</td>
<td>Rebased attachment references</td>
</tr>
<tr>
<td>`chat_base_context_refs`</td>
<td>Rebased resource references and citations</td>
</tr>
<tr>
<td>`chat_change_sets`</td>
<td>Immutable ops, inverse ops, footprint, author, sequence, submission identity</td>
</tr>
</table>
Required constraints:
- unique `(chat_id, seq)`;
- unique `(chat_id, submission_id)`;
- unique `(chat_id, turn_id)`;
- parent turn must belong to the same chat;
- project ID included in all parent lookup paths;
- compare-and-swap update by `(project_id, chat_id, expected_revision)`.
Append the ChangeSet, advance revision, and write Activity in one transaction. Base rebase is transactional and advances only `base_seq`.
A path read loads the active leaf and ancestors plus pending ChangeSets that touch them. A full-tree read is available for branch navigation, export, and rebase. The memory store must pass the same contract tests as SQLite.
## 14. Service and API
```go
type Reader interface {
    Get(ctx context.Context, scope Scope, chatID string) (ChatView, error)
    GetPath(ctx context.Context, scope Scope, chatID, leafTurnID string) (ChatPathView, error)
    ListBranches(ctx context.Context, scope Scope, chatID string) ([]BranchPath, error)
    History(ctx context.Context, scope Scope, chatID string, q HistoryQuery) ([]ChatChangeSet, error)
}

type Mutator interface {
    Create(ctx context.Context, scope Scope, cmd CreateChat) (Chat, error)
    Submit(ctx context.Context, scope Scope, chatID string, sub ChatChangeSubmission) (ChatChangeSet, error)
    Undo(ctx context.Context, scope Scope, chatID string, cmd UndoCommand) (ChatChangeSet, error)
    Redo(ctx context.Context, scope Scope, chatID string, cmd RedoCommand) (ChatChangeSet, error)
}
```
Canonical HTTP surface:
- `POST /chats`
- `GET /chats/{id}`
- `GET /chats/{id}/paths/{leafTurnID}`
- `GET /chats/{id}/branches`
- `POST /chats/{id}/changes`
- `GET /chats/{id}/changes`
- `POST /chats/{id}/turns`
- `POST /chats/{id}/turns/{turnID}/respond`
- `POST /chats/{id}/turns/{turnID}/cancel`
- `POST /chats/{id}/undo`
- `POST /chats/{id}/redo`
Convenience turn/respond endpoints compile to canonical Change submissions. Responses expose Chat revision, BaseSeq, Turn IDs, generation status, task references, and source revisions.
## 15. Agent operation surface
Expose bounded functions to:
- inspect chat metadata, active path, or branch list;
- create a Chat;
- append a Turn with prompt, attachments, context, mode, and persona;
- fork from a prior Turn;
- request, retry, or cancel a response;
- edit/redact prompt or response content under policy;
- change active leaf;
- inspect citations, evidence, diagnostics, and associated task state;
- submit, undo, and redo Chat changes.
Agent-authored and human-authored changes share the same revisions and history. The response engine does not receive a storage handle; it returns an `EngineReply` which the service validates and applies as a typed ChangeSet.
## 16. Validation and errors
Reject:
- wrong-project Chat, file, resource, persona, or task references;
- missing or cross-chat parent turns;
- turn cycles;
- invalid mode or response-state transitions;
- prompt edits on a turn with descendants unless forking;
- stale or mismatched generation tokens;
- citations with dangling text anchors;
- response completion after cancellation;
- hidden/redacted content used as engine context without explicit policy;
- oversized synchronous rich content.
Stable codes include `chat_not_found`, `turn_not_found`, `revision_conflict`, `submission_reused`, `invalid_parent`, `turn_has_descendants`, `invalid_response_transition`, `generation_stale`, `citation_invalid`, and `limit_exceeded`.
## 17. Translation-ready Go contract
This section converts the domain contract into concrete Go, persistence, and execution shapes. It is normative unless an implementation discovers a repository constraint that requires an equivalent representation.
### 17.1 Chat-owned content and reference types
Under the [Omega dependency rule](https://github.com/gccurtis/taurus-omega/blob/main/docs/orientation/README.md), capabilities never import one another. Chat owns its text, resource-reference, attachment-reference, task-reference, and Formula-result DTOs. Wiring resolves and converts them.
```go
type RichContent struct {
    Blocks []TextBlock `json:"blocks"`
}

type TextBlock struct {
    ID    string         `json:"id"`
    Runs  []TextRun      `json:"runs"`
    Marks []TextMark     `json:"marks,omitempty"`
    Style ParagraphStyle `json:"style"`
}

type TextRun struct {
    ID    string     `json:"id"`
    Atoms []TextAtom `json:"atoms"`
}

type TextAtom struct {
    ID   string       `json:"id"`
    Kind TextAtomKind `json:"kind"` // text | formula
    Text string       `json:"text"` // accepted display
    Data TextAtomData `json:"data,omitempty"`
}

type TextAnchor struct {
    AtomID string `json:"atomId"`
    Offset int    `json:"offset"` // UTF-8 byte offset at a rune boundary
}

type TextMark struct {
    ID    string            `json:"id"`
    Kind  string            `json:"kind"`
    Attrs map[string]string `json:"attrs,omitempty"`
    Start TextAnchor        `json:"start"`
    End   TextAnchor        `json:"end"`
}

type ResourceRevisionRef struct {
    ResourceID string `json:"resourceId"`
    Kind       string `json:"kind"`
    Revision   int64  `json:"revision"`
    Selector   string `json:"selector,omitempty"`
}

type PersonaSnapshotRef struct {
    ID      string `json:"id"`
    Version int64  `json:"version"`
    Name    string `json:"name,omitempty"`
}

type ActorRef struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}
```
Formula atoms are optional in the first Chat increment. If enabled, Chat defines its own formula request/result types and a port; wiring converts to the Formula capability. Chat never imports Formula or its Name Manager.
### 17.2 Response state machine
```go
type ResponseStatus string

const (
    ResponsePending   ResponseStatus = "pending"
    ResponseRunning   ResponseStatus = "running"
    ResponseComplete  ResponseStatus = "complete"
    ResponseError     ResponseStatus = "error"
    ResponseCancelled ResponseStatus = "cancelled"
)

func validResponseTransition(from, to ResponseStatus) bool {
    switch from {
    case ResponsePending:
        return to == ResponseRunning ||
               to == ResponseError ||
               to == ResponseCancelled
    case ResponseRunning:
        return to == ResponseComplete ||
               to == ResponseError ||
               to == ResponseCancelled
    case ResponseError, ResponseCancelled:
        return to == ResponseRunning // explicit retry with a new token
    case ResponseComplete:
        return to == ResponseRunning // regenerate; accepted content stays visible
    default:
        return false
    }
}
```
A retry or regeneration keeps the same Turn and Response identity but assigns a new generation token, source revision, and display revision snapshot. Accepted content stays visible while the new response is running, and the prior outcome remains in ChangeSet history.
### 17.3 Service construction
```go
type IDSource interface {
    New() string
}

type Enqueuer interface {
    Enqueue(ctx context.Context, request JobRequest) (Job, error)
}

type Service struct {
    store           Store
    engine          ChatEngine
    contexts        ContextResolver
    enqueuer        Enqueuer
    streams         StreamPublisher
    ids             IDSource
    now             func() time.Time
    rebaseThreshold int
    historyLimit    int
}

type Options struct {
    Engine           ChatEngine
    ContextResolver  ContextResolver
    Enqueuer         Enqueuer
    StreamPublisher  StreamPublisher
    IDSource         IDSource
    RebaseThreshold  int
    HistoryLimit     int
}

func New(store Store, opts Options) (*Service, error) {
    if store == nil {
        return nil, errors.New("chat: store is required")
    }
    if opts.IDSource == nil {
        opts.IDSource = CryptoIDSource{}
    }
    if opts.RebaseThreshold < 1 {
        opts.RebaseThreshold = DefaultRebaseThreshold
    }
    return &Service{
        store:           store,
        engine:          opts.Engine,
        contexts:        opts.ContextResolver,
        enqueuer:        opts.Enqueuer,
        streams:         opts.StreamPublisher,
        ids:             opts.IDSource,
        now:             time.Now,
        rebaseThreshold: opts.RebaseThreshold,
        historyLimit:    opts.HistoryLimit,
    }, nil
}
```
A nil Engine or enqueuer disables response production but not Chat creation, direct content editing, branch navigation, or history tests. A nil stream publisher disables live deltas without affecting durable finalization.
### 17.4 Typed operation envelope
```go
type OperationType string

type ChatOperation struct {
    Type OperationType     `json:"type"`
    Data ChatOperationData `json:"data"`
}

type ChatOperationData interface {
    operationType() OperationType
}

const (
    OpRenameChat          OperationType = "rename_chat"
    OpSetDefaultMode      OperationType = "set_default_mode"
    OpSetDefaultPersona   OperationType = "set_default_persona"
    OpSetPinnedResource   OperationType = "set_pinned_resource"
    OpSetActiveLeaf       OperationType = "set_active_leaf"
    OpAppendTurn          OperationType = "append_turn"
    OpRedactTurn          OperationType = "redact_turn"
    OpHideSubtree         OperationType = "hide_subtree"
    OpReplacePrompt       OperationType = "replace_prompt"
    OpSplicePromptText    OperationType = "splice_prompt_text"
    OpSetPromptAttachments OperationType = "set_prompt_attachments"
    OpSetPromptContext    OperationType = "set_prompt_context"
    OpBeginResponse       OperationType = "begin_response"
    OpFinalizeResponse    OperationType = "finalize_response"
    OpFailResponse        OperationType = "fail_response"
    OpCancelResponse      OperationType = "cancel_response"
    OpReplaceResponse     OperationType = "replace_response"
    OpSpliceResponseText  OperationType = "splice_response_text"
    OpSetResponseCitations OperationType = "set_response_citations"
    OpSetResponseEvidence  OperationType = "set_response_evidence"
)

type SetActiveLeafOp struct {
    TurnID string `json:"turnId"`
}

func (SetActiveLeafOp) operationType() OperationType { return OpSetActiveLeaf }

type AppendTurnOp struct {
    TurnID      string             `json:"turnId,omitempty"` // server fills
    ParentTurnID string            `json:"parentTurnId,omitempty"`
    Mode        ChatMode           `json:"mode"`
    Persona     PersonaSnapshotRef `json:"persona"`
    Prompt      Prompt             `json:"prompt"`
    MakeActive  bool               `json:"makeActive"`
}

func (AppendTurnOp) operationType() OperationType { return OpAppendTurn }

type SplicePromptTextOp struct {
    TurnID  string `json:"turnId"`
    BlockID string `json:"blockId"`
    AtomID  string `json:"atomId"`
    Start   int    `json:"start"`
    End     int    `json:"end"`
    Text    string `json:"text"`
}

func (SplicePromptTextOp) operationType() OperationType { return OpSplicePromptText }

type BeginResponseOp struct {
    TurnID          string `json:"turnId"`
    GenerationToken string `json:"generationToken"`
    SourceRevision  int64  `json:"sourceRevision"`
    DisplayRevision int64  `json:"displayRevision"`
    TaskID          string `json:"taskId,omitempty"`
    StartedAt       time.Time `json:"startedAt"`
}

func (BeginResponseOp) operationType() OperationType { return OpBeginResponse }

type FinalizeResponseOp struct {
    TurnID          string        `json:"turnId"`
    GenerationToken string        `json:"generationToken"`
    SourceRevision  int64         `json:"sourceRevision"`
    DisplayRevision int64         `json:"displayRevision"`
    Content         RichContent   `json:"content"`
    Citations       []Citation    `json:"citations,omitempty"`
    Evidence        []EvidenceRef `json:"evidence,omitempty"`
    Usage           UsageSummary  `json:"usage"`
    CompletedAt     time.Time     `json:"completedAt"`
}

func (FinalizeResponseOp) operationType() OperationType {
    return OpFinalizeResponse
}

type FailResponseOp struct {
    TurnID          string             `json:"turnId"`
    GenerationToken string             `json:"generationToken"`
    Diagnostic      ResponseDiagnostic `json:"diagnostic"`
    FailedAt        time.Time          `json:"failedAt"`
}

func (FailResponseOp) operationType() OperationType { return OpFailResponse }

type ChatChangeSummary struct {
    CreatedTurnIDs    []string `json:"createdTurnIds,omitempty"`
    UpdatedTurnIDs    []string `json:"updatedTurnIds,omitempty"`
    ActiveLeafID      string   `json:"activeLeafId,omitempty"`
    ResponseStates    map[string]ResponseStatus `json:"responseStates,omitempty"`
    HasExternalEffects bool    `json:"hasExternalEffects,omitempty"`
}
```
The payload declarations above cover operations with the strongest lifecycle and concurrency constraints. Every constant in the closed vocabulary must receive an equally concrete Chat-owned payload before the operation is enabled. `ChatOperation.UnmarshalJSON` uses a closed switch over `Type`; unknown operations fail closed. `append_turn` server-normalizes every missing Turn, block, run, atom, and mark ID before acceptance.
`fork_turn` does not need a separate payload: it is `append_turn` with an explicit non-active `ParentTurnID`. A convenience endpoint may name the action “fork,” but it compiles to the same canonical operation.
### 17.5 Pure apply function
```go
func ApplyOperations(
    before ChatBase,
    ops []ChatOperation,
    ids IDSource,
) (after ChatBase, inverse []ChatOperation, fp ChatFootprint, err error) {
    after = before.DeepCopy()

    for _, op := range ops {
        var inv []ChatOperation
        var part ChatFootprint

        switch data := op.Data.(type) {
        case SetActiveLeafOp:
            inv, part, err = applySetActiveLeaf(&after, data)
        case AppendTurnOp:
            inv, part, err = applyAppendTurn(&after, data, ids)
        case SplicePromptTextOp:
            inv, part, err = applyPromptSplice(&after, data, ids)
        case BeginResponseOp:
            inv, part, err = applyBeginResponse(&after, data)
        case FinalizeResponseOp:
            inv, part, err = applyFinalizeResponse(&after, data)
        case FailResponseOp:
            inv, part, err = applyFailResponse(&after, data)
        default:
            err = ErrUnsupportedOperation
        }
        if err != nil {
            return ChatBase{}, nil, ChatFootprint{}, err
        }
        inverse = append(inv, inverse...)
        fp.Merge(part)
    }

    if err := ValidateChatBase(after); err != nil {
        return ChatBase{}, nil, ChatFootprint{}, err
    }
    return after, inverse, fp.Normalize(), nil
}
```
`ApplyOperations` has no engine, storage, job, clock, or foreign-capability dependency. Time values used in lifecycle operations are server-filled during normalization, making replay deterministic.
### 17.6 Path resolution
```go
func ResolvePath(base ChatBase, leafID string) ([]Turn, error) {
    byID := make(map[string]Turn, len(base.Turns))
    for _, turn := range base.Turns {
        if _, duplicate := byID[turn.ID]; duplicate {
            return nil, ErrDuplicateTurnID
        }
        byID[turn.ID] = turn
    }

    seen := map[string]bool{}
    reversed := make([]Turn, 0, len(base.Turns))
    current := leafID
    for current != "" {
        if seen[current] {
            return nil, ErrTurnCycle
        }
        seen[current] = true
        turn, ok := byID[current]
        if !ok {
            return nil, ErrInvalidParent
        }
        reversed = append(reversed, turn)
        current = turn.ParentTurnID
    }
    slices.Reverse(reversed)
    return reversed, nil
}
```
Validation runs this check for every leaf after structural operations. Branch listing derives leaf nodes as turns that are not referenced as another turn's parent, then resolves each path.
### 17.7 Engine request and reply
```go
type EngineRequest struct {
    ChatID           string
    TurnID           string
    ParentPath       []TurnView
    Mode             ChatMode
    Persona          PersonaSnapshotRef
    Prompt           Prompt
    ResourceContext  []ResolvedContext
    GenerationToken  string
    SourceRevision   int64
}

type EngineReply struct {
    Content    RichContent
    Citations  []Citation
    Evidence   []EvidenceRef
    TaskID     string
    Usage      UsageSummary
}

type ChatEngine interface {
    Reply(
        ctx context.Context,
        scope Scope,
        request EngineRequest,
    ) (EngineReply, error)
}

type ContextResolver interface {
    Resolve(
        ctx context.Context,
        scope Scope,
        refs []ContextRef,
    ) ([]ResolvedContext, error)
}
```
The engine and context resolver use Chat-owned DTOs. Wiring adapters call Agent, Persona, File, Resource, Knowledge, or Web capabilities as required. Chat never receives a tool registry or approval-store handle.
### 17.8 Store port and atomic append
```go
type Store interface {
    Create(
        ctx context.Context,
        scope Scope,
        chat Chat,
        activity ActivityFact,
    ) error

    ChatByID(
        ctx context.Context,
        scope Scope,
        chatID string,
    ) (Chat, error)

    ChangeSetsSince(
        ctx context.Context,
        scope Scope,
        chatID string,
        seq int64,
    ) ([]ChatChangeSet, error)

    ChangeSetBySubmission(
        ctx context.Context,
        scope Scope,
        chatID, submissionID string,
    ) (ChatChangeSet, error)

    ChangeSetByID(
        ctx context.Context,
        scope Scope,
        chatID, changeSetID string,
    ) (ChatChangeSet, error)

    AppendChangeSet(
        ctx context.Context,
        scope Scope,
        expectedRevision int64,
        change ChatChangeSet,
        activity ActivityFact,
    ) error

    ReplaceBase(
        ctx context.Context,
        scope Scope,
        chatID string,
        expectedBaseSeq, newBaseSeq int64,
        base ChatBase,
    ) error

    PathProjection(
        ctx context.Context,
        scope Scope,
        chatID, leafTurnID string,
    ) (ChatPathProjection, error)
}

type Scope struct {
    ProjectID string
}
```
The SQLite `AppendChangeSet` transaction verifies project plus expected revision, inserts the immutable ChangeSet, advances the Chat head, and inserts Activity. A response completion never updates `chat_base_turns` directly; Base changes only through rebase.
### 17.9 Submission and response job algorithms
```go
func (s *Service) Submit(
    ctx context.Context,
    scope Scope,
    chatID string,
    author Actor,
    sub ChatChangeSubmission,
) (ChatChangeSet, error) {
    hash, err := ValidateAndHashSubmission(sub)
    if err != nil {
        return ChatChangeSet{}, err
    }
    if prior, ok, err := s.findRetry(ctx, scope, chatID, sub.SubmissionID); err != nil {
        return ChatChangeSet{}, err
    } else if ok {
        if prior.SubmissionHash != hash {
            return ChatChangeSet{}, ErrSubmissionConflict
        }
        return prior, nil
    }

    head, intervening, err := s.resolveHead(ctx, scope, chatID)
    if err != nil {
        return ChatChangeSet{}, err
    }
    if sub.ExpectedRevision != head.Revision {
        if err := ProveDisjoint(sub, intervening, sub.ExpectedRevision); err != nil {
            return ChatChangeSet{}, NewRevisionConflict(head.Revision, err)
        }
    }

    ops := AssignStableIDsAndTimes(sub.Operations, s.ids, s.now())
    _, inverse, footprint, err := ApplyOperations(head.Base, ops, s.ids)
    if err != nil {
        return ChatChangeSet{}, err
    }
    cs := NewChangeSet(head, author, sub, ops, inverse, footprint, hash, s.now())
    if err := s.store.AppendChangeSet(
        ctx, scope, head.Revision, cs, ActivityFor(cs),
    ); err != nil {
        return ChatChangeSet{}, TranslateStoreConflict(err, head.Revision)
    }
    return cs, nil
}

func (s *Service) RequestResponse(
    ctx context.Context,
    scope Scope,
    chatID, turnID string,
    actor Actor,
) (job.Job, error) {
    chat, err := s.Get(ctx, scope, chatID)
    if err != nil {
        return job.Job{}, err
    }
    turn := chat.MustTurn(turnID)
    token := s.ids.New()
    begin, err := s.Submit(ctx, scope, chatID, actor, ChatChangeSubmission{
        SubmissionID:     "response-begin:" + token,
        ExpectedRevision: chat.Revision,
        Operations: []ChatOperation{NewBeginResponse(turn, token, chat.Revision, s.now())},
    })
    if err != nil {
        return job.Job{}, err
    }
    return s.enqueuer.Enqueue(ctx, job.Request{
        Kind: "chat.response",
        Key:  "chat:" + chatID + ":turn:" + turnID + ":token:" + token,
        Payload: ResponseJobPayload{
            ProjectID:      scope.ProjectID,
            ChatID:         chatID,
            TurnID:         turnID,
            GenerationToken: token,
            SourceRevision:  begin.Seq,
        },
    })
}
```
Worker pseudocode:
```plain text
load Chat at SourceRevision
resolve selected parent path
resolve Prompt attachments and resource context through ports
call ChatEngine.Reply
reload current Chat head
verify Turn and generation token are still eligible
submit finalize_response with SubmissionID = "response-finalize:" + JobID
if the engine fails, submit fail_response with SubmissionID = "response-fail:" + JobID
if finalization is stale, acknowledge the job without mutating Chat
```
The begin ChangeSet is committed before enqueueing. If enqueue fails, the service appends a deterministic failure ChangeSet or the abandoned-response reaper does so. There is never a durable Prompt without a durable response lifecycle.
### 17.10 Undo, redo, and rebase
```go
func (s *Service) Undo(
    ctx context.Context,
    scope Scope,
    chatID, authorID, targetID string,
) (ChatChangeSet, error) {
    head, err := s.store.ChatByID(ctx, scope, chatID)
    if err != nil {
        return ChatChangeSet{}, err
    }
    target, err := s.store.ChangeSetByID(ctx, scope, chatID, targetID)
    if err != nil {
        return ChatChangeSet{}, err
    }
    if target.AuthorID != authorID {
        return ChatChangeSet{}, ErrUndoForbidden
    }
    if target.Seq != head.Revision {
        return ChatChangeSet{}, ErrUndoConflict
    }
    if target.UndoOf != "" || len(target.InverseOps) == 0 {
        return ChatChangeSet{}, ErrUndoUnavailable
    }
    if target.Summary.HasExternalEffects {
        return ChatChangeSet{}, ErrExternalEffectNotUndoable
    }
    return s.submitCompensation(
        ctx, scope, head, authorID,
        "undo:"+target.ID,
        target.InverseOps,
        target.ID, "",
    )
}

func (s *Service) Rebase(
    ctx context.Context,
    scope Scope,
    chatID string,
) error {
    stored, err := s.store.ChatByID(ctx, scope, chatID)
    if err != nil {
        return err
    }
    changes, err := s.store.ChangeSetsSince(ctx, scope, chatID, stored.BaseSeq)
    if err != nil {
        return err
    }
    through := stored.Revision
    resolved, err := Replay(stored.Base, ChangeSetsThrough(changes, through))
    if err != nil {
        return err
    }
    return s.store.ReplaceBase(
        ctx, scope, chatID,
        stored.BaseSeq, through, resolved,
    )
}
```
`HasExternalEffects` is true when the ChangeSet starts or records an Agent Plan/Action task or another non-Chat side effect. Such a ChangeSet may be hidden or annotated, but Chat undo cannot claim to reverse the external effect. Redo compensates only an eligible current-head undo. Rebase advances `BaseSeq`, never logical `Revision`.
### 17.11 Streaming boundary
```go
type StreamEvent struct {
    ChatID          string
    TurnID          string
    GenerationToken string
    Sequence        int64
    Delta           string
    Done            bool
}

type StreamPublisher interface {
    Publish(ctx context.Context, event StreamEvent) error
}
```
Stream events are ephemeral and best-effort. They are keyed by generation token and monotonically sequenced for client ordering. They do not advance Chat revision. `finalize_response` is the durable synchronization point; a reconnect always trusts the Chat read over missed deltas.
### 17.12 Representative SQLite DDL
```sql
CREATE TABLE chats (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL,
    title               TEXT NOT NULL,
    creator_id          TEXT NOT NULL,
    creator_name        TEXT NOT NULL,
    default_mode        TEXT NOT NULL,
    default_persona_id  TEXT,
    pinned_resource_id  TEXT,
    active_leaf_turn_id TEXT,
    revision            INTEGER NOT NULL DEFAULT 0,
    base_seq            INTEGER NOT NULL DEFAULT 0,
    lifecycle           TEXT NOT NULL DEFAULT 'active',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    trashed_at          TEXT
);
CREATE INDEX chats_project_updated
    ON chats(project_id, updated_at DESC, id);

CREATE TABLE chat_base_turns (
    chat_id              TEXT NOT NULL,
    id                   TEXT NOT NULL,
    parent_turn_id       TEXT,
    rank                 TEXT NOT NULL,
    mode                 TEXT NOT NULL,
    persona_json         BLOB NOT NULL,
    prompt_json          BLOB NOT NULL,
    response_json        BLOB NOT NULL,
    response_status      TEXT NOT NULL,
    generation_token     TEXT,
    source_revision      INTEGER NOT NULL DEFAULT 0,
    display_revision     INTEGER NOT NULL DEFAULT 0,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    PRIMARY KEY (chat_id, id),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
CREATE INDEX chat_base_turns_parent
    ON chat_base_turns(chat_id, parent_turn_id, rank, id);

CREATE TABLE chat_change_sets (
    id                TEXT PRIMARY KEY,
    chat_id           TEXT NOT NULL,
    project_id        TEXT NOT NULL,
    submission_id     TEXT NOT NULL,
    submission_hash   TEXT NOT NULL,
    author_id         TEXT NOT NULL,
    author_name       TEXT NOT NULL,
    authored_revision INTEGER NOT NULL,
    prior_revision    INTEGER NOT NULL,
    seq               INTEGER NOT NULL,
    operations_json   BLOB NOT NULL,
    inverse_ops_json  BLOB NOT NULL,
    footprint_json    BLOB NOT NULL,
    undo_of           TEXT,
    redo_of           TEXT,
    summary_json      BLOB NOT NULL,
    created_at        TEXT NOT NULL,
    UNIQUE (chat_id, seq),
    UNIQUE (chat_id, submission_id),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);
```
Attachments, context refs, citations, and evidence may remain embedded in Prompt/Response JSON initially because they are fetched with their Turn. Promote them to projection tables only when cross-chat querying or independent lifecycle requires it.
### 17.13 Endpoint DTO example
```go
type AppendTurnRequest struct {
    SubmissionID     string             `json:"submissionId"`
    ExpectedRevision int64              `json:"expectedRevision"`
    ParentTurnID     string             `json:"parentTurnId,omitempty"`
    Mode             ChatMode           `json:"mode,omitempty"`
    Persona          PersonaSnapshotRef `json:"persona,omitempty"`
    Prompt           Prompt             `json:"prompt"`
}

type AppendTurnResponse struct {
    TurnID      string `json:"turnId"`
    ChangeSetID string `json:"changeSetId"`
    Revision    int64  `json:"revision"`
}

func (h *Handler) AppendTurn(
    ctx context.Context,
    access AccessContext,
    chatID string,
    req AppendTurnRequest,
) (AppendTurnResponse, error) {
    op := AppendTurnOp{
        ParentTurnID: req.ParentTurnID,
        Mode:         req.Mode,
        Persona:      req.Persona,
        Prompt:       req.Prompt,
        MakeActive:   true,
    }
    cs, err := h.chats.Submit(
        ctx,
        Scope{ProjectID: access.ProjectID},
        chatID,
        Actor{ID: access.UserID, Name: access.UserName},
        ChatChangeSubmission{
            SubmissionID:     req.SubmissionID,
            ExpectedRevision: req.ExpectedRevision,
            Operations:       []ChatOperation{NewOperation(op)},
        },
    )
    if err != nil {
        return AppendTurnResponse{}, MapEndpointError(err)
    }
    turnID := cs.Summary.CreatedTurnIDs[0]
    return AppendTurnResponse{
        TurnID:      turnID,
        ChangeSetID: cs.ID,
        Revision:    cs.Seq,
    }, nil
}
```
Because the server assigns the Turn ID during normalization, the handler obtains the assigned ID from the accepted ChangeSet summary rather than the pre-normalized local `op`. Production code validates that `CreatedTurnIDs` contains exactly one entry for this convenience endpoint. Transport never accepts ProjectID or author identity from request JSON.
## 18. Acceptance criteria
1. A Turn contains one Prompt and one Response.
2. Prompt creation and pending Response creation are atomic.
3. Branches derive from `ParentTurnID`; no extra Branch aggregate is required.
4. concurrent sibling appends are preserved rather than overwritten;
5. final responses are durable ChangeSets, while stream chunks are transient;
6. response retries are idempotent and stale completions cannot win;
7. Ask, Plan, and Action are snapshotted per Turn;
8. tool calls, approvals, and external side effects remain Agent-owned;
9. undo/redo affects Chat state only and appends current-head compensation;
10. rebase preserves the logical revision and full history;
11. citations and context references are revision-aware;
12. project-scoped storage, revision advancement, and Activity are atomic;
13. memory and SQLite stores share contract tests;
14. resource, file, persona, Formula, search, activity, and agent integrations are wiring adapters rather than leaf imports.
## Sources
- [Taurus Omega orientation and dependency rules](https://github.com/gccurtis/taurus-omega/blob/main/docs/orientation/README.md)
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Current Chat capability](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/capabilities/chat.md)
- [Current Chat implementation](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/chat/chat.go)
- [Current Document model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/model.go)
- [Current Document submission contract](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/submission.go)
- [Current Document SQLite store](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_document.go)
- <mention-page url="https://app.notion.com/p/3a5b6410e5028154903de18bfcc353a5"/>

