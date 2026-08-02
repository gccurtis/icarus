# Agents — tools, policy, and the safety argument

This is where the capability earns the right to exist. An agent that can change
a project is only acceptable if what it can change is knowable in advance,
recorded at the time, and attributable afterwards. This file is how.

## The three-layer rule

```text
model proposal        untrusted   a string the provider produced
      ▼
Agents policy check   trusted     is this target/command even reachable?
      ▼
approval gate         human       does a person allow these exact arguments?
      ▼
capability command    trusted     is this request valid for that resource?
      ▼
capability state      canonical   revision, ChangeSet, validation
```

No layer trusts the one above it. In particular, **the owning capability
validates as if the request came from a stranger** — Agents' policy check is a
reachability filter, not a substitute for the target's own validation. If the
policy check were the only guard, every capability's invariants would depend on
Agents being correct, which is exactly the coupling this design refuses.

## Target registry

Agents reaches other capabilities through a registry populated at composition
time. It never imports a capability module.

```ts
/** What a capability must provide to be reachable by an agent. */
interface AgentTarget {
  readonly kind: string;                      // "document", "structured-data", …
  readonly commands: readonly AgentTargetCommand[];
  readonly reads: readonly AgentTargetRead[];
}

interface AgentTargetCommand {
  readonly name: string;                      // "document.command"
  readonly description: string;               // shown to the model on approval paths
  readonly inputSchema: Record<string, unknown>;
  readonly mutating: true;
  /** Dispatch. Must be idempotent by request digest. */
  execute(input: AgentCommandInput): Promise<AgentCommandOutcome>;
  /** Recovery lookup. Answers "did you already accept this digest?" */
  lookup(requestDigest: string): Promise<AgentCommandOutcome | undefined>;
}

interface AgentTargetRead {
  readonly name: string;                      // "document.query"
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly mutating: false;
  execute(input: AgentReadInput): Promise<unknown>;
}

interface AgentCommandInput {
  readonly request: unknown;
  readonly requestDigest: string;
  /** Attribution the target records with its own change. */
  readonly actor: { readonly kind: "agent"; readonly taskId: string; readonly toolCallId: string };
}

interface AgentCommandOutcome {
  readonly ok: boolean;
  readonly targetRevision?: number;
  readonly changeSetId?: string;
  readonly errorCode?: string;
  readonly safeSummary?: string;
}
```

The registry is mutable during composition and read-only afterwards, following
the pattern the derived-outputs resource registry already uses to break a
construction cycle without a service locator:

```ts
/**
 * Mutable only during composition. Once startup registers the concrete
 * capabilities, callers use this object through the narrow interface.
 */
interface AgentTargetRegistry {
  register(target: AgentTarget): void;        // composition only
  get(kind: string): AgentTarget | undefined;
  resolveCommand(kind: string, name: string): AgentTargetCommand | undefined;
  resolveRead(kind: string, name: string): AgentTargetRead | undefined;
}
```

### What a capability must do to become a target

Three requirements, all of which Document already satisfies:

1. **Idempotency by request digest.** `lookup()` must answer whether a digest
   was already accepted. Without it, the unknown-outcome recovery case in
   [execution.md](execution.md) has no honest resolution.
2. **Actor attribution recorded with the change.** The target's own ChangeSet
   records that an agent made it, with the task and tool call id.
3. **Validation independent of the caller.** No "trust the agent" fast path.

A capability that cannot do all three may be a *read* target but never a
*mutating* one. This is a deliberate gate: it means adding agent write access to
a capability is a decision that capability's owner makes explicitly.

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
  readonly targetKind: string;
  readonly commandName: string;
  /**
   * Absent  → every resource of this kind.
   * Present → only these resource ids.
   */
  readonly resourceIds?: readonly string[];
  /** Mutating entries default to "always". Read entries ignore this. */
  readonly approval: "never" | "always";
}
```

Evaluation is deny-by-default and total:

```text
for a proposed call (targetKind, commandName, resourceId):
  1. registry must resolve the command      else → rejected "unknown_command"
  2. some entry must match kind + name       else → rejected "not_permitted"
  3. if entry.resourceIds present,
       resourceId must be in it              else → rejected "resource_not_permitted"
  4. task mutation count < maxMutations      else → rejected "mutation_budget"
  5. if entry.approval === "always"           → awaitingApproval
     else                                     → dispatch
