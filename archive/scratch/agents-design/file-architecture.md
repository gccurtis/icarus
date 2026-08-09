# Agents — file architecture

Module layout, dependency direction, and composition order.

Agents uses the **layered** capability shape (`domain/`, `application/`,
`ports/`, `persistence/`, `wire/`, `projections/`) with `camelCase` filenames,
matching Document, Activity, Comments, Templates, and Persona. The flat shape
used by Context, Structured Data, and Derived Outputs does not fit: this
capability has a state machine, a work queue, a pluggable strategy layer, an
execution loop, and a wire decoder, and those want file boundaries rather than
section dividers.

**Persona is the closest model to copy**, being the most recently built
capability and the one whose surface Agents consumes.

## Layout

```text
apps/backend/src/
  3-capabilities/agents/
    domain/
      model.ts             AgentTask, AgentQueueItem, AgentPlanNode, AgentRun,
                           AgentCycle, AgentMessage, AgentQuestion,
                           AgentApproval, AgentToolCall
      state.ts             pure task/run/cycle/queue transitions; total switches
      policy.ts            pure policy evaluation — call → allow|approve|reject
      limits.ts            preset resolution: named set + overrides → AgentLimits
      canonical.ts         canonical request digest (own copy, not shared)
      errors.ts            one class per failure mode
      strategies/
        types.ts           AgentStrategy, AgentCycleInput, AgentModelRequest,
                           AgentCycleOutcome, QueueWrite, PlanNodeWrite
        registry.ts        keyed on (name, version); resolve + list
        simpleLoop.ts      the baseline strategy, with its prompts
        decomposeVerify.ts the structured strategy, with its prompts
    application/
      agentTaskService.ts  commands: create, steer, answer, approve, cancel
      agentRunner.ts       run start, scope pin, the cycle, the boundary check
      agentToolHost.ts     builds the ToolSet; intercepts every call;
                           policy → approval → commit → dispatch → commit
      agentSettlement.ts   run settlement and task settlement under CAS
      agentRecovery.ts     the reconciliation sweep
      agentReader.ts       queries and projections
    ports/
      agentStore.ts        the store interface (Promise-returning)
      endpointGateway.ts   AgentEndpointGateway, AgentEndpointDescriptor
      activityPublisher.ts narrow source-side Activity port; one method
    persistence/
      sqliteAgentStore.ts
      sqliteSchema.ts
    tools/
      knowledgeTools.ts    knowledge_retrieve / knowledge_read ToolSet bindings
      endpointTools.ts     policy ∩ requested descriptors → ToolBinding[]
    wire/
      commandSchemas.ts    decodeAgentCommand
      querySchemas.ts      decodeAgentQuery
      valueSchemas.ts      requireIdentifier / requireEnum / exactKeys / …
      common.ts            shared field helpers
    projections/
      projectTaskSummary.ts
      projectPlanTree.ts
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

Note what is **not** here: no `targets/` directory, no per-capability adapter,
no `AgentTargetRegistry`. Agents reaches every capability through one gateway
over the existing job registry. See [tools.md](tools.md).

## The substrate/strategy line

This is the most important structural fact about the module, and it is worth
being able to point at:

| Owns | Files |
| --- | --- |
| **Substrate** — never changes when the loop changes | everything outside `domain/strategies/` |
| **Strategy** — the bet | `domain/strategies/` only |

A strategy is **two pure functions** with no ports: `plan()` builds a model
request, `interpret()` reads the result and returns changes. They cannot
dispatch, cannot exceed policy, cannot skip approval, and cannot write the audit
record — they have no mechanism to. That is why they live in `domain/`, next to
`policy.ts` and `state.ts`, and why they are testable with fixture inputs and no
database.

## Dependency direction

```text
wire ──────► domain (incl. strategies)
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
  from other capabilities except types. `state.ts`, `policy.ts`, `limits.ts`,
  and every strategy are pure functions over values.
- **Agents never imports another capability's module.** Document, Derived
  Outputs, and every other target are reached only through the gateway, by
  endpoint key. Grep for `#document` or `#derived-outputs` inside
  `3-capabilities/agents/` should return nothing; that is an architectural
  regression test.
- **The only capability type Agents imports is `ContextEntry`**, which Context
  re-exports from `0-platform/knowledge/types.ts` — the one deliberate inversion
  the codebase already documents. Persona does the same.
- **`application/` is the only layer that touches ports.** `wire/` decodes into
  domain values and hands them over.
- **Persona is a creation-time dependency only.** `personas.resolve` is called
  once in `agentTaskService.create`. No other file imports `#persona`, because
  every later use reads the frozen snapshot off the task. That single call site
  is what enforces Persona's first consumer law, and it is worth a regression
  test.
- **No strategy imports `#platform/intelligence`.** A strategy returns a
  `Cast` and a message array; `agentRunner` makes the call. This is what keeps
  a strategy pure and is worth a grep test of its own.

## The tool host — where interception lives

`agentToolHost.ts` is the file the safety argument rests on. It builds the
`ToolSet` handed to `Intelligence` and *is* the handler for every tool in it.

