# Research Capability — Operations, Endpoints, and Jobs

## Purpose

This document defines the public commands and queries, exact endpoint surface,
durable stage transitions, queue assignments, idempotency rules, cancellation,
retry, and cross-capability actions for Research.

Research follows the newer command/query envelope used by Document and Slides:

- one serial command endpoint;
- one concurrent query endpoint;
- strict wire decoding at job wiring;
- durable internal intents for expensive work;
- no path parameters;
- no provider or Fastify types in the capability.

The HTTP request that starts a Research turn does not perform the investigation.
It freezes the turn into a durable Run, dispatches a concurrent internal Job,
and returns the Run identity. The in-memory queue is never the record of work
that still needs to happen.

## Public operation model

### Commands

~~~ts
type ResearchCommand =
  | CreateResearchThreadCommand
  | UpdateResearchThreadCommand
  | ArchiveResearchThreadCommand
  | SubmitResearchMessageCommand
  | ContinueResearchRunCommand
  | CancelResearchRunCommand
  | RetryResearchRunCommand
  | ReviewRunFindingCommand
  | ProposeRunFindingCommand
  | LinkRunFindingCommand
  | SaveRunWebResultCommand;

interface ResearchCommandBase {
  readonly requestId: string;
}

interface CreateResearchThreadCommand extends ResearchCommandBase {
  readonly type: "thread.create";
  readonly threadId: string;
  readonly title?: string;
  readonly defaultMode: ResearchMode;
  readonly scope: ResearchScopePolicy;
}

interface UpdateResearchThreadCommand extends ResearchCommandBase {
  readonly type: "thread.update";
  readonly threadId: string;
  readonly expectedRevision: number;
  readonly title?: string | null;
  readonly defaultMode?: ResearchMode;
  readonly scope?: ResearchScopePolicy;
}

interface ArchiveResearchThreadCommand extends ResearchCommandBase {
  readonly type: "thread.archive";
  readonly threadId: string;
  readonly expectedRevision: number;
}

interface SubmitResearchMessageCommand extends ResearchCommandBase {
  readonly type: "message.submit";
  readonly threadId: string;
  readonly expectedThreadRevision: number;
  readonly messageId: string;
  readonly runId: string;
  readonly text: string;
  readonly mode?: ResearchMode;
  readonly scopeOverride?: ResearchScopePolicy;
  readonly questionId?: string;
  readonly hypothesisId?: string;
  /** Optional explicit link to a settled Run in this Thread. */
  readonly continuationOfRunId?: string;
}

interface ContinueResearchRunCommand extends ResearchCommandBase {
  readonly type: "run.continue";
  readonly priorRunId: string;
  readonly newRunId: string;
  readonly responseMessageId: string;
  readonly expectedThreadRevision: number;
  readonly selection:
    | { readonly kind: "use-original" }
    | {
        readonly kind: "use-alternative";
        readonly alternativeId: string;
      }
    | {
        readonly kind: "replacement";
        readonly text: string;
      };
}

interface CancelResearchRunCommand extends ResearchCommandBase {
  readonly type: "run.cancel";
  readonly runId: string;
}

interface RetryResearchRunCommand extends ResearchCommandBase {
  readonly type: "run.retry";
  readonly priorRunId: string;
  readonly newRunId: string;
  readonly expectedThreadRevision: number;
  readonly scopeOverride?: ResearchScopePolicy;
}

interface ReviewRunFindingCommand extends ResearchCommandBase {
  readonly type: "finding.review";
  readonly runId: string;
  readonly candidateId: string;
  readonly expectedReviewState: FindingCandidateReviewState;
  readonly decision: "approved_for_proposal" | "rejected" | "deferred";
}

interface ProposeRunFindingCommand extends ResearchCommandBase {
  readonly type: "finding.propose";
  readonly runId: string;
  readonly candidateId: string;
}

interface LinkRunFindingCommand extends ResearchCommandBase {
  readonly type: "finding.link";
  readonly runId: string;
  readonly candidateId: string;
  readonly findingId: string;
}

interface SaveRunWebResultCommand extends ResearchCommandBase {
  readonly type: "web-result.save";
  readonly runId: string;
  readonly webResultId: string;
  readonly displayName: string;
}
~~~

The caller supplies structural IDs. The capability validates them against its
identity ledger or command receipts and never silently replaces a supplied ID.
Actor attribution comes from the constructed runtime, not the command body.

### Queries

