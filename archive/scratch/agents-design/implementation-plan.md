# Agents — implementation plan

Staged build. Each stage ends with a green tree, a passing verification
command, and something demonstrably working that did not work before.

**Read [architecture.md](architecture.md) first.** This file assumes the design.

## Ground rules

- **Every stage lands typecheck-clean and test-green.** `pnpm --filter
  @icarus/backend typecheck && pnpm --filter @icarus/backend test` is the gate
  after every stage, not at the end.
- **The module graph must resolve.** `node --conditions=development --import tsx
  -e 'import("#init/startBackend.js")'` — the check that caught the Slide
  breakage.
- **Tests go in with the code they cover**, not after. `--test-concurrency=1`
  is required; several suites open real SQLite files.
- **No stage leaves a half-registered capability.** If a stage adds an endpoint,
  it also adds the wiring test that drives it.
- Follow the surrounding directory's conventions: `camelCase` files in the
  layered shape, arrow-function consts for exports, `interface` for shapes and
  `type` for unions, total switches with no `default`.

---

## Stage 0 · Prerequisites

Everything in [supplementary-changes.md](supplementary-changes.md) marked
blocking. **All four land before stage 1**, because stages 2 and 3 cannot be
built or tested without them and retrofitting the config shape later means
rewriting the loader twice.

| Item | Files | Test |
| --- | --- | --- |
| Non-throwing bounded loop + `onRound` hook | `0-platform/intelligence/intelligence.ts`, `types.ts` | a fake provider that returns tool calls forever; assert `exhausted: true` with usage intact, and that `onRound` messages reach the next request |
| Third worker pool | `0-utils/jobs/scheduler.ts`, `types.ts`, `0-utils/config/loadBackendConfig.ts`, `etc/configuration.yaml`, `3-capabilities/built-in/queueStatusCapability.ts` | agent-queue admission, capacity → 429, `GET /health/queues` reports three pools |
| `buildInternalEnvelope` + re-entrancy rule | `0-utils/types/request.ts`, `docs/runtime/dual-queue.md` | envelope shape matches what transport builds; grep test that no serial intent awaits a serial job |
| `agents:` config section with presets | `0-utils/config/loadBackendConfig.ts`, `etc/configuration.yaml`, `etc/README.md` | unknown `defaultLimits` is a startup error; each preset validates independently; a malformed preset degrades to defaults rather than crashing |
| `#agents` aliases | `apps/backend/package.json`, `tsconfig.json`, `test/capabilities/runtime-wiring.test.ts` | alias assertion, all three conditions present |

**Done when:** the four platform changes are in, `runtime-wiring.test.ts` covers
the alias, and `GET /health/queues` shows `agent` alongside `serial` and
`concurrent`.

The `onRound` test is the one worth over-investing in. It is the mechanism the
entire steering story rests on, and it is the easiest thing in this plan to get
subtly wrong — an injected message that lands in the wrong position, or after
the loop has already decided to return, is invisible until a user complains that
steering does nothing.

---

## Stage 1 · Task, queue, and exchange — no runs

**Goal:** the aggregate exists, is durable, and is legible over HTTP. No model
call anywhere.

### Files

```text
3-capabilities/agents/
  domain/model.ts            AgentTask, AgentQueueItem, AgentPlanNode, AgentRun,
                             AgentCycle, AgentMessage, AgentQuestion,
                             AgentApproval, AgentToolCall, commands, queries
  domain/errors.ts
  domain/state.ts            task/queue transitions; ordinal allocation
  domain/limits.ts           preset + overrides → AgentLimits
  domain/canonical.ts        request digest
  domain/policy.ts           evaluatePolicy — pure, fully testable now
  ports/agentStore.ts
  persistence/sqliteSchema.ts       all twelve tables
  persistence/sqliteAgentStore.ts
  application/agentTaskService.ts   create, steer, cancel; queries
  application/agentReader.ts
  wire/{commandSchemas,querySchemas,valueSchemas,common}.ts
  projections/{projectTaskSummary,projectPlanTree,projectAttentionQueue}.ts
  index.ts
  docs/                             the six-file package

4-job-wiring/agents/registerAgentEndpoints.ts
1-init/create/agents.ts
```

