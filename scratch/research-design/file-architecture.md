# Research Capability — File Architecture and Runtime Placement

## Purpose

Research is a large, stateful, asynchronous capability. It uses the layered
shape established by Document and Slides rather than the older flat capability
shape.

The design keeps four boundaries visible:

1. pure Research domain values and validation;
2. the application service that owns durable workflow;
3. narrow outbound ports for every external authority;
4. job wiring that maps exact transport and internal intents to queues.

Research is removable as one capability package, one job-wiring package, one
composition block, one configuration section, one database file, and its
tests. No platform runtime or adjacent capability stores a canonical Research
record.

## Repository placement

~~~text
apps/backend/src/
  3-capabilities/
    research/
      domain/
        model.ts
        errors.ts
        canonical.ts
        validation.ts
        transitions.ts
        modes/
          discovery.ts
          question.ts
          hypothesis.ts
      application/
        researchService.ts
        runCoordinator.ts
        groundingValidator.ts
        findingAdoption.ts
        webResultSave.ts
      ports/
        researchStore.ts
        reasoning.ts
        researchKnowledge.ts
        projectData.ts
        webRetrieval.ts
        resourceReader.ts
        projectFrame.ts
        questions.ts
        hypotheses.ts
        findings.ts
        computation.ts
        analyticOutputs.ts
        generalFiles.ts
      persistence/
        sqliteSchema.ts
        sqliteResearchStore.ts
        sqliteMappers.ts
      projections/
        threadProjection.ts
        runTimeline.ts
        findingReview.ts
      wire/
        commandSchemas.ts
        querySchemas.ts
        valueSchemas.ts
      docs/
        README.md
        concepts.md
        types.md
        runtime.md
        flows.md
        invariants.md
      index.ts

  4-job-wiring/
    research/
      registerResearchEndpoints.ts
      registerResearchInternalJobs.ts
      createResearchJobs.ts
      researchJobPayloads.ts

  1-init/
    create/
      research.ts

apps/backend/test/
  capabilities/
    research-domain.test.ts
    research-application.test.ts
    research-persistence.test.ts
    research-wire.test.ts
    research-wiring.test.ts
    research-recovery.test.ts
    research-grounding.test.ts
~~~

## Layer responsibilities

### domain/model.ts

Owns only canonical and operational Research types:

- Thread and Message;
- Run, attempts, stages, plan, steps, queries, results, and events;
- frozen input/scope manifests;
- web result records;
- mode-specific result unions;
- Finding candidates and links;
- commands, queries, results, and internal intents;
- IDs, timestamps, revisions, digests, and state enums.

It contains no SQLite rows, provider request objects, Fastify types, timers, or
concrete service classes.

### domain/errors.ts

Defines one named error per public failure family. Job wiring imports these
through the public barrel and maps them to HTTP status codes.

Unexpected provider details remain inside logs and diagnostics. Error messages
returned to callers do not contain project content.

### domain/canonical.ts

Provides deterministic, content-safe encodings and digests for:

- command idempotency;
- Thread snapshots;
- frozen Run inputs;
- scope policies and resolved manifests;
- Question/Hypothesis text snapshots;
- plans and candidate results;
- exact web result identities;
- delegated Finding and General File requests;
- result revisions.

Canonical encoding sorts object keys, preserves array order where semantic,
omits undefined, and never uses provider-specific JSON serialization as an
identity.

### domain/validation.ts

Validates trusted domain values after wire decoding and again at persistence
reconstruction boundaries:

- bounded Thread/Message/result sizes;
- state-dependent required fields;
- unique step, query, result, candidate, and event identities;
- closed mode/channel/view/result unions;
- valid scope policies and frozen manifests;
- complete exact-rational FormulaWireValue data;
- valid grounding references;
- coherent attempt/stage state;
- monotonic revisions;
- safe external URL metadata.

Validation never performs I/O.

### domain/transitions.ts

Contains pure state-transition helpers for Run and attempt states. The
application service supplies current state; the helper returns the accepted
next value or a typed state error.

It does not run an investigation or persist anything.

### domain/modes/

Each file owns deterministic construction and validation for one structured
mode result:

- discovery.ts: educational synthesis, areas, gaps, and next explorations;
- question.ts: normalized question, subquestions, assumptions, answer, and
  candidate hypotheses;
- hypothesis.ts: testability, disconfirmation plan, assessment, and proposed
  alternatives.

Prompt text and provider calls belong in the application Reasoning adapter, not
these pure files.

## Application layer

### application/researchService.ts

