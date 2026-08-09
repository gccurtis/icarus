# Research — operations

## Two endpoints

```text
POST /research/command    serial      all mutations
POST /research/query      concurrent  all reads
```

Discriminated-union bodies, no path parameters. The command union is large
enough to earn the envelope pair, and it matches
[Agents](../agents-design/operations.md), which Research delegates execution to.
Mutations are serial because thread/run/message writes read-then-write across
several store calls.

## Commands

```ts
type ResearchCommand =
  | { type: "thread.create";   clientRequestId: string; input: StartRunInput }
  | { type: "thread.rename";   threadId: string; title: string }
  | { type: "thread.delete";   threadId: string }
  | { type: "run.start";       clientRequestId: string; threadId: string;
                               input: StartRunInput }
  | { type: "run.cancel";      runId: string }
  | { type: "run.retry";       clientRequestId: string; runId: string }
  | { type: "run.answer";      runId: string; questionId: string; answer: string }
  | { type: "candidate.review"; candidateId: string;
                               reviewState: "approved_for_proposal" | "rejected" | "deferred" }
  | { type: "candidate.propose"; clientRequestId: string; candidateId: string }
  | { type: "web.save";        runId: string; webResultId: string; filename?: string };

interface StartRunInput {
  readonly mode: ResearchMode;
  readonly text: string;
  readonly questionId?: string;      // question mode only
  readonly hypothesisId?: string;    // hypothesis mode only
  readonly channels?: Partial<ResearchChannels>;
}
```

`thread.create` is `run.start` plus a thread — a separate command only so the
first turn is one round trip.

`run.answer` forwards to the agent task's question. Research does not maintain
its own question record; Agents already owns open questions, required answers,
and the `waiting` state. Research forwards and lets Agents apply the CAS.

`candidate.propose` is the only command that crosses into another capability's
store, and the only one that creates a canonical object. It carries a
`clientRequestId` for the reason set out below.

There is no `run.accept` or `finding.accept`. Acceptance lives in Findings.

## Queries

```ts
type ResearchQuery =
  | { type: "thread.get";        threadId: string }
  | { type: "thread.list";       limit?: number; cursor?: string }
  | { type: "thread.messages";   threadId: string; afterSeq?: number; limit?: number }
  | { type: "run.get";           runId: string }
  | { type: "run.method";        runId: string }
  | { type: "run.grounding";     runId: string }
  | { type: "candidate.list";    runId?: string;
                                 reviewState?: CandidateReviewState }
  | { type: "candidate.queue" };
```

`thread.messages` with `afterSeq` is the polling primitive for a live thread.
`candidate.queue` is the project-wide review queue — every unreviewed candidate
across all threads, which is the list a person actually works from.

`run.method` and `run.grounding` are the inspection views. Neither exposes the
agent task's run transcript; that is model-facing state with no read path by
design.

## Starting a run

```text
run.start
  │
  ├─ 1. frame            subject + mode persona + channels → policy + resultSchema
  ├─ 2. freeze canonical  read Question/Hypothesis, snapshot text + digest
  │
  ├─ 3. TRANSACTION
  │      insert user message (seq n)
  │      insert run, state "running", frozen subject + channels
  │      insert idempotency receipt
  │      advance thread head + latestRunId
  │
  └─ 4. after commit
         agents.command({ type: "task.create", input: { objective, personaId,
                          contextEntries, policy, resultSchema } })
         store the returned agentTaskId on the run
```

Step 4 is deliberately outside the transaction and deliberately *after* it. A
crash between commit and task creation leaves a run in `running` with no
`agentTaskId` — which recovery finds and either creates the task for or fails
the run. The reverse order would create a task no run points at, which is
strictly worse: work runs, tokens burn, nothing records it.

The idempotency receipt keys on `clientRequestId`, so a retried `run.start`
returns the original run rather than starting a second investigation.

## Settlement

Research settles when its agent task settles. Agents dispatches the settlement
intent; Research consumes it.

```text
agent task settles with a validated typed payload
  │
  └─ TRANSACTION
       validate grounding — every ref resolves to a record this run produced
       validate mode criteria — e.g. hypothesis has ≥1 refutation attempt
       insert result
       insert finding candidates (unreviewed | blocked_grounding)
       insert assistant message (seq n+1)
       update run → settled | incomplete
       advance thread head
```

Grounding validation runs **before** the result is stored, and a reference that
does not resolve is dropped along with the claim that cited it. A claim whose
last grounding reference is dropped does not become a candidate. This is the
trusted-candidate discipline Derived Outputs already applies to evidence.

