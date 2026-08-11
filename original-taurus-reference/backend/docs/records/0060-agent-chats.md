# Chats — persistent AI conversation history (BR-AI-CHAT)

Adds durable, project-scoped **chat** threads as their own capability — the first
increment of the document-editor backend plan
([docs/plans/document-editor-backend.md](../plans/document-editor-backend.md),
**BR-AI-CHAT**, the P1 blocker). A chat is a conversation container; posting a
turn runs the chat's mode through the existing **Ask** (inline) or **Plan/Action**
(durable task) engine and records the reply. Everything is scoped to the selected
Project.

Chat is a **separate capability** (`core/capability/chat`), not part of `agent`:
a chat is a first-class Project resource, and keeping it separate means it imports
neither `agent`, `intelligence`, nor `persona`. It declares a narrow `ChatEngine`
port that the composition root satisfies with an adapter over Ask/Workflows.

## `core/capability/chat/chat.go` (new capability)

`Chat` (id, projectId, requesterId, title, mode, resourceId, timestamps), `Turn`
(user|agent message with optional `taskId`), a `Usage` block, the `ChatStore`
persistence port, the `ChatEngine` port, and the `Chats` service
(`Create`/`Get`/`List`/`PostTurn`) with a `MemoryChatStore`. **Persona-free:** a
turn's `ChatReplyRequest` carries no persona, so the capability never touches the
persona model — the engine adapter resolves the default persona. Every read/write
proves `chat.ProjectID == scope.ProjectID` (`ErrProjectScope`).

## `core/handlers/chat/chat.go` (new)

Thin HTTP adapters `Create`/`List`/`Get`/`PostTurn` reading the selected Project
from `ctx.Project.ID`, gating writes with `canWrite`, mapping sentinel errors, and
returning the turn's `{userTurn, agentTurn, usage}` so cost is visible.

## `core/platform/storage/sqlite/sqlite.go`

`agent_chats` + `agent_chat_turns` tables — both keyed by
`project_id REFERENCES projects(id)` — with the six `chat.ChatStore` methods,
`scanChat`, and a `var _ chat.ChatStore = (*Store)(nil)` assertion. Turns are
ordered by `rowid` (exact insertion order).

## `core/transport/transport.go`

`Options.Chats *chat.Chats` and the `/agent/chats`, `/agent/chats/:chatID`,
`/agent/chats/:chatID/turns` routes on the project-scoped group, gated on the
service. (The route path stays under `/agent/chats` per the Alpha contract even
though the capability is separate.)

## `core/wiring/wiring.go`

Constructs the **Ask** engine (previously library-only) and a private
`chatEngine` adapter. **The adapter resolves the requester's default Persona**
(`DefaultForUser`, which materializes General as a fallback) before calling
Ask/Workflows — the engine rejects an empty selection, so a chat turn without a
persona would otherwise fail. It also sums Ask's per-phase usage into the turn's
single `Usage` block.

## General-knowledge triage (`runner.go`, `ask.go`, persona)

Ask was strict grounded-retrieval — it answered only from retrieved evidence and
`ErrMissingCitation`'d a general question (so "1+1" returned 500). Fixed by
**triaging in the planning call**, not by relaxing the grounded answer:

- The retrieval-plan step now returns `needsRetrieval` alongside `queries`.
- `Ask.Run` plans first, then branches: `needsRetrieval:false` → `answerDirect`
  (one plain reasoning call whose system message is the resolved Persona — no
  retrieval, no citation contract); otherwise the **unchanged** grounded path.
- `needsRetrieval` is a `*bool`, so an omitted value (older/scripted planners)
  keeps the grounded path — existing agent tests are untouched.
- The default **General persona** was softened a little: it still grounds and
  cites when evidence/tool results are available, but now also answers from its
  own knowledge otherwise.

## Tests — no model mocks

Model-backed behavior is proven against the **real provider**, never a stub:

- **Unit** (`chat_test.go`, `handlers/chat/chat_test.go`, transport
  `TestChatEndpoints`): create/get/list, project-scope isolation, validation, and
  PostTurn's pre-engine guards — all with a **nil engine** (no model), since these
  paths never call intelligence.
- **Store** (`sqlite_test.go` `TestChatRoundTrip`): chat + turn round-trip, order,
  project + resource filter, touch, not-found.
- **Live** (`dev-test/chats/run.sh`): real turns, both paths — a **grounded**
  turn over an indexed document (cited answer) and **general-knowledge** turns
  with no docs (`1 + 1 → 2`, `r's in strawberry → 3`), asserting turns persist and
  printing the summed token + dollar cost (skips without an OpenRouter key). A
  verified run passed all checks for **~1300 tokens ≈ $0.0008**, exercising the
  default-persona resolution and the triage end to end — both of which a stubbed
  engine had masked.

## Why

BR-AI-CHAT is the P1 document-editor blocker: the AI dock is modeled as ongoing
conversations, but the agent engine only persisted one-shot tasks. This adds the
missing durable container as its own project-scoped resource, reusing the shipped
engine, and — because it was proven live rather than against a stub — it caught
and fixed the empty-persona failure before it could reach a client.
