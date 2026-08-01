# Research Capability — Canonical Model

## Purpose

Research is the project-scoped investigation capability behind the Research
screen. It provides a durable, mode-aware conversation over three information
channels:

- scoped text retrieval through Platform Knowledge;
- all-or-nothing access to project Structured Data;
- bounded public-web search and fetch through Platform Web Retrieval.

It supports `discovery`, `question`, and `hypothesis` runs. Every turn is
durable: the initiating message, exact inquiry snapshot, selected channels,
frozen Knowledge scope, Structured Data resolver identity, plan, retrieved
material, model usage, structured result, and proposed Findings remain
inspectable after completion.

Research owns investigation Threads, Messages, Runs, plans, plan-step attempts,
Run compute attempts and candidates, stage receipts, run-scoped web material,
exact Knowledge/Data/Analytic Output uses, structured
results, and local Finding candidates. It does not own Questions, Hypotheses, Findings,
General Files, Contexts, Structured Data, Analytic Outputs, Knowledge indexes,
web transport, or model routing.

## Naming and primitive values

```ts
import type { ContextEntry } from "#context";
import type { FormulaWireValue } from "#formula";
import type {
  KnowledgeResourceDescriptor,
  KnowledgeScopeManifest,
} from "#platform/knowledge";
import type { Usage } from "#platform/intelligence/types.js";

type ResearchThreadId = string;
type ResearchMessageId = string;
type ResearchRunId = string;
type ResearchStepId = string;
type ResearchStepAttemptId = string;
type ResearchRunComputeAttemptId = string;
type ResearchRunComputeCandidateId = string;
type ResearchRunStageReceiptId = string;
type ResearchQueryId = string;
type WebResultId = string;
type ResearchUseId = string;
type FindingCandidateId = string;
type FindingId = string;
type ActorId = string;
type IsoTimestamp = string;
type Digest = string;
```

IDs are stable opaque strings. Digests are lowercase SHA-256 hex strings over
canonical encodings. Timestamps are UTC ISO-8601 strings. Project and actor
identity are supplied by runtime composition and are absent from public
request payloads.

## Threads and messages

A Thread is the durable conversational container. Every Run has one initiating
user Message and may append one assistant Message during settlement. A normal
turn appends a new user Message and creates one Run. A retry creates a distinct
Run that deliberately reuses the prior Run's initiating Message, so one Message
may initiate a retry-linked family of Runs.

```ts
type ResearchThreadLifecycle = "active" | "archived";

interface ResearchThread {
  readonly id: ResearchThreadId;
  readonly title?: string;
  readonly defaultMode: ResearchMode;
  readonly scope: ResearchScopePolicy;
  readonly lifecycle: ResearchThreadLifecycle;
  readonly revision: number;
  readonly messageCount: number;
  /** The most recently created Run, including a retry Run. */
  readonly latestRunId?: ResearchRunId;
  readonly createdBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

type ResearchMessageRole = "user" | "assistant";

interface ResearchMessage {
  readonly id: ResearchMessageId;
  readonly threadId: ResearchThreadId;
  readonly ordinal: number;
  readonly role: ResearchMessageRole;
  readonly text: string;
  /** Present on an assistant response produced by a settled Run. */
  readonly runId?: ResearchRunId;
  readonly createdBy: ActorId;
  readonly createdAt: IsoTimestamp;
}
```

Messages are append-only and use contiguous one-based ordinals within a
Thread. Editing a past Message would change the input of later Runs and is not
a canonical operation. A correction is a new user Message.

## Modes and inquiry snapshots

```ts
type ResearchMode = "discovery" | "question" | "hypothesis";

interface DiscoverySubject {
  readonly mode: "discovery";
  readonly topic?: string;
}

interface QuestionSnapshot {
  readonly questionId: string;
  readonly text: string;
  readonly description?: string;
  readonly answer?: string;
  readonly status?: string;
  readonly tags: readonly string[];
  readonly updatedAt: IsoTimestamp;
  readonly capturedAt: IsoTimestamp;
  readonly digest: Digest;
}

interface QuestionSubject {
  readonly mode: "question";
  /** Absent for a free-form question supplied only in the initiating Message. */
  readonly question?: QuestionSnapshot;
}

interface HypothesisSnapshot {
  readonly hypothesisId: string;
  readonly questionId: string;
  readonly statement: string;
  readonly rationale?: string;
  readonly status?: string;
  readonly confidence?: number;
  readonly updatedAt: IsoTimestamp;
  readonly capturedAt: IsoTimestamp;
  readonly digest: Digest;
}

interface HypothesisSubject {
  readonly mode: "hypothesis";
  /** Absent for a free-form hypothesis supplied only in the initiating Message. */
  readonly hypothesis?: HypothesisSnapshot;
  /** Captured when the selected Hypothesis has a readable parent Question. */
  readonly question?: QuestionSnapshot;
}

type ResearchSubject =
  | DiscoverySubject
  | QuestionSubject
  | HypothesisSubject;
```

