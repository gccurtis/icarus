# Intelligence capability

## Purpose, ownership, and boundary

Intelligence is the only application boundary to embedding and model
providers. It gives callers stable semantic contracts while hiding provider,
model, credential, retry, routing, and usage mechanics. It is domain-blind and
cannot decide product truth.

The Intelligence domain owns semantic Cast definitions, endpoint-kind
contracts, route/failover rules, usage-accounting rules, continuation
validation, and sanitized provider failures. Its persistence follows two
transaction owners: Control owns Cast publication, route policy/epochs,
credential references, provider admission/health state, and Organization-level
limits; each Project owns its exact call reservations, normalized usage, route
receipts, continuations, and Project budget state.

It does not own Knowledge, evidence, contradiction policy, Prompt Blocks,
Resource Outputs, Formula, Agent plans, tools, authorization, provider secrets
themselves, or billing invoices. Intelligence returns typed tool calls for a
Reasoning cast; it never executes them.

## Feature contract

| Feature | Required behavior | Initial boundary | Retained breadth |
| --- | --- | --- | --- |
| Embedding endpoint | Bounded text batch -> vectors plus exact semantic embedding identity | One cast/route | Multiple compatible spaces and migrations |
| Inference endpoint | One-shot schema-constrained generation/transformation; no tool continuation | Contract ready | Multiple casts/providers |
| Reasoning endpoint | Bounded Start/Continue; caller-declared typed tools; Intelligence validates calls but executes none | One grounded cast | Multi-turn continuation and richer typed tools |
| Semantic Cast | Immutable versioned intent/input/output/tool/budget contract independent of provider | Required | Administration and deprecation windows |
| Routing | Resolve Cast + policy/data class/region to one hidden provider/model route epoch | One default route | Organization policy, health-aware compatible failover |
| Receipt | Return Cast, route epoch, semantic model, provider-call ID hash, usage, latency, finish reason | Required | Billing/export projections |
| Credentials | Resolve backend-only `SecretRef`; never serialize secret material into domain state | One provider | Managed rotation and multiple credential pools |
| Budgets | Reserve before call; enforce input/output/tool/turn/time/cost limits; settle actual usage | Per request/Project | Organization quotas and spend controls |
| Cancellation/retry | Propagate cancellation; retry only safe stages and bounded provider classes | Required | Provider-specific resilience policy |
| Failover | New call may select compatible healthy route; active call never hot-switches model/provider | Minimal | Regional and policy-aware failover |
| Error hygiene | Sanitize provider payloads and map stable categories | Required | Operator-only secure diagnostics |
| Deterministic fake | Same semantic contract, controllable outputs/failures/usage for tests | Required | Recorded conformance fixtures |

## Domain model

```text
Cast {
  cast_id, version, endpoint_kind, input_schema, output_schema,
  allowed_tools, limits, data_classes, compatibility_class,
  state, published_at, deprecated_at?
}

RouteEpoch {
  route_epoch, cast_id, policy_generation, provider_kind,
  semantic_model, region, credential_ref, compatibility_class, state
}

CallRequest {
  call_id, cast_ref, input, declared_tools, data_class, region_policy,
  effect_profile, reservation, continuation?
}

RouteReceipt {
  call_id, cast_ref, route_epoch, semantic_model, region,
  provider_receipt_hash, usage, latency, finish_reason, attempt_count
}

Continuation {
  continuation_id, call_id, turn, previous_response_digest,
  pending_tool_calls, state
}

Usage {
  input_units, output_units, embedding_units, tool_calls,
  reserved_cost, actual_cost, currency
}
```

Endpoint kinds are semantically distinct:

- `embedding`: text inputs and vector outputs only;
- `inference`: one request and schema-bound output, no continuation; and
- `reasoning`: versioned turns that may request only declared tools.

Invariants:

- Cast versions are immutable and explicit in every call;
- Cast state is `active` or `deprecated`; deprecation denies new admissions
  but never rewrites retained call or route receipts;
- provider/model names and SDK objects do not cross the Intelligence boundary;
- `read_only_product` calls cannot declare tools or authorize a Product
  content/workflow mutation;
- one call uses one route epoch and semantic model from start to terminal
  completion;
