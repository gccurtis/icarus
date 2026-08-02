# Research capability — design summary

## Purpose

Research is a project-scoped capability under `3-capabilities/research/` that
owns durable, conversational investigations. It is the backend behind the
Research screen: continue a thread, choose a mode, ask something, get a readable
answer plus a structured result that can be inspected, retried, and turned into
durable project objects.

Three modes, one per run:

| Mode | Asks | Produces |
| --- | --- | --- |
| **Discovery** | what is there? | organised themes about an open topic |
| **Question** | what is the answer? | a grounded answer to an explicit question |
| **Hypothesis** | is this true? | a test that attempts disconfirmation first |

The wire value is `"discovery"`; the screen may label it *Discover*. A mode
belongs to a run, not a thread, so a follow-up can switch from Discovery to
Question without rewriting the conversation that preceded it.

## The central decision: Research runs on Agents

**Research does not implement its own execution runtime. It creates Agent
tasks.**

This is the one structural claim in the design, and everything else follows
from it. An earlier draft of this capability specified its own freeze stage,
staged concurrent execution, settlement transaction, stage receipts,
cancellation protocol, startup recovery, idempotency receipts, retry linking,
and tool-guided investigation loop. [Agents](../agents-design/summary.md)
specifies all of those, for the general case, because that is what Agents is
for.

Building both means two orchestration runtimes, which is the specific outcome
the recent capability work went out of its way to avoid:

> No second job-orchestration framework.
> — `recent-capabilities-fixes-2026-08-01.md`, deliberate non-goals

The mapping is close to exact:

| Research concept | Agents concept |
| --- | --- |
| Run | Agent task |
| Run freeze (subject, channels, scope) | Task creation freeze (persona, scope, policy) |
| Channels: Knowledge / Data / Web | Tool policy entries |
| Method trace | Run steps and tool call records |
| Cancellation | `task.cancel` |
| Retry creates a new Run | A new task, linked |
| Interrupted-attempt recovery | Agents recovery sweep |
| "Ask the user to clarify" | Agent question, task `waiting` |

What is left after subtracting Agents is what Research genuinely owns, and it is
a real capability:

- **Threads and messages** — the conversation, which has no Agents equivalent
  because an agent task is one objective, not an ongoing exchange with a person
  across many objectives.
- **Modes** — the three investigation contracts and their typed result shapes.
- **Finding candidates and their review workflow** — the gate between "the model
  said something" and "the project believes something".
- **Framing** — turning a message plus an optional Question or Hypothesis id
  into an agent objective and policy.

```text
ResearchThread                          Research owns
  └─ ResearchMessage[]                  Research owns
       └─ ResearchRun                   Research owns the record
            ├─ agentTaskId  ──────────► Agents owns the execution
            ├─ mode + frozen subject    Research owns
            ├─ typed mode result        Research owns the schema
            └─ FindingCandidate[]       Research owns the review gate
```

### What this requires from Agents

One amendment, stated plainly because it is a dependency this design creates:

**An agent task must accept a caller-supplied result schema and return a
validated typed payload.** Today `AgentTaskResult` carries `outcome`, `summary`,
`unmet`, and `failureCode` — enough for a general task, not enough for a mode
whose whole point is a structured answer.

```ts
// agents-design amendment
interface CreateTaskInput {
  // …existing…
  /** JSON Schema. The settle decision's payload is validated against it. */
  readonly resultSchema?: Record<string, unknown>;
}

interface AgentTaskResult {
  // …existing…
  readonly payload?: unknown;   // validated against resultSchema at settlement
}
```

This is small, it uses the structured-output mechanism Agents already relies on
for its decision union, and it makes Agents useful to every future consumer that
needs a typed answer rather than prose. Without it, Research would have to run
its own synthesis call after the task settles, which puts a second model call
outside the task's own token accounting and method trace.

## Channels are tool policy

Each run freezes which channels are available. They are not a Research-specific
mechanism — they compile to an Agents tool policy:

| Channel | Default | Compiles to |
| --- | --- | --- |
| Knowledge | on | `knowledge.retrieve` + `knowledge.read` against the frozen scope |
| Structured Data | on | policy entries for the Structured Data read commands |
| Web | **off** | policy entry for the Web Retrieval read command |
| Computation | off | policy entry for the sandbox command |
| Structured Analysis | off | read-only analysis data read by id |

Web is off by default because it performs outbound retrieval, which is a
different kind of act from reading the project. That is a product decision, not
a technical one, and it belongs in the default rather than in a prompt.

Every channel is a **read**. A research run has no mutating tools at all, which
means it never needs the Agents approval gate and its blast radius is empty.
Everything durable a run produces — a canonical Finding, an answer on a
Question, a status on a Hypothesis — happens through an explicit later command
by a person.

## Boundaries with the sibling capabilities

Grounded in the three designs that already exist, not restated from scratch:

**Findings** (`findings-design.md`) owns curated source-grounded claims and
their `proposed → accepted` lifecycle, and admits accepted claims to the
Knowledge lattice. Research produces **candidates only**. Settlement stores them
locally with a review state; an explicit command later proposes an approved
candidate as a canonical Finding with status `proposed`. **Research never
accepts a Finding** — acceptance is what puts a claim into the lattice, and that
belongs to a person.

**Questions** (`questions-design.md`) owns one current answer per question,
last-write-wins, with `answeredAt` and `answeredBy` set when an answer is
written. Question mode may start from a `questionId`, freezes the text and
description at run start, and produces an **answer candidate**. Publishing it is
an explicit Questions update. This matches that design's own statement: *"It
writes an answer candidate back only through an explicit Questions update
approved by a user or an owning workflow."*

