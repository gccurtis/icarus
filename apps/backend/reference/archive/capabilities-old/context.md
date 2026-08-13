# Capability — Icarus Context Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e502818dbe15c88a58e9e52c).

## Summary / Concept
> **Build position — Foundations 2.** Context follows Intelligence and precedes Formula and Data. Knowledge consumes it through the resource-resolver seam; Research, Questions, Analysis, and authored work use the same resolved scope contract.
### Concept
Context names, persists, resolves, and composes bounded sets of resource references. A Context is an unordered set of typed identities. It can include another Context, allowing reusable nested scopes without copying referenced content.
Context owns scope identity, canonical set semantics, nesting, resolution, composition, revisions, and persistence. Referenced capabilities remain authoritative for referenced content. Knowledge owns lattice retrieval and receives resolved Context entries through an injected port.
### Prerequisites
- Platform Database supplies the configuration-bound SQLite store and transaction boundary.
- Platform Logger records mutations, resolution failures, and timings.
- Backend configuration supplies entry-count and resolution-depth limits.
- The request registry, serial queue, concurrent queue, and worker pool are available for endpoint wiring.
### Repository placement
```plain text
apps/backend/src/
  3-capabilities/
    context/
      types.ts
      store.ts
      sqlite-store.ts
      context.ts
      index.ts

  1-init/
    create/
      context.ts

  4-job-wiring/
    context/
      registerContextEndpoints.ts
```
Initialization constructs one `ContextManager` from the configured store and limits. Jobs and domain objects carry Context identities only.
## Types & Interfaces
### Entries and records
```typescript
export interface ContextEntry {
  readonly id: string;
  readonly kind: string;
}

export interface ContextRecord {
  readonly id: string;
  readonly displayName: string;
  readonly entries: readonly ContextEntry[];
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}
```
The pair `kind:id` identifies a reference without coupling Context to another capability’s persistence model. `kind: "context"` identifies a nested Context. Every other kind is an opaque leaf.
- `id` is stable.
- `displayName` is unique among live named Contexts.
- `entries` are deduplicated and canonically sorted.
- `revision` begins at 1 and advances on update or deletion.
- `deletedAt` implements soft deletion.
- Internally composed Contexts use a reserved display-name form and are excluded from standard listing unless requested.
### Configuration
```typescript
export interface ContextManagerConfig {
  readonly maxEntriesPerContext: number;
  readonly maxResolveDepth: number;
}
```
### In-process capability
```typescript
export interface ContextManager {
  get(id: string): Promise<ContextRecord | null>;
  getByName(displayName: string): Promise<ContextRecord | null>;
  list(options?: { includeAnonymous?: boolean }): Promise<ContextRecord[]>;

  declare(
    displayName: string,
    entries: readonly ContextEntry[]
  ): Promise<ContextRecord>;

  update(
    id: string,
    entries: readonly ContextEntry[],
    expectedRevision: number
  ): Promise<ContextRecord>;

  delete(id: string, expectedRevision: number): Promise<void>;

  resolve(
    entries: readonly ContextEntry[]
  ): Promise<readonly ContextEntry[]>;

  combine(
    a: readonly ContextEntry[],
    b: readonly ContextEntry[]
  ): readonly ContextEntry[];

  difference(
    a: readonly ContextEntry[],
    b: readonly ContextEntry[]
  ): readonly ContextEntry[];

  compose(
    operation: "combine" | "difference",
    a: readonly ContextEntry[],
    b: readonly ContextEntry[]
  ): Promise<ContextRecord>;
}

export function createContext(
  store: ContextStore,
  config: ContextManagerConfig,
  logger: Logger
): ContextManager;
```
### Store
```typescript
export interface ContextStore {
  get(id: string): ContextRecord | null;
  getByName(displayName: string): ContextRecord | null;
  list(options?: { includeAnonymous?: boolean }): ContextRecord[];
  insert(record: ContextRecord): void;

  updateIfRevision(request: {
    id: string;
    entries: readonly ContextEntry[];
    expectedRevision: number;
    updatedAt: string;
  }): ContextRecord | null;

  softDeleteIfRevision(request: {
    id: string;
    expectedRevision: number;
    deletedAt: string;
  }): boolean;
}
```
### Knowledge resolver port
```typescript
export interface KnowledgeResourceResolver {
  resolve(
    entries: readonly ContextEntry[]
  ): Promise<readonly ContextEntry[]>;
}
```
`ContextManager` satisfies this structural port. The composition root injects it into Knowledge while both components retain their own persistence and validation boundaries.
### Errors
```typescript
export class ContextNotFoundError extends Error {
  readonly id: string;
}

export class ContextConflictError extends Error {
  readonly displayName: string;
}

export class StaleContextError extends Error {
  readonly id: string;
  readonly expectedRevision: number;
  readonly currentRevision: number;
}

export class ContextCycleError extends Error {
  readonly path: readonly string[];
}

export class ContextDepthError extends Error {
  readonly maxResolveDepth: number;
}
```
## Runtime Objects
### Canonical set
A Context’s entries form an unordered set keyed by:
```typescript
const contextEntryKey = (entry: ContextEntry): string =>
  entry.kind + ":" + entry.id;
```
Canonicalization:
1. validates non-empty `id` and `kind`;
2. collapses duplicate keys;
3. sorts by `kind`, then `id`;
4. enforces `maxEntriesPerContext`;
5. serializes the canonical array for storage and hashing.
Equivalent entry sets therefore have identical serialized forms and digests. Input order carries no semantic meaning.
### Resolver
`resolve` recursively expands entries whose kind is `context`.
```plain text
input entries
  -> load each referenced live Context
  -> detect cycles with the active resolution path
  -> enforce maximum depth
  -> retain opaque leaf entries
  -> deduplicate
  -> canonicalize
  -> resolved entry set
```
An unavailable referenced Context contributes no leaf entries. Resolution is deterministic for equivalent inputs. A cycle reports the complete cycle path; a depth failure reports the configured bound.
### Pure composition
`combine(a, b)` returns canonical set union. `difference(a, b)` returns the entries in `a` whose keys do not occur in `b`. Both are pure and persistence-free.
### Persisted composition
`compose` applies union or difference, persists the canonical result as an internally named Context, and returns its stable record. Composition preserves references; resolution remains a separate operation.
### Scoped Knowledge retrieval
```plain text
caller entries
  -> Context.resolve
  -> canonical leaf set
  -> Knowledge extracts admissible source identities
  -> normal lattice descent
  -> candidate windows
  -> discard windows outside the admissible set
  -> Region assembly with scope manifest
```
Knowledge performs ordinary retrieval first, then removes candidate windows outside the resolved scope. An absent or empty input scope selects the complete configured lattice.
## Change Operations
<table fit-page-width="true" header-row="true">
<tr>
<td>Operation</td>
<td>Input</td>
<td>Effect</td>
<td>Revision boundary</td>
</tr>
<tr>
<td>declare</td>
<td>display name and entries</td>
<td>Creates a canonical named Context</td>
<td>Insert at revision 1; SQL enforces live name uniqueness</td>
</tr>
<tr>
<td>update</td>
<td>ID, replacement entries, expected revision</td>
<td>Replaces the complete canonical entry set</td>
<td>Atomic compare-and-swap</td>
</tr>
<tr>
<td>delete</td>
<td>ID and expected revision</td>
<td>Soft-deletes the record</td>
<td>Atomic compare-and-swap and revision advance</td>
</tr>
<tr>
<td>compose</td>
<td>operation and two entry sets</td>
<td>Persists a union or difference result</td>
<td>Serial insert at revision 1</td>
</tr>
<tr>
<td>resolve</td>
<td>entry set</td>
<td>Returns canonical leaf entries</td>
<td>No state change</td>
</tr>
<tr>
<td>combine / difference</td>
<td>two entry sets</td>
<td>Returns a canonical set value</td>
<td>No state change</td>
</tr>
</table>
Declare validates the display name, canonicalizes entries, enforces limits, inserts the record, and returns the committed row. Update and delete execute one atomic store operation. When a compare-and-swap changes no row, the service re-reads the record and maps the result to not-found, already-deleted, or stale-revision diagnostics.
## Endpoints
<table fit-page-width="true" header-row="true">
<tr>
<td>Method and path</td>
<td>Input</td>
<td>Result</td>
</tr>
<tr>
<td>`POST /contexts`</td>
<td>`{ displayName, entries }`</td>
<td>Declared Context</td>
</tr>
<tr>
<td>`GET /contexts`</td>
<td>optional `includeAnonymous`</td>
<td>Bounded Context list</td>
</tr>
<tr>
<td>`GET /contexts/entry`</td>
<td>query `id`</td>
<td>Context by ID</td>
</tr>
<tr>
<td>`GET /contexts/by-name`</td>
<td>query `displayName`</td>
<td>Live Context by name</td>
</tr>
<tr>
<td>`PATCH /contexts/entries`</td>
<td>`{ id, entries, expectedRevision }`</td>
<td>Updated Context</td>
</tr>
<tr>
<td>`DELETE /contexts`</td>
<td>`{ id, expectedRevision }`</td>
<td>Revision-checked soft deletion</td>
</tr>
<tr>
<td>`POST /contexts/resolve`</td>
<td>`{ entries }`</td>
<td>Canonical leaf set</td>
</tr>
<tr>
<td>`POST /contexts/combine`</td>
<td>`{ a, b }`</td>
<td>Pure union</td>
</tr>
<tr>
<td>`POST /contexts/difference`</td>
<td>`{ a, b }`</td>
<td>Pure difference</td>
</tr>
<tr>
<td>`POST /contexts/compose`</td>
<td>`{ operation, a, b }`</td>
<td>Persisted composed Context</td>
</tr>
</table>
The request registry uses exact path matching. IDs travel in query or body data.
## Jobs
<table fit-page-width="true" header-row="true">
<tr>
<td>Endpoint or intent</td>
<td>Job</td>
<td>Queue</td>
<td>Response</td>
<td>Calls or emits</td>
</tr>
<tr>
<td>`POST /contexts`</td>
<td>`DeclareContextJob`</td>
<td>Serial</td>
<td>Inline</td>
<td>Creates a revision-1 Context</td>
</tr>
<tr>
<td>`GET /contexts`, `/entry`, `/by-name`</td>
<td>List or read job</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Reads Context records</td>
</tr>
<tr>
<td>`PATCH /contexts/entries`</td>
<td>`UpdateContextJob`</td>
<td>Serial</td>
<td>Inline</td>
<td>Emits a revision-checked replacement</td>
</tr>
<tr>
<td>`DELETE /contexts`</td>
<td>`DeleteContextJob`</td>
<td>Serial</td>
<td>Inline</td>
<td>Emits a revision-checked soft deletion</td>
</tr>
<tr>
<td>resolve, combine, difference</td>
<td>Pure Context job</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Returns a canonical set without persistence</td>
</tr>
<tr>
<td>`POST /contexts/compose`</td>
<td>`ComposeContextJob`</td>
<td>Serial</td>
<td>Inline</td>
<td>Persists a composed Context</td>
</tr>
</table>
Concurrent jobs enter the worker pool when capacity exists and otherwise remain in the concurrent queue. Serial jobs execute one at a time and await completion before the next serial job starts.
## SQL Tables
Logical table names are mapped to the configured physical names by the SQLite adapter.
```sql
CREATE TABLE contexts (
  id           TEXT PRIMARY KEY CHECK (length(id) > 0),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  entries_json TEXT NOT NULL
    CHECK (json_valid(entries_json) AND json_type(entries_json) = 'array'),
  revision     INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE UNIQUE INDEX contexts_live_display_name
  ON contexts(display_name COLLATE NOCASE)
  WHERE deleted_at IS NULL;

CREATE INDEX contexts_updated
  ON contexts(deleted_at, updated_at DESC, id);
```
`entries_json` contains the canonical sorted and deduplicated array of `{ id, kind }` values.
Update:
```sql
UPDATE contexts
SET entries_json = ?,
    revision = revision + 1,
    updated_at = ?
WHERE id = ?
  AND revision = ?
  AND deleted_at IS NULL;
```
Soft deletion:
```sql
UPDATE contexts
SET deleted_at = ?,
    revision = revision + 1,
    updated_at = ?
WHERE id = ?
  AND revision = ?
  AND deleted_at IS NULL;
```
Exactly one changed row commits a mutation. SQL uniqueness and compare-and-swap are the final integrity boundaries even when more than one runtime process reaches the store.
## Invariants
1. Entries are unordered, deduplicated sets.
2. Canonical ordering makes equivalent sets digest-identical.
3. Context IDs are stable and revisions are monotonic.
4. Update and soft deletion use atomic compare-and-swap.
5. Nested Contexts resolve with cycle and depth protection.
6. Combine and difference are pure set operations.
7. Compose persists a referenceable result.
8. Context owns scope composition; referenced capabilities own their content.
9. Knowledge receives resolved leaves through an injected structural port.
10. Knowledge applies scope after normal descent and before Region assembly.
## Acceptance Criteria
- Equivalent entry sets persist and hash identically.
- Live display names remain unique case-insensitively.
- Stale updates and deletions return typed conflicts.
- Cycles and excessive nesting return bounded diagnostics.
- Resolution returns deterministic canonical leaves.
- Pure composition never changes stored state.
- Persisted composition returns an addressable Context.
- Scoped Knowledge retrieval cannot return a window outside the resolved scope.