~~~ts
type ResearchQuery =
  | { readonly type: "thread.list"; readonly includeArchived?: boolean }
  | { readonly type: "thread.load"; readonly threadId: string }
  | { readonly type: "run.get"; readonly runId: string }
  | {
      readonly type: "run.list";
      readonly threadId?: string;
      readonly mode?: ResearchMode;
      readonly state?: ResearchRunState;
      readonly questionId?: string;
      readonly hypothesisId?: string;
      readonly limit?: number;
      readonly cursor?: string;
    }
  | { readonly type: "run.timeline"; readonly runId: string }
  | {
      readonly type: "finding-candidates.list";
      readonly runId?: string;
      readonly reviewState?: FindingCandidateReviewState;
    };
~~~

Queries return durable projections. They do not invoke Intelligence, retrieve
Knowledge, search the web, evaluate Formula, or mutate freshness.

## Command results

~~~ts
type ResearchCommandResult =
  | {
      readonly type: "thread.created";
      readonly thread: ResearchThread;
    }
  | {
      readonly type: "thread.updated";
      readonly thread: ResearchThread;
    }
  | {
      readonly type: "thread.archived";
      readonly threadId: string;
      readonly revision: number;
    }
  | {
      readonly type: "run.requested";
      readonly threadId: string;
      readonly messageId: string;
      readonly runId: string;
    }
  | {
      readonly type: "run.continuation-requested";
      readonly priorRunId: string;
      readonly runId: string;
    }
  | {
      readonly type: "run.cancel-requested";
      readonly runId: string;
      readonly state: ResearchRunState;
    }
  | {
      readonly type: "run.retry-requested";
      readonly priorRunId: string;
      readonly runId: string;
    }
  | {
      readonly type: "finding.reviewed";
      readonly runId: string;
      readonly candidateId: string;
      readonly reviewState: FindingCandidateReviewState;
    }
  | {
      readonly type: "finding.proposed";
      readonly runId: string;
      readonly candidateId: string;
      readonly findingId: string;
    }
  | {
      readonly type: "finding.linked";
      readonly runId: string;
      readonly candidateId: string;
      readonly findingId: string;
    }
  | {
      readonly type: "web-result.saved";
      readonly runId: string;
      readonly webResultId: string;
      readonly generalFileId: string;
      readonly generalFileRevision: number;
    };
~~~

Run request, continuation, and retry results use HTTP 202. A 202 means the
durable Run compute attempt exists and its next internal Job was admitted or recorded for
recovery. It does not claim the Run has completed.

## Thread operations

### Create

thread.create:

1. Strictly decode all keys and bounded text.
2. Reject reused thread or request identities.
3. Validate the default mode and scope policy.
4. Insert revision 1 of the Thread and its command receipt atomically.
5. Return the complete Thread.

Creating a Thread performs no model or retrieval work.

### Update

thread.update is a compare-and-swap against expectedRevision. It may update:

- display title;
- default mode;
- default channel policy;
- default Context entries or Context IDs.

Updating a Thread never changes the frozen input of an existing Run. It affects
only later submitted Messages.

### Archive

Archiving removes the Thread from the default list while preserving Messages,
Runs, results, Findings links, and exact provenance. It does not cancel an
active Run.

## Message submission and Run freeze

message.submit is the canonical start operation:

1. Reuse an existing receipt when requestId and digest match.
2. Load the Thread and compare expectedThreadRevision.
3. If the Thread has no `latestRunId`, require `continuationOfRunId` to be
   absent. Otherwise require it and require exact equality with the Thread's
   current `latestRunId`.
4. Validate the bounded user message.
5. Resolve the effective mode and ResearchScopePolicy from the Thread plus the
   supplied override.
6. Read and snapshot an optional Question and Hypothesis.
7. Resolve the complete Knowledge/Context scope once.
8. Capture the current Structured Data binding-view identity. Project-wide
   Data is discoverable when enabled; only entries actually read later are
   added to the Run input manifest.
9. Freeze the project frame supplied through the narrow Project reader.
10. Insert the user Message, Run, frozen input, queued Run compute attempt, all
    six stage receipts, Thread revision, and command receipt in one
    Research-store transaction. Freeze is `completed`; plan, gather, evaluate,
    synthesize, and settle are `pending`.
11. Dispatch `research.run.compute` with the opaque Run compute attempt ID.
12. Return run.requested.

The serial command does not perform web search, Knowledge retrieval, Formula
evaluation, sandboxed computation, Analytic Output reads, or Intelligence
inference.