Exports the ResearchCapability interface and implements:

- public command/query dispatch;
- Thread/message mutation;
- Run freeze;
- cancellation and retry;
- compute and settle stage entry points;
- startup recovery;
- delegated-action claims;
- structured logging.

The concrete class remains private. Callers receive the interface returned by
createResearchCapability.

### application/runCoordinator.ts

Owns the bounded investigation loop:

- mode framing;
- creation or recovery reuse of the Run's one immutable plan;
- Knowledge/Web/Data calls, bounded computation, and optional Analytic Output
  reads;
- persistence of each query/result;
- cancellation checks;
- synthesis;
- grounding validation;
- candidate-result publication.

It may hold an in-process map from active Run identities to AbortControllers.
That map is operational optimization only. SQLite attempt/cancel state remains
authoritative.

### application/groundingValidator.ts

Checks that every result citation and Finding candidate refers to material
actually persisted for this Run:

- a Knowledge region from the frozen scope;
- a bounded resource read authorized by that scope;
- a Structured Data entry/revision recorded as used;
- a persisted bounded-computation result;
- an existing Analytic Output materialization recorded as used;
- an exact Run web result.

It never trusts a model-returned reference merely because its shape decodes.

### application/findingAdoption.ts

Implements the explicit delegated command that proposes a canonical Finding
from a Run candidate. It freezes the candidate in a local claim, calls the
narrow Findings port idempotently, then records the Finding ID.

It never accepts a Finding.

### application/webResultSave.ts

Implements explicit saving of one bounded Run web result as a General File. It
does not run web search or alter the original web result record.

## Owned ports

Each port states exactly what Research consumes. Research never imports another
capability's concrete service or persistence.

### researchStore.ts

Research's complete persistence contract. It includes:

- Thread/message atomic writes;
- Run freeze and compare-and-publish settlement;
- attempt/stage claim and recovery;
- append-only query/result/event writes;
- cancellation;
- delegated command claims;
- retention and read projections.

Only Research owns this port.

### reasoning.ts

A purpose-specific interface implemented over Platform Intelligence:

~~~ts
interface ResearchReasoning {
  frame(input: ResearchFramingInput, signal: AbortSignal): Promise<ResearchFrame>;
  plan(input: ResearchPlanningInput, signal: AbortSignal): Promise<ResearchPlan>;
  continue(
    input: ResearchContinuationInput,
    tools: readonly ResearchTool[],
    signal: AbortSignal
  ): Promise<ResearchContinuation>;
  synthesize(
    input: ResearchSynthesisInput,
    signal: AbortSignal
  ): Promise<ResearchRunResult>;
}
~~~

The adapter selects Intelligence purposes and schemas. Research does not name a
provider/model or import OpenRouter.

### researchKnowledge.ts

~~~ts
interface ResearchKnowledge {
  resolveScope(entries: readonly ContextEntry[]): Promise<KnowledgeScopeManifest>;
  retrieveMany(
    queries: readonly string[],
    options: {
      readonly scope: KnowledgeScopeManifest;
      readonly topK?: number;
    }
  ): Promise<readonly ScopedRetrieveResult[]>;
}
~~~

The exact method shape should adapt the implemented Knowledge API without
duplicating lattice semantics. Every call receives the same frozen manifest.

### projectData.ts

Provides a frozen project binding view, entry reads, and Formula evaluation:

~~~ts
interface ResearchProjectData {
  freezeView(): Promise<ResearchDataView>;
  list(view: ResearchDataView): Promise<readonly ResearchDataDescriptor[]>;
  read(
    view: ResearchDataView,
    entryId: string
  ): Promise<ResearchDataSnapshot | null>;
  evaluate(
    view: ResearchDataView,
    source: string
  ): Promise<ResearchFormulaEvaluation>;
}
~~~

The composition adapter points from Structured Data and Formula toward this
port. Research never opens structured-data tables.

### webRetrieval.ts

Narrowly exposes bounded search and fetch through Platform Web Retrieval. The
current platform directory is a scaffold, so implementation of this port and a
configured adapter is a build prerequisite.

### resourceReader.ts

Performs bounded full reads only for resources admitted by the frozen scope.
The current runtime resource registry is the natural adapter because it
already maps General Files and Connector Context leaves and enforces scope.

### projectFrame.ts

Returns a small project framing snapshot: project summary and relevant
descriptors. It does not return arbitrary capability state. If the Project
capability is not yet implemented, composition may supply a minimal
configuration-backed adapter, but the snapshot/digest contract remains.

### questions.ts and hypotheses.ts

