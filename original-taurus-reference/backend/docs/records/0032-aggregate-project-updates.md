# 0032 Aggregate Project modification time and closeout

This increment gives Project API timestamps their accepted aggregate meaning and
closes the deterministic backend-request implementation.

## `core/handlers/project/project.go`

### Compose profile and Resource Activity time

A narrow handler-owned reader batches latest Activity by Project. Every Project
view returns the later of persisted profile time and latest committed Resource
event time. Reader failures fail the response rather than knowingly advertising
stale aggregate metadata; Access remains unaware of Activity.

## `core/transport/transport.go`

### Inject aggregate timestamp reads when Activity is configured

Project handlers receive Activity in production while retaining an isolated
profile-only constructor path for focused tests.

## `core/wiring/wiring.go`

### Share one durable store across Resource, Activity, and Projects

The composition root binds all reads and owner mutations to the same SQLite
store, including the fixed Document Resource family.

## `core/transport/transport_test.go`

### Prove aggregate advancement and restart survival

The SQLite end-to-end test creates, renames, and deletes a Resource, observes
semantic actor/target snapshots, verifies Project time advances beyond profile
creation, reopens the database, and confirms Activity remains while the
canonical catalog stays empty.

## Companion and architecture documentation

### Keep implementation and explanation synchronized

Every changed/new non-test Go file has a regenerated paired companion whose Go
blocks reproduce the source exactly. Resource, Activity, Access, Document,
backend, manual, inventory, design, and plan docs describe the implemented
contracts and retain the deferred AI/Slides boundaries.
