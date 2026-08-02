# Agents — file architecture

Module layout, dependency direction, and composition order.

Agents uses the **layered** capability shape (`domain/`, `application/`,
`ports/`, `persistence/`, `wire/`, `projections/`) with `camelCase` filenames,
matching Document, Activity, Comments, Templates, and Persona. The flat shape
used by Context, Structured Data, and Derived Outputs does not fit: this
capability has a state machine, a decomposition tree, an execution loop, and a
wire decoder, and those want file boundaries rather than section dividers.

**Persona is the closest model to copy**, being the most recently built
capability and the one whose surface Agents consumes.

## Layout

```text
apps/backend/src/
  3-capabilities/agents/
    domain/
      model.ts             AgentTask, AgentGoal, AgentRun, AgentWorkUnit,
                           AgentMessage, AgentQuestion, AgentApproval, AgentToolCall
      state.ts             pure task/run/unit/goal transitions; the derived
                           active-goal traversal; total switches
      decision.ts          the three decision unions + their output schemas
      prompts.ts           DECOMPOSE_V1 / SEQUENCE_V1 / VERIFY_V1 / SETTLE_V1
      policy.ts            pure policy evaluation — call → allow|approve|reject
      limits.ts            preset resolution: named set + overrides → AgentLimits
      canonical.ts         canonical request digest (own copy, not shared)
      errors.ts            one class per failure mode
    application/
      agentTaskService.ts    commands: create, steer, answer, approve, cancel
      agentRunner.ts         run start, scope pin, the boundary check, the traversal
      agentDecomposeUnit.ts  decompose units — model call, child goal writes
      agentSequenceUnit.ts   sequence units — observe, then queue act units
      agentActUnit.ts        act units — policy, commit, dispatch, settle
      agentVerifyUnit.ts     verify units — re-observe, met|not-met|pending
      agentSettlement.ts     run settlement and task settlement under CAS
      agentRecovery.ts       the reconciliation sweep
      agentReader.ts         queries and projections
    ports/
      agentStore.ts        the store interface (Promise-returning)
      endpointGateway.ts   AgentEndpointGateway, AgentEndpointDescriptor
      activityPublisher.ts narrow source-side Activity port; one method
    persistence/
      sqliteAgentStore.ts
      sqliteSchema.ts
    tools/
      knowledgeTools.ts    knowledge_retrieve / knowledge_read ToolSet bindings
      endpointTools.ts     policy-permitted descriptors → ToolBinding[]
    wire/
      commandSchemas.ts    decodeAgentCommand
      querySchemas.ts      decodeAgentQuery
      valueSchemas.ts      requireIdentifier / requireEnum / exactKeys / …
      common.ts            shared field helpers
    projections/
      projectTaskSummary.ts
      projectGoalTree.ts
      projectAttentionQueue.ts
    index.ts               barrel — see below
    docs/                  README, concepts, types, runtime, flows, invariants

  4-job-wiring/agents/
    registerAgentEndpoints.ts     POST /agents/command, POST /agents/query
    createAgentJobs.ts            intent → queue, total switch, no default
    agentEndpointCatalogue.ts     the declared descriptors — the opt-in gate

  1-init/create/
    agents.ts                     createAgentsInstance(config, logger, deps)
    agentEndpointGateway.ts       implements the gateway over registry + scheduler
```

Note what is **not** here: no `targets/` directory, no per-capability adapter, no
`AgentTargetRegistry`. Agents reaches every capability through one gateway over
the existing job registry. See [tools.md](tools.md).

## Dependency direction

```text
wire ──────► domain
              ▲
application ──┘──► ports ──► (persistence implements)
     │
     ├──► #persona                    resolve() — at creation only
     ├──► #platform/knowledge         resolveScope, retrieve, read
     ├──► #platform/intelligence      reasonWithToolsStructured, ToolSet
     ├──► #platform/observability     Logger
     ├──► ports/activityPublisher     satisfied by an adapter built in 1-init
     └──► ports/endpointGateway       satisfied by an adapter built in 1-init
```

The rules that matter:

