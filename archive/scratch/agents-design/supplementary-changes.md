# Agents — supplementary changes

Changes **outside** `3-capabilities/agents/` that the Agents design depends on,
or that it makes newly worth doing.

The design deliberately places almost nothing on other capabilities — the
loopback gateway means Document, Derived Outputs, and every future target need
**zero changes** to become agent-reachable. What remains is a short list, and it
is short on purpose.

When any of these is scheduled, it should move into
`scratch/0-general-updates.md`, the standing home for cross-capability work.

| # | Change | Blocking? | Size |
| --- | --- | --- | --- |
| 1 | [Intelligence: a non-throwing bounded loop and an `onRound` hook](#1--intelligence-a-non-throwing-bounded-loop-and-an-onround-hook) | **Yes** | ~40 lines |
| 2 | [Runtime: a third worker pool for agent work](#2--runtime-a-third-worker-pool-for-agent-work) | **Yes** | ~60 lines |
| 3 | [Runtime: the internal request envelope and the re-entrancy rule](#3--runtime-the-internal-request-envelope-and-the-re-entrancy-rule) | **Yes** | Small |
| 4 | [Config: an `agents:` section with named limit presets](#4--config-an-agents-section-with-named-limit-presets) | **Yes** | Small |
| 5 | [Aliases and the wiring test](#5--aliases-and-the-wiring-test) | **Yes** | Small |
| 6 | [Context: a live whole-project reference](#6--context-a-live-whole-project-reference) | No — enables a real use case | Medium |
| 7 | [Context: document the absent-means-everything convention](#7--context-document-the-absent-means-everything-convention) | No — doc | Small |
| 8 | [Knowledge: state that retrieval is current-only](#8--knowledge-state-that-retrieval-is-current-only) | No — doc | Small |
| 9 | [Request-level cancellation](#9--request-level-cancellation) | No — known gap | Large |
| 10 | [Confirmed: no change needed](#10--confirmed-no-change-needed) | — | — |

---

## 1 · Intelligence: a non-throwing bounded loop and an `onRound` hook

**Blocking, and the single most important item on this list.** Two changes to
the same function; land them together.

### 1a · The bound throws

`Intelligence.reasonWithToolsInternal` currently ends its loop with:

```ts
throw new Error(`Reasoning tool loop exceeded max rounds (${maxRounds})`);
```

A bare `Error` — no structured result, no partial output, and no usage figures
for the rounds it did run.

Derived Outputs tolerates this because its loop is one shot inside one refresh.
Agents cannot: a cycle that spends its round budget is an **ordinary** event
that must tell the model to decide with what it has, and it must be
distinguishable from a provider failure without matching on a message string.
The tokens spent still count against `maxTokensPerTask`, so losing them corrupts
a budget.

### 1b · There is no way to reach a model mid-work — except the loop we own

**This is the mechanism the entire steering design rests on**, so it is worth
stating the constraint precisely.

There is **no way to push into an in-flight completion.** Not in OpenRouter, not
in the provider APIs beneath it. Inference is request/response; streaming is
output-only (you can abort, not inject); and a model surfaces a turn to the
caller only by emitting tool calls. The only bidirectional surfaces anywhere are
the realtime/voice WebSocket APIs, which are not the reasoning-and-tools path
and are not proxied by OpenRouter.

But **the tool loop is ours**. Look at what it actually does:

```ts
while (rounds < maxRounds) {
  const response = await provider.reason(signal, { messages, tools: tools.definitions() });
  if (response.toolCalls.length === 0) return …;
  messages.push({ role: "assistant", content, toolCalls });
  for (const call of response.toolCalls) {
    const toolResult = await tools.execute(call);
    messages.push({ role: "tool", toolCallId: call.id, content: … });
  }
  // ← right here. Nothing stops us appending anything else.
}
```

Every round is a **fresh HTTP request with a longer message array**, made by us.
Between `tools.execute()` and the next `provider.reason()` we can append a
`user` turn carrying a steering message. Providers accept a user turn after tool
results — an ordinary multi-turn interleave.

So the injection point already exists, at every tool call, and **costs nothing
extra**, because the round trip was already being paid for.

**This decouples steering responsiveness from work granularity**, which is the
tension the whole Agents design was fighting. Cycles can be as large as a
strategy wants and a person's redirect still lands within one round.

### The change

```ts
interface ToolLoopOptions {
  /** Default "throw" — existing callers are unchanged. */
  readonly onBoundExceeded?: "throw" | "return";
  /**
   * Called after each round's tool results are appended, before the next
   * provider call. Return messages to inject, or "stop" to unwind cleanly.
   */
  readonly onRound?: (state: {
    readonly rounds: number;
    readonly calls: number;
    readonly usage: Usage;
  }) => Promise<readonly Message[] | "stop">;
}

reasonWithToolsStructured(signal, req, tools, schema, maxRounds, options?)
reasonWithTools(signal, req, tools, maxRounds, options?)
```

With `onBoundExceeded: "return"` the loop exits normally carrying
`{ structured: undefined, messages, toolResults, rounds, calls, usage,
exhausted: true }`. With `onRound` returning `"stop"`, it returns the same shape
with `stopped: true`.

Both are additive; existing callers keep current behaviour by default. Roughly
forty lines in `0-platform/intelligence/intelligence.ts`, plus the result type.

**Agents' `onRound` does four things**: injects new exchange messages, stops on
a pending approval, stops on cancellation, and stops when the token budget is
spent. See [execution.md](execution.md).

---

## 2 · Runtime: a third worker pool for agent work

**Blocking before any cycle runs concurrently with real traffic.**

`workerPool.concurrentWorkers` defaults to **4**, and every non-serial job in
the backend shares it: every document query, every Context read, every health
check.

That default is not arbitrary — it is sized for **synchronous SQLite**. With
`better-sqlite3`, store work blocks the thread, so extra workers do not buy
throughput; they add memory and contention. For the existing workload that is
defensible.

**Agent cycles are the opposite workload.** A cycle spends almost all of its
wall time blocked on a model response, doing nothing. Four is absurdly low for
that, and worse, ten active tasks would saturate the pool and **starve every
HTTP read in the backend**.

One pool cannot be right for both shapes.

### The change

A third array in `0-utils/jobs/scheduler.ts`, with the same admission logic,
capacity check, and logging as the existing two:

```ts
export type QueueType = "serial" | "concurrent" | "agent";

// config
workerPool: {
  concurrentWorkers: 4,     // unchanged — sized for synchronous SQLite
  agentWorkers: 16          // sized for network-bound model calls
}
queue: {
  serialMaxSize: 1000,
  concurrentMaxSize: 1000,
  agentMaxSize: 500
}
```

`agents.run.start` and `agents.cycle` declare `queueType: "agent"`. Nothing else
does.

**A third pool rather than a reservation.** Reserving a slice of
`concurrentWorkers` would give isolation but still force one number to serve
both bottlenecks. Separate pools let each be sized for what actually blocks it,
and it is the smaller change — one more array in a scheduler that already
manages two.

`GET /health/queues` should report all three, since it is the practical
debugging entry point.

**On a future Go service.** The loopback gateway makes that easier rather than
harder: agent work already travels as HTTP-shaped envelopes, so a separate
process calling the same endpoints is a small step rather than a rewrite.
Nothing here forecloses it, and nothing here should be designed around it yet.

---

## 3 · Runtime: the internal request envelope and the re-entrancy rule

**Blocking.** The gateway needs both.

### 3a · Constructing a `RequestEnvelope` without Fastify

`0-utils/types/request.ts` defines `RequestEnvelope` precisely so job wiring
never depends on Fastify, and `2-transport/registerHttpTransport.ts` is the only
thing that builds one today. The gateway needs to build one too, from
`(method, path, body)` plus a synthetic request id.

**Change.** An exported helper —
`buildInternalEnvelope(method, path, body, requestId)` — beside the type in
`0-utils/types/request.ts`, so transport and the gateway construct the same
shape from one place rather than two. Ten lines, and it removes the risk of the
two drifting.

Synthetic request ids carry a reserved prefix (`agent-internal:`) so a log
reader can tell a loopback call from an HTTP one, and no external caller can
forge one — the same technique Document uses with `$document-internal$:`.

### 3b · The re-entrancy rule, written down and tested

**A concurrent or agent job may enqueue a serial job. A serial job must never
await one.** The serial queue has exactly one active slot; a serial job awaiting
another serial job deadlocks the whole backend.

Nothing violates this today, because the only in-job dispatch is
`SchedulerInternalJobsRuntime.dispatch`, which deliberately returns at
**admission** rather than completion. The gateway is the first thing that will
await completion from inside a job.

**Change.** State the rule in `docs/runtime/dual-queue.md` (which becomes a
triple queue) and add an architectural regression test in the style of the
existing `runtime-wiring` greps. Agents' own compliance — every cycle on the
agent pool — is tested on its side; this is the general statement so the next
capability wanting loopback dispatch does not rediscover it.

---

## 4 · Config: an `agents:` section with named limit presets

**Blocking.** `AgentLimits` defaults have to live somewhere.

`configuration.yaml` is the stated home for "all backend tuning values and other
runtime magic numbers", and `AgentLimits` is exactly that. Persona and Comments
keep their limits in `domain/validation.ts` because theirs are *content-shape*
rules (`maxSectionChars`); that precedent does not transfer to cost controls.

**Unlike every other section, this one is a map of named presets:**

```yaml
agents:
  defaultLimits: standard
  defaultStrategy: { name: simple-loop, version: "1" }
  limits:
    quick:
      maxCyclesPerRun: 20
      maxToolRoundsPerCycle: 12
      maxReadsPerCycle: 30
      maxMutationsPerTask: 20
      maxQueueDepth: 100
      maxRunsPerTask: 5
      maxTokensPerTask: 1_000_000
      steerCheckRounds: 1
    standard:  { maxCyclesPerRun: 200, … maxTokensPerTask: 10_000_000, … }
    thorough:  { maxCyclesPerRun: 800, … maxTokensPerTask: 50_000_000, … }
```

A caller names a preset and may override individual fields; resolution happens
at task creation and the resolved set is **frozen onto the task**, so editing a
preset never changes a task in flight.

This is a new shape for `loadBackendConfig.ts`, which today parses flat typed
sections. The parser must validate each preset independently against the same
field schema, and `defaultLimits` must name a preset that exists — a mismatch is
a **startup error**, not a runtime surprise. Same for `defaultStrategy` against
the strategy registry.

**Why presets rather than seventeen top-level numbers.** These bounds move
together. "Be thorough" is a longer loop, more mutations, and more tokens at
once; a `maxCyclesPerRun` of 800 with a `maxTokensPerTask` of 1M is a task that
always dies for a reason nobody can act on.

While there: `etc/README.md` documents 4 of 13 sections. Adding a 14th makes
that gap worse, and review 001 (finding 4b) recommended the transcription
alongside any config change. This is that change.

---

## 5 · Aliases and the wiring test

**Blocking.** A missing alias only fails at runtime, in the built output.

```json
"#agents":   { "development": "./src/3-capabilities/agents/index.ts",
               "types":       "./src/3-capabilities/agents/index.ts",
               "default":     "./dist/3-capabilities/agents/index.js" },
"#agents/*": { "development": "./src/3-capabilities/agents/*",
               "types":       "./src/3-capabilities/agents/*",
               "default":     "./dist/3-capabilities/agents/*" }
```

In `apps/backend/package.json` `imports` and mirrored in `tsconfig.json`
`paths`. Add `#agents` to the alias assertion in `runtime-wiring.test.ts`, which
exists because this class of mistake is invisible until production.

---

## 6 · Context: a live whole-project reference

**Not blocking, but it is what makes scopes useful across a changing project.**

Today a Context is a **frozen enumeration**. Persona's own `invariants.md` says
so:

> "The whole project except X" is expressible only by enumerating the project at
> compose time, so a document added tomorrow will not appear in it.
> `resolveScope([])` does mean live whole-project, but `[] minus X` cannot be
> expressed.

| Expression | Live? | How |
| --- | --- | --- |
| whole project | **yes** | absent / empty scope, resolved at pin time |
| whole project minus X | no | `POST /contexts/difference` over an enumeration |
| a named set | no | enumeration |

**What is wanted:** a Context that resolves to current project contents at
resolution time, so `project − X` stays correct as the project grows.

- **(a) A `kind: "project"` entry.** A `ContextEntry` whose `kind` is `project`
  expands at resolve time to every current source. `combine`/`difference` then
  work over it, and `project − X` becomes expressible and stays live.
- **(b) A live-composition record.** A Context storing its *operation*
  (`difference(project, X)`) rather than its result. More general, more
  machinery, and cycles need a guard the existing `maxResolveDepth` sketches.

**(a) is the smaller change and covers the case that hurts.** It also removes
Agents' need to special-case an absent entry: a caller can write `project`
explicitly and mean it.

### The constraint Agents places on this

**An agent task must pin an exact resource set.** Whatever a live Context
resolves to at pin time is what the task sees for its whole life — resolved once
by the first run, frozen into `scope_json`. A live Context that grew afterwards
does not grow the task.

That must survive whatever shape (a) or (b) takes:
`knowledge.resolveScope` must always return a concrete `resolvedSourceIds` list,
never a lazy reference. It does today. **The manifest must remain the point
where "live" becomes "fixed".**

---

## 7 · Context: document the absent-means-everything convention

**Not blocking. A documentation and naming risk, not a defect.**

```ts
resolveScope(undefined)  → null       // unscoped; no restriction applied
resolveScope([])         → manifest   // THE WHOLE PROJECT, snapshotted
resolveScope([X])        → manifest   // only X
```

The middle one is a trap: it reads like "nothing" and means "everything", and
the failure when someone gets it wrong is **silent narrowing** — append one
entry to an empty scope and a task that could see the whole project now sees
one context. Agents has an explicit guard (`scopeEntriesFor`), and Persona's
`flows.md` documents it under "The empty-scope trap", but the convention itself
lives only in a code comment in `knowledge.ts`.

**Change.** State it in `0-platform/knowledge/docs/concepts.md` and
`invariants.md` as a named rule, with the narrowing failure spelled out. Every
future consumer will hit this.

**Agents' own surface avoids the ambiguity** by taking at most one optional
entry: absent means the whole project, and there is no empty array to misread.
Worth keeping as the pattern for new capabilities.

---

## 8 · Knowledge: state that retrieval is current-only

**Not blocking. Documentation of existing, correct behaviour.**

A scope manifest pins **membership, not content**. `resolvedSourceIds` is fixed
at pin time; the windows behind those sources are whatever Knowledge holds when
a retrieval runs. A Connector sync or a General File replacement mid-task
changes what comes back.

**This is accepted and expected.** An agent working on live project material
should see live project material, and there is no revision-qualified search.
Derived Outputs' generation fence is right for a one-shot refresh and wrong for
a task that may run for an hour, where the user cannot act on the failure.

**Change.** Say so in `0-platform/knowledge/docs/invariants.md`: the manifest
freezes *which sources are admissible*, never *what they contain*, and there is
no mechanism to retrieve against a historical revision. Both halves are things a
reader will otherwise assume the opposite of.

---

## 9 · Request-level cancellation

**Not blocking. A known runtime gap Agents makes visible.**

- `JobDefinition` carries no `AbortSignal`.
- `Intelligence`'s methods accept a `signal` and every caller passes
  `undefined`.
- `knowledge/embedder.ts`: *"AbortSignal is undefined for now — wire it through
  when request-level cancellation is added."*
- `docs/runtime/repository-boundaries.md` still shows `execute(signal?:
  AbortSignal)`, which review 001 flagged as describing a target rather than
  current behaviour.

**Consequence for Agents:** cancel unwinds at a **tool round boundary**, not
instantly. For a tool-using turn that is seconds; for a turn making no tool
calls it is one full completion.

Survivable, and the design says so plainly. If it becomes the complaint, the fix
is threading an `AbortSignal` through `JobDefinition` → capability →
`Intelligence` → provider — a runtime-wide change, not something Agents can
solve locally. Tracked here so the first person to hit it finds the analysis.

---

## 10 · Confirmed: no change needed

Verified against source, listed so nobody goes looking.

**Persona.** `revision` already exists, starts at 1, increments per accepted
update; the built-in is revision 0. `PersonaSnapshot` already carries
`revision`, `sections`, and the rendered `prompt`. `(personaId, revision,
sections)` fully determines the prompt, so Agents pins by revision and stores
the snapshot verbatim. **Both digests stay where they are and Agents indexes
neither** — they answer finer questions than "which version ran".

**Activity.** `ActivityOrigin` already includes `agent`. The publisher contract
is the existing local-outbox pattern: allocate a stable `sourceTransactionId`
with the committed work, pass it as `idempotencyKey`, and Activity derives
`act_<sha256(...)>`. Comments' `CommentActivityPublisher` is a one-method port
Agents copies exactly.

**Document, Comments, Templates.** Nothing. All three already accept
`{ requestId, origin, actorId, command }` and are idempotent by caller-supplied
request id — the only requirement Agents places on a mutating target. This is
the payoff from the loopback gateway: no adapter, no new store method, no new
index. An earlier draft required every target to implement
`lookup(requestDigest)`; dropped after verifying no digest index exists anywhere
in the tree and that a re-dispatch under the same request id replays correctly
through the receipt each target already has.

**`JobRegistry` / `JobScheduler`.** `listEndpoints()`, `createJob(envelope)`,
and `admit(job)` all exist and are sufficient. `admit` already splits admission
from completion, which is what the gateway needs.

**`ToolSet`.** Rejects duplicate tool names at construction and never lets a
handler exception escape — it returns `{ ok: false, error: { code:
"tool_failed" } }`. Agents' handlers return typed refusals deliberately rather
than throwing, so the model sees *why*, but the safety net underneath is already
correct.
