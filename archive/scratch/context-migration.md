# Context Migration

**Status: Implemented.**

## What We Did

Collapsed Context to project-only scope, removed `promote` and the dual-scope
API entirely, and added two persisted composition endpoints (union and
difference) that accept context IDs or inline entries, require a
`displayName`, accept an optional `description`, and return only `{contextId}`.

## Steps

### 1. Collapse user/project scope in Context

Context is the only capability in the codebase with active dual-scope behavior. Remove it.

What to do:
- Drop the user table entirely. Keep one table, project-scoped.
- Remove `ContextStoreScope` type and all scope parameters from the service interface,
  store interface, and SQLite store.
- Remove the project-first-then-user-fallback logic in `get`, `getByName`, and `resolve`.
- Remove the `promote` method and its endpoint.
- Drop the user-scoped half of the endpoint tree (`/user/contexts/*`).
- Rename remaining `/project/contexts/*` endpoints to `/contexts/*`.

This is the bulk of the work. Everything else downstream stays the same because
`KnowledgeResourceResolver.resolve` has no scope parameter — it already only
receives entries and returns entries, with no scope threading.

Dev data note: drop and recreate the context DB. No migration needed.

### 2. Add description to ContextRecord

Add an optional `description` field to `ContextRecord` and thread it through
the SQLite store (add column to schema, update insert/update/select mapping).

### 3. Add the two new composition endpoints

These are the primary user-facing addition.

**POST /contexts/union**
```
Request:
  a: { contextId: string } | { entries: ContextEntry[] }
  b: { contextId: string } | { entries: ContextEntry[] }
  displayName: string          // required; name for the new context
  description?: string

Response 201:
  { contextId: string }
```

**POST /contexts/difference**
```
Request:
  a: { contextId: string } | { entries: ContextEntry[] }
  b: { contextId: string } | { entries: ContextEntry[] }
  displayName: string
  description?: string

Response 201:
  { contextId: string }
```

Both endpoints resolve each operand (load context by ID or use inline entries),
apply the existing `combine`/`difference` pure helpers, persist the result as a
named context (not anonymous), and return the new context ID.

The existing anonymous `compose` endpoint can be removed since these replace it
with a better contract.

### 4. Update alias and import paths

Context currently lives at `3-capabilities/context/`. If any files move, update:
- The `#context` path alias in `tsconfig.base.json` (and the backend tsconfig if it
  has a local override).
- Any import sites that reference context via a relative path instead of the alias.

---

## Behavioral Dependencies: User/Project Distinction at Large

Here is every place `userId` or a user/project scope distinction touches behavior
in the current codebase.

### Context — the only real dual-scope behavioral actor

This is the only capability where user vs project creates actual branching logic:

| What | File | Behavior |
|---|---|---|
| Two tables | `sqlite-store.ts` | `ctx_user_${userPrefix}_contexts` and `ctx_proj_${projectPrefix}_contexts` |
| Fallback reads | `context.ts` `get`/`getByName` | project table checked first; if nothing found, falls through to user table |
| Fallback resolve | `context.ts` `resolve` | same fallback during recursive expansion |
| Promote | `context.ts` | copies a user-scoped record into the project table |
| API split | `registerContextEndpoints.ts` | 10 endpoints × 2 scopes + 1 promote = 21 routes |

All of this goes away in this migration. After the change, Context has one scope
(project), one table, and a flat set of routes under `/contexts/*`.

### Activity / actorId — legitimate and staying

`userId` flows into activity attribution via `config.userId → actorId` on document
and slide operations. This is not a scope distinction — it is labeling who performed
an action in the append-only activity ledger. It has nothing to do with storage
routing or behavioral fallback. Keep it.

### Structured Data — already project-only; comment is stale

The store file says "Two store instances are used per backend: one for user scope,
one for project scope." That is stale. The create file passes only `config.projectId`.
There is no user-scoped structured data instance at runtime. The comment can be
deleted when touching that file.

### Formula name resolver scope — metadata, not behavior

`FormulaResolverSnapshot` carries `{ userId, projectId }` in a `scope` field.
This is only embedded for traceability in snapshot records — there is no branching
on `userId` in the resolver logic. It is not a behavioral dependency.

### Everything else — project-only from the start

Document, Slide, Connector, Activity, General Files, Derived Outputs all pass
`config.projectId` only to their stores. None of them have a user-scoped table
or user-fallback read path.

---

## Summary

The user/project behavioral distinction lives almost entirely in Context, and
it is being removed here. After this migration:

- Everything is project-scoped for storage.
- `userId` survives only as `actorId` in activity records, which is correct.
- One DB file per capability, one table prefix per project, no cross-scope fallback
  logic anywhere.

The consolidation of DB files into a single shared database is a later change
and is orthogonal to this migration.