- **`domain/` imports nothing from the capability's other layers** and nothing
  from other capabilities except types. `state.ts`, `policy.ts`, and
  `decision.ts` are pure functions over values, which is what makes the state
  machine, the policy check, and decision validation testable without a database
  or a model.
- **Agents never imports another capability's module.** Document, Derived
  Outputs, and every other target are reached only through the gateway, by
  endpoint key. Grep for `#document` or `#derived-outputs` inside
  `3-capabilities/agents/` should return nothing; that is an architectural
  regression test.
- **The only capability type Agents imports is `ContextEntry`**, which Context
  re-exports from `0-platform/knowledge/types.ts` — the one deliberate
  inversion the codebase already documents. Persona does the same.
- **`application/` is the only layer that touches ports.** `wire/` decodes into
  domain values and hands them over.
- **Persona is a creation-time dependency only.** `personas.resolve` is called
  once in `agentTaskService.create`. No other file imports `#persona`, because
  every later use reads the frozen snapshot off the task. That single call site
  is what enforces Persona's first consumer law ("resolve once per task"), and
  it is worth an architectural regression test.

## The endpoint gateway

The gateway is the seam that lets Agents reach every capability without
depending on any of them. It lives in `1-init` because it needs the concrete
`JobRegistry` and `JobScheduler`, and neither the capability nor job wiring may
hold both.

```ts
// 1-init/create/agentEndpointGateway.ts
export const createAgentEndpointGateway = (
  registry: JobRegistry,
  scheduler: JobScheduler,
  descriptors: readonly AgentEndpointDescriptor[],
  logger: Logger
): AgentEndpointGateway => ({
  catalogue: () => descriptors,
  call: async (input) => {
    const descriptor = byKey.get(input.endpointKey);
    if (!descriptor) throw new AgentPolicyError(`unknown endpoint ${input.endpointKey}`);

    // The model never supplies these. A model that could claim origin "user"
    // would launder its own changes; one that could choose its own requestId
    // could collide with another task's receipt.
    const body = withAgentEnvelope(input.body, input.requestId, input.actor);

    const envelope = buildInternalEnvelope(descriptor, body);
    const job = registry.createJob(envelope);
    const admission = scheduler.admit(job);
    const result = await admission.completion;
    return {
      ok: result.response.statusCode < 400,
      statusCode: result.response.statusCode,
      body: result.response.body
    };
  }
});
```

This is the transport path minus Fastify. Every safety property comes from the
path already being correct: the target runs its own wire decoder, chooses its
own queue, maps its own errors, and applies its own receipt-based idempotency.

**Startup validates the catalogue against the registry.** A descriptor naming an
endpoint key that no capability registered is a fatal startup error, not a
first-use surprise, and it is logged as `agents.catalogue.validated`.

### The re-entrancy rule

**A concurrent job may enqueue a serial job. A serial job must never await
one.** The serial queue has a single active slot; a serial job awaiting another
serial job deadlocks the whole backend.

Every work unit that calls the gateway runs on the **concurrent** queue. That is
not incidental — it is the constraint that makes loopback dispatch safe, and it
is why `agents.work.act` is concurrent even though the command it triggers is
serial. `agents.run.settle` and `agents.task.settle` are serial and touch only
Agents' own store; they never call the gateway.

There is an architectural regression test asserting no serial agent intent
reaches `gateway.call`.

## The barrel

`index.ts` is the boundary, and what it exports is the complete public surface.
Following `persona/index.ts`:

```ts
export { createAgentsCapability } from "./application/agentTaskService.js";
export type { AgentsCapability, AgentDependencies, AgentClock }
  from "./application/agentTaskService.js";
export * from "./domain/model.js";     // canonical types, commands, queries
export * from "./domain/errors.js";    // job wiring maps these to status codes
export { digestAgentRequest } from "./domain/canonical.js";
export { evaluatePolicy } from "./domain/policy.js";
export type { AgentStore } from "./ports/agentStore.js";
export type { AgentEndpointGateway, AgentEndpointDescriptor, AgentEndpointCall,
              AgentEndpointOutcome } from "./ports/endpointGateway.js";
export type { AgentActivityPublisher } from "./ports/activityPublisher.js";
export { SQLiteAgentStore } from "./persistence/sqliteAgentStore.js";
export { decodeAgentCommand } from "./wire/commandSchemas.js";
export { decodeAgentQuery } from "./wire/querySchemas.js";
```

