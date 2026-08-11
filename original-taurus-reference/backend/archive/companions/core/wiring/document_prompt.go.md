# `document_prompt.go`

The three ports a document prompt block resolves through, bound to the three
services that actually serve them.

A prompt block is a live region of a document: it holds an instruction, and
resolving it produces content plus the evidence that content rests on. Doing
that reaches intelligence (plan, then synthesize), knowledge (retrieve) and
persona (instructions). The document capability declares all three as ports and
imports none of the implementations — the adapters live here, and this is where
the configured casts get bound.

The pay-off is that a prompt block resolves under the *same* persona and the
*same* retrieval lattice as a chat turn, without document and agent sharing any
code.

## Code breakdown

### `documentPromptModel` — intelligence, under two casts

```go
type documentPromptModel struct {
	intel     *intelligence.Intelligence
	planCast  intelligence.Cast
	synthCast intelligence.Cast
}
```

Two casts, one service. `Plan` and `Synthesize` are the same call with a
different cast, and both delegate to the private `reason`. Splitting them is the
point: planning decides *what to retrieve* and is short and cheap; synthesis
writes the prose and wants a stronger model. `Run` binds each from
`documents.prompt.plan_cast` / `synthesis_cast`, so an operator can move the two
independently without a code change.

Both take a `json.RawMessage` schema and call `ReasonJSON`, so every step is
structured output rather than parsed prose. `reason` translates
`document.PromptMessage` to `intelligence.Message` and translates the token
counts back into `document.Usage` — the document capability records the cost of
resolving a block.

### `documentRetriever` — the knowledge lattice, three ways

Wraps `*knowledge.Knowledge` and offers the three operations a prompt block
needs.

`Retrieve` runs the planned queries over the whole project and maps each
grounded region onto a `document.EvidenceSpan`, carrying source type, source id,
character range, text and relevance. The spans are what the block records as its
evidence, which is what makes a resolution auditable after the fact.

`RetrieveScoped` is the same, restricted to an allow-set. The mapping is the
subtle line:

```go
origins[i] = knowledge.Origin{SourceType: o.Kind, SourceID: o.ID}
```

A document `ScopeOrigin.Kind` maps 1:1 onto a knowledge source type
(`document` / `connector`), so a block bound to a context variable retrieves
from exactly the sources that context resolves to — and from nothing else. The
scope is enforced inside the lattice query, not by filtering results afterwards,
so an out-of-scope source cannot influence the ranking either.

`ChangedSince` asks whether anything in the project's lattice has changed since a
timestamp. It is the cheap staleness probe: a block that has already resolved
does not need to re-run a model call to discover nothing has moved. It takes and
ignores a `context.Context` (`_`) to match the port shape.

Both retrieval methods return usage alongside the spans, so a block's recorded
cost includes its embedding spend, not just its reasoning.

### `documentPersonaResolver` — one composition of instruction text

Resolves a block's `PersonaRef` to a snapshot and flattens it into a single
instruction string:

```go
parts := []string{snap.Instructions}
// then, each only if non-blank after TrimSpace:
//   "Focus: " + snap.Focus
//   "Default verification: " + snap.DefaultVerification
//   "Output preferences: " + snap.OutputPreferences
return strings.Join(parts, " "), nil
```

The labels are load-bearing — they are what tells the model which sentence is a
focus and which is a verification requirement — and the blank checks keep a
partially-filled persona from emitting a dangling `"Focus: "`.

The doc comment states the invariant this exists to hold: it composes the text
"the same way the agent runner does, so a persona shapes a prompt-block
resolution exactly as it shapes a chat turn". A persona that behaves one way in
chat and another inside a document would be a bug users could see, and the two
compositions are expected to stay in step.

`ref.Version` is passed straight through to `persona.Resolve`, so a block pinned
to a version stays pinned and one that is not follows the persona forward.