Question and Hypothesis currently expose no revision number. Research therefore
freezes their exact text fields, capture time, and canonical digest. It never
pretends an absent revision exists.

Without `continuationOfRunId`, this is the Thread's first user turn. Every later
turn supplies the Thread's current `latestRunId`; the new Message and Run retain
that explicit conversational link while the prior Run remains immutable. In
both cases the operation creates exactly one user Message and one Run and
advances `Thread.latestRunId` to the new Run.

## Clarification continuation

Hypothesis mode may determine that the submitted proposition is not testable.
It must not silently rewrite it. The compute stage may settle the Run as
`awaiting_input` with:

- the extracted original proposition;
- the reason it is not presently testable;
- a bounded set of alternative formulations;
- an option to proceed with the original wording.

run.continue validates `expectedThreadRevision`, requires `priorRunId` to equal
the Thread's current `latestRunId`, requires that Run to be settled as
`awaiting_input`, appends one user response Message, and creates a new Run
linked through `continuationOfRunId`. The
selected alternative or replacement is frozen in the new Run input. It also
creates a fresh queued Run compute attempt and all six initial stage receipts.
The original
Run, Message, result, candidate, Run compute attempts, and step attempts remain
immutable.

Discovery and Question modes may also use `awaiting_input` when the request is
materially ambiguous, but ordinary decomposition does not require a user
round-trip.

## Internal intent model

~~~ts
type ResearchInternalJobIntent =
  | {
      readonly type: "research.run.compute";
      readonly runComputeAttemptId: ResearchRunComputeAttemptId;
    }
  | {
      readonly type: "research.run.settle";
      readonly runComputeAttemptId: ResearchRunComputeAttemptId;
    };
~~~

Research receives only InternalJobsRuntime<ResearchInternalJobIntent>. It does
not import JobScheduler, select a queue, or register its own continuations.

4-job-wiring owns the total intent-to-Job switch:

| Intent | Queue | Calls |
|---|---|---|
| research.run.compute | concurrent | ResearchCapability.computeRun(runComputeAttemptId) |
| research.run.settle | serial | ResearchCapability.settleRun(runComputeAttemptId) |

Adding an intent is incomplete until the wiring switch handles it.

## Compute stage

The compute Job addresses one durable Run compute attempt by its opaque ID:

1. Atomically claims the queued Run compute attempt. A `pending` plan receipt
   moves to `running`; a `completed` plan receipt must resolve to the Run's
   existing immutable plan.
2. Re-reads cancellation before starting external work.
3. Constructs an AbortController registered only for the active process.
4. Frames the request according to mode.
5. When no plan exists, produces and persists the Run's one immutable Research
   plan and completes the plan receipt. Otherwise it loads the existing plan
   without invoking Intelligence. It then starts the gather receipt.
6. Executes the bounded retrieval and inspection loop.
7. Checks cancellation between every model, web, Knowledge, Data, bounded
   computation, and optional Analytic Output read.
8. Passes the AbortSignal to Intelligence and Web Retrieval.
9. Persists every query and exact result before that result can be cited.
10. Completes gather, starts evaluate, performs the planned challenges and
    computations, and persists their exact outputs.
11. Completes evaluate, starts synthesize, and produces a typed mode result.
12. Validates all grounding references against persisted Run material.
13. Atomically writes one immutable candidate, completes the synthesis receipt,
    verifies the durable settle receipt remains `pending`, and marks the Run
    compute attempt `candidate_ready`.
14. Dispatches `research.run.settle` with the same opaque attempt ID.

If compute fails or observes cancellation before step 13, it uses one guarded
store transaction to mark the Run compute attempt `failed` or `cancelled` and
to transition every remaining non-settle `pending` or `running` receipt to the
matching terminal state while leaving the settle receipt `pending`. It then
dispatches the same `research.run.settle` intent. This path creates no candidate
and still leaves serial settlement as the only code that terminalizes the Run.

The in-process AbortController is an optimization for stopping an active
network request. The persisted cancelRequested flag is authoritative and
survives restart.

One compute Job may perform several bounded reasoning/tool rounds. Each model
round does not become a separate scheduler Job; a `ResearchStepAttempt` is
persisted only for execution of a step in the Research plan. The concurrent
worker remains occupied until compute finishes.

## Settle stage

For a candidate-bearing attempt, the settle Job uses one Research-store
transaction to compare:

- expected Run revision;
- opaque Run compute attempt ID and expected `candidate_ready` or idempotently
  claimed `settling` state;
- frozen scope digest;
- frozen input digest;
- candidate result digest;
- cancellation state.

