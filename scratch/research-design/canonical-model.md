# Research — canonical model

## Aggregate

```text
ResearchThread                  the conversation container
  ├─ ResearchMessage[]          append-only, seq-ordered, immutable
  └─ ResearchRun[]              one per user turn that requires work
       ├─ agentTaskId           the execution lives in Agents
       ├─ mode                  immutable: discovery | question | hypothesis
       ├─ subject               frozen at creation
       ├─ channels              frozen at creation
       ├─ result                typed per mode, written at settlement
       ├─ grounding[]           exact references the result cites
       └─ candidate[]           reviewable Finding candidates
```

Research is a **process record**, not authored content. There are no
ChangeSets, no inverse operations, and no rebase. Messages, runs, and results
are historical facts; a retry creates a new run linked to the old one rather
than overwriting it.

## Thread and message

```ts
interface ResearchThread {
  readonly id: string;
  readonly title: string;              // derived from the first message, editable
  readonly headSeq: number;
  readonly latestRunId?: string;
  readonly createdBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly deletedAt?: IsoTimestamp;
}

interface ResearchMessage {
  readonly id: string;
  readonly threadId: string;
  readonly seq: number;                // contiguous from 1
  readonly role: "user" | "assistant";
  readonly text: string;
  /** Present on assistant messages; absent on user messages. */
  readonly runId?: string;
  readonly createdAt: IsoTimestamp;
}
```

**Every assistant message is backed by exactly one settled run.** There is no
path that appends assistant prose without a run behind it, which is what makes
every claim in the conversation traceable to the material that produced it.

Messages are immutable. Editing a question means asking a new one.

## Run

```ts
type ResearchMode = "discovery" | "question" | "hypothesis";

type ResearchRunState =
  | "running"      // the agent task is live
  | "waiting"      // the agent task asked the user something
  | "settled"      // a typed result was validated and stored
  | "incomplete"   // settled without meeting the mode's completion criteria
  | "failed"
  | "cancelled";

interface ResearchRun {
  readonly id: string;
  readonly threadId: string;
  readonly userMessageId: string;

  /** The Agents task carrying out this run. */
  readonly agentTaskId: string;

  readonly mode: ResearchMode;                 // immutable
  readonly subject: ResearchSubject;           // frozen
  readonly channels: ResearchChannels;         // frozen
  readonly state: ResearchRunState;

  /** Links, never rewrites. */
  readonly continuationOfRunId?: string;
  readonly retryOfRunId?: string;

  readonly result?: ResearchResult;            // typed per mode
  readonly assistantMessageId?: string;
  readonly failureCode?: string;

  readonly createdAt: IsoTimestamp;
  readonly settledAt?: IsoTimestamp;
}
```

`state` is a projection of the agent task's state plus Research's own
settlement, not a second authority. Agents owns whether the task is running;
Research owns whether a validated typed result exists.

The distinction that matters: an agent task can settle `completed` while the
research run is `incomplete`, because the task met its objective and the *mode*
did not meet its completion criteria. Hypothesis mode that never managed a
refutation attempt is the common case.

## Subject

```ts
type ResearchSubject =
  | { kind: "topic";      text: string }
  | { kind: "question";   text: string; description?: string;
      canonical?: CanonicalRef }
  | { kind: "hypothesis"; statement: string; rationale?: string;
      questionText?: string; canonical?: CanonicalRef };

/** A frozen snapshot of a canonical object, taken at run creation. */
interface CanonicalRef {
  readonly id: string;
  readonly digest: string;      // over the snapshotted fields
  readonly capturedAt: IsoTimestamp;
}
```

Freezing the text rather than holding a live pointer is the same discipline
Persona and Agents use. A question edited mid-run does not change what the run
investigated, and the run's record says what it actually read.

`canonical` is absent for free-form subjects. A hypothesis can be tested without
existing as a canonical Hypothesis — and because
`hypotheses-design.md` requires exactly one `questionId` per Hypothesis, saving
one afterwards forces the caller to pick or create a Question. Research surfaces
that as a suggestion; it never invents the Question.

## Channels

