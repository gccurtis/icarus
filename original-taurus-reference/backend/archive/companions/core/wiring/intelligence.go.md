# `intelligence.go`

Building the intelligence service from configuration, and the one adapter that
lets the knowledge lattice reach embeddings.

Two things live here because they are the same boundary seen from both sides.
The first turns the manifest's provider and cast tables into a running
`*intelligence.Intelligence`. The second hands that service to the knowledge
capability through a narrow port, so knowledge can embed text without importing
— or knowing anything about — providers, casts or routing.

## Code breakdown

### `buildIntelligence` — providers, then routes

Runs in two passes over the config.

**Providers.** Each configured provider name is switched to a constructor;
today only `openrouter` exists, and an unrecognized name is fatal. A blank API
key is *not* fatal:

> A blank API key still yields a usable provider that fails calls with a clear
> "not configured" error, so the server starts with or without a key.

That is the property the whole dev experience rests on. The server boots, every
route is reachable, and only the calls that actually need a model fail — with a
message that says why. A fresh clone with no `etc/config.local.yaml` is a
working system with one capability switched off, not a process that refuses to
start.

**Routes.** The three endpoint kinds — reasoning, inference and embedding — each
get their own route table, built by `castRoutes` (in `config.go`) from the
corresponding cast list. A route naming a provider that was not constructed is
rejected inside `intelligence.New`, and that error is fatal here: a
misconfigured route is a typo that would otherwise surface as a mysterious
runtime failure much later.

**Telemetry.** The service is built with an `intelligenceTelemetry` adapter, so
every provider call reports through the same central sink a connector sync uses
rather than logging in its own shape. The adapter exists because the intelligence
capability defines its own `CallEvent` — it depends on nothing outside itself —
and the composition layer is where that meets `telemetry.Call`.

This is the one wiring line that makes model latency, per-call cost, fallback
engagement, and tool-loop shape observable at all. Everything upstream sees only
a `Result`.

**Embedding pacing.** `EmbeddingOptions` carries `max_batch_inputs` and the two
durations — `max_wait` and `backoff` — parsed from the manifest through
`parseDurationOrZero`.

Zero is the meaningful value there, not an error case: a malformed duration yields
zero and the capability reads zero as "use the default", so a typo in the manifest
degrades to shipped behaviour rather than taking the server down over a pacing knob.
That matches how the provider `timeout` beside it is handled, and it is why both
durations go through the shared helper rather than a local `time.ParseDuration`
whose error would have to be discarded by hand at each site.

### `intelligenceTelemetry` — capability event → central sink

A field-for-field translation, and deliberately nothing more. The two structs are
near-identical by design: keeping them separate is what lets the capability stay
free of the platform package, and the cost of that independence is one adapter
that a compiler error will catch if either side gains a field.

`Usage` is the one part written out field by field rather than copied wholesale,
because the two `Usage` types are structurally identical but nominally distinct.
That is where a dropped field hides: the adapter compiles either way, and the
consequence is silent under-reporting rather than a build failure. It has already
happened once — completion tokens were not carried across, so every cost figure
derived from this telemetry was low by roughly 4.5×, and nothing failed. Listing
every field explicitly makes the omission visible in review, which is the only
place it can be caught.

### `knowledgeEmbedder` — intelligence → knowledge

The knowledge lattice needs exactly one thing from intelligence: turn texts into
vectors. This adapter serves that port and carries the cast with it:

```go
type knowledgeEmbedder struct {
	intel *intelligence.Intelligence
	cast  intelligence.Cast
}
```

The cast is fixed at construction (`Run` binds the general medium/medium/medium
cast) rather than chosen per call. Embeddings must be *comparable* to be useful:
vectors produced by different models do not share a space, so letting callers
pick a cast per call would silently poison the lattice. Binding one cast for the
lifetime of the service makes that impossible by construction.

`Embed` translates in both directions and, on the way back, records the vector
identity:

```go
Identity: knowledge.VectorIdentity{Provider: res.Provider, Model: res.Model, Dims: dims}
```

`dims` is read off the first returned vector rather than declared anywhere. The
knowledge capability stores this identity with what it writes, which is how it
can later detect that stored vectors came from a different model than the one
answering queries now.

Usage is passed through as `knowledge.Usage` so token spend stays attributable
all the way up to the live suites that report the dollar cost of a run.

### The provider timeout comes from configuration

`buildIntelligence` parses each provider's `timeout` and passes it to the
adapter; a blank or unparseable value yields zero, which the adapter reads as
"use the default" (60s).

The value is a **product constraint, not a safety valve**. How quickly a model
answers is part of whether it is usable for interactive work, so a model that
cannot respond inside the budget is cut rather than accommodated —
`claude-haiku-4.5` fails the live demo at 60s, and that is the verdict we want.
Putting it in the manifest means the budget can be tuned per deployment without
a rebuild, not that it should be widened whenever something slow fails.

The adapter also carries `Subject` across, so the attribution set by a task, chat
or prompt block reaches the log. It is the only field that does not describe the
call itself — it describes what the call was *for* — and it is what makes a run's
cost summable without correlating timestamps.
