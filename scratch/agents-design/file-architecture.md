# Agents — file architecture

Module layout, dependency direction, and composition order.

Agents uses the **layered** capability shape (`domain/`, `application/`,
`ports/`, `persistence/`, `wire/`, `projections/`) with `camelCase` filenames,
matching Document, Slide, and Activity. The flat shape used by Context,
Structured Data, and Persona does not fit: this capability has a state machine,
an execution loop, and a wire decoder, and those want file boundaries rather
than section dividers.

## Layout

```text
apps/backend/src/
  3-capabilities/agents/
    domain/
      model.ts             AgentTask, AgentRun, AgentStep, AgentMessage,
                           AgentQuestion, AgentApproval, AgentToolCall
      state.ts             pure task/run state transitions; total switches
      decision.ts          AgentDecision union + its structured-output schema
      policy.ts            pure policy evaluation — proposal → allow|approve|reject
      canonical.ts         canonical request digest (own copy, not shared)
      errors.ts            one class per failure mode
    application/
      agentTaskService.ts  commands: create, steer, answer, approve, cancel
      agentRunner.ts       reason and retrieve steps; builds model input
      agentToolStep.ts     tool dispatch: commit, call, settle
      agentSettlement.ts   run settlement and task settlement under CAS
      agentRecovery.ts     the reconciliation sweep
      agentReader.ts       queries and projections
    ports/
      agentStore.ts        the store interface (synchronous)
      agentTargetRegistry.ts  AgentTarget, AgentTargetCommand, AgentTargetRead
    persistence/
      sqliteAgentStore.ts
      sqliteSchema.ts
    tools/
      readTools.ts         knowledge.retrieve / knowledge.read ToolSet bindings
      targetReadTools.ts   policy-granted target reads as ToolSet bindings
    wire/
      decodeAgentCommand.ts
      decodeAgentQuery.ts
      valueSchemas.ts
    projections/
      projectTaskSummary.ts
      projectAttentionQueue.ts
    index.ts               barrel
    docs/                  README, concepts, types, runtime, flows, invariants

  4-job-wiring/agents/
    registerAgentEndpoints.ts   POST /agents/command, POST /agents/query
    createAgentJobs.ts          intent → queue, total switch, no default

  1-init/create/
    agents.ts                   createAgentsInstance(config, logger, deps)
    agentTargetRegistry.ts      created early; targets register as constructed
```

## Dependency direction

```text
wire ──────► domain
              ▲
application ──┘──► ports ──► (persistence implements)
     │
     ├──► #persona          type + resolve, at creation only
     ├──► #platform/knowledge  resolveScope, retrieve, read
     ├──► #platform/intelligence  reason, ToolSet
     └──► ports/agentTargetRegistry   never a capability module directly
```

The rules that matter:

- **`domain/` imports nothing from the capability's other layers** and nothing
  from other capabilities except types. `state.ts` and `policy.ts` are pure
  functions over values, which is what makes the state machine and the policy
  check testable without a database or a model.
- **Agents never imports another capability's module.** Document, Structured
  Data, and every other target are reached only through `AgentTargetRegistry`.
  Grep for `#document` inside `3-capabilities/agents/` should return nothing;
  that is worth an architectural regression test.
- **`application/` is the only layer that touches ports.** `wire/` decodes into
  domain values and hands them over.
- **Persona is a creation-time dependency only.** `personas.resolve` is called
  once in `agentTaskService.create`. No other file imports `#persona`, because
  every later use reads the frozen snapshot off the task.

## Composition

`AgentTargetRegistry` is created early and mutated during composition, then read
through its narrow interface — the same late-registration step the derived
outputs resource registry already uses to break a construction cycle without a
service locator.

```ts
// 1-init/startBackend.ts, in order

const agentTargets = createAgentTargetRegistry();

// …existing capability construction…
const documentCapability = createDocumentInstance(…);
agentTargets.register(documentAgentTarget(documentCapability));   // adapter, not the capability

const structuredData = createStructuredDataInstance(…);
agentTargets.register(structuredDataAgentTarget(structuredData));

// Agents last: it needs personas, knowledge, intelligence, and the registry
const agentInternalJobs = new SchedulerInternalJobsRuntime<AgentInternalJobIntent>(scheduler);
const agents = createAgentsInstance(config, logger, {
  personas,
  knowledge,
  intelligence,
  targets: agentTargets,
  internalJobs: agentInternalJobs      // dispatch face
});

registerAgentEndpoints(registry, agents);
createAgentJobs(agentInternalJobs, agents);   // registrar face
```

The `*AgentTarget(capability)` adapters live in **job wiring**, not in either
capability. That placement is what keeps the dependency arrow one-directional:
Document does not know it is an agent target, and Agents does not know Document
exists. The adapter is the only file that knows both, and it is the natural home
for the `lookup(requestDigest)` implementation each target must provide.

Recovery starts after the HTTP listener binds, for the same reason the connector
sync scheduler does — a failed startup must not be kept alive by background
work.

## Aliases

| alias | target |
| --- | --- |
| `#agents` | `3-capabilities/agents/index.ts` |
| `#agents/*` | `3-capabilities/agents/*` |

Both need explicit `development`, `types`, and compiled `default` conditions, so
dev and tests select source deliberately rather than loading a stale `dist`.

## Tests

One file per layer, matching the existing `document-domain` /
`document-application` / `document-persistence` / `document-wire` split.

| File | Covers |
| --- | --- |
| `agents-domain.test.ts` | state transitions, policy evaluation, decision validation, digests |
| `agents-application.test.ts` | create/freeze, the consumed-prefix rule, step idempotency, settlement CAS, recovery branches |
| `agents-persistence.test.ts` | seq contiguity, unique constraints, partial indexes, outbox |
| `agents-wire.test.ts` | command/query decoding, error → code mapping |

The cases most worth writing first, because they are the ones that are painful
to discover later:

- a duplicate continuation for `(runId, stepSeq)` does the work once;
- a message appended during a run is consumed by the next run, exactly once;
- a second answer to a required question is rejected;
- an approval whose digest does not match is rejected;
- a task settled by one run cannot be settled again by another;
- a tool call left `dispatched` is found by recovery and resolved by lookup;
- a proposal for an ungranted command is rejected without failing the run;
- a persona edited after creation does not change the task's prompt.

Architectural regression tests, in the style of the existing `runtime-wiring`
greps:

- no `#document`, `#slide`, or other capability import inside
  `3-capabilities/agents/`;
- no objective, exchange content, or proposal arguments in any captured log
  record;
- `createAgentJobs.ts` switch is total over `AgentInternalJobIntent`.
