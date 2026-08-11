# Architecture imports and startup registry

This inventory freezes and enforces the real composition shape shipped by
Ω-004.

## Capability import graph

There are 21 Go packages under `core/capability`. Most are leaf packages. The
eight capability-to-capability imports are exhaustively classified in
[`architecture-import-map.tsv`](architecture-import-map.tsv). The baseline gate
derives the edges with `go list` and compares them exactly, so a new cross-
capability dependency cannot arrive as invisible architecture drift.

`core/architecture` also rejects capability-to-adapter, handler-to-store, shared
platform-to-product, composition-root, concrete Connector provider, and
archive/experimental imports. The 18 current departures are exact rows in
[`architecture-exceptions.tsv`](architecture-exceptions.tsv); every row carries
an owner, rationale, removal condition, and expiry packet. Tests reject stale or
incomplete rows and cap the budget at 18, so it may fall but cannot grow without
a reviewed packet changing the executable ceiling.

The sanctioned exceptions are:

- `agent` is an application composition tier over Document, Intelligence,
  Knowledge, Notification, and Persona contracts.
- `formula/names` is a small stateful manager over the pure `formula` library.
- `knowledge` and `resource` publish tool bindings with Intelligence
  `ToolBinding` and `ToolError` value types; embedding and exact reads remain
  behind their owning narrow ports.

Stable limit primitives remain generally allowed. Existing job, logging,
dispatch, HTTP, and filesystem dependencies are temporary exact exceptions,
not a wildcard permission.

## Startup registry

`core/wiring.Run` is the sole process composition root. At the frozen baseline
it:

- opens one WAL-mode SQLite Store and supplies it to every durable Store port;
- constructs all 21 capability packages (formula and formula/names are separate
  packages);
- installs and requires exactly three current `resource.Family` adapters:
  Document, Connector, and File;
- registers exactly five durable job handlers:
  `document.rebase`, `document.resolve`, `agent.run`, and
  `knowledge.rebuild-corpus`, plus `knowledge.reembed.run`;
- starts the job pool, task reaper, trash purge, connector detector, and session
  sweeper under process lifecycle control;
- builds transport options once, then installs 150 routes representing 145
  dispatch operations.

Resource families, durable jobs, immutable ToolSets, and Intelligence providers
reject duplicate or incomplete registrations. After all deliberate `UseX`
back-patches, `validateReadiness` checks required Resource, Connector, Context,
Document, Chat, and Knowledge ports before the pool, background workers, or
listener starts.

The acceptance gate runs the architecture checker, compares the eight
capability imports exactly, verifies the required three-family and five-job
sets, inventories all capability packages, and checks the source-derived
route/dispatch registry. Ω-013 still owns the bounded User Cell / Project
Subcell registries; Ω-004 defines their typed-port and rehydration constraints.