Question and Hypothesis currently expose last-write-wins records without a
revision counter. Research therefore pins their exact readable fields and a
canonical digest rather than inventing a `questionRevision` or
`hypothesisRevision`. Adding revisions to those capabilities later can extend
the snapshots without changing their present meaning.

## Channel and scope policy

```ts
interface ResearchWebPolicy {
  readonly enabled: boolean;
  readonly maxSearchQueries: number;
  readonly maxResultsPerQuery: number;
  readonly maxFetchedPages: number;
  readonly allowedDomains?: readonly string[];
  readonly excludedDomains?: readonly string[];
  readonly recencyDays?: number;
}

interface ResearchKnowledgePolicy {
  readonly enabled: boolean;
  /** Empty means the full project lattice; otherwise Context resolves it. */
  readonly contextEntries: readonly ContextEntry[];
  readonly maxQueries: number;
  readonly topKPerQuery: number;
}

interface ResearchStructuredDataPolicy {
  readonly enabled: boolean;
}

interface ResearchAnalyticOutputPolicy {
  readonly enabled: boolean;
  /** Explicit materializations available as inputs to this Run. */
  readonly materializationIds: readonly string[];
}

interface ResearchScopePolicy {
  readonly web: ResearchWebPolicy;
  readonly knowledge: ResearchKnowledgePolicy;
  /** Structured Data has no sub-scope: enabled means all project entries. */
  readonly structuredData: ResearchStructuredDataPolicy;
  readonly analyticOutputs: ResearchAnalyticOutputPolicy;
}
```

The three primary channels are Web, Knowledge, and Structured Data. Analytic
Output materializations are exact derived inputs, not a fourth discovery
channel. They are included explicitly when Research is asked to reason from an
existing chart or table output.

## Run input and frozen scope

```ts
interface ResearchRunInput {
  readonly initiatingMessageId: ResearchMessageId;
  readonly initiatingMessageText: string;
  readonly mode: ResearchMode;
  readonly subject: ResearchSubject;
  readonly scopePolicy: ResearchScopePolicy;
  readonly projectFrame: ResearchProjectFrameSnapshot;
  readonly policyVersion: string;
  readonly requestedAt: IsoTimestamp;
}

interface ResearchProjectFrameSnapshot {
  readonly projectSummary?: string;
  readonly questions: readonly QuestionSnapshot[];
  readonly hypotheses: readonly HypothesisSnapshot[];
  readonly capturedAt: IsoTimestamp;
  readonly digest: Digest;
}

interface FrozenThreadHistory {
  readonly throughOrdinal: number;
  readonly messageIds: readonly ResearchMessageId[];
  readonly digest: Digest;
}

interface StructuredDataBindingRef {
  readonly entryId: string;
  readonly displayName: string;
  readonly kind: "variable" | "function" | "table" | "record" | "list";
  readonly revision: number;
}

interface FrozenStructuredDataScope {
  readonly enabled: boolean;
  readonly resolverSnapshotId?: string;
  readonly resolverDigest?: Digest;
  readonly bindings: readonly StructuredDataBindingRef[];
  readonly capturedAt: IsoTimestamp;
}

interface AnalyticOutputMaterializationRef {
  readonly analyticOutputId: string;
  readonly definitionRevision: number;
  readonly materializationId: string;
  readonly materializationDigest: Digest;
}

interface FrozenResearchScope {
  readonly thread: FrozenThreadHistory;
  readonly subject: ResearchSubject;
  readonly policy: ResearchScopePolicy;
  readonly knowledge: KnowledgeScopeManifest | null;
  readonly knowledgeGeneration: number;
  readonly structuredData: FrozenStructuredDataScope;
  readonly analyticOutputs: readonly AnalyticOutputMaterializationRef[];
  readonly projectFrame: ResearchProjectFrameSnapshot;
  readonly intelligenceRoutes: readonly ResolvedResearchRoute[];
  readonly policyVersion: string;
  readonly frozenAt: IsoTimestamp;
  readonly digest: Digest;
}

interface ResolvedResearchRoute {
  readonly purpose: string;
  readonly strength: "low" | "medium" | "high";
  readonly speed: "low" | "medium" | "high";
  readonly provider: string;
  readonly model: string;
  readonly effort?: "low" | "medium" | "high";
}
```

