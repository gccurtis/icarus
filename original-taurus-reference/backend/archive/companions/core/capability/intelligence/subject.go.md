# subject.go

`subject.go` answers a question the rest of the telemetry could not: **what was
this provider call for?**

## The gap it closes

A `CallEvent` already says which cast selected a model, which model actually
served it, what it cost, and how long it took. It could not say which piece of
work caused it. Summing one agent task's true spend therefore meant reading log
lines by timestamp and hoping no two runs overlapped — and under concurrent job
workers that is not merely tedious, it produces wrong numbers.

With a subject, "what did this task cost" is a filter on one field. The first
live run showed a single Action task as a planning call, two embeddings, and a
27.2s tool loop of 35,913 tokens across 8 rounds — one task's whole bill, grouped
without correlation.

## Why the context, and not a request field

The subject is ambient to a *unit of work*, not a property of any single call.
One task makes a retrieval-planning call, then a tool loop, then possibly a
corrective re-ask; a prompt block makes a plan call and a synthesis call. Adding
an attribution argument to every request struct would put the same value in four
places and let any one of them forget it — and the one that forgot would silently
under-report, which is the failure mode hardest to notice.

A context value is exactly the right shape for something that is set once at the
boundary of a unit of work and read implicitly by everything beneath it.

## First write wins

```go
	if existing, ok := ctx.Value(subjectKey{}).(string); ok && existing != "" {
		return ctx
	}
```

Work nests. A task runs an Ask; the Ask would like to attribute its calls to a
chat. If the inner scope could re-attribute, one run's spend would be split
across two subjects and **both would be undercounted** — the exact opposite of
what this exists to do.

So the outermost scope wins, because that is the unit a cost belongs to. An Ask
invoked directly from the API attributes to `ask:<project>`; the same Ask invoked
inside a task stays charged to `task:<id>`, and the task's total is complete.

This is why `WithSubject` is safe to call unconditionally at every boundary. No
caller needs to know whether it is the outermost one.

## Subject format

Conventionally `kind:id`:

- `task:9f2c…` — a durable Plan or Action run
- `chat:41ab…` — an inline chat turn
- `ask:<projectID>` — a direct Ask with no conversation
- `document:7d1e…#block-2` — one prompt block's resolution

The block-level form is deliberately finer than the document. A document's blocks
resolve independently and cost independently, and the interesting comparison —
plan versus synthesis latency, one block against another — is lost the moment
they are pooled.

An empty subject is a legitimate state, not an error: a direct API call belongs
to no unit of work. `subjectFrom` returns `""` and the log line simply omits the
field.

## Code breakdown

### The key type

```go
type subjectKey struct{}
```

An unexported empty struct, the standard idiom: it cannot collide with a key from
another package, and because the type is unexported no other package can
construct one — so the only way to set a subject is `WithSubject`, and the only
way to read one is inside this package.

### Nil tolerance

```go
	if subject == "" || ctx == nil {
		return ctx
	}
```

An empty subject is not stored, so a caller that has nothing meaningful to
attribute does not shadow an outer attribution with a blank. Both this and
`subjectFrom`'s nil check keep every call site free of guards.