**Hypotheses** (`hypotheses-design.md`) owns a testable statement, one required
`questionId`, a status, and an optional `0..1` confidence that is *"a current
assessment, not a probability calculation"*. Hypothesis mode may propose a
status, rationale, or confidence update; the record changes only through an
explicit Hypotheses operation.

Two consequences worth naming:

- **A free-form hypothesis can be tested without becoming canonical.** Since
  every canonical Hypothesis requires a `questionId`, saving one forces the
  caller to pick or create a Question first. Research surfaces that as a
  suggestion rather than inventing a Question.
- **Research never populates `Hypothesis.confidence` silently.** It may propose
  a number, with its reasoning, for a person to apply.

## Required amendments to sibling designs

Found by reading the three authoritative designs against what a run actually
produces. Each is a real conflict, not a preference.

**R2 and R4 have been applied** — both were documentation drift against shipped
code, so correcting them needed no decision. **R1 and R3 remain open**: they
propose changes to how Findings works, which is a design call rather than a
correction.

**R1 · Finding grounding cannot be Knowledge-only.** `findings-design.md`
requires every `SourceReference.sourceId` to identify an existing Knowledge
source. A research claim can be grounded in a web result, a Structured Data
entry revision, a computation record, or an analytic materialization — none of
which are Knowledge sources, and none of which should be force-converted into
General Files just to be citable. `SourceReference` needs to become a tagged
union over grounding kinds. Until it does, candidates grounded outside Knowledge
are reviewable in Research but not proposable.

**R2 · The span coordinate system was stale in two design docs, not one.**
*Applied.* This was documentation drift against shipped code, and it was wider
than it first appeared.

| Source | Says | Status |
| --- | --- | --- |
| `findings-design.md` | `{ kind: "byte-range" }`, `{ kind: "line-range" }` | stale |
| `knowledge-design.md` | `start: number; // byte offset in source at index time` | stale |
| `derived-outputs/domain/model.ts:106` | `// UTF-16 code-unit offset, inclusive` | **shipped** |
| `derived-outputs/sqlite-store.ts:187` | `// always UTF-16 offsets, so normalise the label on read` | **shipped** |
| `recent-capabilities-fixes-2026-08-01.md` | "UTF-16 character offsets — the coordinate system Knowledge actually produces" | **shipped** |

The implementation is unambiguous — it even carries
`@deprecated … Knowledge has never emitted byte offsets` on the old alias. Both
design documents described byte offsets, so anyone implementing Findings from
its design would have produced spans disagreeing with every span the system
already stores. Both are now corrected to the shipped `characters` / `lines`
union.

Byte and UTF-16 offsets coincide for ASCII and diverge for everything else, so
this fails exactly on the documents where precise citation matters most, and it
fails by highlighting the wrong text rather than by erroring. Both docs need
correcting; this design uses UTF-16 throughout and says so at the type.

Research passes opaque grounding handles wherever it can, which sidesteps the
question for retrieval-derived spans but not for direct resource reads.

**R3 · `findings.propose()` needs an idempotency contract.** It currently
generates the id internally with no client key. An explicit research proposal
crosses two SQLite stores, so a crash after Findings commits but before Research
records the id duplicates the Finding on retry. Either a caller-supplied stable
id or a keyed propose fixes it.

**R4 · Findings endpoints used path parameters.** *Applied.* `GET /findings/:id`
and `DELETE /findings/:id` could not have been registered — the transport
matches on exact strings and no path parameters exist anywhere in the backend.
Corrected to `GET /findings/get?id=` and `DELETE /findings/delete?id=`.

## Reading order

| File | Covers |
| --- | --- |
| [canonical-model.md](canonical-model.md) | Threads, messages, runs, candidates, invariants |
| [modes.md](modes.md) | The three investigation contracts and their result schemas |
| [operations.md](operations.md) | Endpoints, jobs, settlement, cancellation, retry |
| [store.md](store.md) | SQLite schema and transactions |
| [file-architecture.md](file-architecture.md) | Module layout and composition |

## Open decisions

**R-D1 · Research runs on Agents.** *Structural.* The whole design. The
alternative is a self-contained Research runtime — buildable sooner, since
Agents does not exist yet, at the cost of a second orchestration framework and
two implementations of freeze, recovery, and cancellation. If Research must ship
before Agents, the honest move is to build Agents' task machinery first and let
Research be its first consumer, not to fork it.

**R-D2 · Runs have no mutating tools.** *Structural.* Everything durable
happens through an explicit later human command. The alternative is letting a
run propose a Finding directly under the Agents approval gate, which is
technically supported and skips a step. Kept out because acceptance into the
Knowledge lattice is the point at which a claim becomes project truth.

**R-D3 · Thread history entering a follow-up run.** *Behavioural.* Every prior
message is durable, but replaying full conversation text is unbounded. Proposed:
a configured recent-message window plus a revisioned thread summary. The
compaction threshold and who owns the summary are unresolved.

**R-D4 · The first Computation Sandbox runtime.** *Behavioural.* The port and
the durable computation record are needed even if the first adapter is narrow.
A network-disabled Python runtime is the likely first implementation; its
package set, CPU/memory/time limits, deterministic environment identity, and
deployment boundary all need choosing before quantitative runs are enabled.

**R-D5 · Web payload retention.** *Behavioural.* Result metadata, excerpts,
digests, and citations must stay durable with the run. Retaining complete
fetched bodies indefinitely duplicates General Files and raises licensing and
storage questions. Needs an explicit bounded retention decision.

**R-D6 · Whether Discovery should exist as a separate mode.** *Behavioural.*
Discovery is Question mode without a question. If the framing step is good, a
vague question produces the same result, and three modes become two. Kept
because "explore this area" and "answer this" want visibly different result
shapes, but it is the mode most likely to be redundant.