Persona is wired now — `create` resolves and freezes the snapshot — because the
freeze is the thing most likely to be got wrong late.

### Tests

`agents-domain.test.ts`, `agents-persistence.test.ts`, `agents-wire.test.ts`,
`agents-wiring.test.ts`.

The cases that matter:

- queue ordinals: interleaved front and back pushes never collide and never
  renumber; a front push runs before an already-pending back push;
- exchange `seq` is contiguous under concurrent appends on the serial lane;
- `task.create` replay with the same `requestId` returns the original response;
  a different digest is `idempotency_mismatch`;
- `expectedRevision: undefined` is a **400, not a 409** (the `Number(undefined)`
  → `NaN` trap Persona has a regression test for);
- the scope-column paired `CHECK` rejects a half-pinned task;
- a persona edited after creation does not change the stored snapshot;
- an unknown limits preset is a 400 before any row is written.

### Done when

`POST /agents/command { task.create }` returns a task id; `task.get`,
`task.list`, `task.queue`, `task.plan`, `task.exchange`, and `task.attention`
all answer; `task.steer` appends a message and moves `headSeq`; retention
binding is in `startBackend.ts` and `purgeExpired` returns 0.

---

## Stage 2 · `simple-loop` with read-only policy

**Goal: the first real agent run.** A task can answer a question about the
project. No mutations — the policy grants only read endpoints.

This is the stage that proves the substrate, and it does it against ~200 lines
of strategy rather than ~1,500. Everything learned here informs stage 7.

### Files

```text
3-capabilities/agents/
  domain/strategies/types.ts
  domain/strategies/registry.ts
  domain/strategies/simpleLoop.ts       incl. its versioned prompts
  ports/endpointGateway.ts
  ports/activityPublisher.ts
  tools/knowledgeTools.ts
  tools/endpointTools.ts                policy ∩ requested → ToolBinding[]
  application/agentToolHost.ts          READ interception only, for now
  application/agentRunner.ts            run start, scope pin, the cycle,
                                        the boundary check
  application/agentSettlement.ts
  application/agentRecovery.ts

4-job-wiring/agents/createAgentJobs.ts
4-job-wiring/agents/agentEndpointCatalogue.ts   read descriptors only
1-init/create/agentEndpointGateway.ts
```

Wire `agents.run.start` and `agents.cycle` on the **agent pool**;
`agents.run.settle`, `agents.task.settle`, `agents.task.recover` serial.

Activity gets `agent.task.created` and `agent.task.settled` now — the outbox is
cheaper to build once than to retrofit.

### Tests

`agents-strategies.test.ts` (new) and additions to
`agents-application.test.ts`.

- `simpleLoop.plan()` and `.interpret()` against fixture inputs — **no
  database, no model**. This is the payoff for strategies being pure.
- scope pinning happens once, is idempotent under the revision CAS, and a
  second run does not re-pin;
- the absent-entry guard: no task entry + a persona context still resolves to
  the whole project;
- `policy ∩ request.toolNames`: a tool outside the policy is never bound, and a
  tool outside the request is not bound either;
- read tool calls are recorded as `tool_calls` rows with `mutating = 0`;
- `(runId, cycleSeq)` duplicate claim does the work once;
- an interrupted cycle is re-run and its already-recorded reads appear in
  `lastOutcomes`;
- the catalogue validates against the registry at construction — an unknown key
  is a **fatal startup error**.

### Done when

A task created with `strategy: simple-loop@1` and a read-only policy runs to
`completed`, writes plan nodes and progress messages, records its reads, and
publishes two Activity rows. `run.cycles` shows the turns with their prompt
versions and round counts.

**Verify by hand:** create a task whose objective is a question about a document
in the project, and read `task.exchange` until it settles.

---

## Stage 3 · Steering injection and questions