```ts
// application/agentToolHost.ts, in outline
const buildToolSet = (ctx: CycleContext, requestedToolNames: readonly string[]): ToolSet => {
  const permitted = ctx.catalogue.filter(d =>
    ctx.policy.entries.some(e => e.endpointKey === d.key) &&
    requestedToolNames.includes(d.toolName)          // policy ∩ request
  );
  return new ToolSet([
    ...knowledgeTools(ctx.scope),                    // closes over the frozen manifest
    ...permitted.map(d => ({
      definition: { name: d.toolName, description: d.summary, inputSchema: d.inputSchema },
      handler: d.mutating ? mutatingHandler(ctx, d) : readHandler(ctx, d)
    }))
  ]);
};
```

`mutatingHandler` is where policy, approval, commit-before-dispatch, attribution
injection, and the Activity outbox row all happen — in that order, in one place.
It returns a refusal as a **tool result** rather than throwing, so a denied call
is information the model acts on rather than a failure that ends the cycle.

The intersection `policy ∩ request` is the reason a strategy can ask for a
subset of its policy per turn but can never exceed it.

## The endpoint gateway

The seam that lets Agents reach every capability without depending on any. It
lives in `1-init` because it needs the concrete `JobRegistry` and
`JobScheduler`, and neither the capability nor job wiring may hold both.

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
first-use surprise, logged as `agents.catalogue.validated`.

### The re-entrancy rule

**A concurrent job may enqueue a serial job. A serial job must never await
one.** The serial queue has a single active slot; a serial job awaiting another
serial job deadlocks the whole backend.

Every cycle runs on the **agent pool**, never serial. `agents.run.settle` and
`agents.task.settle` are serial and touch only Agents' own store; they never
call the gateway. There is an architectural regression test asserting no serial
agent intent reaches `gateway.call`.

## The barrel

```ts
export { createAgentsCapability } from "./application/agentTaskService.js";
export type { AgentsCapability, AgentDependencies, AgentClock }
  from "./application/agentTaskService.js";
export * from "./domain/model.js";     // canonical types, commands, queries
export * from "./domain/errors.js";    // job wiring maps these to status codes
export { digestAgentRequest } from "./domain/canonical.js";
export { evaluatePolicy } from "./domain/policy.js";
export { resolveAgentLimits } from "./domain/limits.js";
export type { AgentStrategy, AgentCycleInput, AgentModelRequest, AgentCycleOutcome }
  from "./domain/strategies/types.js";
export { createStrategyRegistry, BUILT_IN_STRATEGIES }
  from "./domain/strategies/registry.js";
export type { AgentStore } from "./ports/agentStore.js";
export type { AgentEndpointGateway, AgentEndpointDescriptor, AgentEndpointCall,
              AgentEndpointOutcome } from "./ports/endpointGateway.js";
export type { AgentActivityPublisher } from "./ports/activityPublisher.js";
export { SQLiteAgentStore } from "./persistence/sqliteAgentStore.js";
export { decodeAgentCommand } from "./wire/commandSchemas.js";
export { decodeAgentQuery } from "./wire/querySchemas.js";
```

What leaks deliberately: **error classes** (wiring maps them), **wire decoders**
(wiring calls them), **the SQLite store class** (`1-init` constructs it), the
**gateway and descriptor types** (job wiring declares the catalogue, `1-init`
implements it), and the **strategy types and registry** (so a strategy can be
added without reaching inside). What does not: the service class, the runner,
the tool host, the store adapter's internals, and the transcript.

## `wire/` file names

The house layout is `commandSchemas.ts` / `querySchemas.ts` / `valueSchemas.ts`
plus `common.ts`, each exporting a `decode<Thing>` function — Document, Persona,
Comments, and Templates all use it. Files are named for what they hold, not for
the function they export.

`exactKeys(record, allowed, label)` rejects **unknown** keys, not just missing
ones, so a client typo is a 400 rather than a silently ignored field.
`expectedRevision` must be decoded with a genuine non-negative-integer check,
never `Number(body.x)` — coercing a missing value yields `NaN`, which compares
unequal to every stored revision and surfaces a malformed request as
`409 revision_conflict`, so a client implementing retry-on-409 retries forever.
Persona has a regression test for exactly this; copy it.

## Composition

```ts
// 1-init/startBackend.ts, in order

// …existing capability construction, including every endpoint registration…
registerDocumentEndpoints(registry, document, logger);
registerDerivedOutputEndpoints(registry, derivedOutputs, logger);
// …

// Agents last: the gateway validates its catalogue against a populated registry.
const agentGateway = createAgentEndpointGateway(
  registry, scheduler, AGENT_ENDPOINT_CATALOGUE, logger
);

const agentInternalJobs = new SchedulerInternalJobsRuntime<AgentInternalJobIntent>(scheduler);
const agents = createAgentsInstance(config, logger, {
  personas,
  knowledge,
  intelligence,
  gateway: agentGateway,
  strategies: createStrategyRegistry(BUILT_IN_STRATEGIES),
  activityPublisher: createAgentActivityPublisher(activity),
  internalJobs: agentInternalJobs      // dispatch face
});

registerAgentEndpoints(registry, agents, logger);
createAgentJobs(agentInternalJobs, agents);   // registrar face

bindResourceRetentionPort("agents", agents)

// Before app.listen, with the other recovery calls:
const recoveredAgentTasks = await agents.recoverPendingTasks();
logger.info("agents.tasks.recovered", { count: recoveredAgentTasks });
const recoveredAgentActivity = await agents.publishPendingActivity();
logger.info("agents.activity.recovered", { count: recoveredAgentActivity });
```