One Run uses one `FrozenResearchScope` for its entire lifetime. Every Knowledge
query supplies the same `KnowledgeScopeManifest`. Tool-driven follow-up queries
cannot silently drop or widen it. Structured Data is frozen as one resolver
snapshot identity and a sorted list of contributing entry revisions. The
snapshot map itself is reconstructed through the injected resolver; only its
stable identity is canonical Research state.

## Run lifecycle

```ts
type ResearchRunStage =
  | "freeze"
  | "plan"
  | "gather"
  | "evaluate"
  | "synthesize"
  | "settle";

type ResearchRunState =
  | "queued"
  | "running"
  | "awaiting_input"
  | "completed"
  | "failed"
  | "interrupted"
  | "cancel_requested"
  | "cancelled";

interface ResearchRun {
  readonly id: ResearchRunId;
  readonly threadId: ResearchThreadId;
  readonly initiatingMessageId: ResearchMessageId;
  readonly mode: ResearchMode;
  readonly input: ResearchRunInput;
  readonly frozenScope: FrozenResearchScope;
  readonly state: ResearchRunState;
  readonly stage: ResearchRunStage;
  readonly revision: number;
  readonly retryOfRunId?: ResearchRunId;
  readonly continuationOfRunId?: ResearchRunId;
  readonly planDigest?: Digest;
  readonly resultDigest?: Digest;
  readonly failure?: ResearchFailure;
  readonly createdBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly startedAt?: IsoTimestamp;
  readonly settledAt?: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

interface ResearchFailure {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly stage: ResearchRunStage;
}
```

The Run revision advances only through guarded serial transitions. Operational
Run-compute, step-attempt, receipt, and retrieval records may change during
concurrent computation, but they cannot publish a Result or assistant Message.

`retryOfRunId` links a new Run to the Run being retried; both Runs use the same
initiating user Message. `continuationOfRunId` links a new user turn to a
Thread's immediately preceding Run, whether that predecessor is terminal or
still computing. The structured `run.continue` operation is reserved for an
`awaiting_input` Run that is still the Thread's latest. Neither relationship
reopens or rewrites the prior Run.

## Plan, steps, and attempts

```ts
type ResearchStepKind =
  | "frame"
  | "decompose"
  | "web-search"
  | "web-fetch"
  | "knowledge-retrieve"
  | "structured-data-read"
  | "analytic-output-read"
  | "compute"
  | "compare"
  | "challenge"
  | "synthesize";

interface ResearchPlanStep {
  readonly id: ResearchStepId;
  readonly sequence: number;
  readonly kind: ResearchStepKind;
  readonly objective: string;
  readonly dependsOn: readonly ResearchStepId[];
}

interface ResearchPlan {
  readonly runId: ResearchRunId;
  readonly objective: string;
  readonly subquestions: readonly string[];
  readonly assumptionsToInspect: readonly string[];
  readonly steps: readonly ResearchPlanStep[];
  readonly createdAt: IsoTimestamp;
  readonly digest: Digest;
}

type ResearchStepAttemptState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "interrupted"
  | "cancelled";

interface ResearchStepAttempt {
  readonly id: ResearchStepAttemptId;
  readonly runId: ResearchRunId;
  readonly stepId: ResearchStepId;
  readonly attempt: number;
  readonly state: ResearchStepAttemptState;
  readonly inputDigest: Digest;
  readonly outputDigest?: Digest;
  readonly usage?: Usage;
  readonly failure?: ResearchFailure;
  readonly startedAt?: IsoTimestamp;
  readonly finishedAt?: IsoTimestamp;
  readonly createdAt: IsoTimestamp;
}
```

