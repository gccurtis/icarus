# intelligence.go

`intelligence.go` resolves semantic casts to configured provider/model routes and dispatches one-shot Reasoning, Inference, and Embedding calls. The bounded tool continuation lives beside it in `tool_loop.go`, leaving ordinary Reason and Infer calls intentionally single-turn.

## Measurement lives here because nothing else can see it

Every provider call in the system passes through this package, and this is the
only place where four facts are simultaneously known: how long the call took,
which model actually served it, what it cost, and — for a tool loop — how much
work the model did to get there. Anywhere upstream, some of that has already been
lost: a caller sees a `Result`, not the route that produced it, and certainly not
the two failed attempts a fallback absorbed on the way.

`Telemetry` is a narrow port rather than a direct dependency on the platform
telemetry package, for the same reason `Provider` is: this package is the boundary
to the outside world, and what happens to a measurement is not its concern. The
composition layer adapts `CallEvent` to the central sink.

`record` tolerates a nil recorder so every call site can measure unconditionally,
without a guard at each one. Focused tests supply no telemetry and are unaffected.

### What is measured, and where the clock starts

The clock brackets the **provider call alone**, not the surrounding bookkeeping,
so a reported duration is the model's response time rather than this package's
overhead. That is what makes the number comparable across models, which is the
whole point of collecting it.

Two cases deserve their reasoning stated:

**A 200 that returns unusable JSON is recorded as a failure.** It spent tokens
and time and produced nothing the caller can use, then fell through to the next
candidate. That is exactly the shape of waste a per-call log exists to surface,
and treating it as a success because the HTTP status was 200 would hide it.

**An embedding retry is measured across every attempt.** `embedChunk` retries the
same route, because an embedding cast has no fallback by design. Reporting only
the successful attempt would understate what the caller actually waited for — a
route that answers only after waiting out a rate limit costs the request that whole
wait.

### Splitting a tool loop's time

`CallEvent` carries a `ToolDuration` beside its `Duration`: the share of the
elapsed time spent inside tool handlers rather than waiting on the provider. It
is set only for a tool loop, where the distinction exists.

Without the split, a slow loop is unattributable. A model that thinks for twenty
seconds and a tool handler that takes twenty seconds produce the same total, and
the two call for opposite responses — one is a model choice, the other is our own
code. Measured across the suites, tool time turns out to be a rounding error
(hundredths of a second against tens of seconds of model wait), which is itself
worth knowing: it says optimisation effort belongs at the prompt and round count,
not in the handlers.

## Code breakdown

### `Kind` and `Cast` — what a caller is allowed to ask for

Three endpoint kinds (`reasoning`, `inference`, `embedding`), each with its own
cast table, so the strength/speed/cost tradeoffs can differ between them.

A `Cast` is four coordinates — purpose, strength, speed, cost — and nothing else. It
resolves by **exact match** against its kind's table: no solver, no
nearest-neighbour fallback. An unmatched cast is an error rather than a silent
substitution, because substituting a model a caller did not ask for is how a
deployment ends up paying for a tier it thought it had turned off.

`normalized` fills in `purposeGeneral` for an empty purpose, which leaves room for
image and other purposes later without breaking existing callers. `String` renders
the cast for errors.

### `Route` — and why `Effort` lives on it

A route maps one cast to a concrete provider and model. `Effort` optionally pins how
hard the model thinks.

It belongs to the route rather than the request because it is part of the *model
choice*: the same cast can be served by a cheap model told to think harder, and
callers ask for a cast, never for a model or a thinking budget.

### The error sentinels

`ErrNoCast` (nothing configured for this cast) and `ErrProviderNotConfigured` (the
resolved provider has no credential) are ordinary sentinels.

`ErrRateLimited` and `ErrProviderTimeout` are the two that change control flow, and
each is discussed in its own section below.

### `RateLimited` — a rate limit that carries a delay

A typed error unwrapping to `ErrRateLimited`, carrying `RetryAfter`, `Provider` and
`Detail`. The unwrap is what keeps every existing `errors.Is(err, ErrRateLimited)`
check working, and it lets an adapter with no delay to report return the bare
sentinel instead.

### Requests, results, and `Options`

`ReasonRequest` and `InferRequest` carry identical payloads under distinct types, so
a call site says which it is without a comment. `EmbedRequest` carries the batch.

`Result` holds either `Text` (plain call) or `JSON` (structured call) plus usage;
`EmbedResult` holds the vectors **plus the provider and model** — the vector-space
identity a caller needs in order to know which embeddings are comparable with which.

`Options` supplies the providers, the routes per kind, the optional telemetry sink,
and `EmbeddingOptions`.

### `New` rejects two misconfigurations at startup

It indexes every route by its normalized cast for O(1) lookup, preserving
configuration order so the first route for a cast is its primary and the rest are
ordered fallbacks.

A route naming an unsupplied provider is rejected. So is a **second route for an
embedding cast**: every stored source records the model identity it was embedded
with, and vectors from different models live in different spaces, so a fall-over
would embed queries in a space the corpus is not in and silently match nothing.
Both fail at startup, where a misconfiguration is loud, rather than on the first
request.

### `Reason`, `Infer`, and their `…JSON` variants

Four thin entry points over `generate`, differing only in which cast table they
resolve against and whether a schema is attached. `ensureSchema` turns a blank
schema into a permissive object schema, so a `…JSON` call always requests structured
output while a plain call never does.

### `generate` — one shared path, so the variants cannot drift

Resolve the cast, dispatch a one-shot call, package the result as text or validated
JSON, walking the candidate list on failure.

