# Agents — tools, policy, and the safety argument

This is where the capability earns the right to exist. An agent that can change
a project is only acceptable if what it can change is knowable in advance,
recorded at the time, and attributable afterwards. This file is how.

## The three-layer rule

```text
model tool call       untrusted   the model asks; nothing has happened yet
      ▼
Agents interception   trusted     policy: is this endpoint reachable for this task?
      ▼
approval gate         human       does a person allow these exact arguments?  (opt-in)
      ▼
capability endpoint   trusted     is this request valid for that resource?
      ▼
capability state      canonical   its own revision, history, and validation
```

No layer trusts the one above it. In particular, **the owning capability
validates as if the request came from a stranger** — Agents' policy check is a
reachability filter, not a substitute for the target's own validation. If the
policy check were the only guard, every capability's invariants would depend on
Agents being correct, which is exactly the coupling this design refuses.

That property comes free, because of how Agents reaches capabilities.

## Interception: the model asks, we act

**A mutating tool call is a declaration.** The model emits `toolCalls` and then
*stops and waits*. The runtime executes them. So between "the model asked" and
"anything happened" there is a complete interception point, and every guarantee
hangs off it.

```text
the model emits a round of tool calls
      ▼
the runtime sees ALL of them before executing ANY
      ├─ classify each as read or mutation, from its catalogue descriptor
      ├─ if the round contains mutations, append ONE `plan` message:
      │     "about to: update doc-q3 (2 operations), refresh output out-5"
      │
      └─ execute in order:
           READ      → gateway, record a row, return the result
           MUTATION  → policy → approval → commit → dispatch → commit
```

This is the whole safety story, and it is smaller than the alternatives.

### Why not structured-output declaration

An earlier design had the model emit mutations as **structured output** — a
`ProposedAction[]` the runner then validated, recorded, gated, and dispatched —
on the belief that a tool handler could not give the same guarantee. That belief
was wrong: **the handler is ours, and it commits before it dispatches.** A crash
between the two transactions leaves exactly one row in `dispatched`, which
recovery resolves by replay.

Interception is strictly better on three counts:

- **No per-endpoint output schema.** Declaring mutations as structured output
  means describing every reachable command's arguments inside a decision schema,
  and re-describing them whenever a target's wire shape changes. A tool
  definition already carries that schema, and the provider validates against it
  before we ever see the arguments.
- **"Here is what I am about to do" survives.** A round can emit several calls,
  and we see all of them before executing any — so the pre-execution `plan`
  message describes the batch. No separate planning turn is needed to get
  visibility.
- **Strategies get simpler.** Asking for a mutation and getting one are the same
  act, so a strategy never has to describe a mutation it wants; it sees outcomes.

### Why not let the model call the endpoint itself

It cannot — there is no path from a completion to our HTTP surface. But the
point worth stating is that even if there were, the value here is not in
preventing the model from reaching the network; it is in **every mutation
passing through one place we control**, where policy, approval, the durable
record, and attribution injection all happen together.

## How Agents reaches capabilities: the endpoint gateway

**Agents holds no capability runtimes and writes no per-capability adapters.**
It reaches everything through the same path an HTTP request takes.

```ts
export interface AgentEndpointGateway {
  /** Every endpoint exposed to agents, with what policy and tool binding need. */
  catalogue(): readonly AgentEndpointDescriptor[];
  /** Dispatch one call through the registry and scheduler, exactly as transport does. */
  call(input: AgentEndpointCall): Promise<AgentEndpointOutcome>;
}

export interface AgentEndpointCall {
  readonly endpointKey: string;         // "POST /documents/command"
  readonly body: unknown;               // the model's arguments, unmodified
  readonly requestId: string;           // "agent:<toolCallId>"
  readonly actor: {
    readonly kind: "agent";
    readonly taskId: string;
    readonly toolCallId: string;
  };
}

export interface AgentEndpointOutcome {
  readonly ok: boolean;                 // statusCode < 400
  readonly statusCode: number;
  readonly body: unknown;
}
```

