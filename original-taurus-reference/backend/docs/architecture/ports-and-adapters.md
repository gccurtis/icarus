# Ports, adapters, and composition policy

Omega is one modular-monolith product with hexagonal capability boundaries. The
boundary is about ownership and dependency direction, not a process, database,
or network hop per capability, User, or Project.

The executable policy is `core/architecture`. `scripts/check-architecture.sh`
runs it directly, and `scripts/acceptance/omega-baseline.sh` includes it in the
completion gate. The checker reads the real Go package graph and applies these
rules:

- a leaf capability does not import another capability;
- a capability does not import handlers, transport, wiring, integrations, or
  concrete platform adapters;
- handlers do not import stores, providers, or composition;
- stable shared platform primitives do not import product behavior;
- only the process entry point reaches into `core/wiring`;
- runtime code does not import archived or experimental implementations.

The reviewed departures are exact edges in
`docs/completion/architecture-exceptions.tsv`. Every row has an owner,
rationale, removal condition, and expiry packet. The Ω-004 ceiling is 18:
removing an edge requires removing its now-stale exception, and reducing the
file is allowed; adding a nineteenth row fails until a later reviewed packet
deliberately changes the ceiling. There are no wildcard or inline suppressions.

## Ownership vocabulary

- **Domain types and policy** live in `core/capability/<owner>`. The capability
  owns its invariants, stable errors, and Store/behavior ports.
- **Inbound application ports** are the capability service methods or a narrow
  interface declared by the caller when it needs less than the whole service.
- **Outbound ports** are interfaces declared by the capability that needs an
  effect: storage, enqueue, model/retrieval, clock, observation, authorization,
  or collaboration.
- **Inbound adapters** live in handlers and application tool bindings. They
  decode/authorize/translate and invoke one application boundary.
- **Outbound adapters** live in `core/wiring`, `core/integration`, or
  `core/platform/storage`. They implement an owned port using another
  capability, SQLite, a provider, the filesystem, or a queue.
- **Composition** lives in `core/wiring`. It is the only place that constructs
  the complete production graph and it exposes one transport after validation.

`agent` remains the named application-composition tier. Its behavioral
dependencies are Agent-owned ports; direct capability imports carry canonical
value contracts. `formula/names` is an intentional stateful layer over the pure
Formula library. These and the two current tool-value seams are exact,
budgeted exceptions rather than a general permission for capability imports.

## Startup closure

Construction is fail-fast in two phases:

1. constructors and immutable registries reject invalid or duplicate Resource
   families, tools, and providers;
2. after the deliberate Document/Context, Chat/Knowledge, and
   Knowledge/Resource back-patches, `core/wiring.validateReadiness` validates
   required families and every required late-bound port before the job pool,
   background workers, or HTTP listener starts.

The durable job registry rejects blank, nil, and duplicate handlers and validates
the complete four-handler production set. `Resource.ValidateFamilies` validates
the Document, Connector, and File family set. `ToolSet.ValidateRequired` closes
profile-specific missing-tool checks while `NewToolSet` owns definition,
handler, and duplicate validation. `Intelligence.New` rejects nil, unnamed, or
duplicate provider identities and routes to absent provider keys.

Focused tests may intentionally construct a smaller service and omit optional
ports. Production readiness is stricter and explicit.

## Logical User and Project scopes

The runtime identity is:

```text
UserCell(UserID) -> ProjectSubcell(UserID, ProjectID)
```

A subcell acquires a complete, typed bundle of Resource, Workspace, Retrieval,
Agent, Job, and Project-change application ports from composition. It binds the
authenticated User and admitted Project to those façades; it never looks up a
global service locator. Alice and Bob in one Project therefore have distinct
keys and distinct ephemeral scopes. The same logical scope may be physically
rehydrated on any replica.

The cell owns only bounded caches, subscriptions, cursors, presence connections,
and coordination. Canonical Resource/Workspace state, revisions, idempotency
receipts, jobs, Activity, and change rows remain in durable stores. Discarding a
cell cannot roll back accepted work, and neither sticky sessions nor one
in-memory registry is a correctness requirement.

Ω-004 freezes this dependency and construction contract. Ω-013 owns the bounded
in-process registries, leases, and eviction implementation; Ω-014 owns the
durable Project change stream and replica catch-up behavior. Building those
registries or pretending that the current process-global services are cells
would cross those packet boundaries.

## Transaction and outbox boundary

A synchronous aggregate invariant stays inside one capability-owned Store
operation. When an accepted cross-capability outcome requires canonical state,
revision/ChangeSet, idempotency, Activity, and Project publication, one
unit-of-work adapter commits all required rows in the same database transaction.
Only after commit may a wake-up be emitted.

The durable outbox/change cursor is authority; an in-process channel, database
notification, or broker message is only a hint to list after the last cursor.
Retries use command idempotency and revision CAS. A durable job carries its
Project and actor/system identity and reauthorizes before publishing. Ω-014 owns
that schema and implementation; no temporary non-atomic event path is introduced
by this architecture packet.

## Topology

V1 remains one deployable Omega application over one physical database adapter
and one shared durable worker pool. Future identical replicas may rehydrate the
same logical key independently and converge through durable revisions and
change cursors. Capability ports are extraction seams if measured security or
load later justifies another deployable; they are not a reason to introduce
microservices pre-emptively.