Mode criteria failing does not fail the run — it settles `incomplete` with the
unmet criterion named. The narrative and whatever was found stay readable.

## Proposing a candidate

The one cross-store write, and the one place a crash can duplicate a durable
object.

```text
candidate.propose { clientRequestId, candidateId }
  │
  ├─ candidate must be "approved_for_proposal"
  ├─ candidate must not be "blocked_grounding"
  │
  ├─ generate the Finding id HERE, in Research
  ├─ TRANSACTION 1 (research): record intent — candidateId → findingId, pending
  ├─ call findings.propose({ id: findingId, claim, sources, … })
  └─ TRANSACTION 2 (research): mark proposedFindingId, clear pending
```

Generating the id in Research is what makes this safe, and it is why
[summary.md](summary.md) amendment R3 asks Findings for a caller-supplied id or
a keyed propose. As `findings-design.md` stands, `propose()` mints the id
internally with no idempotency key — so a crash after Findings commits but
before Research records the id produces a second Finding on retry, with no way
to detect the first.

With a caller-supplied id, the retry either finds the Finding already present
(and records it) or creates it. Recovery sweeps rows left `pending`.

`grounding` maps to `SourceReference` at this boundary. Only Knowledge and
resource grounding can currently map, which is what `blocked_grounding` records.

## Cancellation and retry

**Cancel** forwards to `agents.command({ type: "task.cancel" })`. Completed
searches, reads, tests, and step records stay visible — the agent task's own
cancel semantics say a dispatched call is allowed to finish and be recorded, and
research tools are all reads, so nothing needs undoing.

**Retry** creates a new run linked by `retryOfRunId`, with a fresh agent task
over the same frozen subject and channels. It does not append another user
message, and it advances the thread's `latestRunId`. The failed run, its
partial result, and its method trace remain readable.

## Errors

```ts
class ResearchThreadNotFoundError extends Error { readonly threadId: string }
class ResearchRunNotFoundError    extends Error { readonly runId: string }
class ResearchRunSettledError     extends Error { readonly runId: string }
class ResearchCandidateStateError extends Error {
  readonly candidateId: string;
  readonly reviewState: CandidateReviewState;
}
class ResearchChannelUnavailableError extends Error {
  readonly channel: "web" | "computation";
}
class ResearchValidationError extends Error {
  readonly field: string;
  readonly reason: string;
}
```

| Error | Status | Wire code |
| --- | --- | --- |
| `ResearchThreadNotFoundError` | 404 | `thread_not_found` |
| `ResearchRunNotFoundError` | 404 | `run_not_found` |
| `ResearchRunSettledError` | 409 | `run_settled` |
| `ResearchCandidateStateError` | 409 | `candidate_state_invalid` |
| `ResearchChannelUnavailableError` | 503 | `channel_unavailable` |
| `ResearchValidationError` | 400 | `research_invalid` |

`channel_unavailable` matters more than it looks. Web Retrieval is currently a
scaffold directory with no composed adapter. A run requesting the web channel
before one exists must fail visibly — **an unconfigured provider is not an empty
search result**, and treating it as one produces a confident "I found nothing
on the web" that is a lie about a search that never happened.

## Logging

```text
research.thread.create   info   { threadId, mode, durationMs }
research.run.start       info   { threadId, runId, agentTaskId, mode,
                                  subjectKind, hasCanonical, channelsEnabled,
                                  contextEntryCount, durationMs }
research.run.settle      info   { runId, state, mode, groundingCount,
                                  droppedGroundingCount, candidateCount,
                                  blockedCandidateCount, unmetCriteria, durationMs }
research.run.cancel      info   { runId, durationMs }
research.run.retry       info   { runId, retryOfRunId, agentTaskId }
research.candidate.review info  { candidateId, from, to, actorId }
research.candidate.propose info { candidateId, findingId, groundingKinds, durationMs }
research.web.save        info   { runId, webResultId, generalFileId, bytes }
research.query           debug  { type, count, durationMs }
```

Message text, subject text, claims, narratives, and result payloads never appear
in a log record. Counts, kinds, ids, and states do — the same rule Agents and
Persona apply, and the same reason: diagnostics must not echo prompts or
provider output.

`droppedGroundingCount` is worth watching on its own. A run consistently
producing references that fail validation is a run whose persona or tool set is
wrong, and that shows up here before it shows up as a bad answer.