`ResearchStepAttempt` applies only to execution of a step in a persisted
`ResearchPlan`; it is not the durable identity of the whole concurrent Job. If
one plan step is retried inside a Run compute attempt, it appends a new step
attempt number and never overwrites the prior attempt.

A Run owns at most one immutable ResearchPlan. Automatic recovery reuses that
plan when it was committed before interruption; it never asks Intelligence to
regenerate different bytes under the same Run identity. Only an attempt that
has no persisted plan may execute the planning step. An explicit user retry
creates a new Run and therefore may create a new plan.

## Durable Run compute attempts and candidates

The whole concurrent investigation has its own durable identity. Internal Job
intents carry `ResearchRunComputeAttempt.id`, never a positional attempt number.
That makes queue replay, crash recovery, candidate settlement, and diagnostic
records refer to one opaque piece of work.

```ts
type ResearchRunComputeAttemptState =
  | "queued"
  | "running"
  | "candidate_ready"
  | "settling"
  | "settled"
  | "stale"
  | "failed"
  | "interrupted"
  | "cancelled";

interface ResearchRunComputeAttempt {
  readonly id: ResearchRunComputeAttemptId;
  readonly runId: ResearchRunId;
  /** Human-readable ordering only; never used as a Job identity. */
  readonly sequence: number;
  readonly state: ResearchRunComputeAttemptState;
  readonly frozenRunRevision: number;
  readonly frozenScopeDigest: Digest;
  readonly inputDigest: Digest;
  readonly failure?: ResearchFailure;
  readonly queuedAt: IsoTimestamp;
  readonly startedAt?: IsoTimestamp;
  readonly computeFinishedAt?: IsoTimestamp;
  readonly settledAt?: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

type ResearchRunStageReceiptState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "interrupted"
  | "cancelled";

interface ResearchRunStageReceipt {
  readonly id: ResearchRunStageReceiptId;
  readonly runComputeAttemptId: ResearchRunComputeAttemptId;
  readonly runId: ResearchRunId;
  readonly stage: ResearchRunStage;
  readonly state: ResearchRunStageReceiptState;
  readonly inputDigest: Digest;
  readonly outputDigest?: Digest;
  readonly failure?: ResearchFailure;
  readonly createdAt: IsoTimestamp;
  readonly startedAt?: IsoTimestamp;
  readonly finishedAt?: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

type ResearchRunStageReceipts = Readonly<{
  [Stage in ResearchRunStage]: ResearchRunStageReceipt & {
    readonly stage: Stage;
  };
}>;

interface ResearchRunComputeCandidate {
  readonly id: ResearchRunComputeCandidateId;
  readonly runComputeAttemptId: ResearchRunComputeAttemptId;
  readonly runId: ResearchRunId;
  readonly expectedRunRevision: number;
  readonly frozenScopeDigest: Digest;
  readonly inputDigest: Digest;
  readonly planDigest: Digest;
  readonly result: ResearchRunResult;
  readonly assistantText: string;
  readonly findingCandidates: readonly FindingCandidate[];
  readonly digest: Digest;
  readonly createdAt: IsoTimestamp;
}
```

There is at most one immutable candidate per Run compute attempt. The candidate
is committed together with the attempt transition to `candidate_ready` and the
completed synthesis receipt. Serial settlement consumes that exact candidate.
Creation of the first Run compute attempt persists all six receipts in the same
transaction: freeze is `completed`, while plan, gather, evaluate, synthesize,
and settle are `pending`. A recovery replacement also persists all six; when
the Run already owns a plan, its plan receipt starts `completed` and compute
loads that exact plan by the receipt's matching `outputDigest`; otherwise it
starts `pending`. Each
`(runComputeAttemptId, stage)` has exactly one receipt whose guarded transitions
record which stage can be safely resumed or superseded after a restart. No
stage may exist only in memory.

If concurrent compute fails or observes cancellation before a candidate is
committed, the attempt becomes `failed` or `cancelled` with no candidate and all
of its non-settle receipts become terminal in the same transaction; the settle
receipt remains `pending`. The same serial settle intent completes that receipt
and publishes the owning Run's matching terminal state. Recovery re-dispatches
that settlement when the attempt is terminal but its Run is not. An
`interrupted` attempt instead receives an atomic replacement attempt inside the
same Run; it is never treated as an explicit Run retry.

