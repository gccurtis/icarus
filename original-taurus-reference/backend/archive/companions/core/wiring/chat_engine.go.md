# `chat_engine.go`

The agent/persona → chat adapter: everything that happens between a user sending
a chat message and an answer (or a task id) coming back.

The chat capability owns conversations — messages, ordering, attachments,
persistence. It owns none of the machinery that produces a reply. This file
supplies that as a single port, so `chat` imports neither `agent` nor `persona`,
and so the two very different reply shapes — inline answer versus durable task —
are reconciled in one place.

## What this file used to do, and why it stopped

This adapter used to resolve a chat's attachments into `agent.ContextItem`s and
hand them to the turn, inlining each readable file's bytes into the prompt. That
code is gone, and the reasoning is worth keeping because the replacement looks
like a removal of capability and is the opposite.

Inlining put an attachment's content in front of the model, which seemed
sufficient. It was not, because of what happens at the *end* of a grounded turn.
Caller-supplied context is not evidence: it carries no locator, so nothing in it
can be cited. Ask rejects a grounded answer that cites nothing. So a question
answerable *only* from an attachment produced the right answer and then failed
validation — the live suite saw `500 chat operation failed` for a turn in which
the model had read the file and answered correctly.

Attachments are now admitted to the knowledge lattice when they are uploaded (see
`attachment_lattice.go`), so a turn reaches them by retrieval, reading and citing
them exactly as it would a document or a connector's file. The adapter needs no
attachment code at all, which is why `attachments`, `files`, and
`maxAttachmentContextBytes` all left with it.

The one thing that survived the move is the *filter*: binary and oversized files
are still skipped, now at indexing time rather than at prompt time. The
difference is that a skipped file is no longer invisible — `chat.attachments.list`
reports it as attached-but-unreadable.

## Code breakdown

### `chatEngine` — the three services a turn needs

```go
type chatEngine struct {
	ask       *agent.Ask
	workflows *agent.Workflows
	personas  *persona.Personas
}
```

`ask` and `workflows` are the two engines; `personas` resolves who is answering.
The attachment store and file capability are no longer here: nothing in a reply
path needs them now that attachment content reaches the model through Knowledge.

### `Reply` — persona, then mode

**Scope.** The trusted scope now carries the conversation:

```go
agentScope := agent.Scope{ProjectID: scope.ProjectID, ChatID: req.ChatID}
```

The chat id travels in `Scope` rather than in the request body for the same
reason the Project id does — `Scope` is the caller's trusted resolution of *who
is asking about what*, and a tool bound from it cannot be redirected by model
output. This is what lets Ask offer `chat.attachments.list` scoped to exactly
this conversation.

**Persona.** A conversation may pin one; otherwise the turn runs under the
requester's default:

```go
if req.PersonaID != "" {
	selection = persona.Selection{ID: req.PersonaID}
} else {
	record, err := e.personas.DefaultForUser(...)
	selection = persona.Selection{ID: record.Persona.ID, Version: record.Version.Version}
}
```

Note the asymmetry in `Version`. A pinned persona leaves it zero, which resolves
to *whatever that persona is now* — so editing a persona changes the behaviour
of conversations already pinned to it, which is what a user editing a persona
expects. The default path pins the concrete version it resolved, so a turn's
provenance is recorded exactly.

**Mode.** The switch is where the two reply shapes live:

- `ModePlan` / `ModeAction` create a durable task and return **only a
  `TaskID`** — the client polls it. These runs edit documents and take as long
  as they take; holding an HTTP request open for them is not viable.
- The default (`ModeAsk`) runs `e.ask.Run` inline on
  `context.Background()` and returns a body plus usage.

All three modes pass `nil` context items. That is not an omission: there is no
longer any caller-supplied context for a chat turn, because the material that
used to go there now reaches the model as citable Knowledge.

Both task modes pass `req.ResourceID` through as the task's scope, so a chat
pinned to a document spawns tasks that surface under that document's task
filter. `IncludeWeb` reaches the Ask engine only; the live-web retriever is an
ask-mode affordance.

`chatUsage` converts the answer's token counts (below); task modes report no
usage here because the spend happens later, inside the job.

### `chatUsage` — one number for the turn

An Ask spends tokens in three phases (planning, retrieval, answer). The chat
turn shows one usage block, so this sums prompt and total tokens across all
three. Reporting only the answer phase would understate the real cost of a turn
— and per the working agreement, the price of a run is never hidden.