`call()` builds a `RequestEnvelope`, hands it to `registry.createJob(envelope)`,
admits the job through the scheduler, and awaits its `JobResponse`. That is the
transport path minus Fastify.

### Why this is the right shape

**Every safety property comes from the path already being correct.**

- **Validation is the target's own.** Its wire decoder, its `exactKeys`
  rejection, its error ladder. No translation layer that can drift from what the
  capability accepts.
- **Queue placement is the target's own.** A `document.command` runs serial
  because Document said so, not because Agents guessed.
- **Idempotency is the target's own.** `requestId` travels in the body the way
  it already does for HTTP callers, and the existing receipt handles replay.
- **Error mapping is the target's own.** A 409 revision conflict reaches the
  model with the target's wire code — exactly the information it needs.
- **A new capability becomes reachable by adding one descriptor**, not an
  adapter, a port, and a composition-root entry.

The alternatives were both worse:

| Shape | Why not |
| --- | --- |
| **Inject capability runtimes** (`document`, `derivedOutputs`, …) | Agents imports every capability, the dependency arrows fan out from one module to all of them, and it cannot be tested without constructing the whole tree. It also invites calling internal methods rather than the public surface. |
| **Per-capability adapters in job wiring** | One file per target, each duplicating wire decoding the endpoint already does, each a place for drift between "what the adapter sends" and "what the endpoint accepts". |

### The catalogue is one file, and it is the opt-in gate

```ts
export interface AgentEndpointDescriptor {
  readonly key: string;                 // "POST /documents/command"
  readonly method: string;
  readonly path: string;
  readonly mutating: boolean;
  readonly toolName: string;            // "document_command" — what the model sees
  readonly summary: string;             // one sentence, shown to the model
  readonly inputSchema: Record<string, unknown>;
  /** Where the addressed resource id lives in the body, for policy scoping. */
  readonly resourceIdPath?: readonly string[];   // ["command", "documentId"]
  readonly resourceKind?: string;                // "document"
  /**
   * True when the endpoint accepts work rather than completing it — a 202 with
   * an attempt id. A strategy verifying its effect must poll rather than assume
   * failure. Document's prompt.create.request is the first of these.
   */
  readonly asynchronous?: boolean;
}
```

Descriptors live in **one file**,
`4-job-wiring/agents/agentEndpointCatalogue.ts`, declared explicitly — **not
derived** from `registry.listEndpoints()`.

That is deliberate. Deriving would make every endpoint in the backend
agent-reachable the moment it registers, including purge routes and anything
added without thinking about agents. Declaring means **adding agent access to a
capability is an explicit, reviewable decision in one place**.

Startup validates the catalogue against the registry: a descriptor naming a key
no endpoint registers is a **fatal startup error**, logged as
`agents.catalogue.validated`.

### The one runtime rule the gateway must respect

**A concurrent job may enqueue a serial job. A serial job must never await
one.** The serial queue has a single active slot; a serial job awaiting another
serial job deadlocks the whole backend.

Every cycle runs on the **agent pool** (see
[supplementary-changes.md](supplementary-changes.md) item 5b), never the serial
queue. There is an architectural regression test asserting no serial agent
intent reaches `gateway.call`.

## Tools are built from policy, per turn

```text
task.policy ∩ strategy.request.toolNames  ──►  ToolBinding[]  ──►  ToolSet
                                                                     │
knowledge_retrieve  ───────────────────────────────────────────────► │
knowledge_read      ───────────────────────────────────────────────► │
```

The policy is the ceiling; a strategy chooses a subset of it for a given turn —
a planning turn might bind only reads, a working turn binds both. **It can never
exceed the policy**, because the runtime performs the intersection.

Two consequences:

- **The model cannot name a tool it was not granted.** An earlier design offered
  a broad surface and rejected disallowed proposals afterwards; this never
  presents them. Rejection remains as defence in depth — a model can still
  address a resource id outside the permitted set — but the common case is
  structurally impossible rather than caught.
- **The provider validates arguments against `inputSchema`** before Agents sees
  them, and the endpoint validates again after. Two independent checks, neither
  trusting the other.

Two read tools are always available regardless of policy, because they are
scope-bounded rather than endpoint-bounded:

| Tool | Does |
| --- | --- |
| `knowledge_retrieve` | retrieval against the task's **frozen scope manifest** |
| `knowledge_read` | bounded direct read of a resource in that manifest |

Their handlers close over the frozen manifest, so a read cannot reach outside
what the task was given even if the model asks. This is the same closure
discipline `buildToolSet` already uses in derived-outputs.

## Tool policy

Frozen at task creation; the complete statement of what a task can reach.

```ts
interface AgentToolPolicy {
  readonly entries: readonly AgentPolicyEntry[];
  /** Cap on mutating calls for the whole task, independent of per-run bounds. */
  readonly maxMutations: number;
}

interface AgentPolicyEntry {
  readonly endpointKey: string;          // from the agent catalogue
  /**
   * Absent  → every resource this endpoint addresses.
   * Present → only these ids, matched via the descriptor's resourceIdPath.
   */
  readonly resourceIds?: readonly string[];
  /** Defaults to "never". Ignored for non-mutating endpoints. */
  readonly approval?: "never" | "always";
}
```

Evaluation is deny-by-default and total, and runs **inside the tool handler**:

```text
for a call (endpointKey, body):
  1. catalogue must hold the key            else → rejected "unknown_endpoint"
  2. some entry must match the key           else → rejected "not_permitted"
  3. if entry.resourceIds present:
       extract the id via resourceIdPath
       it must be in the list                else → rejected "resource_not_permitted"
  4. if the descriptor is non-mutating        → dispatch
  5. task mutation count < maxMutations      else → rejected "mutation_budget"
  6. if entry.approval === "always"           → awaitingApproval
     else                                     → dispatch
```

**A rejection is returned to the model as a tool result, not thrown.** It is
recorded on the call, appended to the exchange, published as
`agent.mutation.refused`, and the model sees `{ ok: false, error:
"not_permitted" }` and can choose differently in the very next round. Failing
the cycle on a refused call would train the whole system to be brittle about a
completely normal event — and would waste the round trip.

### Why approval defaults to "never" — and why the gate is still strict

This pair pulls in opposite directions on purpose, and both halves matter.

**The default is off.** `approval` is optional and absent means `"never"`. A
policy author opts *in* to the gate. The policy is already the blast radius: an
entry names an endpoint and — when it matters — an explicit resource id list,
all frozen at creation and knowable forever from the creation record. Requiring
a click per edit on top of that makes the common case (a task scoped to one
draft document, created by the person watching it) tiresome enough that authors
route around it, and a gate people route around is worse than one they choose.

**When the gate is on, it is exact.** `approval: "always"` authorises **one
call, with those exact arguments**, bound to its request digest. It does not
promote to the entry, does not persist to the next cycle, and does not survive a
change of arguments. A weaker interactive grant would look identical in the UI
and mean nothing.

The honest tradeoff: the safe configuration is now the one you have to remember
to write. That is accepted because the policy — not the approval prompt — is
where reach is decided, and the policy is mandatory, reviewed at creation, and
immutable. **It makes "enumerate the resource ids" the habit worth building.**

## Approval gating, and how a grant is executed

A tool handler cannot block for a human. So the gated path unwinds:

```text
mutating call, approval required
  ├─ record the row `awaitingApproval` with its requestDigest
  ├─ append an `approvalRequest` message carrying the rationale and a safe
  │  rendering of the arguments
  ├─ return "requires approval; requested" as the tool result
  └─ set the unwind flag → onRound returns "stop" after this round

cycle commits, task → waiting, attention "approval". The run stays running.

  ├─ operator grants  ──► approval bound to requestDigest
  │                        the NEXT cycle's step 2 dispatches that exact call,
  │                        before any model work. The model does not re-issue it.
  │
  └─ operator denies  ──► call → rejected, denial in the exchange,
                           the strategy sees it in `decisions`
```

**The runtime dispatches a granted call, not the model.** The call already has
its row, request, and digest; asking the model to reproduce it would be wasteful
and might not produce the same arguments — which would silently escape the
approval it was granted.

