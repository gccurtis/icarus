# Capability model

## Definition

A capability is an independently testable Go library that owns a product
vocabulary and the functions operating on that vocabulary. It is not a
process, service endpoint, repository, worker pool, or deployment unit.

Capabilities expose two forms of behavior:

1. deterministic functions that transform plain state and input into plain
   output; and
2. functions that consume a narrow capability-owned port supplied by the
   caller for a concrete external need.

```go
// Illustrative only.
type EditCommand struct {
    BaseVersion Version
    Operations  []EditOperation
}

func ApplyEdit(current Document, command EditCommand) (Document, DocumentChangeSet, error)

type PromptResolutionProvider interface {
    Resolve(context.Context, PromptResolutionRequest) (PromptResolutionResult, error)
}
```

Persisted structures contain values and stable identifiers, never contexts,
interfaces, clients, callbacks, channels, locks, loggers, transports, or
provider objects.

## Standard source shape

```text
internal/capabilities/<family>/
├── api.go          intentional public operations
├── model.go        canonical serializable values
├── operations.go   commands, queries, and transformations
├── validate.go     invariants and bounds
├── ports.go        consumer-owned runtime needs, only when required
├── errors.go       stable domain error categories
├── render.go       deterministic projections when applicable
├── templates/      family-specific template behavior when applicable
└── *_test.go       tables, properties, fuzzing, and golden outputs
```

This is a convention, not boilerplate. A capability adds only files and ports
that express real behavior.

## Independence test

A capability is independent when it can be imported, exercised, fuzzed, and
rendered with plain inputs and deterministic fakes without starting the Host,
opening a database, serving HTTP, or booting unrelated capabilities.

Independence does not require separate deployment. If measured needs later
justify extraction, a transport adapter can wrap the same public operation
contracts without changing the capability's domain or persisted state.

## Handler envelope

The Cell handler owns environmental work:

```text
trusted request
  -> revalidate current authority
  -> load canonical state
  -> validate preconditions
  -> call capability operation
  -> obtain fresh one-use mutation permit when an effect will commit
  -> open bounded Project transaction
  -> validate/consume permit against authority fence
  -> persist canonical effect + idempotency + required Audit
     + declared SemanticFact + job submission
  -> commit
  -> return canonical version/projection
```

Queries omit the mutation transaction but remain authorized, bounded, and
version-aware.

## Cross-capability rule

The consumer defines the interface in its own vocabulary. An adapter outside
both capability packages satisfies it through the operation registry. Raw
sibling imports, global service locators, and provider-shaped domain models are
forbidden.

Nested invocations must propagate:

- immutable Cell key;
- actor and delegation chain;
- deadline and cancellation;
- remaining work/cost/recursion budget;
- idempotency lineage where applicable;
- trace correlation; and
- explicit operation/action identity.

Cycles and budget exhaustion fail before work begins.

## Capability families

- Resource families: Documents, Workbooks, Decks, Boards, Chats, Files
- Knowledge and reasoning: Knowledge, Resolution, Intelligence
- Computation and data: Formula, Data Objects, Data Catalog, analytic compute
- Experience: User Workspace, Translation, family-specific Templates,
  Collaboration, Search
- External integration: Project connector subscriptions, mappings, sync state
  and bounded provider intake
- Automation: Agents, Personas, Task Runs
- Context: Activity, Working Context, Episodes, Memory, Recommendations
- Security administration: Project Audit safe query/export/delivery models and
  validation

Control identity, sessions, Organizations, Projects, access, entitlements,
placement, provisioning, connector consent/connection identity/SecretRefs and
Control-local Audit are authoritative application domains, not optional
Product capabilities. Project connector subscriptions, mappings and sync state
remain capability-owned; Control never owns their canonical Project state. The
required Project-Audit appender remains part of every bound handler/UoW
envelope; the separate pure `projectaudit` capability owns only safe
administrative query/export/delivery models, validation, states and errors. It
cannot append or rewrite Audit. Platform packages remain technical leaves.

## Architecture laws

Machine-enforced rules must prove both legal and illegal fixtures:

- capabilities cannot import Host, Cell, transport, wiring, Control, SQL,
  provider SDKs, schedulers, loggers, or concrete platform adapters;
- sibling capabilities cannot import each other's implementations;
- handlers can import their capability and narrow neutral platform contracts,
  but not another handler implementation;
- platform cannot import product domains;
- transport cannot reach repositories or capability implementations directly;
- persisted models cannot contain forbidden runtime field types;
- Nova imports are forbidden; and
- internal gRPC/event-bus/runtime-service machinery is forbidden unless a later
  accepted decision changes the architecture.