Keeping it in one place is what makes the plain and structured variants behave
identically apart from their cast table and output shape. Tool requests are refused
here (`ErrToolCallsNotEnabled`) and accepted only by `ReasonWithTools`, where a fixed
tool set and its limits are present.

An unusable structured response is treated as a failed call and the next candidate is
tried, rather than as fatal. Skipping the fallback chain would skip it for precisely
the failure a fallback is best placed to absorb: one bad sample from one model.

### `candidates` — the ordered list, or a named error

Returns the primary followed by any fallbacks, or `ErrNoCast` naming both the kind
and the cast, so a misconfiguration is diagnosable from the message alone.

### `Embed` chunks; `embedChunk` does one chunk

`Embed` splits its inputs into runs of at most `maxBatchInputs`, calls `embedChunk`
per run, and concatenates the vectors in input order while summing the usage.
`embedChunk` resolves the cast, retries the same route, and checks that the provider
returned one vector per input.

**There is deliberately no separate batched entry point.** A single input is one
chunk and behaves exactly as an unchunked call, so a retrieval query is unaffected
and a five-thousand-window ingest is paced without any caller opting in — and no
caller can opt in wrongly.

The reason is arithmetic, not tidiness. A large ingest has only bad shapes available
to it otherwise: one request too large for the provider to accept, or (what this
replaced) one request per source in a tight loop, which is the shape a per-minute
rate limit exists to stop. Chunking is the only form bounded in both directions.

Ordering is the risk a scatter/gather always carries, because callers pair inputs to
vectors by index — a concatenation that slipped by one would produce plausible
vectors attached to the wrong text, and nothing downstream could detect it. The
identity fields (`Provider`, `Model`) are carried from the chunks rather than
recomputed; embedding casts are single-route by construction, so every chunk
necessarily resolves the same way and the vectors cannot span two spaces.

A provider owes exactly one vector per input. Returning fewer is a failed call, not
a partial success: the knowledge lattice paired by index, read off the end of a short
list, and panicked — turning a provider hiccup into an opaque 500. It is caught where
the provider's answer enters.

### Two failures are waited out; one is re-asked at once

`embedChunk`'s retry loop distinguishes failures by **what they are asking for**,
not by how many have happened.

A **hiccup** — an empty or short vector list, a one-off provider error — is
re-asked immediately, once (`embedHiccupRetries`). A provider that answers wrongly
on one call and correctly on the next was having a moment; re-embedding the same
inputs is side-effect free, and waiting would buy nothing. One is a constant rather
than configuration because it is not a budget: a provider that fails twice with no
rate limit and no timeout will not be fixed by a third ask, and each ask costs a
full embedding request.

A **rate limit** or a **provider timeout** is waited out against `MaxWait`. Both
are the provider saying it cannot serve this right now, and both happen exactly
when load is highest — which is precisely when retrying immediately is the worst
available move. Neither can be answered by falling over to another model, because
an embedding cast has no fallback: a second model embeds into a different space.

`waitFor` selects on `ctx.Done()` rather than sleeping outright. A wait can run to
a minute, and a request whose caller has already given up should not keep holding
its slot for the remainder.

### `MaxWait` is a budget because patience is what was meant

The bound used to be `MaxAttempts`, and it bounded the wrong thing. Rate limits are
enforced over windows measured in minutes; an attempt count bounds the wait only as
a side effect of the backoff curve, and the shipped four attempts at a doubling
second came to **seven seconds** of patience against a sixty-second window. That is
not patience, and the arithmetic saying so was never written down anywhere.

A time budget says the thing directly: ninety seconds, however many tries that
takes.

### `RateLimited` carries what the provider asked for

`ErrRateLimited` remains the sentinel every caller checks. `RateLimited` adds
`RetryAfter`, so an adapter with a `Retry-After` header can pass the delay through.

Honouring it is strictly better than guessing, in both directions: the provider
knows when its window resets and we do not, and guessing *short* means walking
straight back into the limit.

One case inverts that, and `embedChunk` handles it explicitly: a `Retry-After`
longer than the whole remaining budget is **not** slept. Honouring an hour-long
delay inside a request is exactly the unbounded wait the budget exists to prevent,
so the loop gives up and surfaces the rate limit for something above to act on.

### `ErrProviderTimeout` and the order inside `shouldFallover`

`shouldFallover` advances to the next candidate route for every real provider
failure — a bad request, a rate limit, an outage — and not for the caller
abandoning the request, since a fallback would only race the same deadline.

It checks `ErrProviderTimeout` **before** it checks the context errors, and that
order is the whole of a fixed defect.

An `http.Client`'s own `Timeout` surfaces as an error satisfying
`errors.Is(err, context.DeadlineExceeded)` — identical in shape to the caller's
context expiring. Without the earlier arm, the deadline check claimed it, so
`shouldFallover` returned false, so a slow provider was treated as a caller who had
walked away: no retry, no fallback, at the exact moment load was highest.

The two call for opposite responses, and only the adapter can tell them apart — it
is the one layer holding both the caller's context and the deadline it configured.
`ErrProviderTimeout` is how it says which happened; this is where the answer is
read. The fix reaches reasoning and inference too, where a timed-out provider now
falls over to the next candidate route instead of failing the call.

### Attribution travels in the context

Every `CallEvent` carries a `Subject` read from the context (see
`subject.go`), so a call is attributable to the task, chat turn or prompt block
that caused it rather than only to a cast and a model. `subjectFrom(ctx)` is
called at all three measurement points — `generate`, `embedChunk`, and the tool
loop — so no unit of work reports partially.