- failover is allowed only before a new compatible call/attempt under declared
  replay semantics, never by splicing incompatible continuations;
- multi-audience/provider identity assumptions are irrelevant here: provider
  credentials authorize Taurus to call a provider, not a User to use Taurus;
- actual usage cannot exceed contract maxima, and reservation settlement is
  idempotent; and
- unknown finish reasons, schemas, tool calls, route epochs, or provider
  response versions fail closed.

## Commands and queries

| Operation | Kind | Behavior |
| --- | --- | --- |
| `intelligence.embed.v1` | Command (provider/accounting effect) | Executes one embedding Cast and returns vectors plus receipt |
| `intelligence.infer.v1` | Command (provider/accounting effect) | Executes one schema-bound inference Cast |
| `intelligence.reason_start.v1` | Command (provider/accounting effect) | Starts a bounded Reasoning continuation |
| `intelligence.reason_continue.v1` | Command (provider/accounting effect) | Continues only the expected prior turn with validated tool results |
| `intelligence.cancel.v1` | Command | Cancels a live continuation/reservation where supported |
| `intelligence.get_call.v1` | Query | Returns safe call status, receipt, and normalized failure |
| `intelligence.get_route_receipt.v1` | Query | Returns reproducibility/usage metadata without secret/provider payloads |
| `intelligence.list_casts.v1` | Query | Lists authorized semantic Casts and versions |
| `intelligence.publish_cast.v1` | Control command | Validates and publishes one immutable active Cast version under Control authority and Audit |
| `intelligence.deprecate_cast.v1` | Control command | Conditionally deprecates one Cast version for new admissions without mutating retained receipts |
| `intelligence.publish_route_epoch.v1` | Control command | Publishes immutable route policy after validation; not a Project Resource command |
| `intelligence.set_route_state.v1` | Control command | Drains/disables a route for new calls without mutating prior receipts |

The capability library validates Casts, canonicalizes semantic inputs,
validates outputs/tool calls/continuations, selects compatible route candidates
from supplied policy state, and normalizes usage/errors. Control handlers own
Cast/route/policy repositories and Control Audit. Bound-Cell handlers own
Project reservation/call/receipt/continuation repositories, Project Audit,
provider adapter calls, and durable retry state when a caller elects
asynchronous execution. No handler opens both databases in one transaction.

An Ask interaction uses a `read_only_product` Cast. It may read authorized
grounding supplied by its caller, but it cannot declare or execute tools and it
cannot create or change a Resource, Task, Activity item, Memory entry,
`SemanticFact`, or other user-visible Product content/workflow state. Saving or
promoting an answer is a separate explicit Product command.

## Consumed and provided ports

Intelligence defines provider-neutral ports:

```go
type Provider interface {
    Embed(ctx context.Context, req ProviderEmbeddingRequest) (ProviderEmbeddingResponse, error)
    Infer(ctx context.Context, req ProviderInferenceRequest) (ProviderInferenceResponse, error)
    Reason(ctx context.Context, req ProviderReasoningRequest) (ProviderReasoningResponse, error)
}

type SecretResolver interface {
    Resolve(ctx context.Context, ref SecretRef) (SecretLease, error)
}

type BudgetAuthority interface {
    Reserve(ctx context.Context, req ReservationRequest) (Reservation, error)
    Settle(ctx context.Context, req SettlementRequest) error
}
```

Concrete OpenRouter, OpenAI, Anthropic, and future adapters live outside the
pure capability and map provider wire types into these types. `SecretLease`
uses a non-printable secret wrapper and has a bounded lifetime.

Knowledge, Resolution, Agents, Translation, and other consumers define their
own semantic ports and adapt them to the three Intelligence operations through
bounded nested dispatch. Consumers name a Cast, not a provider/model.

## Persistence and concurrency

Control repositories own immutable Cast versions, route epochs, admitted
provider/credential references, health facts, and Organization policy/limits.
Project repositories own reservations, normalized calls/receipts,
continuation state, and usage ledgers for that exact Project. Provider request/
response bodies are not canonical state by default. A Project call stores the
exact immutable Control route epoch/policy generation used, never a copied
mutable route or credential.

