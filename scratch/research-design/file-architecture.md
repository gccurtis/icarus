# Research — file architecture

## Layout

Layered capability shape with `camelCase` filenames, matching Document, Slide,
Activity, and Agents. Research has a state machine, a wire decoder, and a
multi-capability integration surface; those want file boundaries.

```text
apps/backend/src/
  3-capabilities/research/
    domain/
      model.ts          Thread, Message, Run, Subject, Channels, Grounding,
                        Result, FindingCandidate
      modes/
        discovery.ts    persona constant, result schema, completion criteria
        question.ts
        hypothesis.ts
      framing.ts        subject + mode + channels → objective, policy, schema
      grounding.ts      validate refs against a run's own records
      transitions.ts    pure run state transitions; total switches
      canonical.ts      canonical-object snapshot digests
      errors.ts
    application/
      researchService.ts    thread and run commands
      runSettlement.ts      validate, extract candidates, append assistant message
      candidateReview.ts    review states and the propose flow
      webSave.ts            explicit save-as-General-File
      researchReader.ts     queries and projections
      recovery.ts           orphan runs, pending proposals
    ports/
      researchStore.ts
      agentTasks.ts         narrow view of the Agents command port
      findingsProposal.ts   keyed propose, per amendment R3
      questionReader.ts     matches questions-design's reader shape
      hypothesisReader.ts
      computation.ts        bounded sandbox
      analyticOutputs.ts    read-only materialization by id
      webRetrieval.ts
    persistence/
      sqliteResearchStore.ts
      sqliteSchema.ts
    wire/
      decodeResearchCommand.ts
      decodeResearchQuery.ts
      valueSchemas.ts
    projections/
      threadProjection.ts
      candidateQueue.ts
    index.ts
    docs/

  4-job-wiring/research/
    registerResearchEndpoints.ts
    createResearchJobs.ts
    researchAgentAdapter.ts     Research → Agents command port

  1-init/create/
    research.ts
```

## Dependency direction

```text
wire ──────► domain
              ▲
application ──┘──► ports ──► (persistence + adapters implement)
```

Rules:

- **`domain/` is pure.** `framing.ts`, `grounding.ts`, `transitions.ts`, and the
  three mode modules take values and return values. No store, no clock, no
  logger, no model. Every mode's completion criteria and every grounding
  validation rule becomes a test needing two literals.
- **Research never imports another capability's module.** Findings, Questions,
  Hypotheses, Structured Analysis, and Agents are all reached through narrow ports
  in `ports/`, implemented by adapters in job wiring. Grep for `#findings` or
  `#agents` under `3-capabilities/research/` should return nothing.
- **Research owns no execution.** There is no runner, no step, no tool
  dispatch, no transcript. If a file here starts looking like a loop over model
  calls, the design has drifted and the work belongs in Agents.

The `ports/` list is long, and that is the honest shape of this capability: its
job is to sit at the junction of the investigation objects and turn a
conversation into durable proposals. Each port is small — `questionReader.ts` is
the same one-method reader `hypotheses-design.md` already defines for itself.

## Composition

```ts
// 1-init/startBackend.ts, after Agents and the investigation capabilities

const research = createResearchInstance(config, logger, {
  agents: researchAgentAdapter(agents),      // narrow: create, cancel, answer
  findings: keyedFindingsProposal(findings), // amendment R3
  questions: questionReaderAdapter(questions),
  hypotheses: hypothesisReaderAdapter(hypotheses),
  analyticOutputs: analyticOutputReader(analyticOutput),
  computation: computationSandbox,           // may be absent
  webRetrieval: webRetrievalAdapter          // may be absent
});

registerResearchEndpoints(registry, research);
createResearchJobs(researchInternalJobs, research);
```

`computation` and `webRetrieval` are **optional dependencies**, and absence is
modelled explicitly rather than as a silent no-op. A run requesting a channel
with no adapter fails with `channel_unavailable`. Web Retrieval is currently a
scaffold directory with no composed provider, so this is the live case, not a
hypothetical: a missing search provider must never look like a search that
found nothing.

Recovery starts after the HTTP listener binds, matching the connector sync
scheduler and Agents.

## The Agents adapter

`researchAgentAdapter` is the only file that knows both capabilities. It maps:

```text
ResearchChannels          → AgentToolPolicy   (all read-only entries)
mode persona constant     → PersonaSnapshot   (built-in, not catalog)
mode result schema        → CreateTaskInput.resultSchema
subject + message text    → objective
run cancel / answer       → task.cancel / task.answer
task settlement intent    → research settlement
```

Placing it in job wiring keeps the arrow one-directional: Agents does not know
Research exists, and Research does not import Agents. It is the same placement
`agents-design.md` uses for its own target adapters, and for the same reason.

## Aliases

| alias | target |
| --- | --- |
| `#research` | `3-capabilities/research/index.ts` |
| `#research/*` | `3-capabilities/research/*` |

Explicit `development`, `types`, and compiled `default` conditions.

## Tests

| File | Covers |
| --- | --- |
| `research-domain.test.ts` | framing, grounding validation, mode criteria, transitions |
| `research-application.test.ts` | run start ordering, settlement, candidate extraction, propose flow, recovery |
| `research-persistence.test.ts` | seq contiguity, idempotency, orphan and pending indexes |
| `research-wire.test.ts` | command/query decoding, error → code mapping |

Cases worth writing first:

- a hypothesis result with no `intent: "refute"` test settles `incomplete`;
- a grounding reference to a record the run never produced is dropped, and the
  claim citing only it does not become a candidate;
- a candidate citing a web result is created `blocked_grounding` and cannot be
  proposed;
- a repeated `clientRequestId` on `run.start` returns the original run;
- a run committed with no `agent_task_id` is found by recovery;
- a `proposal_pending` candidate re-proposes with the same pre-generated id;
- settlement never writes to Questions or Hypotheses;
- a canonical Question edited after run start does not change the run's frozen
  subject.

Architectural regression tests:

- no capability-module imports under `3-capabilities/research/`;
- no message text, claim text, or result payload in any captured log record;
- `createResearchJobs.ts` switch is total over the internal intent union.