## Run-scoped web provenance

Web results remain Research records unless the user explicitly saves a page as
a General File.

```ts
interface WebSearchQuery {
  readonly id: ResearchQueryId;
  readonly runId: ResearchRunId;
  readonly attemptId: ResearchStepAttemptId;
  readonly query: string;
  readonly requestedAt: IsoTimestamp;
  readonly digest: Digest;
}

interface WebResultRecord {
  readonly id: WebResultId;
  readonly runId: ResearchRunId;
  readonly attemptId: ResearchStepAttemptId;
  readonly queryId: ResearchQueryId;
  readonly ordinal: number;
  readonly requestedUrl: string;
  readonly finalUrl?: string;
  readonly title?: string;
  readonly searchSnippet?: string;
  readonly retrievedAt: IsoTimestamp;
  readonly statusCode?: number;
  readonly contentType?: string;
  readonly normalizedTextDigest?: Digest;
  readonly normalizedTextLength?: number;
  readonly truncated: boolean;
  readonly redirectChain: readonly string[];
}

interface WebResultText {
  readonly webResultId: WebResultId;
  /** Exact bounded normalized text exposed to Research. */
  readonly text: string;
  readonly digest: Digest;
}
```

Persisting bounded normalized text is required because a URL may later change.
The result records requested and final URL separately and retains redirect and
truncation facts. Saving the page to General Files is an explicit later action
and does not replace or rewrite the historical Research record.

## Exact material used by a Run

Retrieval results are not provenance merely because they were returned. The
following records capture material actually selected for reasoning or cited by
the Result.

```ts
interface KnowledgeUse {
  readonly id: ResearchUseId;
  readonly runId: ResearchRunId;
  readonly attemptId: ResearchStepAttemptId;
  readonly query: string;
  readonly scopeDigest: Digest;
  readonly sourceId: string;
  readonly resource?: KnowledgeResourceDescriptor;
  readonly label: string;
  /** Current Knowledge offsets are UTF-16 code-unit positions. */
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly textDigest: Digest;
  readonly relevance: number;
  readonly density: number;
}

type StructuredDataSelector =
  | { readonly kind: "whole-entry" }
  | { readonly kind: "fields"; readonly fieldNames: readonly string[] }
  | {
      readonly kind: "formula";
      readonly source: string;
      readonly expressionDigest: Digest;
    };

interface StructuredDataUse {
  readonly id: ResearchUseId;
  readonly runId: ResearchRunId;
  readonly attemptId: ResearchStepAttemptId;
  readonly entryId: string;
  readonly entryRevision: number;
  readonly resolverDigest: Digest;
  readonly selector: StructuredDataSelector;
  readonly value: FormulaWireValue;
  readonly valueDigest: Digest;
}

interface AnalyticOutputUse {
  readonly id: ResearchUseId;
  readonly runId: ResearchRunId;
  readonly attemptId: ResearchStepAttemptId;
  readonly ref: AnalyticOutputMaterializationRef;
  readonly selector?: StructuredDataSelector;
  readonly value: FormulaWireValue;
  readonly valueDigest: Digest;
}

type ResearchComputationSpec =
  | {
      readonly kind: "formula";
      readonly source: string;
      readonly sourceDigest: Digest;
    }
  | {
      readonly kind: "python";
      readonly code: string;
      readonly codeDigest: Digest;
      readonly entrypoint: "main";
    };

type ResearchComputationInputRef =
  | {
      readonly kind: "structured-data";
      readonly useId: ResearchUseId;
      readonly valueDigest: Digest;
    }
  | {
      readonly kind: "analytic-output";
      readonly useId: ResearchUseId;
      readonly valueDigest: Digest;
    };

interface ResearchComputationLimits {
  readonly timeoutMs: number;
  readonly maxMemoryBytes: number;
  readonly maxOutputBytes: number;
  readonly network: "disabled";
}

interface ResearchComputationRecord {
  readonly id: ResearchUseId;
  readonly runId: ResearchRunId;
  readonly attemptId: ResearchStepAttemptId;
  readonly engine: "formula" | "sandbox-python";
  readonly engineVersion: string;
  readonly specification: ResearchComputationSpec;
  readonly inputs: readonly ResearchComputationInputRef[];
  readonly inputDigest: Digest;
  readonly limits: ResearchComputationLimits;
  readonly state: "succeeded" | "failed";
  /** Validated, bounded output. Python never persists an opaque process value. */
  readonly output?: FormulaWireValue;
  readonly outputDigest?: Digest;
  readonly diagnostics: readonly {
    readonly code: string;
    readonly message: string;
  }[];
  readonly startedAt: IsoTimestamp;
  readonly finishedAt: IsoTimestamp;
}
```