Provider-backed Ask is read-only with respect to user-visible Product state,
not necessarily with respect to operational accounting. Its only permitted
durable admission writes are the exact call's bounded usage reservation, call
record, optional bounded continuation envelope, and an exact
`FinalizationRecord`. Before invoking the provider, one Project transaction
consumes a fresh session-sourced effect permit and commits those records plus
required Audit. Any later provider turn requires a currently admitted session
and its own bounded reservation/admission; a continuation never becomes
authority.

After a provider attempt, the separately typed finalizer alone may record the
normalized route/provider receipt and settle/cancel that exact reservation and
call generation with required Audit—even if the session was revoked or the
Host crashed. It cannot invoke/retry the provider, advance a continuation to a
new call, write a Product Resource/Task/Activity/Memory/`SemanticFact`/tool
effect, enqueue work, or widen spend. Exact state/generation mismatch fails
closed.

- Cast publication is an immutable insert; deprecation is an expected-state
  transition that denies new calls while preserving reproduction metadata.
- Route publication is an immutable insert plus conditional active-pointer
  update in one Control transaction with required Control Audit and any
  declared policy `SemanticFact`.
- Calls bind to one route epoch at admission and retain it in the receipt.
- Continuations transition by expected turn/digest only through a new currently
  authorized provider-turn admission; duplicate exact continue is idempotent and
  divergent replay conflicts.
- Reservations use uniqueness and conditional state transitions; settlement is
  exactly once in the bound Project transaction domain from Taurus's
  perspective even if provider usage arrives late.
- A committed reservation is reconciled to a terminal canceled or settled
  state after crash through its exact finalizer. Reconciliation may complete
  only accounting for that reservation; it cannot retry a provider effect.
- Metering receipts and continuations have explicit minimization and retention
  limits and are never Activity, Memory, Knowledge evidence, or a substitute
  for saved Product content.
- Concurrency is bounded by Host, Project, Cast, provider, and credential-pool
  budgets. Queueing is explicit at the handler/job layer, not a hidden
  Intelligence goroutine.
- Provider-health caches influence candidate selection only. They do not alter
  policy, authority, Cast compatibility, or already admitted calls.

There is no distributed transaction between route selection and Project
metering. A bound handler reads an immutable admitted Control route epoch,
records that exact reference with the Project reservation/finalizer, commits,
then calls the provider and conditionally finalizes the Project record. If the
route is disabled after
admission, it denies new calls; the already admitted call follows its recorded
cancellation/recovery policy and cannot silently switch epochs. Future
Organization-wide spend reservation requires an explicit Control-owned quota
protocol; it is not simulated with uncoordinated Project counters.

Calls that are part of a protected Project mutation do not themselves commit
the mutation. The owning handler obtains/consumes the fresh one-use permit only
immediately before the canonical Project effect. Expensive model work cannot
extend authorization validity.

## Security, privacy, and errors

Provider credentials are backend-only SecretRefs; no browser, capability
model, receipt, Audit row, log, trace, or error contains secret material.
Inputs and outputs are content-classified, minimized, region/policy checked,
and redacted from general observability. Provider retention/residency must be
known and admitted; unknown policy fails closed.

Intelligence enforces schemas, maximum bytes/tokens, tool count/name/argument
schemas, continuation order, maximum turns, deadlines, cancellation, and
actual usage bounds. It rejects provider attempts to add undeclared tools or
instructions. Tool results are treated as caller data, not authority.

Stable mappings include:

- invalid Cast/input/output/tool schema -> `invalid_argument` or
  `integrity_failure` when the provider violated a validated response;
- missing/disabled route or secret -> `temporarily_unavailable`;
- policy/data-class/region denial -> `forbidden`;
- budget/quota exhausted -> `rate_limited`;
- continuation turn/digest mismatch -> `conflict`;
- unsupported Cast/route/provider response -> `unsupported_version`;
- provider timeout/cancel -> `deadline_exceeded` / `canceled`; and
- provider 5xx/overload -> bounded retry then `temporarily_unavailable`.

Raw provider messages never reach clients. Safe operator correlation uses a
hashed/opaque receipt reference.

