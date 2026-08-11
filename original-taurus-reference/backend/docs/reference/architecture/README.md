# Architecture guide

Read in this order:

1. [System map](system-map.md) — conceptual topology and truth boundaries.
2. [Runtime](runtime.md) — Host, bound Cells, concurrency, and lifecycle.
3. [Request dispatch](request-dispatch.md) — operation routing, admission,
   handlers, nested calls, errors, and idempotency.
4. [Capability model](capability-model.md) — independent domain libraries and
   dependency laws.
5. [Control and Project boundary](control-and-project-boundary.md) — identity,
   tenancy, placement, permits, revocation, and Audit.
6. [Persistence and concurrency](persistence-and-concurrency.md) — database
   topology and capability-specific canonical state.
7. [Jobs, Audit, and observability](jobs-audit-observability.md) — record
   authority and asynchronous work.
8. [Repository map](repository-map.md) — expected packages/files and imports.
9. [Supply chain](supply-chain.md) — supported versions, pinning, dependencies,
   and updates.

The Product architecture intentionally uses a modular monolith: independently
testable capability libraries inside a Product Host, with explicit handler and
database boundaries. Control-worker and privileged operator graphs are separate
runtime/credential roles, not a federation of domain microservices. This
preserves future extraction options without paying network, service-discovery,
distributed-transaction, and operational costs before a measured requirement
exists.