**Digest binding is the whole guarantee.** If approval were granted for a call
*identity* rather than its *content*, a later cycle could re-propose the same
logical call with different arguments and inherit the grant. So: different
arguments, different digest, new approval.

Granting is not a general capability grant either. It authorises that call and
expires with it. There is no "approve all future edits to this document" — that
is what `approval: "never"` is, decided at creation where it is visible.

## Attribution

Every effect an agent causes is attributable from three directions:

```text
Agents        task.actorId              who created the task
              task.origin               user, or which automation
              cycle.id                  which turn
              tool_call.request_id      the id the target saw: agent:<toolCallId>
              approval                  who allowed it, and for which digest

Target        its own accepted change   origin "agent",
                                        actorId "agent:<taskId>:<toolCallId>"

Activity      agent.task.created / agent.mutation.committed /
              agent.mutation.refused / agent.task.settled
```

### How attribution reaches the target

No producer has a structured field for a task or cycle id. Document records
`origin: DocumentOrigin` and an optional `actorId: string`; Comments and
Templates are the same shape. Adding structured agent attribution to every write
target is a much larger change than this capability should require.

So the gateway encodes it in the fields that exist, injecting them into the body
before dispatch:

```ts
{ requestId: `agent:${toolCallId}`,
  origin: "agent",
  actorId: `agent:${taskId}:${toolCallId}`,
  command: /* the model's arguments, unmodified */ }
```

Ugly, and deliberately explicit rather than assumed: greppable, joins straight
back to the Agents row, and needs zero change in any target. `origin: "agent"`
already exists in Document's, Comments', and Templates' vocabularies, and in
`ActivityOrigin`, precisely for this.

**The model never supplies `origin`, `actorId`, or `requestId`.** The gateway
strips any it finds and injects its own. A model that could claim
`origin: "user"` could launder its own changes; one that could choose its own
`requestId` could collide with another task's receipt.

## Threat model

**Defended:**

- *A model invoking a command it was never granted.* The tool is not bound into
  the `ToolSet`; deny-by-default policy is the second check.
- *A model reaching material outside its scope.* Read handlers close over the
  frozen manifest; there is no parameter that widens it.
- *A model escalating its own permissions mid-task.* Policy is frozen at
  creation. There is no grant command.
- *A model laundering its own attribution.* The gateway injects and strips.
- *An approved call being swapped for a different one.* Digest binding, plus the
  runtime dispatching the recorded call rather than a re-issued one.
- *A persona rewriting the task's rules.* The runtime assembles system content;
  the persona fragment is appended after the contract, and a strategy cannot
  influence the order.
- *A crash hiding an effect.* Commit-before-dispatch plus replay by request id.
- *An endpoint becoming agent-reachable by accident.* The catalogue is declared,
  not derived.
- *A strategy bug becoming a safety bug.* Strategies are pure functions with no
  ports. They cannot dispatch, exceed policy, skip approval, or write the audit
  record.

**Not defended, and deliberately so:**

- *A permitted command used badly.* If a task is granted `POST /documents/command`
  on a document, it can make a bad edit. Policy constrains reach, not judgment.
  Approval and revision history are the answer, not prevention.
- *Prompt injection through project content.* Retrieved material is untrusted
  text, and a sufficiently adversarial source can influence what the model
  invokes. The mitigation is structural rather than textual: the call still has
  to be a bound tool and pass policy, so injection can at worst cause a
  *permitted* action. Retrieved content is delimited and labelled untrusted in
  the transcript, which raises the bar on naive injections and makes the trust
  boundary legible — but it is a speed bump, not a defence, and it is described
  as one here. **Since `approval` defaults to `"never"`, the policy is doing
  essentially all of this work**, which is the strongest argument for narrow
  policies with enumerated resource ids.
- *Cost exhaustion by a hostile objective.* Bounds cap it; they do not make it
  free.
- *Provider-side data handling.* Out of scope for this capability entirely.

The honest summary: this design makes an agent's blast radius **knowable and
recorded**, not zero. A task's creation record states exactly what it could
touch, forever, and its tool call rows state exactly what it tried.