What leaks deliberately: **error classes** (wiring maps them), **wire decoders**
(wiring calls them), **the SQLite store class** (`1-init` constructs it), and the
**gateway and descriptor types** (job wiring declares the catalogue, `1-init`
implements the gateway). What does not: the service class, the runner, the unit
executors, the store adapter's internals, and the transcript.

## `wire/` file names

The house layout is `commandSchemas.ts` / `querySchemas.ts` / `valueSchemas.ts`
(plus `common.ts` for shared field helpers), each exporting a `decode<Thing>`
function — Document, Persona, Comments, and Templates all use it. Files are
named for what they hold, not for the function they export.

`exactKeys(record, allowed, label)` is the load-bearing helper: it rejects
**unknown** keys, not just missing ones, so a client typo is a 400 rather than a
silently ignored field. `expectedRevision` must be decoded with a genuine
non-negative-integer check, never `Number(body.x)` — coercing a missing value
yields `NaN`, which compares unequal to every stored revision and surfaces a
malformed request as `409 revision_conflict`. A client implementing
retry-on-409 would then retry forever. Persona has a regression test for exactly
this and Agents should copy it.

## Composition

```ts
// 1-init/startBackend.ts, in order

// …existing capability construction, including every endpoint registration…
registerDocumentEndpoints(registry, document, logger);
registerDerivedOutputEndpoints(registry, derivedOutputs, logger);
// …

// Agents last: the gateway needs a fully populated registry.
const agentGateway = createAgentEndpointGateway(
  registry,
  scheduler,
  AGENT_ENDPOINT_CATALOGUE,        // declared in 4-job-wiring/agents/
  logger
);

const agentInternalJobs = new SchedulerInternalJobsRuntime<AgentInternalJobIntent>(scheduler);
const agents = createAgentsInstance(config, logger, {
  personas,
  knowledge,
  intelligence,
  gateway: agentGateway,
  activityPublisher: createAgentActivityPublisher(activity),
  internalJobs: agentInternalJobs      // dispatch face
});

registerAgentEndpoints(registry, agents, logger);
createAgentJobs(agentInternalJobs, agents);   // registrar face

// Bound into the shared sweep alongside every other persisted capability.
// purgeExpired is a deliberate no-op; pruneHistory sweeps failed-task transcripts.
bindResourceRetentionPort("agents", agents)

// Before app.listen, with the other recovery calls:
const recoveredAgentTasks = await agents.recoverPendingTasks();
logger.info("agents.tasks.recovered", { count: recoveredAgentTasks });
const recoveredAgentActivity = await agents.publishPendingActivity();
logger.info("agents.activity.recovered", { count: recoveredAgentActivity });
```

**Agents is constructed after every other endpoint registration**, because the
gateway validates its catalogue against the registry at construction. That is
the one ordering constraint the composition root gains, and it is load-bearing
enough to deserve a comment in `startBackend.ts` alongside the existing ones.

`createAgentActivityPublisher(activity)` is the translation seam, built here for
the same reason `createDocumentActivityPublisher` is: neither capability knows
the other's vocabulary, and the adapter maps between them.

**Recovery runs before `app.listen`, awaited**, alongside
`document.recoverPendingAttempts()` — not after it like the connector sync
scheduler. The two rules are different and easy to conflate: recovery goes
*before* binding so no request can race a half-recovered task, while recurring
*timers* go after binding so a failed listen is not kept alive by them. Agents
has no timers at all, so only the first rule applies.

## Aliases

| alias | target |
| --- | --- |
| `#agents` | `3-capabilities/agents/index.ts` |
| `#agents/*` | `3-capabilities/agents/*` |

Both need explicit `development`, `types`, and compiled `default` conditions, so
dev and tests select source deliberately rather than loading a stale `dist`.
`runtime-wiring.test.ts` already asserts specific aliases exist, because a
missing one only fails at runtime in the built output — add `#agents` to it.

