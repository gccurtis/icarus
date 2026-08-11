# Stage 00 — Foundation Host and bound Cell kernel

## Outcome

Build a Go-only backend foundation that can start a development/lab Host,
resolve a synthetic trusted scope, construct isolated Cells bound to immutable
`(UserID, ProjectID)` keys, execute typed operations through bounded interactive
workers, expose truthful health, and shut down cleanly.

This stage proves the runtime shape without identity, databases, Product
Resources, durable jobs, or a browser.

## Non-goals

- OIDC, sessions, Organizations, Projects, or real authorization
- MySQL, migrations, object storage, durable jobs, or canonical Resource state
- product capabilities beyond a small probe fixture
- frontend/Node
- gRPC, event runtime, service discovery, or goroutine per capability
- production startup with synthetic dependencies

## Target tree

```text
go.mod
flake.nix
flake.lock
Makefile
cmd/
  taurus-omega/main.go
  taurus-lab/main.go
internal/
  host/{bootstrap,routing,cells,runtime}/
  cell/
    key.go
    kernel/
    access/
    dispatch/
    scheduler/
    handlers/probe/
    runtime/
  capabilities/probe/
  transport/http/{server,health}/
  transport/cli/
  wiring/{testing,lab,development,production}/
  platform/{config,secrets,logging,clock,health}/
  architecturetest/
scripts/{architecture,supply-chain}/
```

## Contracts

### Scope and identity

- distinct `UserID`, `ProjectID`, `CellKey`, and `CellInstanceID` types;
- `CellKey` components cannot be set or replaced by decoded request fields;
- instance IDs are cryptographically random or equivalent collision-resistant
  identifiers supplied by trusted construction.

### Kernel

- versioned `Operation`;
- typed `Request`/`Response` with bounded metadata;
- `Execution` containing trusted key, actor/delegation, deadline, trace,
  idempotency lineage, and descending budget;
- stable error categories from request dispatch documentation;
- operation descriptors for type, action, limits, and nested-call policy.

### Dispatch and scheduling

- immutable registry builder with duplicate/type/descriptor validation;
- dispatcher that gates, admits, and creates a typed invocation;
- bounded nested invoker with cycle/depth/budget checks;
- per-Cell bounded queue/workers and host-wide fair capacity;
- overload/cancel/deadline/panic/drain semantics.

### Host

- synthetic bootstrap resolver only in testing/lab/development wiring;
- Cell factory, by-instance registry, optional scope index, and admission caps;
- routing that derives scope from the resolver, never from product payload;
- health/readiness and lifecycle joining all runnables;
- resource stack with reverse, once-only cleanup.

## Reference flow

```text
taurus-lab request
  -> lab transport decode/bounds
  -> Host synthetic resolver
  -> Cell factory/registry
  -> Cell gate
  -> typed registry lookup
  -> scheduler admission
  -> worker constructs Execution with bound key
  -> probe handler
  -> pure probe capability
  -> typed response/JSON
```

## Architecture laws

- capabilities cannot import runtime/platform/transport/SQL/network packages;
- Cell cannot import Host routing/registry;
- platform is a product-domain leaf;
- transport cannot reach handlers or repositories directly;
- Nova imports and internal RPC/event machinery are forbidden;
- serializable structs cannot contain context, function, channel, mutex,
  interface/client, DB, logger, or other runtime handle fields; and
- production wiring cannot reference synthetic resolvers/gates/providers.

Every law runs against the real tree plus at least one legal and one illegal
fixture.

## Proof matrix

- hostile payload cannot substitute User or Project;
- same-scope concurrent placement creates isolated instances within caps;
- User, scope, Cell, operation, queue, and Host caps reject deterministically;
- host-wide capacity is fair across Cells;
- queued/running cancellation and deadlines settle once;
- panics are redacted and do not kill workers;
- drain stops admission, settles/cancels accepted work, and leaks no goroutine;
- construction failure unwinds resources in reverse exactly once;
- fatal runnable cancels peers and all runnables are joined under race testing;
- development health becomes ready and handles SIGTERM cleanly; and
- production profile refuses startup.

## Completion boundary

Completion means the runtime contracts are real and race-clean. It does not
mean Taurus can authenticate, persist data, or serve Product operations. Stage
01 must replace technical placeholders before production can start.
