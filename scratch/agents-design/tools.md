# Agents — tools, policy, and the safety argument

This is where the capability earns the right to exist. An agent that can change
a project is only acceptable if what it can change is knowable in advance,
recorded at the time, and attributable afterwards. This file is how.

## The three-layer rule

```text
model call            untrusted   a tool the provider chose to invoke
      ▼
Agents policy check   trusted     is this endpoint even reachable for this task?
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

That property comes free here, because of how Agents reaches capabilities.

## How Agents reaches capabilities: the endpoint gateway

**Agents holds no capability runtimes and writes no per-capability adapters.**
It reaches everything through the same path an HTTP request takes.

```ts
/**
 * The narrow slice of the runtime Agents needs to reach every capability.
 * Implemented in 1-init over the existing JobRegistry and JobScheduler; the
 * capability sees only this interface.
 */
export interface AgentEndpointGateway {
  /** Every endpoint exposed to agents, with what policy and tool binding need. */
  catalogue(): readonly AgentEndpointDescriptor[];
  /** Dispatch one call through the registry and scheduler, exactly as transport does. */
  call(input: AgentEndpointCall): Promise<AgentEndpointOutcome>;
}

export interface AgentEndpointCall {
  readonly endpointKey: string;         // "POST /documents/command"
  readonly body: unknown;               // the model's arguments, unmodified
  /** `agent:<toolCallId>`. Committed before dispatch; the target keys its receipt on it. */
  readonly requestId: string;
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

- **Validation is the target's own.** The endpoint runs its own wire decoder,
  its own `exactKeys` rejection, its own error ladder. There is no translation
  layer that can drift from what the capability accepts.
- **Queue placement is the target's own.** A `document.command` runs on the
  serial queue because Document said so, not because Agents guessed.
- **Idempotency is the target's own.** `requestId` travels in the body the way
  it already does for HTTP callers, and the target's existing receipt handles
  replay.
- **Error mapping is the target's own.** A 409 revision conflict reaches the
  model as a 409 with the target's own wire code, which is exactly the
  information the next sequence unit needs.
- **A new capability becomes reachable by adding one descriptor**, not by
  writing an adapter, a port, and a registration in the composition root.

The alternative shapes were both worse:

| Shape | Why not |
| --- | --- |
| **Inject capability runtimes directly** (`document`, `derivedOutputs`, …) | Agents imports every capability, the dependency arrows fan out from one module to all of them, and it cannot be tested without constructing the whole tree. It also invites calling internal methods that are not the public command surface. |
| **Per-capability adapters in job wiring** | One file per target, each duplicating the wire decoding the endpoint already does, each a place for drift between "what the adapter sends" and "what the endpoint accepts". Real machinery to hand-maintain for no property the gateway does not already give. |

### The catalogue is one file, and it is the opt-in gate

```ts
export interface AgentEndpointDescriptor {
  readonly key: string;                 // "POST /documents/command"
  readonly method: string;
  readonly path: string;
  readonly mutating: boolean;
  /** Tool name shown to the model. Stable; policies reference the key, not this. */
  readonly toolName: string;            // "document_command"
  readonly summary: string;             // one sentence, shown to the model
  readonly inputSchema: Record<string, unknown>;
  /** Where the addressed resource id lives in the body, for policy scoping. */
  readonly resourceIdPath?: readonly string[];   // ["command", "documentId"]
  readonly resourceKind?: string;                // "document"
}
```

Descriptors live in **one file**, `4-job-wiring/agents/agentEndpointCatalogue.ts`,
declared explicitly. Not derived from `registry.listEndpoints()`.

That is deliberate. Deriving the catalogue would make every endpoint in the
backend agent-reachable the moment it registers, including purge routes and
anything added without thinking about agents. Declaring it means **adding agent
access to a capability is an explicit, reviewable decision in one place** — the
same gate the earlier per-target design provided, at a fraction of the code.

`registry.register` throws on duplicate endpoint keys, so a descriptor naming a
key no endpoint registers is caught at startup rather than at first use. That
check runs in composition and is a fatal startup error.

### The one runtime rule the gateway must respect

**A concurrent job may enqueue a serial job. A serial job must never await
one.** The serial queue has a single active slot; a serial job awaiting another
serial job deadlocks the whole backend.

Every work unit that calls the gateway runs on the **concurrent** queue. That is
not incidental — it is the constraint that makes loopback dispatch safe, and it
is why `agents.work.act` is concurrent even though the command it triggers is
serial. There is an architectural regression test asserting no serial agent
intent calls the gateway.

## Tools are generated from policy

At run start, Agents builds the model's `ToolSet` from **the read descriptors
the task's policy permits, and nothing else**.

```text
task.policy ──► permitted READ descriptors ──► ToolBinding[] ──► ToolSet
                                                                   │
knowledge_retrieve  ─────────────────────────────────────────────► │
knowledge_read      ─────────────────────────────────────────────► │

task.policy ──► permitted MUTATING descriptors ──► the schema of
                                                   ProposedAction.endpointKey
```

Mutating endpoints shape the **structured-output schema** a sequence unit emits
against, rather than becoming callable tools. The effect is the same guarantee
from the other direction: `endpointKey` is an enum of exactly what this task may
change, so a sequence that names anything else does not validate.

Two consequences worth stating:

- **The model cannot name a tool or an endpoint it was not granted.** The
  earlier design offered a broad surface and rejected disallowed proposals
  afterwards; this never presents them. Rejection still exists as defence in
  depth — a model can still address a resource id outside the permitted set —
  but the common case is structurally impossible rather than caught.
- **The provider validates arguments against the descriptor's `inputSchema`**
  before Agents ever sees them, and the endpoint validates again after. Two
  independent checks, neither trusting the other.

Two read tools are always available regardless of policy, because they are
scope-bounded rather than endpoint-bounded:

| Tool | Does |
| --- | --- |
| `knowledge_retrieve` | retrieval against the task's **frozen scope manifest** |
| `knowledge_read` | bounded direct read of a resource in that manifest |

Their handlers close over the frozen manifest, so a read cannot reach outside
what the task was given even if the model asks for it. This is the same closure
discipline `buildToolSet` already uses in derived-outputs.

### Reads run in the loop; mutations are sequenced

The split is by risk, and it decides where a call lives.

| | Read endpoints + knowledge tools | Mutating endpoints |
| --- | --- | --- |
| Bound as | real tools, in every planning unit's loop | **not bound at all** |
| Invoked | by the model, inside one `reasonWithToolsStructured` call | by the runner, one per `act` unit |
| Declared | not declared — the model just reads | as `ProposedAction[]` in a sequence decision |
| Bounded by | `maxReadToolRoundsPerUnit`, `maxReadsPerUnit` | `maxActionsPerSequence`, `maxMutationsPerTask` |
| Recorded | `tool_calls` rows on the owning unit | a `tool_calls` row plus its own `act` unit |
| On crash | redone; harmless | recovered from the committed row |

**Reads do not change the world, so they do not need to be planned, ordered,
approved, or recovered.** A sequence unit answers *"where are we now?"* by
reading as much as it judges useful inside its own model call, then declares the
mutations. Making each read its own durable unit would triple the job count and
buy nothing — a re-read after a crash returns the same thing.

**Mutations are never invoked by the model directly.** A sequence unit's
structured output *declares* an ordered list of them; the runner then validates,
records, gates, and dispatches each one as its own committed `act` unit. Every
one of those four verbs is code the model cannot skip, and it is what makes
commit-before-dispatch possible at all: a tool handler running inside a model
loop cannot pause for a human approval, and cannot leave a durable record the
loop's own failure will not take with it.

This is the single most important structural decision in the capability, and it
is by risk rather than taste:

- **Reads are replayable.** A retrieval redone after a crash returns the same
  regions against a frozen scope. Losing an in-flight read loop costs tokens.
- **Writes are not.** A mutation dispatched from inside an in-process loop that
  then crashes leaves an effect in another capability with no committed record
  in Agents that it was ever asked for. That is precisely the state dual
  recording exists to make impossible.

Before dispatching, an act unit re-checks the steer flag and supersedes itself
cleanly if a redirect has arrived — so steering lands *between* mutations rather
than after the model has already committed to three more.

## Tool policy

The policy is frozen at task creation and is the complete statement of what a
task can reach.

```ts
interface AgentToolPolicy {
  readonly entries: readonly AgentPolicyEntry[];
  /** Cap on mutating calls for the whole task, independent of per-run bounds. */
  readonly maxMutations: number;
}

interface AgentPolicyEntry {
  /** An endpoint key from the agent catalogue. */
  readonly endpointKey: string;
  /**
   * Absent  → every resource this endpoint addresses.
   * Present → only these resource ids, matched against the descriptor's
   *           resourceIdPath extraction.
   */
  readonly resourceIds?: readonly string[];
  /** Defaults to "never". Ignored for non-mutating endpoints. */
  readonly approval?: "never" | "always";
}
```

Evaluation is deny-by-default and total:

```text
for a call (endpointKey, body):
  1. catalogue must hold the key            else → rejected "unknown_endpoint"
  2. some entry must match the key           else → rejected "not_permitted"
  3. if entry.resourceIds present:
       extract the id via resourceIdPath
       it must be in the list                else → rejected "resource_not_permitted"
  4. if the descriptor is non-mutating        → dispatch (5–6 do not apply)
  5. task mutation count < maxMutations      else → rejected "mutation_budget"
  6. if entry.approval === "always"           → awaitingApproval
     else                                     → dispatch
```

**A rejection is not a run failure.** It is recorded on the act unit,
appended to the exchange, published to Activity as `agent.mutation.refused`, and
fed to the next sequence unit. The agent learns what it may not do and chooses
again. Failing the run on a refused proposal would train the whole system to be
brittle about a completely normal event.

### Why approval defaults to "never" — and why the gate is still strict

This pair of decisions pulls in opposite directions on purpose, and both halves
matter.

**The default is off.** `approval` is optional and absent means `"never"`. A
policy author opts *in* to the gate. The reasoning is that the policy is already
the blast radius: an entry names an endpoint and — when it matters — an explicit
resource id list, all frozen at creation and knowable forever from the creation
record. Requiring a click per edit on top of that makes the common case (a task
scoped to one draft document, created by the person watching it) tiresome enough
that authors route around it, and a gate people route around is worse than one
they choose deliberately.

**When the gate is on, it is exact.** `approval: "always"` authorises **one
call, with those exact arguments**, bound to its request digest. It does not
promote to the entry, does not persist to the next unit, and does not survive a
change of arguments. A weaker interactive grant would look identical in the UI
and mean nothing.

The honest statement of the tradeoff: the safe configuration is now the one you
have to remember to write. That is accepted because the policy — not the
approval prompt — is where a task's reach is actually decided, and the policy is
mandatory, reviewed at creation, and immutable afterwards. **It makes "enumerate
the resource ids" the habit worth building, rather than "turn approval on".**

## Approval gating

An approval authorises **one call, with those exact arguments**:

```text
proposed mutation
  ├─ requestDigest computed over the canonical request
  ├─ approval request message appended, carrying the rationale and a safe
  │  rendering of the arguments
  ├─ task → waiting, attention "approval"; the run stays running
  │
  ├─ operator grants  ──► approval bound to requestDigest
  │                        the boundary check dispatches that exact act unit
  │
  └─ operator denies  ──► unit → rejected, denial in the exchange,
                           the next sequence unit sees the refusal
```

**Digest binding is the whole guarantee.** If approval were granted for a call
*identity* rather than its *content*, a later unit could re-propose the same
logical call with different arguments and inherit the grant. The gate would look
identical in the UI and mean nothing. So: different arguments, different digest,
new approval.

Granting is not a general capability grant either. It authorises that call and
expires with it. There is no "approve all future edits to this document" — that
is what `approval: "never"` in the policy is (and what you get by default),
decided at creation where it is visible, rather than accumulated by clicking.

## Attribution

Every effect an agent causes is attributable from three directions:

```text
Agents        task.actorId              who created the task
              task.origin               user, or which automation
              work_unit.id              which unit
              tool_call.request_id      the id the target saw: agent:<toolCallId>
              approval                  who allowed it, and for which digest

Target        its own accepted change   origin "agent",
                                        actorId "agent:<taskId>:<toolCallId>"

Activity      agent.task.created        the task existed
              agent.mutation.committed  an agent was allowed to change this
              agent.mutation.refused    an agent was not
              agent.task.settled        how it ended
```

### How attribution actually reaches the target

No producer has a structured field for a task or unit id. Document records
`origin: DocumentOrigin` and an optional `actorId: string`, and Comments and
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

Ugly, and deliberately explicit rather than assumed: the string is greppable, it
joins straight back to the Agents row, and it needs zero change in any target.
`origin: "agent"` already exists in Document's, Comments', and Templates'
vocabularies, and in `ActivityOrigin`, precisely for this.

**The model never supplies `origin`, `actorId`, or `requestId`.** The gateway
strips any it finds and injects its own. A model that could claim
`origin: "user"` would be able to launder its own changes, and a model that
could choose its own `requestId` would be able to collide with another task's
receipt.

## Threat model

What this design defends against, and what it does not.

**Defended:**

- *A model invoking a command it was never granted.* The tool is not bound into
  the `ToolSet` at all; deny-by-default policy is the second check.
- *A model reaching material outside its scope.* Read handlers close over the
  frozen manifest; there is no parameter that widens it.
- *A model escalating its own permissions mid-task.* Policy is frozen at
  creation. There is no grant command.
- *A model laundering its own attribution.* The gateway injects `origin`,
  `actorId`, and `requestId`, stripping anything the model supplied.
- *An approved call being swapped for a different one.* Digest binding.
- *A persona rewriting the task's rules.* The persona fragment is appended
  after the runner's own system content, never before it — Persona's rule,
  relied on here.
- *A crash hiding an effect.* Commit-before-dispatch plus replay by request id.
- *An endpoint becoming agent-reachable by accident.* The catalogue is declared,
  not derived.

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
touch, forever, and its work unit rows state exactly what it tried.