**Goal:** a person can redirect a running task, and the agent can ask.

### Files

Modified, not new: `agentRunner.ts` (the `onRound` wiring),
`agentTaskService.ts` (`task.answer`), `simpleLoop.ts` (handle `newMessages`
and emit questions), `agentRecovery.ts` (the `waiting` branch).

### Tests

- **steering injected mid-loop reaches the model in the next round**, asserted
  against a fake provider that records every request it receives — the single
  most important test in this plan;
- `steerCheckRounds` batching does not swallow a redirect: the check still runs
  before a round that would mutate, and at end of cycle;
- a required question sets `waiting` with `attention: "question"`; the run stays
  `running`;
- a second answer to a required question is rejected at the schema level;
- answering resumes the **same run**, not a new one;
- `task.attention` returns exactly the blocked tasks;
- a superseded queue item keeps its label, payload, and reason, and appears in
  the next cycle's strategy input.

### Done when

Steering a running task changes its behaviour within one tool round, visible in
`agents.steer.injected` and in the model's next request.

---

## Stage 4 · Mutation interception, against Derived Outputs

**Goal:** an agent changes something — but only something it created.

Derived Outputs is the first mutating target because it is **already idempotent
by caller-supplied key** and already owns evidence provenance, so this stage
exercises the risky machinery without touching anything a person authored.

### Files

`agentToolHost.ts` gains `mutatingHandler`: policy → commit → dispatch →
commit, attribution injection, the Activity outbox row, and the pre-execution
`plan` message describing the round's batch.
`agentEndpointCatalogue.ts` gains the Derived Outputs mutating descriptors.

### Tests

- **a mutating tool call is recorded before dispatch**; a simulated crash
  between the two transactions leaves exactly one `dispatched` row;
- **recovery re-dispatches that row under the same `requestId`** and the target
  replays rather than acting twice;
- **a denied call returns a tool result, and the model continues** — the cycle
  does not fail, and `agent.mutation.refused` is published;
- the gateway **strips a model-supplied** `origin` / `actorId` / `requestId`;
- `maxMutationsPerTask` refuses further mutations with `mutation_budget`;
- at most one mutating call per run is `dispatched` at any moment;
- the pre-execution `plan` message names every mutation in the round.

### Done when

A task can declare and refresh a Derived Output through the gateway, the effect
is visible in `derived-outputs.db`, and both Document's — sorry, *Derived
Outputs'* — own record and Agents' `agent.mutation.committed` exist.

**This is the stage to be slowest on.** Every guarantee in
[tools.md](tools.md) is exercised here for the first time.

---

## Stage 5 · Approval gating

**Goal:** a policy entry with `approval: "always"` blocks, and a grant is
dispatched by the runtime.

### Files

`agentToolHost.ts` (the unwind), `agentRunner.ts` (step 2: dispatch granted
calls before any model work), `agentTaskService.ts` (`task.approve`).

### Tests

- an `approval: "always"` call records `awaitingApproval`, returns a tool result
  saying so, and **unwinds the loop** at the round boundary;
- the task goes `waiting` with `attention: "approval"`; the run stays `running`;
- **the grant is dispatched by the runtime, not re-issued by the model** — the
  fake provider receives no second tool call for it;
- a digest mismatch on `task.approve` is rejected at the wire;
- a denial marks the call `rejected` and the strategy sees it in `decisions`;
- when both a required question and a pending approval exist, `attention`
  reports `"question"`.

### Done when

A gated mutation round-trips through a person and lands with its original
arguments.

---

## Stage 6 · Document as a mutating target

**Goal:** the first target that changes something a person authored.

Only `agentEndpointCatalogue.ts` changes. **That is the point** — adding a
target is a descriptor.

### Tests

- a task scoped to one `documentId` cannot address another
  (`resource_not_permitted`), with the id extracted via `resourceIdPath`;
- `prompt.create.request` returning **202** is handled: the strategy does not
  re-issue it, and the descriptor's `asynchronous: true` flag is what tells it
  so;
