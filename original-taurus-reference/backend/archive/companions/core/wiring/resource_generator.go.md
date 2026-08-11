# `resource_generator.go`

The seam behind "Create with AI": an agent → resource adapter that turns a
freshly created, empty resource into a populated one.

The resource handler owns creation. When the caller supplies a prompt, the
handler creates the resource first and then asks this port to fill it — it does
not know that "filling it" means spawning a durable agent Action under a
resolved persona. Composing that here is what keeps the resource capability from
importing either `agent` or `persona`.

The order matters: **the resource exists before the generation starts.** The
client gets an id it can navigate to immediately, and the agent's edits stream
into a document the user is already looking at, rather than the UI blocking on a
model call.

## Code breakdown

### `resourceGenerator` — the two services it needs

```go
type resourceGenerator struct {
	workflows *agent.Workflows
	personas  *persona.Personas
}
```

`Run` builds it after both, and hands it to `transport.New` as
`ResourceGenerator`.

### `Generate` — resolve a persona, then create an Action

Returns the task id, which is what the caller polls.

**Persona resolution.** A "Create with AI" request carries no persona — it is a
one-shot from a button, not a conversation. But the workflow engine requires a
valid selection, so the adapter resolves the requester's default via
`DefaultForUser` (which materializes the configured General persona for the
project on first use) and pins its concrete version:

```go
selection := persona.Selection{ID: record.Persona.ID, Version: record.Version.Version}
```

Pinning the version, rather than leaving it zero, means the task records exactly
which persona version shaped its output — a later edit to the persona cannot
retroactively change what this run was told to do.

### The objective is prompt engineering, and it lives here

The user's prompt is wrapped, not passed through:

```go
objective := "Write the requested content into document " + documentID +
	" using the document.edit tool: append well-structured blocks (a heading and paragraphs) as markdown. " +
	"Report only the confirmed change. Request: " + prompt
```

Three instructions are doing work. Naming the tool and the target document turns
an open-ended request into a bounded edit. Asking for a heading and paragraphs
as markdown produces something that reads as a document rather than a wall of
text. "Report only the confirmed change" suppresses the model's tendency to
narrate its intentions — the task's report should describe what it actually
wrote.

The user's prompt goes last, after the framing, so it reads as the request
inside an established job.

### Scoping

`CreateAction` receives `documentID` as its resource scope, which does two
things: the agent's document tools are pointed at that document, and the task
appears under that document's task filter — so the generation is visible from
the thing being generated.

Both fallible calls return the error unwrapped; the resource handler decides how
that surfaces. A generation failure leaves the empty resource in place, which is
the recoverable outcome: the user can retry or write it themselves.