It then produces exactly one outcome:

~~~ts
type ResearchSettlement =
  | { readonly kind: "completed"; readonly resultRevision: number }
  | { readonly kind: "awaiting_input" }
  | { readonly kind: "failed" }
  | { readonly kind: "cancelled" }
  | { readonly kind: "superseded" }
  | { readonly kind: "already-settled" };
~~~

Completed settlement:

- publishes the immutable Run result;
- advances the Run head;
- appends a Run event;
- completes the settle receipt and marks the Run compute attempt `settled`;
- updates the assistant Message projection;
- leaves Finding candidates in reviewable state.

The serial transaction appends the assistant Message at the Thread's current
next ordinal. The Run's frozen history remains its conversational input; a
later Message or metadata update does not rewrite that input or invalidate an
otherwise current Run result.

Settlement does not accept Findings, update Questions, update Hypotheses, or
save web pages. Those are explicit later commands.

A superseded or cancelled candidate remains stored for audit but never becomes
the Run head. Its Run compute attempt becomes `stale` or `cancelled` as
appropriate. A stale settlement is an expected outcome, not a 500 error.

The same settle intent also accepts a `failed` or `cancelled` Run compute
attempt with no candidate. It verifies that every non-settle stage receipt is
terminal, that no candidate exists, and that the settle receipt is `pending` or
`running`. It completes the settle receipt, CAS-transitions the owning Run to
`failed` or `cancelled`, and appends its terminal event. It does not insert a
Result, assistant Message, or Finding candidate.

## Finding review and proposal operations

Research does not own Findings. A mode result may contain FindingCandidate
records grounded in exact Run material.

finding.review changes only the local candidate's review state. It is a
compare-and-swap transition, preserves the generated candidate bytes, and
records an idempotent command receipt. Rejecting or deferring a candidate never
deletes it from the Run result.

finding.propose:

1. Require the candidate to be approved_for_proposal.
2. Freeze the candidate and its Run result revision in a delegated command
   claim.
3. Validate that every reference still resolves to persisted Run grounding.
4. Call the narrow ResearchFindings port with an idempotency key derived from
   the Research request claim.
5. Record the returned Finding ID and complete the local claim atomically.
6. Return finding.proposed.

The proposal remains proposed. Research never calls Findings.accept.

The current Findings design must support idempotent proposal or a
caller-supplied stable Finding ID before this delegated workflow can be
implemented safely. Random non-idempotent creation is not a sufficient
cross-database contract.

finding.link associates an already-existing Finding with one reviewed Run
candidate without copying its body. The Finding remains canonical in Findings.

## Saving a web result

Web results used by Research remain exact Run-owned records. They are not
General Files merely because Research fetched them.

web-result.save is an explicit delegated operation:

1. Freeze the exact WebResultRecord and content digest in a local claim.
2. Supply its bounded saved body and metadata to the narrow General Files port.
3. Use a deterministic idempotency key or content-addressed reuse.
4. Store the returned General File ID/revision on the Run link.

The saved General File follows the ordinary General Files and Knowledge
ingestion path. Saving does not rewrite the original Run reference.

## Cancellation

run.cancel sets cancelRequested in a serial transaction and appends a Run
event. If this process is actively computing the Run, the service aborts the
registered controller after the durable flag commits.

Cancellation is cooperative:

- queued compute sees the flag and exits before external work;
- active compute aborts the current supported provider request;
- tools that cannot abort finish their bounded call, then stop;
- completed steps and query results remain readable;
- settlement publishes cancelled, never a partial answer as completed.

Cancellation is idempotent. Cancelling a terminal Run replays its existing
terminal state.

## Retry

run.retry compares `expectedThreadRevision`, then creates a new Run identity
linked through retryOfRunId. It does not
erase or reopen the prior Run. It reuses the prior Run's initiating user
Message, does not append another Message, and does not advance the Thread
message count. One initiating Message may therefore belong to a retry-linked
family of Runs. The new retry Run becomes `Thread.latestRunId`. An ordinary
`message.submit` still creates exactly one new Message and one new Run.

The retry freezes:

- the prior submitted Message and mode;
- today's Question/Hypothesis snapshots;
- today's project frame;
- a newly resolved Context/Knowledge scope;
- the current Structured Data binding-view identity;
- an optional scope override.

This makes comparisons honest: a retry may use newer project material, and its
input manifest shows exactly what changed. The retry Run is committed with its
own queued Run compute attempt and all six initial stage receipts.