- a 409 revision conflict from Document reaches the model as a 409 with
  Document's own wire code, and the model retries against fresh state;
- the target's own transaction carries `origin: "agent"` and
  `actorId: "agent:<taskId>:<toolCallId>"`.

### Done when

An agent edits a document, and the change is attributable from Agents, from
Document's own history, and from Activity.

---

## Stage 7 · `decompose-verify`

**Goal:** the structured strategy — built after watching `simple-loop` run.

### Files

`domain/strategies/decomposeVerify.ts` and its prompts. **Nothing else.** If
this stage touches a file outside `domain/strategies/`, the substrate/strategy
line was drawn wrong and that is worth stopping to fix.

### Tests

In `agents-strategies.test.ts`, all against fixtures:

- a decompose turn emits a multi-level plan tree in one call and pushes leaves
  to the **front**;
- at `maxPlanDepth`, the output schema offers no children — the model cannot
  emit what is not there;
- `maxPlanningTurns` forces work or blocks the node;
- a self-check that fails pushes rework to the front, ahead of pending siblings;
- a `202` becomes a `recheck` item, not a re-issue;
- `maxRechecks` blocks the node with a question rather than assuming failure.

### Done when

A task created with `strategy: decompose-verify@1` produces a legible plan tree
in `task.plan` and works it to completion, and `simple-loop` still passes every
one of its own tests unchanged.

---

## Stage 8 · Automation origin

**Goal:** the settlement notification Automation will consume.

`origin: { kind: "automation", automationId }` stages a second outbox row on
settlement. There is no consumer yet; the row and its publisher are what
Automation will be built against.

### Done when

An automation-origin task settles with two outbox rows, both published, and a
duplicate settlement is recognised rather than re-sent.

---

## Verification

After every stage:

```bash
cd apps/backend
pnpm typecheck                       # expect: clean, exit 0
pnpm test                            # expect: all pass
node --conditions=development --import tsx \
  -e 'import("#init/startBackend.js")'      # expect: resolves
```

**Add `pnpm typecheck` to whatever gate runs `pnpm test` before stage 1.** It is
still listed as open in `09-verified-status.md`, it bit once already with Slide,
and Agents will be the largest new capability since Document. The module-graph
test catches unresolvable imports of *used* bindings but not unused or type-only
ones — esbuild elides those before Node resolves them.

For stages 2 and later, also drive it by hand: create a task, watch
`task.exchange`, and read `logs/backend-YYYY-MM-DD.log` for the cycle events. A
green test run does not tell you whether the loop *behaves*.

---

## Risks

**The prompts are the least testable part.** `plan()` and `interpret()` are pure
and fully covered, but whether a model actually produces a usable decision from
`SIMPLE_LOOP_V1` is only discoverable by running it. Budget real time in stage 2
for prompt iteration, and keep `promptVersion` on every cycle so a regression
after an edit is attributable.

**Stage 4 is where a mistake is expensive.** Everything before it is
recoverable by deleting `agents.db`. From stage 4 on, a bug can leave real
changes in another capability's store. Land the crash test *before* the happy
path.

**`simple-loop` may be good enough.** If it is, stage 7 is optional and
`decompose-verify` becomes something to build when a task shape demands it. That
is a success, not a wasted seam — the seam is what let stage 2 be small.

**The catalogue is a standing security surface.** Every descriptor added is
reach granted to every agent task whose policy names it. It should be reviewed
the way a route is, and `agentEndpointCatalogue.ts` is deliberately one file so
that review has one place to happen.

---

## What this plan does not cover

- **A UI.** `task.exchange`, `task.plan`, `task.queue`, and `task.attention` are
  the surface a UI would need; none of it is designed here.
- **Automation itself.** Stage 8 produces the notification; the consumer is a
  separate capability.
- **Per-task concurrency fairness.** The third pool stops agent work starving
  HTTP reads, but one task can still occupy the whole agent pool. A per-task
  in-flight cap is a small addition to the scheduler if it becomes a problem —
  worth watching from stage 2, when more than one task can run at once.