Read-only ports. They return exact current records for Run snapshotting.
Research does not update them.

### findings.ts

Supports idempotent proposal and exact reads. Research stores only Finding IDs
and immutable proposal receipts after adoption.

The current Findings design's random, last-write-wins propose contract is not
sufficient for a resumable cross-database delegated command. Findings must
accept a caller-supplied identity or idempotency key before the explicit
proposal command is implemented.

### computation.ts

Runs bounded, isolated Python computations over exact persisted Run inputs.
The Research-owned port admits a typed program/request, exact
`FormulaWireValue` inputs, declared output limits, and an `AbortSignal`; it
returns normalized stdout diagnostics plus a JSON-safe result and execution
digest. The adapter owns process/container isolation, network denial, time,
memory, filesystem, and output limits.

Research persists the program, input references and digests, runtime version,
limits, result, and diagnostics before any conclusion can cite the execution.
It never treats untracked model-generated arithmetic as a quantitative test.

### analyticOutputs.ts

Reads an existing immutable Analytic Output materialization when the user has
made it available to the Run. This is an optional derived input, not the engine
for statistical or Python work. Research stores the materialization identity
and digest and never interprets chart pixels.

### generalFiles.ts

Admits an explicitly selected Run web result through a content-addressed or
idempotent save contract.

## Persistence adapter

sqliteResearchStore.ts uses better-sqlite3, one Research database file, WAL,
foreign keys, busy timeout, synchronous NORMAL, and project-hashed logical
table prefixes.

The adapter:

- begins its own transactions;
- maps all rows in sqliteMappers.ts;
- enforces compare-and-swap settlement;
- keeps canonical, operational, and derived state distinct;
- never calls another capability while holding a Research database transaction.

See store.md for the exact schema and transaction protocols.

## Projections

Projections are rebuildable:

- threadProjection combines Thread, Messages, and Run summaries;
- runTimeline orders events, stages, queries, and results;
- findingReview groups candidates and linked Findings.

No projection becomes a canonical result or persistence authority.

## Wire package

The wire package rejects unknown keys and validates sizes before application
code sees untrusted values.

commandSchemas.ts and querySchemas.ts each use a total mapping keyed by the
discriminated union. Adding a domain variant without a decoder is a compile
error.

## Public barrel

index.ts exports:

- createResearchCapability;
- ResearchCapability and ResearchDependencies;
- public model/command/query/result types;
- typed errors;
- validation/canonical helpers required by tests;
- ResearchStore and narrow port interfaces;
- SQLiteResearchStore;
- strict command/query decoders.

It does not export the service class, SQLite mappers, prompt templates, active
controller map, or provider adapters.

Cross-capability imports use a bare package alias such as #research. The exact
and wildcard aliases must be added to both apps/backend/package.json imports
and apps/backend/tsconfig.json paths with development/types/default mappings.

## Job wiring

registerResearchEndpoints.ts registers exactly:

~~~text
POST /research/command  -> serial inline Job
POST /research/query    -> concurrent inline Job
~~~

createResearchJobs.ts turns decoded values into fresh Jobs and maps typed
errors to transport responses.

registerResearchInternalJobs.ts registers compute and settle intents through
the registrar face of SchedulerInternalJobsRuntime.

researchJobPayloads.ts is limited to intent conversion and must not become a
second domain model.

## Construction

1-init/create/research.ts:

1. Opens ./data/research.db.
2. Constructs SQLiteResearchStore with configured project ID.
3. Creates composition adapters for Intelligence, Knowledge/resource scope,
   Structured Data + Formula, bounded computation, project frame, Questions,
   Hypotheses, Findings, optional Analytic Output reads, General Files, and Web
   Retrieval.
4. Passes the dispatch-only Research internal Jobs runtime.
5. Binds actor attribution from configured user ID and Research limits from
   configuration.
6. Returns ResearchCapability.

startBackend.ts constructs prerequisites before Research, then:

~~~text
create Research internal Jobs runtime
create Research capability
register Research internal Jobs
register Research endpoints
recover Research attempts
bind HTTP listener
~~~

Research recovery must complete its durable scan before the listener admits
new requests. Dispatch admission may continue asynchronously through the
existing retry mechanism.

## Configuration