```

A rejection is **not** a run failure. It is recorded on the call, appended to
the exchange, and fed to the next reason step. The agent learns what it may not
do and chooses again. Failing the run on a refused proposal would train the
whole system to be brittle about a completely normal event.

### Why approval defaults to "always" for mutations

A policy author must opt *out* of approval, not into it. Getting this backwards
means the safe configuration is the one you have to remember to write, and the
dangerous one is the one you get by forgetting.

`approval: "never"` on a mutating entry is legitimate — a task scoped to one
draft document, created by the person watching it, does not need a prompt per
edit. It is just required to be deliberate.

## Approval gating

An approval authorises **one call, with those exact arguments**:

```text
proposed call
  ├─ requestDigest computed over the canonical request
  ├─ approval request message appended, carrying the rationale and a safe
  │  rendering of the arguments
  ├─ run settles; task → waiting, attention "approval"
  │
  ├─ operator grants  ──► approval bound to requestDigest
  │                        next run dispatches that exact call
  │
  └─ operator denies  ──► call → rejected, denial in the exchange,
                           next run sees the refusal
```

**Digest binding is the whole guarantee.** If approval were granted for a call
*identity* rather than its *content*, a subsequent run could re-propose the same
logical call with different arguments and inherit the grant. The gate would look
identical in the UI and mean nothing. So: different arguments, different digest,
new approval.

Granting is not a general capability grant either. It authorises that call and
expires with it. There is no "approve all future edits to this document" — that
is what `approval: "never"` in the policy is, decided at creation where it is
visible, rather than accumulated by clicking.

## Read tools

Read tools are bound into a `ToolSet` and executed inside the model loop by the
existing `reasonWithToolsStructured`, exactly as Derived Outputs does today.

Two read tools are always available regardless of policy, because they are
scope-bounded rather than target-bounded:

| Tool | Does |
| --- | --- |
| `knowledge.retrieve` | retrieval against the task's **frozen scope manifest** |
| `knowledge.read` | bounded direct read of a resource in that manifest |

Every other read comes from a policy entry naming a target's read command.

The handlers close over the frozen scope manifest, so a read cannot reach
outside what the task was given even if the model asks for it. This is the same
closure discipline `buildToolSet` already uses in derived-outputs, where each
tool closes over the exact manifest and trusted-candidate set.

Read results are summarised into the step's `safeSummary` and flow into the run
transcript. They do not become exchange messages — a person watching a task does
not want a line per retrieval — except when a read fails in a way that changes
what the agent can do, which is worth surfacing.

## Attribution

Every effect an agent causes is attributable from three directions:

```text
Agents        task.actorId          who created the task
              task.origin           operator, or which automation
              tool_call.id          which proposal
              approval              who allowed it, and for which digest

Target        its own ChangeSet     actor kind "agent", task id, tool call id

Activity      (later)               the accepted fact, in the project feed
```

The Agents record and the target record are both required and neither is
derivable from the other, as [canonical-model.md](canonical-model.md) sets out.
The Agents side is the only place a *rejected* or *denied* call exists, which
makes it the record you actually want when auditing what an agent tried to do.

## Threat model

What this design defends against, and what it does not.

**Defended:**

- *A model proposing a command it was never granted.* Deny-by-default policy,
  checked in code the model cannot influence.
- *A model reaching material outside its scope.* Handlers close over the frozen
  manifest; there is no parameter that widens it.
- *A model escalating its own permissions mid-task.* Policy is frozen at
  creation. There is no grant command.
- *An approved call being swapped for a different one.* Digest binding.
- *A persona rewriting the task's rules.* The persona fragment is appended
  after the runner's own system content, never before it — Persona's rule,
  relied on here.
- *A crash hiding an effect.* Commit-before-dispatch plus digest reconciliation.

**Not defended, and deliberately so:**

- *A permitted command used badly.* If a task is granted `document.command` on
  a document, it can make a bad edit. Policy constrains reach, not judgment.
  Approval and revision history are the answer, not prevention.
- *Prompt injection through project content.* Retrieved material is untrusted
  text, and a sufficiently adversarial source can influence what the model
  proposes. The mitigation is structural rather than textual: the proposal
  still has to pass policy and approval, so injection can at worst cause a
  *permitted* action. This is a real reason to keep default policies narrow and
  approval on.
- *Cost exhaustion by a hostile objective.* Bounds cap it; they do not make it
  free.
- *Provider-side data handling.* Out of scope for this capability entirely.

The honest summary: this design makes an agent's blast radius **knowable and
recorded**, not zero. A task's creation record states exactly what it could
touch, forever, and its tool call rows state exactly what it tried.
