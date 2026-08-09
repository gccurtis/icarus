# Research — modes

Three investigation contracts. Each is a persona plus a tool policy plus a
result schema handed to one Agent task — nothing more. The mode does not change
how the loop executes; it changes what the loop is trying to satisfy and what
shape it must return.

## The shared loop

Agents runs the loop; Research states the completion criteria.

```text
frame → plan → retrieve / read / search / compute → inspect
      → challenge → synthesise → validate grounding → settle
```

Every additional action must address a **named gap or challenge**. That is a
prompt-level rule enforced by the persona rather than a code-level one, and it
is what stops a run issuing eleven near-identical queries because more retrieval
feels like more rigour.

The loop stops when the mode's completion criteria are met, when further work
has low expected information value, when the user cancels, or when the task's
bounds are exhausted. The first three settle a result; the last settles
`incomplete`.

## Framing

Framing turns a message plus an optional canonical id into the three frozen
inputs an agent task needs.

```text
user message + mode + optional questionId/hypothesisId
  │
  ├─ subject      free text, or a frozen snapshot of the canonical object
  ├─ persona      the mode's persona: focus, background, approach,
  │               output preferences, verification
  ├─ policy       channels compiled to read-only tool policy entries
  └─ resultSchema the mode's payload schema
```

The mode's persona is a **built-in constant**, not a row in the Persona
catalog. A research run is not a place for arbitrary authored behaviour: its
verification section is what enforces the mode's discipline, and a persona
someone edited could quietly remove the requirement that a hypothesis run try to
refute anything.

A caller-supplied persona could later be *layered* on top of the mode's — but
[Persona](../persona-design.md) has one persona per task by design, so that is a
composition question to answer there rather than a mechanism to invent here.

## Discovery

**Asks:** what is there?
**Completion:** the topic has organised themes, each grounded, plus named
unknowns.

```ts
interface DiscoveryResult {
  readonly summary: string;
  readonly themes: readonly {
    readonly label: string;
    readonly description: string;
    readonly grounding: readonly GroundingRef[];
  }[];
  readonly notableClaims: readonly {
    readonly claim: string;
    readonly grounding: readonly GroundingRef[];
  }[];
  readonly unknowns: readonly string[];
  readonly suggestedQuestions: readonly string[];
}
```

Discovery is the only mode that may settle with no claim at all — "there is
very little here on this topic" is a valid and useful outcome, and forcing a
claim out of thin material is how a discovery run becomes misleading.

`suggestedQuestions` feed the Questions capability as ordinary text
suggestions. Research does not create Questions.

## Question

**Asks:** what is the answer?
**Completion:** a direct answer, its basis, and the assumptions it rests on —
or an explicit statement that the material does not support one.

```ts
interface QuestionResult {
  readonly answer: string;
  /** Present when the material does not support an answer. */
  readonly insufficientReason?: string;

  readonly decomposition: readonly string[];
  readonly assumptions: readonly string[];
  readonly basis: readonly {
    readonly point: string;
    readonly grounding: readonly GroundingRef[];
  }[];
  readonly candidateHypotheses: readonly {
    readonly statement: string;
    readonly rationale: string;
  }[];

  /** Proposed only. Publishing is an explicit Questions update. */
  readonly answerCandidate?: {
    readonly text: string;
    readonly canonicalQuestionId: string;
  };
}
```

`answerCandidate` is present only when the subject carried a canonical
`questionId`. It is a proposal: `questions-design.md` is explicit that Research
*"writes an answer candidate back only through an explicit Questions update
approved by a user or an owning workflow"*, and setting `Question.answer` also
sets `answeredAt` and `answeredBy` and flips the status to `answered`. That is a
statement about the project's beliefs and belongs to a person.

**"I could not answer this" is a completion, not a failure.** A run that settles
with `insufficientReason` and a good account of the gaps did its job.

## Hypothesis

**Asks:** is this true?
**Completion:** at least one explicit attempt to refute, falsify, or materially
qualify the proposition.

```ts
interface HypothesisResult {
  readonly testability: "testable" | "partially_testable" | "not_testable";
  /** Required when testability is not "testable". */
  readonly testabilityReason?: string;

  readonly tests: readonly {
    readonly description: string;
    readonly intent: "refute" | "support" | "qualify";
    readonly outcome: "refuted" | "supported" | "qualified" | "inconclusive";
    readonly grounding: readonly GroundingRef[];
  }[];

  readonly assumptions: readonly string[];
  readonly alternatives: readonly string[];
  readonly assessment: "supported" | "refuted" | "qualified" | "inconclusive";
  readonly nextTests: readonly string[];

  /** Proposed only. Applying it is an explicit Hypotheses operation. */
  readonly statusProposal?: {
    readonly canonicalHypothesisId: string;
    readonly status: "testing" | "supported" | "refuted" | "inconclusive";
    readonly rationale: string;
    readonly confidence?: number;    // 0..1, proposed, never applied here
  };
}
```

Two rules make this mode worth having rather than being Question mode with
different words:

**At least one test must have `intent: "refute"`.** A run that only gathered
supporting material has not tested a hypothesis; it has confirmed a bias with
citations. Settlement validates this, and a run that cannot produce a refutation
attempt settles `incomplete` with that named as the gap.

**A non-testable hypothesis is never silently rewritten.** If the proposition
cannot be tested against available material, the run says so and offers
`alternatives` as suggestions. Quietly substituting a testable near-neighbour
and answering that instead produces a confident answer to a question nobody
asked.

`statusProposal.confidence` is a proposal. `hypotheses-design.md` defines that
field as *"a current assessment, not a probability calculation"* and the service
*"does not calculate a status or confidence from linked Findings"* — the same
reasoning applies to a research run.

## Mode comparison

| | Discovery | Question | Hypothesis |
| --- | --- | --- | --- |
| May settle with no claim | yes | yes, with a reason | no — a test is required |
| Proposes to a canonical object | no | Question answer | Hypothesis status |
| Distinctive validation | none | basis must be grounded | ≥1 refutation attempt |
| Typical channels | Knowledge, Web | Knowledge, Data | Knowledge, Data, Computation |

## Candidate extraction

All three modes produce Finding candidates through one shared rule, applied at
settlement rather than by the model:

```text
for each claim in the result that carries grounding:
  ├─ grounding is empty          → not a candidate
  ├─ grounding cites only Knowledge or resource records
  │                              → candidate, reviewState "unreviewed"
  └─ grounding cites web / data / computation / analytic records
                                 → candidate, reviewState "blocked_grounding"
```

The `blocked_grounding` branch exists because `findings-design.md` currently
requires every `SourceReference.sourceId` to be a Knowledge source. Those
candidates are visible and reviewable in Research; they cannot cross into
Findings until amendment R1 widens that union. Marking them rather than dropping
them means the work is not lost and the constraint is visible to whoever hits
it.

`recommended` versus `needs_review` is a judgment the run offers: direct,
clearly-grounded, single-source claims are recommended; inferential, qualified,
or multi-hop ones need review. Neither state skips review — the distinction only
orders the queue.