## Documentation

A six-file `docs/` package beside the code, matching the modules that already
carry one: `README.md`, `concepts.md`, `types.md`, `runtime.md`, `flows.md`,
`invariants.md`.

`README.md` opens with the two sections that make these pages worth reading:

- **Status and authority** — what is implemented, what is not, and which older
  design page must *not* be read as describing current behaviour. For Agents
  that list includes `docs/capabilities-old/agents.md` and, once built, this
  scratch directory.
- **Implementation map** — a concern → file table, which is the fastest way to
  find the right file in an unfamiliar capability.

Persona's `docs/README.md` is the closest model, including its "Deliberate
deviations, so they are not rediscovered as bugs" section. Agents has several
worth recording there: no history table, no delete, `purgeExpired` returning a
constant zero, `approval` defaulting to `"never"`, and the loopback gateway
instead of per-capability adapters.

## Tests

One file per layer, matching the existing `document-domain` /
`document-application` / `document-persistence` / `document-wire` split, plus a
wiring test — Persona, Comments, Templates, and Activity each have one.

| File | Covers |
| --- | --- |
| `agents-domain.test.ts` | state transitions, the derived active-goal traversal, decomposition bounds, policy evaluation, decision validation, limit-preset resolution, digests |
| `agents-application.test.ts` | create/freeze, scope pinning, the boundary check, steering supersession and re-sequencing, verify `pending` backoff, unit idempotency, settlement CAS, recovery branches |
| `agents-persistence.test.ts` | seq contiguity, unique constraints, partial indexes, the scope-column CHECK, outbox |
| `agents-wire.test.ts` | command/query decoding, `exactKeys` rejection, error → code mapping |
| `agents-wiring.test.ts` | a real transport + registry + scheduler driving both endpoints, gateway loopback against a real registered endpoint, queue placement, the error ladder |

The cases most worth writing first, because they are the ones that are painful
to discover later:

- a duplicate continuation for `(runId, unitSeq)` does the work once;
- **the derived active goal is the deepest, leftmost unfinished node**, and a
  goal with children gets a verify while a goal without gets a decompose or a
  sequence;
- a parent whose children all succeeded can still fail its own verify;
- **steering supersedes the queued act units, keeps their rationales, feeds them
  to the replacement sequence unit, and does not end the run**;
- a steering `escalate` moves the cursor to the parent and decomposes there;
- a mutation steered *before* dispatch leaves nothing behind; one steered
  *after* dispatch is recorded as committed and becomes the next sequence's
  starting state;
- a verify returning `pending` re-dispatches the same verify on a backoff and
  does **not** re-issue the mutation;
- decomposition at `maxGoalDepth` cannot emit a `decompose` decision;
- `maxConsecutivePlanningUnits` forces an action or blocks the goal;
- a restart mid-sequence resumes the remaining queued act units without
  re-planning them;
- an act unit left `dispatched` is found by recovery, re-dispatched under the
  same `requestId`, and replays the target's original result rather than acting
  twice;
- a second answer to a required question is rejected;
- an approval whose digest does not match is rejected;
- a task settled by one run cannot be settled again by another;
- a second run pinning an already-pinned scope is a no-op;
- an absent task context entry plus a persona context still resolves to the
  whole project;
- a call to an endpoint the policy does not name is rejected without failing the
  run;
- the gateway strips a model-supplied `origin` / `actorId` / `requestId`;
- a persona edited after creation does not change the task's prompt;
- `expectedRevision: undefined` is a 400, not a 409;
- goal decomposition stops at `maxGoalDepth` and forces a `sequence`.

Architectural regression tests, in the style of the existing `runtime-wiring`
greps:

- no `#document`, `#derived-outputs`, or other capability import inside
  `3-capabilities/agents/` — every target is reached through the gateway;
- `#persona` is imported by `application/agentTaskService.ts` and nothing else;
- no serial agent intent in `createAgentJobs.ts` reaches `gateway.call`;
- no objective, exchange content, goal statement, rationale, request body, or
  persona section text in any captured log record;
- `createAgentJobs.ts` switch is total over `AgentInternalJobIntent`.