**Agents is constructed after every other endpoint registration**, because the
gateway validates its catalogue against the registry at construction. That is
the one ordering constraint the composition root gains, and it deserves a
comment in `startBackend.ts` alongside the existing ones.

`createAgentActivityPublisher(activity)` is the translation seam, built here for
the same reason `createDocumentActivityPublisher` is.

**Recovery runs before `app.listen`, awaited**, alongside
`document.recoverPendingAttempts()` — not after it like the connector sync
scheduler. The two rules are different and easy to conflate: recovery goes
*before* binding so no request races a half-recovered task, while recurring
*timers* go after binding so a failed listen is not kept alive by them. Agents
has no timers, so only the first rule applies.

## Aliases

| alias | target |
| --- | --- |
| `#agents` | `3-capabilities/agents/index.ts` |
| `#agents/*` | `3-capabilities/agents/*` |

Both need explicit `development`, `types`, and compiled `default` conditions.
`runtime-wiring.test.ts` already asserts specific aliases exist, because a
missing one only fails at runtime in the built output — add `#agents` to it.

## Documentation

A six-file `docs/` package beside the code: `README.md`, `concepts.md`,
`types.md`, `runtime.md`, `flows.md`, `invariants.md`.

`README.md` opens with **Status and authority** (what is implemented, what is
not, and which older design page must not be read as current — for Agents that
includes `docs/capabilities-old/agents.md` and, once built, this scratch
directory) and an **Implementation map** table.

Persona's `docs/README.md` is the closest model, including its "Deliberate
deviations, so they are not rediscovered as bugs" section. Agents has several
worth recording: no history table, no delete, `purgeExpired` returning a
constant zero, `approval` defaulting to `"never"`, the loopback gateway instead
of per-capability adapters, and mutations arriving as intercepted tool calls
rather than declared structured output.

## Tests

| File | Covers |
| --- | --- |
| `agents-domain.test.ts` | state transitions, queue ordinal allocation, policy evaluation, limit-preset resolution, digests, strategy registry lookup |
| `agents-strategies.test.ts` | each strategy's `plan()` and `interpret()` against fixture inputs — no database, no model |
| `agents-application.test.ts` | create/freeze, scope pinning, the cycle, tool interception, approval unwind and grant dispatch, steering injection, settlement CAS, recovery branches |
| `agents-persistence.test.ts` | seq contiguity, queue ordinals under front/back pushes, unique constraints, partial indexes, the scope-column CHECK, outbox |
| `agents-wire.test.ts` | command/query decoding, `exactKeys` rejection, error → code mapping |
| `agents-wiring.test.ts` | a real transport + registry + scheduler driving both endpoints, gateway loopback against a real registered endpoint, queue placement, the error ladder |

The cases most worth writing first:

- a duplicate continuation for `(runId, cycleSeq)` does the work once;
- **a mutating tool call is recorded before dispatch**, and a simulated crash
  between the two leaves exactly one `dispatched` row that recovery replays;
- **a denied call returns a tool result and the model continues** — the cycle
  does not fail;
- **an approval unwinds the loop, and the grant is dispatched by the runtime**,
  not re-issued by the model;
- **steering injected mid-loop reaches the model in the next round**, asserted
  against a fake provider that records its inputs;
- a front push runs before an already-pending back push;
- ordinals never collide and never renumber across interleaved pushes;
- a superseded queue item keeps its label, payload, and reason;
- an interrupted cycle re-runs and its already-executed tool calls appear in
  `lastOutcomes` rather than being redone;
- the gateway strips a model-supplied `origin` / `actorId` / `requestId`;
- a call to an endpoint outside the policy is never bound as a tool;
- a persona edited after creation does not change the task's prompt;
- a strategy version shipped after task creation does not change that task;
- `expectedRevision: undefined` is a 400, not a 409.

Architectural regression tests, in the style of the existing `runtime-wiring`
greps:

- no `#document`, `#derived-outputs`, or other capability import inside
  `3-capabilities/agents/`;
- `#persona` is imported by `application/agentTaskService.ts` and nothing else;
- no `#platform/intelligence` import inside `domain/strategies/`;
- no serial agent intent in `createAgentJobs.ts` reaches `gateway.call`;
- no objective, exchange content, plan statement, queue label, strategy memory,
  request body, or persona section text in any captured log record;
- `createAgentJobs.ts` switch is total over `AgentInternalJobIntent`.