A deterministic or fully local Ask path may be literally zero-write: no
provider spend means no durable reservation, receipt, continuation, settlement,
or metering Audit is required. Tests must distinguish that profile from a real
provider call instead of claiming that all Ask execution is storage-free.

## Cross-capability contracts

- Knowledge uses Embedding only and owns vector/query/index meaning.
- Resolution uses Embedding and Reasoning but owns plans, evidence,
  contradictions, Results, and settlement.
- Agents use Reasoning through ToolBroker; Intelligence returns tool calls and
  executes none.
- Control owns Cast/route/provider policy and Organization limits; the Project
  owns its exact calls, reservations, receipts, continuations, and usage.
- Formula never calls Intelligence during evaluation. Authoring assistance is
  a separate caller operation whose proposed formula must pass deterministic
  Formula validation.
- Translation/Data extraction may use schema-bound Reasoning but must validate
  every typed field/citation deterministically.
- Operations surfaces may project safe aggregate usage/status from accounting
  records. An Ask call emits no Activity item or `SemanticFact`, and Memory
  cannot be silently inferred from provider transcripts; required metering
  Audit excludes prompts and payloads.

## Headless proof plan

1. Deterministic fake conforms to Embedding, Inference, and Reasoning Casts,
   including controlled usage, failures, calls, and continuations.
2. Provider adapter contract tests prove no provider SDK type escapes and
   semantic normalization is stable.
3. Unknown/extra/malformed outputs and tool calls fail closed.
4. Continuation ordering, replay, digest mismatch, depth/turn/tool/output
   limits, deadline, cancellation, and race tests.
5. Route epoch remains fixed for a live call; a newly published epoch affects
   only new calls; incompatible failover is refused.
6. Cast publication validates closed endpoint/schema/tool/limit semantics;
   concurrent deprecation denies new calls while retained receipts remain
   reproducible.
7. Session-permitted reservation precedes provider invocation; exact finalizer-
   only receipt/settlement/cancel remains idempotent across crash/revocation,
   cannot invoke the provider or write Product state, and usage cannot exceed
   policy without a terminal bounded failure.
8. Secret/log/error/JSON/trace negative fixtures prove credentials and content
   cannot print.
9. Data-class/region/retention unknown or denied policies fail closed.
10. Revoked Project authority prevents the eventual owning mutation even if a
   model call already completed.
11. Ask-profile write-set tests prove that admission can write only the exact
    bounded reservation/call/optional continuation/finalizer plus Audit, and
    finalization can write only the exact receipt/settlement/cancel plus Audit;
    deterministic local Ask can execute with zero writes and neither path emits
    Product effects or semantic facts.
12. Crash recovery settles or cancels an admitted reservation without
    duplicating provider spend or manufacturing a Product effect.
13. Live-provider evidence later covers real OpenRouter/OpenAI/Anthropic calls,
    rotation, outage, throttling, malformed response, cancellation, and cost
    reconciliation; source tests must not claim this evidence prematurely.

The initial product proof uses one embedding Cast for Knowledge and one
schema-bound Reasoning Cast for a grounded Document Prompt Block, with exact
route receipts and a deterministic fake producing the same domain contract.

## Source grounding

- [SOL X 44 — Intelligence](https://app.notion.com/p/39ab6410e5028127b45ee0f51977d1ee)
- [Original Intelligence construction](https://app.notion.com/p/393b6410e50281d1ad30f11bca8aa3ec)
- [SOL Y Developer Guide](https://app.notion.com/p/39ab6410e50281928025cdf64f09426d)
- [Omega capability model](../architecture/capability-model.md)
- [Omega jobs, Audit, and observability](../architecture/jobs-audit-observability.md)
- [Omega decision register](../decisions/README.md)

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
Nova working legacy evidence includes provider-neutral
[`model.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/intelligence/model.go),
the deterministic fake and provider boundary in
[`gateway.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/intelligence/gateway.go),
embedding identity in
[`embeddings.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/intelligence/embeddings.go),
and a real
[`openrouter.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/intelligence/openrouter.go)
adapter. Separate Embedding/Inference/Reasoning contracts, route epochs,
continuations/tools, budgets/receipts and production provider policy remain
target-only.