```ts
interface ResearchChannels {
  readonly knowledge: boolean;                     // default true
  readonly contextEntries: readonly ContextEntry[]; // [] = whole project
  readonly structuredData: boolean;                // default true
  readonly web: boolean;                           // default false
  readonly computation: boolean;                   // default false
  readonly structuredAnalyticIds: readonly string[]; // explicit, read-only
  /** Project Knowledge generation at freeze. See below. */
  readonly knowledgeGeneration: number;
}
```

### Knowledge generation

`knowledgeGeneration` is captured at freeze and compared at settlement, the same
fence Derived Outputs already uses.

Note that `knowledge-design.md` lists generation pinning under *deferred /
dropped* — *"not needed; writes are serialized through the job queue"*. That was
superseded. The generation counter now exists, owned by the Derived Outputs
store rather than by Knowledge, and the reason is recorded in
`recent-capabilities-fixes-2026-08-01.md`:

> A successful Knowledge add/remove conservatively increments one project
> generation and marks all Derived Outputs stale. […] the generation fence also
> stops an in-flight refresh from publishing against content that changed
> mid-run.

A research run needs the same fence for a weaker but real purpose. Unlike a
derived refresh, **a run whose generation moved still settles** — its retrieved
material was genuinely retrieved, and discarding a completed investigation
because an unrelated document was uploaded would be worse than reporting it. The
run is marked as having executed against an older generation, stays fully
inspectable, and a retry picks up the new material.

That asymmetry is deliberate: a derived output claims to be *current*, so a
stale one is wrong. A research run claims to be *a record of what was found at a
time*, so a stale one is merely old.

Where the counter should live once a second consumer exists is an open
question — owning it inside Derived Outputs made sense when there was one
consumer, and less sense with two.

These compile to an Agents tool policy at run creation. They are frozen because
the policy is frozen — Agents has no mid-task grant, deliberately.

`contextEntries: []` means the whole project, which is what
`knowledge.resolveScope([])` already means. The empty-scope guard from Persona
applies: a persona's context must not be appended to an empty caller scope, or
the run would be narrowed from everything to one context.

**Scope resolution failure never broadens access.** If a referenced resource
disappears after freeze, the exact read fails and becomes a gap in the result.
The run may still settle incomplete; it may not silently substitute something
in scope for something that was not.

## Grounding

Every claim a result makes carries an exact reference to the material behind it.

```ts
type GroundingRef =
  | { kind: "knowledge";   sourceId: string; span?: KnowledgeSpan }
  | { kind: "resource";    entryKind: string; id: string; span?: KnowledgeSpan }
  | { kind: "web";         webResultId: string; excerptIndex?: number }
  | { kind: "data";        entryId: string; revision: number | string;
                           valueDigest: string }
  | { kind: "computation"; computationId: string; outputDigest: string }
  | { kind: "analytic";    materializationId: string; resultDigest: string };

/** UTF-16 code-unit offsets — the coordinate system Knowledge produces. */
interface KnowledgeSpan {
  readonly start: number;
  readonly end: number;
}
```

The comment on `KnowledgeSpan` is load-bearing, and it is where this design
disagrees with `findings-design.md`, which specifies byte and line ranges.
Knowledge produces UTF-16 code-unit offsets. For any source containing a
non-ASCII character the two disagree, and a span recorded under one and rendered
under the other highlights the wrong text — quietly, and only on the documents
where it matters most. See amendment R2 in [summary.md](summary.md).

**Model-produced grounding is validated before settlement.** A reference must
resolve to a record the run actually produced — a retrieval region, a resource
read, a web result, a pinned data entry, a computation, or a named analytic
materialization. Invented references are rejected and the result does not
settle with them. This is the same trusted-candidate discipline Derived Outputs
already applies to evidence.

## Result

```ts
interface ResearchResult {
  /** Prose for the conversation. Becomes the assistant message. */
  readonly narrative: string;
  /** Mode-specific structure. See modes.md. */
  readonly payload: DiscoveryResult | QuestionResult | HypothesisResult;
  readonly grounding: readonly GroundingRef[];
  readonly limitations: readonly string[];
  readonly contradictions: readonly Contradiction[];
  readonly gaps: readonly string[];
  readonly method: readonly MethodStep[];
  readonly reliability: ResearchReliability;
}

interface Contradiction {
  readonly description: string;
  readonly sides: readonly GroundingRef[];   // at least two
}

/** What was done, not what was thought. */
interface MethodStep {
  readonly kind: "query" | "read" | "search" | "fetch" | "compute" | "inspect";
  readonly summary: string;
  readonly grounding?: readonly GroundingRef[];
}
```