~~~ts
interface ResearchConfig {
  readonly maxThreadTitleBytes: number;
  readonly maxMessageBytes: number;
  readonly maxMessagesPerThread: number;
  readonly maxFrozenThreadMessages: number;
  readonly maxFrozenThreadBytes: number;
  readonly maxProjectFrameBytes: number;
  readonly maxConcurrentRunsPerThread: number;
  readonly maxPlanSteps: number;
  readonly maxRounds: number;
  readonly maxQueriesPerRound: number;
  readonly maxKnowledgeRegionsPerQuery: number;
  readonly maxWebResultsPerQuery: number;
  readonly maxDataEntriesInspected: number;
  readonly maxStructuredDataBindings: number;
  readonly maxComputationTasks: number;
  readonly maxComputationInputBytes: number;
  readonly maxComputationResultBytes: number;
  readonly maxComputationDurationMs: number;
  readonly maxDirectReadBytes: number;
  readonly maxPersistedWebBodyBytes: number;
  readonly maxFindingCandidates: number;
  readonly maxResultBytes: number;
  readonly retainedTerminalRunsPerThread: number;
  readonly retainedEventsPerRun: number;
}
~~~

Configuration supplies bounds, not model/provider names. Intelligence purpose
routing remains behind the reasoning adapter.

## Dependency direction

~~~text
Research domain
  <- Research application
      <- Research-owned ports
      <- adapters in 1-init
          -> Platform Intelligence
          -> Platform Knowledge + runtime resource registry
          -> Platform Formula
          -> Platform Web Retrieval
          -> bounded computation adapter
          -> Structured Data
          -> Questions / Hypotheses / Findings
          -> Analytic Output
          -> General Files

Transport -> Research job wiring -> Research public barrel
~~~

No dependency points from a platform module into Research. Adjacent
capabilities may read Research through a narrow public port but never import its
store.

## Build prerequisites

The core Thread, Run, Knowledge, and Structured Data paths can be implemented
with the currently available contracts. Optional paths become available only
when their narrow adapters exist:

1. The Web channel requires a concrete Platform Web Retrieval adapter.
2. Quantitative Python tests require a bounded computation adapter with no
   ambient network or project-store access.
3. Explicit Finding proposal requires a keyed idempotent Findings contract;
   each candidate's grounding kind must also be representable by Findings.
   Candidates that cannot cross that boundary remain `blocked_grounding`
   without blocking the Research Run.
4. Canonical Question and Hypothesis subjects require their read ports;
   free-form Question and Hypothesis Runs remain valid independently.
5. Existing Analytic Output inputs require exact materialization reads; the
   input remains optional.
6. Project framing uses the Project reader when available and otherwise the
   configuration-backed adapter described above.

Construction exposes every unavailable optional path explicitly. It never
silently treats an unavailable adapter as an empty search, empty computation,
or missing result.

## Test strategy

### Domain

- mode-specific result validation;
- state-transition table;
- canonical digest stability;
- scope-policy normalization;
- exact FormulaWireValue preservation;
- grounding-reference validation;
- bounded plan/query/result counts.

### Application

- Thread CAS and idempotent receipts;
- one immutable Message and Run per accepted normal/continuation submission;
- exact latest-Run linkage for every non-initial user turn;
- Question/Hypothesis text snapshots;
- all retrieval calls use one scope manifest;
- structured Data discovers project entries but pins only reads;
- non-testable Hypothesis awaits input without rewrite;
- cancellation before, during, and after compute;
- retry links a distinct Run;
- stale/cancelled settlement does not publish;
- Finding and General File delegated claims survive retry.

### Persistence

- complete schema on empty database;
- transaction rollback;
- Run/event revision contiguity;
- stage claim exclusivity;
- compare-and-publish races;
- recovery of interrupted receipts without regenerating an existing plan;
- result and provenance retention;
- project-prefix isolation.

### Wiring

- exact two-route inventory;
- fresh Job per request;
- command serial, query concurrent;
- compute concurrent, settle serial;
- strict unknown-key rejection;
- error/status mapping;
- no Fastify types outside transport.

### End-to-end deterministic

Use fake Intelligence, Web Retrieval, Knowledge, resource readers, Data,
computation, Analytic Output reads, Findings, and General Files. Verify complete
Discovery, Question, Hypothesis-awaiting-input, Hypothesis-completed,
cancellation, retry, Finding proposal, and explicit web-save flows without paid
provider calls.

## Removal boundary

Removing Research means deleting:

- 3-capabilities/research;
- 4-job-wiring/research;
- 1-init/create/research.ts;
- its startBackend construction/registration/recovery block;
- its aliases and configuration;
- research.db and tests.

Formula, Knowledge, Structured Data, General Files, Findings, Questions,
Hypotheses, and Analytic Output remain independently valid. Their canonical
tables contain no foreign keys to Research.
