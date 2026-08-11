# 0027 Alpha backend-request audit

This documentation-only increment starts a branch from current `main`, reads
the current Taurus Alpha backend-request directory—including its staged Resource
revision—and separates already implemented Omega behavior from genuinely open
work before any new subsystem is built.

## `docs/superpowers/specs/2026-07-21-alpha-backend-request-inventory.md`

### Inventory every Alpha request against executable Omega state

The audit records Resources, members, AI generation, Project purpose, activity,
Project updates, and display name as individual backend requirements. It marks
members, rename, icon, display name, and the selected authenticated link-sharing
semantics as implemented; identifies Project timestamp semantics for review;
and leaves Resource catalog, purpose, activity, and generation as open work.

This prevents Alpha's stale all-Open status index from causing duplicate backend
implementations while still treating its newly added request documents as real
inputs.

### Capture the changed Resource integration requirement

The audit incorporates Alpha's staged clarification that Documents now exist in
Omega, tabs currently match them by name, and future Resource entries must
reference canonical Document IDs. It also calls out that “download” has no
contract in the metadata-only request and therefore remains separate work.

This matters because a unified Resource table must be an index/lifecycle layer
over family owners, not another source of Document or Deck content truth.

### Order the remaining backend work without premature scaffolding

The initial plan puts deterministic Project-purpose persistence first, the
Resource catalog at the center, Activity after confirmed Resource lifecycle
events exist, and AI generation after ordinary Resource creation plus Agent and
family tools are available. It records the architectural questions that must be
resolved next rather than inventing final types or transaction boundaries in an
inventory pass.

The document also distinguishes current `main` from the unmerged Quarterback
and Slides branches so later implementation can reconcile dependencies without
assuming feature-branch code is already part of the base.

## `docs/superpowers/specs/2026-07-21-resource-purpose-activity-design.md`

### Resolve Resource identity without duplicating family truth

The accepted design uses `(kind, family-owned ID)` as Resource identity and a
fixed owner-adapter catalog rather than a generic Resource table. Existing
Documents therefore appear under their real IDs, lifecycle operations continue
through Documents, and future Decks can join through an adapter after their
separate branch is integrated.

This directly answers Alpha's name-binding problem while preserving Omega's
capability boundaries and avoiding an unreliable second name/lifecycle record.

### Define purpose authorization and aggregate timestamp meaning

Project purpose is bounded plain profile text. Owners and editors may edit it;
owner-only Project fields remain owner-only, and mixed unauthorized patches
fail atomically. The design distinguishes persisted profile modification time
from the wire's aggregate “last edited,” which composes the latest profile or
Resource Activity time instead of making every family contend on the Project
row.

### Make Activity a committed semantic effect

Document create/edit/rename/delete facts are written in the same SQLite
transaction as the canonical effect. Activity exposes only bounded Project-
scoped reads with stable cursor ordering; it has no public append route and does
not accept client/model claims about effects.

This gives the Overview feed reliable events without confusing it with request
logs, security Audit, model memory, or canonical Document history.

## `docs/superpowers/plans/2026-07-21-resource-purpose-activity.md`

### Break the accepted design into green vertical increments

The implementation plan orders Project purpose, Activity query/persistence,
atomic Document facts, unified Resource routing, aggregate Project timestamps,
and end-to-end closeout. Each increment lists concrete source, companion, test,
storage, transport, dev-test, and documentation work and has an independent
commit boundary.

AI generation, Quarterback/Slides integration, unavailable Resource families,
and download/export stay explicitly outside the plan so deterministic backend
work cannot silently expand into the deferred agent/branch work.

## `docs/superpowers/specs/2026-07-21-alpha-backend-request-inventory.md`

### Record the accepted implementation scope

The inventory now links the detailed design and plan, marks Resource/purpose/
Activity as the work approved for this branch, and replaces its former next-
review agenda with the resolved design outcome. Deferred AI and feature-branch
integration remain visible rather than being accidentally treated as
prerequisites.
