# telemetry.go

The central measurement sink. Model-backed operations report through the
`Recorder` contract, so what a run costs — in tokens and in time — surfaces in
one place instead of being hidden per call site. `Logger` is the default
`Recorder`. See repo conventions (AGENTS.md).

Two event shapes, for two different questions:

- **`RecordCost(operation, subject, usage)`** — "what did this subject cost?"
  Attributes tokens to a named thing (a connector, a task). Zero-cost events are
  dropped so no-op work stays quiet.
- **`RecordCall(Call)`** — "what happened on this provider call?" One measured
  call: how long, which model, how many tokens, which fallback attempt, and for a
  tool loop how many rounds and tool calls. Never dropped.

## Why a call event was needed at all

The cost event answers a question about a *subject* and cannot answer questions
about a *call*. Diagnosing record 0130 needed the second kind and there was
nothing: a chat turn logged no tool calls, no retrieval counts, and no timing, so
separating "the lattice never held the content" from "the model declined to cite
it" required a throwaway test suite and a temporarily enriched error message.

Three facts were structurally unavailable before this, and each changes a
decision:

**Latency.** Response speed is a product constraint — there is a 60-second
provider timeout — but time was only ever reconstructed from log timestamps after
the fact. A model that fails purely by being slow (`claude-haiku-4.5` at 72s
against that budget) looked the same as one that failed on quality.

**Which model actually served the request.** A cast lists ordered fallbacks, so a
successful response says nothing about whether the primary answered or a backup
absorbed a failure. `Attempt > 1` is a route-health signal that is invisible in
the response itself.

**A tool loop's shape.** `Rounds` and `Calls` separate an agent that did the job
once from one that repeated itself — the exact ambiguity left unresolved when a
demo re-did finished work and no evidence could say whether it had looped.

## The asymmetry: cost events are dropped, call events never are

`RecordCost` returns early on zero tokens; `RecordCall` always logs. This looks
inconsistent and is deliberate.

A zero-token cost event means nothing happened — a sync with no changes — and
logging it would be noise. A zero-token *call* means something happened and
produced nothing: it still spent wall-clock, and if it failed it is the single
most informative event in the log. Dropping it is precisely how a run that burned
thirty seconds on two rate-limited attempts before succeeding becomes
indistinguishable from one that answered immediately.

## Code breakdown

### `Call`

```go
type Call struct {
	Operation    string
	Subject      string
	Cast         string
	Provider     string
	Model        string
	Effort       string
	Duration     time.Duration
	ToolDuration time.Duration
	Usage        Usage
	Attempt      int
	Rounds       int
	Calls        int
	Err          string
}

type Usage struct {
	PromptTokens     int
	CompletionTokens int
	ReasoningTokens  int
	TotalTokens      int
}
```

`Operation` is `"reason"`, `"infer"`, `"embed"`, or `"reason.tools"` for a
bounded tool loop. `Cast` carries the requested tuple so a slow or costly cast can
be found without cross-referencing the config — the log line is self-contained,
which matters when reading a run after the fact.

`Provider` and `Model` are the route that *actually served* the call, not the one
the cast names first. Together with `Attempt` they make a fallback legible.

`Rounds` and `Calls` are set only for a tool loop and are zero elsewhere, which is
why the formatter omits them rather than printing zeros. `ToolDuration` is the
same: it is the share of `Duration` spent inside tool handlers, which only exists
for a loop.

`Usage` carries prompt, completion and reasoning counts. Reasoning tokens are a
**share of** the completion count, not a fourth number to add — they bill at the
completion rate, so a cost calculation that added them would overstate the bill.
They are recorded because they say where the output budget went.

Everything a report needs is now on this one struct, which is the point: pricing
a run means reading these lines and multiplying by a published rate, with no
second source to reconcile. Before completion tokens were carried here, cost had
to be inferred from totals and was under-reported by about 4.5×.

### `RecordCall` formatting

```go
	fmt.Fprintf(&b, " — %s", c.Duration.Round(time.Millisecond))
	if c.ToolDuration > 0 {
		fmt.Fprintf(&b, " (tools %s)", c.ToolDuration.Round(time.Millisecond))
	}
```

Rounded to milliseconds. Sub-millisecond precision is noise for a network call,
and the rounding keeps the duration field a consistent width so a run's lines
stay scannable.

Tool time prints **beside** the total rather than replacing it, so a reader never
subtracts two numbers by hand to find out how much of a slow loop was ours. It is
omitted entirely when zero, which is every non-loop call.

```go
	fmt.Fprintf(&b, ", %d tokens (%d prompt, %d completion", …)
	if c.Usage.ReasoningTokens > 0 {
		fmt.Fprintf(&b, " of which %d reasoning", c.Usage.ReasoningTokens)
	}
	b.WriteString(")")
```

Reasoning tokens are printed *inside* the completion count — "of which" — because
that is exactly their relationship to it. Printing them as a peer of prompt and
completion would invite the reader to add all three, which is the one arithmetic
error this line exists to prevent.

```go
	if c.Attempt > 1 {
		fmt.Fprintf(&b, ", attempt %d", c.Attempt)
	}
```

The attempt is printed only when it is not the primary. Attempt 1 is the
overwhelming majority, and printing it on every line would bury the handful of
lines where a fallback engaged — which is the only time the field carries
information.

Each optional field is omitted rather than zero-filled for the same reason: a
line should contain what happened, and nothing a reader has to skip past.

```go
	if c.Err != "" {
		fmt.Fprintf(&b, " — FAILED: %s", c.Err)
	}
```

The failure is appended last and shouted, after the timing and token counts, so a
failed call still reports what it spent before saying that it failed.

## `Subject` — attributing a call to the work that caused it

A `Call` says which cast selected a model, which model served it, what it cost
and how long it took. `Subject` says *what it was for*: `task:9f2c`,
`chat:41ab`, `document:7d1e#block-2`.

Without it, summing one agent run's spend meant correlating log lines by
timestamp — which is wrong the moment two job workers run concurrently, and job
workers exist precisely so that they do. With it, "what did this task cost" is a
filter on one field.

The subject is set once at the boundary of a unit of work and carried in the
context (see `intelligence/subject.go`), so a task that makes a planning call, a
tool loop and a corrective re-ask has all three charged to the same id without
any of them passing it along.

In the log line it is printed immediately after the operation, in brackets:

```text
call: reason.tools [task:019a79c9] openai/gpt-5.6-luna — 27.159s, 35913 tokens (33983 prompt), 8 round(s), 15 tool call(s)
```

That position is deliberate. It is the field a reader groups by, so it belongs
where the eye lands rather than at the end of a line whose length varies with
which optional fields are present. It is omitted entirely when empty — a direct
API call belongs to no unit of work, and that is a legitimate state rather than
a gap.