Structured Data has stable entry IDs and entry revisions, but no stable column
or row IDs. Field selectors therefore use names against an exact entry
revision. A changed schema or revision makes the use historical; it never
silently rebinds to a same-named field in a newer entry.

Quantitative tests belong to a bounded Research computation seam, not to
Analytic Output. Formula calculations run through Platform Formula. Statistical
or simulation work may run through an injected, network-disabled Python
sandbox. Both receive only exact `FormulaWireValue` inputs and persist the
engine version, source/code, limits, input manifest, output, diagnostics, and
digests. Analytic Output is a visualization specification/materialization; an
existing materialization may be read as an input, but Research never asks it to act
as a general Python or statistical executor.

## Grounding references and Finding candidates

```ts
type ResearchGroundingReference =
  | {
      readonly kind: "knowledge";
      readonly knowledgeUseId: ResearchUseId;
    }
  | {
      readonly kind: "web";
      readonly webResultId: WebResultId;
      readonly start: number;
      readonly end: number;
      readonly exactText: string;
      readonly exactTextDigest: Digest;
    }
  | {
      readonly kind: "structured-data";
      readonly structuredDataUseId: ResearchUseId;
    }
  | {
      readonly kind: "analytic-output";
      readonly analyticOutputUseId: ResearchUseId;
    }
  | {
      readonly kind: "computation";
      readonly computationId: ResearchUseId;
    };

type FindingCandidateReviewState =
  | "unreviewed"
  | "approved_for_proposal"
  | "rejected"
  | "deferred"
  | "blocked_grounding";

interface FindingCandidate {
  readonly id: FindingCandidateId;
  readonly runId: ResearchRunId;
  readonly claim: string;
  readonly grounding: readonly ResearchGroundingReference[];
  readonly commentary?: string;
  readonly tags: readonly string[];
  readonly questionIds: readonly string[];
  readonly hypothesisIds: readonly string[];
  readonly reviewState: FindingCandidateReviewState;
  readonly recommendation: "recommended" | "needs_review";
  readonly diagnostic?: string;
  readonly createdAt: IsoTimestamp;
}

interface FindingLink {
  readonly candidateId: FindingCandidateId;
  readonly findingId: FindingId;
  readonly linkedAt: IsoTimestamp;
  readonly linkedBy: ActorId;
}
```

Research stores a candidate claim and exact Research-owned grounding first.
Creating a canonical Finding is a separate, explicit capability call. The
current Findings design accepts only a Knowledge `sourceId` plus a character or
line span. That contract cannot faithfully express a transient web result,
Structured Data revision, Computation record, or Analytic Output
materialization. Until Findings widens its reference union, those candidates
remain reviewable in Research and must not be reported as admitted Findings.
Research must not auto-save web pages as General Files merely to work around
this type mismatch.

## Structured run results

All modes return a closed structured result. Prose for the assistant Message is
a projection of this object rather than a second authority.