`method` records material actions — queries issued, resources inspected, tests
executed. It never stores hidden model reasoning or provider-internal tokens;
those stay behind the Intelligence port, and Agents' own logging rule says the
same thing.

### Reliability is described, not scored

```ts
interface ResearchReliability {
  readonly coverage: "broad" | "partial" | "thin";
  readonly directness: "direct" | "inferred" | "mixed";
  readonly agreement: "consistent" | "mixed" | "contradictory";
  readonly recency?: "current" | "dated" | "unknown";
}
```

**There is no single numeric confidence score.** A model-generated 0.82 is a
number with no defined denominator that people nonetheless compare, sort, and
threshold on. Four inspectable dimensions say more and invite the right
question, which is *why*.

This is also why `Hypothesis.confidence` — which that capability defines as
*"a current assessment, not a probability calculation"* — is never populated by
a run. Research may propose a value with its reasoning; a person applies it.

## Finding candidates

The gate between "the model said something" and "the project believes
something".

```ts
type CandidateReviewState =
  | "unreviewed"
  | "blocked_grounding"      // cites material Findings cannot currently reference
  | "approved_for_proposal"
  | "rejected"
  | "deferred";

interface FindingCandidate {
  readonly id: string;
  readonly runId: string;
  readonly claim: string;
  readonly grounding: readonly GroundingRef[];   // at least one
  readonly commentary?: string;
  readonly suggestedQuestionIds: readonly string[];
  readonly suggestedHypothesisIds: readonly string[];
  readonly suggestedTags: readonly string[];

  /** The run's own read of how ready this is. Carries no authority. */
  readonly recommendation: "recommended" | "needs_review";
  readonly reviewState: CandidateReviewState;

  /** Set once an explicit proposal creates the canonical Finding. */
  readonly proposedFindingId?: string;
  readonly createdAt: IsoTimestamp;
  readonly reviewedAt?: IsoTimestamp;
}
```

Settlement creates candidates as `unreviewed`, or `blocked_grounding` when they
cite material `SourceReference` cannot currently express — a web result, a data
revision, a computation, an analytic materialization. That state exists because
of amendment R1; once Findings widens its grounding union, those candidates
become ordinary.

`recommendation` is advisory and explicitly carries no authority. It exists so a
UI can sort, not so a workflow can skip review.

**Research never calls `findings.accept()`.** Acceptance admits a claim to the
Knowledge lattice, where it grounds every future run — a self-reinforcing loop
if a run could close it on its own.

## Invariants

1. Every assistant message is backed by exactly one settled run.
2. Message `seq` is contiguous from 1; messages are never edited or deleted.
3. A run's `mode`, `subject`, and `channels` are immutable after creation.
4. A run has exactly one `agentTaskId`, and Agents owns that task's execution.
5. Every retrieval and read in a run uses the one frozen scope; resolution
   failure never broadens access.
6. Every grounding reference resolves to a record the run actually produced.
7. A canonical object referenced by a subject is frozen by text and digest at
   creation.
8. Settlement creates local candidates only. A canonical Finding is created
   only by an explicit later proposal command, and is never accepted by
   Research.
9. Research never mutates a Question or Hypothesis; it proposes.
10. `Hypothesis.confidence` is never populated by a run.
11. Retries create new runs; completed runs, results, and candidates are never
    overwritten.
12. Every non-initial user turn links to the thread's immediately preceding run
    through `continuationOfRunId` before the thread's pointer advances.
13. Method steps record actions, never hidden model reasoning.
14. Web results remain run records unless an explicit General Files operation
    saves them.
15. A run records the Knowledge generation it froze against. A generation change
    before settlement marks the run as having run against older material; it
    never discards the result and never silently re-retrieves.
