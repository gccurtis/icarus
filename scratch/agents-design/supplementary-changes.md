# Agents — supplementary changes

Changes **outside** `3-capabilities/agents/` that the Agents design depends on,
or that it makes newly worth doing.

The design deliberately places almost nothing on other capabilities — the
loopback gateway means Document, Derived Outputs, and every future target need
**zero changes** to become agent-reachable. What remains is a short list, and it
is short on purpose.

When any of these is scheduled, it should move into `scratch/0-general-updates.md`,
which is the standing home for cross-capability work.

| # | Change | Blocking? | Size |
| --- | --- | --- | --- |
| 1 | [Intelligence: non-throwing bounded tool loop](#1--intelligence-non-throwing-bounded-tool-loop) | **Yes** | ~15 lines |
| 2 | [Context: a live whole-project reference](#2--context-a-live-whole-project-reference) | No — enables a real use case | Medium |
| 3 | [Context: document the absent-means-everything convention](#3--context-document-the-absent-means-everything-convention) | No — doc | Small |
| 4 | [Knowledge: state that retrieval is current-only](#4--knowledge-state-that-retrieval-is-current-only) | No — doc | Small |
| 5 | [Runtime: the internal request envelope and the re-entrancy rule](#5--runtime-the-internal-request-envelope-and-the-re-entrancy-rule) | **Yes** | Small |
| 6 | [Config: an `agents:` section with named limit presets](#6--config-an-agents-section-with-named-limit-presets) | **Yes** | Small |
| 7 | [Aliases and the wiring test](#7--aliases-and-the-wiring-test) | **Yes** | Small |
| 8 | [Request-level cancellation](#8--request-level-cancellation) | No — known gap | Large |
| 9 | [Confirmed: no change needed](#9--confirmed-no-change-needed) | — | — |

---

## 1 · Intelligence: non-throwing bounded tool loop

**Blocking.** `maxReadToolRoundsPerUnit` means nothing without it.

`Intelligence.reasonWithToolsInternal` currently ends its loop with:

```ts
throw new Error(`Reasoning tool loop exceeded max rounds (${maxRounds})`);
```

A bare `Error` — no structured decision, no partial result, and no usage figures
for the rounds it did run.

Derived Outputs tolerates this because its tool loop is one shot inside one
refresh; a throw there fails the refresh, which is the right outcome. Agents
cannot: a sequence unit that spends its read budget is an **ordinary** event that
must produce a `system` message telling the model to decide with what it has,
and it must be distinguishable from a provider failure without matching on a
message string. The tokens spent inside the aborted loop also still count
against `maxTokensPerTask`, so losing the usage figures corrupts a budget.

**Change.** `reasonWithToolsStructured` and `reasonWithTools` gain an option:

```ts
reasonWithToolsStructured(signal, req, tools, schema, maxRounds, {
  onBoundExceeded: "throw" | "return"    // default "throw" — existing callers unchanged
})
```

With `"return"`, the loop exits normally and the result carries:

```ts
{ structured: undefined, messages, toolResults, rounds, calls, usage, exhausted: true }
```

Existing callers keep the current behaviour by default, so this is additive.
Roughly fifteen lines in `0-platform/intelligence/intelligence.ts`, plus the
result type.

**Why it is worth doing properly rather than catching the throw.** Catching
works, but the usage accounting is lost and "budget exhausted" becomes
indistinguishable from "provider failed" without matching a message string. Both
matter here, and the fix makes the bound honest for every future caller.

---

## 2 · Context: a live whole-project reference

**Not blocking, but it is what makes personas useful across a changing project.**

Today, a Context is a **frozen enumeration**. Persona's own `invariants.md`
states this plainly:

> "The whole project except X" is expressible only by enumerating the project at
> compose time, so a document added tomorrow will not appear in it.
> `resolveScope([])` does mean live whole-project, but `[] minus X` cannot be
> expressed.

So there are two kinds of "everything" and only one of them is live:

| Expression | Live? | How |
| --- | --- | --- |
| whole project | **yes** | absent / empty scope, resolved at pin time |
| whole project minus X | no | `POST /contexts/difference` over an enumeration |
| a named set | no | enumeration |

**What is wanted:** a Context that resolves to the current project contents at
resolution time, so `project − X` stays correct as the project grows. Two shapes
worth considering:

- **(a) A `kind: "project"` entry.** A `ContextEntry` whose `kind` is `project`
  expands, at resolve time, to every current source. `combine`/`difference` then
  work over it, and `project − X` becomes expressible and stays live.
- **(b) A live-composition record.** A Context that stores its *operation*
  (`difference(project, X)`) rather than its result, and evaluates on resolve.
  More general; more machinery, and cycles need a guard the existing
  `maxResolveDepth` already sketches.

**(a) is the smaller change and covers the case that actually hurts.** It also
removes the need for Agents to special-case an absent entry: the caller can
write `project` explicitly and mean it.

### The constraint Agents places on this

**An agent task must pin an exact resource set.** Whatever a live Context
resolves to at pin time is what the task sees for its whole life — it is
resolved once by the first run and frozen into `scope_json`. A live Context that
grew afterwards does not grow the task.

That is deliberate and must survive whatever shape (a) or (b) takes:
`knowledge.resolveScope` must always return a concrete `resolvedSourceIds` list,
never a lazy reference. It does today. If a live Context is added, the manifest
must still be the point where "live" becomes "fixed".

---

## 3 · Context: document the absent-means-everything convention

**Not blocking. It is a documentation and naming risk, not a defect.**

`Knowledge.resolveScope` has three behaviours and they are easy to confuse:

```ts
resolveScope(undefined)  → null       // unscoped; no restriction is applied
resolveScope([])         → manifest   // THE WHOLE PROJECT, snapshotted
resolveScope([X])        → manifest   // only X
```

The middle one is a real trap. It reads like "nothing" and means "everything",
and the failure when someone gets it wrong is **silent narrowing**: append one
entry to an empty scope and a task that could see the whole project now sees one
context. Agents has an explicit guard for exactly this
(`scopeEntriesFor`), and Persona's `flows.md` documents it under "The empty-scope
trap" — but the convention itself is stated only in a code comment in
`knowledge.ts`.

**Change.** State it in `0-platform/knowledge/docs/concepts.md` and
`invariants.md` as a named rule, with the narrowing failure spelled out. Every
future consumer will hit this.

**Agents' own surface avoids the ambiguity** by taking at most one optional
entry: `contextEntry` absent means the whole project, and there is no empty
array to misread. That is worth keeping as the pattern for new capabilities.

---

## 4 · Knowledge: state that retrieval is current-only

**Not blocking. Documentation of an existing, correct behaviour.**

A scope manifest pins **membership, not content**. `resolvedSourceIds` is fixed
at pin time; the windows behind those sources are whatever Knowledge holds when
a retrieval runs. A Connector sync or a General File replacement mid-task
changes what comes back.

**This is accepted and expected.** An agent working on live project material
should see live project material, and there is no revision-qualified search:
`knowledge.retrieve` is always against current content. The alternative —
Derived Outputs' generation fence, which refuses to publish across a corpus
change — is right for a one-shot refresh and wrong for a task that may run for
an hour, where the user cannot act on the failure.

**Change.** Say so in `0-platform/knowledge/docs/invariants.md`: the manifest
freezes *which sources are admissible*, never *what they contain*, and there is
no mechanism to retrieve against a historical revision. Both halves are things a
reader will otherwise assume the opposite of.

---

## 5 · Runtime: the internal request envelope and the re-entrancy rule

**Blocking.** The gateway needs both.

### 5a · Constructing a `RequestEnvelope` without Fastify

`0-utils/types/request.ts` defines `RequestEnvelope` precisely so job wiring
never depends on Fastify, and `2-transport/registerHttpTransport.ts` is currently
the only thing that builds one. The gateway needs to build one too, from
`(method, path, body)` plus a synthetic request id.

**Change.** A small exported helper — `buildInternalEnvelope(method, path, body,
requestId)` — beside the type in `0-utils/types/request.ts`, so transport and the
gateway construct the same shape from one place rather than two. Ten lines, and
it removes the risk of the two drifting.

Synthetic request ids should carry a reserved prefix (`agent-internal:`) so a
log reader can tell a loopback call from an HTTP one, and so no external caller
can forge one — the same technique Document uses with `$document-internal$:`.

### 5b · The re-entrancy rule, written down and tested

**A concurrent job may enqueue a serial job. A serial job must never await
one.** The serial queue has exactly one active slot; a serial job awaiting
another serial job deadlocks the whole backend.

Nothing violates this today because nothing dispatches jobs from inside a job
except `SchedulerInternalJobsRuntime.dispatch`, which deliberately returns at
**admission** rather than completion. The gateway is the first thing that will
await completion from inside a job.

**Change.** State the rule in `docs/runtime/dual-queue.md` and add an
architectural regression test in the style of the existing `runtime-wiring`
greps. Agents' own compliance — every gateway-calling work unit is concurrent —
is tested on its side; this is the general statement so the next capability that
wants loopback dispatch does not have to rediscover it.

---

## 6 · Config: an `agents:` section with named limit presets

**Blocking.** `AgentLimits` defaults have to live somewhere.

`apps/backend/etc/configuration.yaml` is the stated home for "all backend tuning
values and other runtime magic numbers", and `AgentLimits` is exactly that —
`maxTokensPerTask` and `maxRunsPerTask` are operational cost controls, not
content-shape rules. Persona and Comments keep their limits in
`domain/validation.ts` because theirs *are* content-shape rules
(`maxSectionChars`); that precedent does not transfer.

**Change.** A typed `agents:` section in `configuration.yaml`, a matching parser
and `DEFAULT_CONFIG` entry in `0-utils/config/loadBackendConfig.ts`, and a row
in `apps/backend/etc/README.md`.

**Unlike every other section, this one is a map of named presets rather than a
flat block:**

```yaml
agents:
  defaultLimits: standard
  limits:
    quick:    { maxGoalDepth: 3, maxUnitsPerRun: 60,   maxMutationsPerTask: 20,  … }
    standard: { maxGoalDepth: 6, maxUnitsPerRun: 500,  maxMutationsPerTask: 200, … }
    thorough: { maxGoalDepth: 8, maxUnitsPerRun: 2000, maxMutationsPerTask: 800, … }
```

A caller names a preset and may override individual fields; resolution happens
at task creation and the resolved set is frozen onto the task, so editing a
preset never changes a task already in flight.

This is a new shape for the loader, which today parses flat typed sections. The
parser needs to validate each preset independently against the same field
schema, and `defaultLimits` must name a preset that exists — a mismatch is a
startup error, not a runtime surprise.

**Why presets rather than seventeen top-level numbers.** These bounds move
together. "Be thorough" is not one knob; it is a deeper tree, more units, more
mutations, and more read rounds at once. Asking a caller to keep seventeen
numbers mutually consistent is asking for incoherent configurations — a
`maxGoalDepth` of 8 with a `maxUnitsPerRun` of 60 is a task that always settles
`partial` for a reason nobody can act on.

While there: `etc/README.md` currently documents 4 of 13 sections. Adding a
14th makes that gap slightly worse, and the review that flagged it
(`docs/claude-notes/review/001`, finding 4b) recommended doing the transcription
alongside any config change. This is that change.

---

## 7 · Aliases and the wiring test

**Blocking.** A missing alias only fails at runtime, in the built output.

**Change.** Add to `apps/backend/package.json` `imports` and mirror in
`tsconfig.json` `paths`:

```json
"#agents":   { "development": "./src/3-capabilities/agents/index.ts",
               "types":       "./src/3-capabilities/agents/index.ts",
               "default":     "./dist/3-capabilities/agents/index.js" },
"#agents/*": { "development": "./src/3-capabilities/agents/*",
               "types":       "./src/3-capabilities/agents/*",
               "default":     "./dist/3-capabilities/agents/*" }
```

Both need all three conditions, so dev and tests select source deliberately
rather than loading a stale `dist`. Add `#agents` to the alias assertion in
`runtime-wiring.test.ts`, which exists because this class of mistake is
invisible until production.

---

## 8 · Request-level cancellation

**Not blocking. A known runtime gap that Agents makes visible.**

There is no cancellation primitive anywhere in the runtime:

- `JobDefinition` carries no `AbortSignal`.
- `Intelligence`'s methods accept a `signal` parameter and every caller passes
  `undefined`.
- `knowledge/embedder.ts` carries the standing comment *"AbortSignal is
  undefined for now — wire it through when request-level cancellation is
  added."*
- `docs/runtime/repository-boundaries.md` still shows a `JobDefinition` with
  `execute(signal?: AbortSignal)`, which review 001 (finding 4c) flagged as
  describing a target rather than current behaviour.

**Consequence for Agents:** steer and cancel latency is **one work unit**. For a
read or a mutation that is fast. For a plan or verify unit it is one model call
— which is the number a user clicking "stop" will complain about.

This is survivable and the design says so plainly rather than pretending
otherwise. If it becomes the complaint, the fix is threading an `AbortSignal`
through `JobDefinition` → capability → `Intelligence` → provider, which is a
runtime-wide change and not something Agents can solve locally.

Worth tracking here so the first person to hit it finds the analysis rather than
re-deriving it.

---

## 9 · Confirmed: no change needed

Verified against source, listed so nobody goes looking.

**Persona.** `revision` already exists, starts at 1, increments by exactly one
per accepted update, and the built-in is revision 0. `PersonaSnapshot` already
carries `revision`, `sections`, and the rendered `prompt`. `(personaId,
revision, sections)` fully determines the prompt a task received, so Agents pins
by revision and stores the snapshot verbatim. **The two digests
(`definitionDigest`, `promptDigest`) stay where they are and Agents indexes
neither** — they answer finer questions than "which version ran", and revision
is the granularity the historical model already provides.

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
`lookup(requestDigest)`; that was dropped after verifying no digest index exists
anywhere in the tree and that a re-dispatch under the same request id replays
correctly through the receipt each target already has.

**`JobRegistry` / `JobScheduler`.** `listEndpoints()`, `createJob(envelope)`,
and `admit(job)` all exist and are sufficient. `admit` in particular already
splits admission from completion, which is what the gateway needs.