```ts
interface ResearchResultBase {
  readonly runId: ResearchRunId;
  readonly summary: string;
  readonly method: readonly string[];
  readonly limitations: readonly string[];
  readonly findingCandidateIds: readonly FindingCandidateId[];
  readonly usage: Usage;
  readonly createdAt: IsoTimestamp;
  readonly digest: Digest;
}

interface DiscoveryResearchResult extends ResearchResultBase {
  readonly mode: "discovery";
  readonly outcome: "completed";
  readonly briefing: string;
  readonly sections: readonly {
    readonly heading: string;
    readonly body: string;
    readonly grounding: readonly ResearchGroundingReference[];
  }[];
  readonly areasToExplore: readonly string[];
}

interface QuestionResearchResult extends ResearchResultBase {
  readonly mode: "question";
  readonly outcome: "completed";
  readonly answer: string;
  readonly decomposedQuestions: readonly string[];
  readonly assumptions: readonly string[];
  readonly proposedHypotheses: readonly string[];
  readonly unresolvedGaps: readonly string[];
  readonly grounding: readonly ResearchGroundingReference[];
}

type HypothesisAssessment =
  | "supported"
  | "refuted"
  | "qualified"
  | "inconclusive";

interface HypothesisResearchResult extends ResearchResultBase {
  readonly mode: "hypothesis";
  readonly outcome: "completed";
  readonly testedStatement: string;
  readonly assessment: HypothesisAssessment;
  readonly assumptions: readonly string[];
  readonly falsificationCriteria: readonly string[];
  readonly disconfirmingMaterial: readonly ResearchGroundingReference[];
  readonly qualifyingMaterial: readonly ResearchGroundingReference[];
  readonly unresolvedGaps: readonly string[];
}

interface AwaitingInputResearchResult extends ResearchResultBase {
  readonly mode: ResearchMode;
  readonly outcome: "awaiting_input";
  readonly reason:
    | "clarification"
    | "hypothesis_not_testable"
    | "missing_required_choice";
  readonly prompt: string;
  readonly alternatives: readonly {
    readonly id: string;
    readonly label: string;
    readonly statement?: string;
    readonly rationale?: string;
  }[];
}

type ResearchRunResult =
  | DiscoveryResearchResult
  | QuestionResearchResult
  | HypothesisResearchResult
  | AwaitingInputResearchResult;
```

A hypothesis that cannot be tested is not silently rewritten. The Run settles
to `awaiting_input` with an `AwaitingInputResearchResult`. A later user Message
selects or supplies a statement and starts a new Run linked through
`continuationOfRunId`; the settled Run is never reopened or rewritten.

No arbitrary numeric model-confidence field exists. The Result exposes the
method, exact grounding, limitations, contrary material, and unresolved gaps so
the user can assess strength from inspectable facts.

## Canonical and derived state

Canonical Research state includes:

- Thread head and append-only Messages;
- Run input, frozen scope, guarded state transitions, and Run events;
- immutable plans, steps, step attempts, Run compute candidates, queries,
  result text, exact material uses, Results, Finding candidates, and Finding
  links;
- guarded Run compute attempts and their six durable stage receipts;
- idempotency receipts and retry relationships.

Rebuildable projections include Thread previews, Run timelines, mode/status
lists, unreviewed Finding-candidate queues, citation displays, usage summaries,
and rendered assistant-message layouts.

Provider-native traces, hidden reasoning, transient ranking candidates, raw
search-provider payloads, and frontend rendering state are neither canonical
Research state nor safe diagnostic content.

## Governing invariants

1. A Run belongs to exactly one Thread and one initiating user Message. A
   Message may initiate multiple Runs only along an explicit retry chain.
2. Thread Message ordinals are append-only, contiguous, and unique.
3. A Run uses one immutable frozen scope and one matching mode/subject.
4. Every Knowledge retrieval and bounded read uses the frozen scope manifest.
5. Structured Data is either disabled or frozen as the complete project
   resolver snapshot; Research does not invent a hidden sub-scope.
6. Web results retain the exact bounded normalized text used by the Run.
7. Formula values cross the boundary only as `FormulaWireValue`.
8. Concurrent work may append operational records and one immutable candidate
   per Run compute attempt, but cannot publish a Result, assistant Message, or
   Finding link.
9. Settlement is compare-and-swap against the frozen Run revision and digests.
10. A failed or stale compute candidate cannot replace a settled Result.
11. Research creates local Finding candidates; Findings remains the authority for
    admitted Finding identity and lifecycle.
12. Question and Hypothesis records are read and snapshotted, never silently
    mutated by a Research Run.
13. A clarification or Hypothesis reformulation starts a new Run linked through
    `continuationOfRunId`; a terminal Run is never reopened.
14. `ResearchStepAttempt` identities belong only to plan steps. Scheduler Jobs,
    candidates, stage receipts, and recovery use an opaque
    `ResearchRunComputeAttemptId`.
15. `ResearchThread.latestRunId` names the most recently created Run. Every
    non-initial user turn links to the value it replaces.
16. One Run owns at most one immutable ResearchPlan; recovery either reuses it
    or creates the first plan when none was committed.
