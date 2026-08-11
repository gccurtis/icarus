# CHAT — durable project-scoped AI conversations

CHAT owns the **conversations a user has with the system inside a project**: a
durable `Chat` container, its ordered `Turn`s, and the files attached to it. It
exists so a conversation is a first-class, persisted Project artifact rather than
transient UI state — you can leave a chat, come back, and the thread is still
there with its history, its pinned resource, and its persona.

What CHAT deliberately does *not* own is **how a turn is answered**. Answering is
the [agent](agents/README.md) capability's job (Ask for inline answers, Plan and
Action for durable tasks). CHAT drives it through an injected `ChatEngine` port,
so this package imports neither agent, nor intelligence, nor persona — a chat
turn is just "hand the trusted request to the engine, persist what comes back".

- **Domain and persistence contract** —
  [`core/capability/chat/chat.go`](../../../core/capability/chat/chat.go) (the
  `Chats` service, its value types and ports) and
  [`core/capability/chat/attachment.go`](../../../core/capability/chat/attachment.go)
  (the attachment half).
- **Application handlers** —
  [`core/handlers/chat/chat.go`](../../../core/handlers/chat/chat.go) and
  [`core/handlers/chat/attachment.go`](../../../core/handlers/chat/attachment.go).
  Thin endpoints that map the service's sentinels onto HTTP status codes.

## The model

```go
type Chat struct {                      // the durable container
	ID, ProjectID, RequesterID string
	Title, Mode                string    // Mode ∈ {ask, plan, action}
	ResourceID                 string    // optional: the in-project resource it is pinned to
	PersonaID                  string    // optional: resolved to a snapshot at turn time
	CreatedAt, UpdatedAt       time.Time
}

type Turn struct {                      // one message: a user prompt or the agent reply
	ID, ChatID, ProjectID string
	Role                  string         // "user" | "agent"
	Body                  string
	TaskID                string         // set when a plan/action turn spawned a durable task
	CreatedAt             time.Time
}

type Attachment struct {                // a reference to bytes owned by the file capability
	ID, ChatID, ProjectID string
	Kind                  string         // "file" | "directory"
	FileID, Name          string
	RelativePath, DirectoryUploadID string
	CreatedAt             time.Time
}
```

A chat's **mode** is fixed at creation and decides the shape of every turn:
`ask` answers inline and returns a body; `plan` and `action` spawn a durable task
and return only its `TaskID` for the client to poll. `Usage` (prompt/total tokens)
is summed onto the turn result so a live run surfaces its real cost — it is zero
for plan/action turns, whose task reports its own cost when it later runs.

An `Attachment` carries only a `FileID` and presentation metadata; the bytes live
in the [file](file.md) capability, so chat never imports it either.

## Ports and who satisfies them

| Port | Declared in | Satisfied by |
|---|---|---|
| `ChatStore` | `chat.go` | the one `*sqlite.Store`; `MemoryChatStore` for tests |
| `AttachmentStore` | `attachment.go` | the same `*sqlite.Store`, injected post-construction via `UseAttachments` |
| `ChatEngine` | `chat.go` | `chatEngine` in [`core/wiring/wiring.go`](../../../core/wiring/wiring.go) |

`chatEngine` is the interesting one. It wraps `*agent.Ask` + `*agent.Workflows` +
`*persona.Personas` + the file store and does four things the capability must not
know about: resolve the chat's `PersonaID` (or the requester's default persona)
to a `persona.Selection`; decode each attachment into a bounded UTF-8
`agent.ContextItem` (skipping binary or >32 KiB files); route the turn by mode to
`CreatePlan` / `CreateAction` / `Ask.Run`; and sum the Ask's per-phase token
counts into one `chat.Usage`. The capability sees only a `ChatReplyRequest` in
and a `ChatReply` out.

Note the deviation from the meta-model: chat's in-memory store lives at the
bottom of `chat.go`, not in a separate `memory.go`.

## Operations

`Chats` is stateless over `ChatStore` (plus the optional `AttachmentStore`).
`Scope{ProjectID}` is the trusted project the gate stamped on the request, and
**every** operation re-proves that the chat's `ProjectID` matches it —
`ErrProjectScope` and `ErrNotFound` both map to `404`, so a chat id is
meaningless outside its own project.

| Method & path | Service call | Purpose |
|---|---|---|
| `POST /agent/chats` | `Create` | Open a chat in the selected project (write role). Body `{title, mode, resourceId}`. → `201`. |
| `GET /agent/chats` | `List` | The project's chats, most-recently-updated first; `?resourceId=` filters to one resource. |
| `GET /agent/chats/:chatID` | `Get` | One chat plus its ordered turns. |
| `POST /agent/chats/:chatID/turns` | `PostTurn` | Append the user's message, run it through the engine, append the reply (write role). Body `{message, web}`. |
| `PATCH /agent/chats/:chatID/persona` | `SetPersona` | Pin (or clear) the persona this chat's turns run under (write role). |
| `POST /agent/chats/:chatID/attachments` | `AddAttachment` | Attach one base64 file, or a `{directory:[…]}` manifest whose files share a directory-upload id. |
| `GET /agent/chats/:chatID/attachments` | `Attachments` | The chat's attachments, in creation order. |
| `DELETE /agent/chats/:chatID/attachments/:attachmentID` | `DeleteAttachment` | Remove one attachment. |

`PostTurn` is the whole capability in one method: prove scope → validate the
message (non-empty, ≤ 16 KiB) → append the user turn → `engine.Reply(...)` →
append the agent turn with any `TaskID` → `TouchChat` so `List` ordering stays
right. The attachment routes register only when the file service is also wired,
and the directory manifest is bounded by `agents.attachments.max_directory_files`
from [configuration](../configuration.md).

`SetPersona` never validates the persona id — validating it would mean importing
the [persona](persona.md) capability. An unknown id surfaces at turn time, when
the engine adapter tries to resolve it.

## Persistence

Three tables in the one SQLite [store](../persistence.md): `agent_chats`
(indexed by `(project_id, updated_at)` for listing and `(project_id, resource_id)`
for the resource filter), `agent_chat_turns` (indexed by `chat_id`), and
`agent_chat_attachments` (indexed by `(chat_id, created_at)`).

## Related

- [Agents](agents/README.md) — the engine behind every turn (Ask / Plan / Action).
- [Persona](persona.md) — resolved by the engine adapter, never by this capability.
- [File](file.md) — owns the bytes an attachment points at.
- [Access](access.md) — establishes the project scope and the write role.