## Recovery

At startup, before the listener binds:

1. Settle durable cancellation requests before admitting more compute.
2. List Run compute attempts whose owning Run is still nonterminal and whose
   state is `queued`, `running`, `candidate_ready`, `settling`, `failed`, or
   `cancelled`.
3. Dispatch compute for each `queued` attempt using its opaque ID.
4. For an abandoned `running` attempt, use one store transaction to mark that
   attempt `interrupted`, transition every old `pending` or `running` stage
   receipt to `interrupted`, create a replacement Run compute attempt with a new
   opaque ID over the same frozen Run and all six receipts; if the Run already
   owns a plan, seed the replacement plan receipt as `completed` and reuse the
   exact plan, otherwise seed it as `pending`; then dispatch the replacement.
5. Dispatch settle for `candidate_ready` or `settling` attempts using their
   original opaque IDs because their immutable candidates are already durable.
6. Dispatch the same serial settle intent for `failed` or `cancelled` attempts
   whose owning Run is still nonterminal; those paths require no candidate.
7. Treat missing required receipts or candidates as corruption instead of
   guessing which stage completed.
8. Leave attempts whose owning Run is already terminal untouched.

The automatic replacement in step 4 remains inside the same nonterminal Run
and exists only to recover interrupted scheduler work. It is not `run.retry`.
An explicit retry always creates a new linked Run with its own compute attempt.

Every stage claim and external delegated command uses durable idempotency. A
crash after a candidate is persisted but before dispatch does not lose work;
the `candidate_ready` attempt and stage receipts make recovery schedule
settlement without recomputing.

Queue-capacity admission failures use the existing bounded dispatch retry
pattern. Unknown intent types are wiring errors and are not retried.

## HTTP surface

| Method | Path | Queue | Response |
|---|---|---|---|
| POST | /research/command | serial | 200, 201, or 202 ResearchCommandResult |
| POST | /research/query | concurrent | 200 ResearchQueryResult |

There are no mode-specific start routes and no path-parameter routes. Mode is a
closed value inside message.submit.

## Wire admission

4-job-wiring/research/wire.ts performs strict, total decoding:

- exact key sets for every command and query variant;
- bounded identifiers and text;
- a closed mode enum;
- valid channel policies;
- valid Context entries;
- finite limits within configured ceilings;
- no actor, project, provider, model, database, or table selection fields;
- no arbitrary JSON escape hatch.

Unknown fields are 400 errors. Cross-capability existence checks occur in the
application service after structural decoding.

## Queue rationale

The command endpoint is serial because Thread updates, Run freeze, cancellation,
delegated-command claims, and settlement all mutate Research canonical or
operational state through multi-step transactions.

Queries and compute are concurrent. The public command never holds the serial
slot during model or network work.

Research does not use deferred response mode. A normal inline serial command
commits the durable request and returns 202 after dispatch admission. Internal
Jobs continue the work. Deferred mode would hold the original queue slot for
the entire investigation and defeats the staged design.

## Error mapping

Job wiring maps typed errors:

| Error | HTTP |
|---|---:|
| ResearchWireError, ResearchValidationError | 400 |
| ResearchThreadNotFoundError, ResearchRunNotFoundError | 404 |
| ResearchResultNotFoundError, ResearchCandidateNotFoundError | 404 |
| ResearchRevisionConflictError | 409 |
| ResearchIdempotencyMismatchError | 409 |
| ResearchRunStateError | 409 |
| ResearchDelegatedCommandConflictError | 409 |
| ResearchHistoryPrunedError | 410 |
| ResearchPrerequisiteUnavailableError | 422 |
| ResearchGroundingError | 422 |
| unexpected error | 500 with generic public message |

Expected 4xx outcomes are returned without leaking message, finding, question,
hypothesis, web content, provider payloads, or structured project data into
logs.

## Command acceptance checklist

An implementation is incomplete until:

1. Every command and query variant has an exact wire key set.
2. The public command and query endpoints each create a fresh Job.
3. Every internal intent appears in the total job-wiring switch.
4. Run creation commits before compute dispatch.
5. Compute never mutates Thread or publishes a Run result.
6. Settlement never performs network or model work.
7. Cancellation survives restart.
8. Retry creates a distinct Run.
9. All cited material resolves to persisted Run records.
10. Finding review, Finding proposal, and web-result save are explicit and
    idempotent; cross-capability actions use durable delegated claims.
11. Research never accepts a Finding or silently updates a Question or
    Hypothesis.
