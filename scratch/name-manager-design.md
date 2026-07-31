# Name Manager Capability Design

---

## What it is

The Name Manager is a **regular capability** that owns the stable identity of every user-facing name in a project. Users create and delete names directly. It provides the mapping layer between **display names** (mutable, user-editable) and **stable identifiers** (immutable, UUID-keyed) that Formula binder, dependency tracking, and ChangeSet history all rely on.

A name is a declaration: "this stable ID is currently surfaced to users as this display name, and its body is formula source text." Formula's `BoundFormulaReference` is stable across renames because the Name Manager is the single source of truth for what a stable ID means right now.

---

## Where it lives

```
apps/backend/src/
  3-capabilities/
    built-in/
      name-manager/
        types.ts              # NameEntry, NameKind, NameResolution, NameManagerSnapshot
        store.ts              # NameManagerStore interface (read + write)
        sqlite-store.ts       # SQLite implementation
        name-manager.ts       # NameManager class — in-process interface
        index.ts              # barrel

  4-job-wiring/
    name-manager/
      registerNameManagerEndpoints.ts
```

The Name Manager is a **regular capability**. It receives a Logger. It does not receive Intelligence or Formula. HTTP endpoints exist for user-facing operations (create, delete, list, rename).

---

## Core types

Both kinds store **formula source text** as their body. The distinction is structural:

- `"variable"` — body is any formula expression; may reference other names and therefore has dependencies. The type/kind of its value is determined on demand by resolving the body at the point it's needed.
- `"function"` — body is a lambda expression (starts with a parameter list). Structurally a lambda is already a `FormulaValue`; the distinction is user intent.

The Name Manager does not eagerly evaluate bodies or cache values. Any consumer that needs the type or kind of a name's value resolves it on demand via Formula.

```typescript
type NameKind =
  | "variable"    // formula expression — resolved on demand
  | "function";   // lambda expression — resolved on demand

interface NameEntry {
  id: string;              // stable UUID — never changes
  kind: NameKind;
  scopeId: string;         // logical container: project-global, document id, sheet id, etc.
  displayName: string;     // current user-visible name
  body: string;            // formula source text (expression or lambda)
  revision: number;        // increments on every rename or body update; starts at 1
  createdAt: string;       // ISO-8601
  updatedAt: string;       // ISO-8601
  deletedAt?: string;      // soft delete
}
```

### Stable references

Formula binder emits a `BoundFormulaReference` that contains only `id` + `revision`. Renames bump `revision` but keep `id`. An expression bound at revision 3 retains a `stale_binding` diagnostic if the name is now at revision 5 — the caller decides whether to rebind or reject.

```typescript
interface BoundFormulaReference {
  id: string;        // stable UUID from NameEntry
  revision: number;  // revision at bind time
  kind: NameKind;
}
```

---

## Name resolution

Formula resolves built-in names itself. For external names, Formula asks Name
Manager for a frozen `NameManagerSnapshot` before the pure evaluation phase.
Name Manager is never called from the evaluator.

Resolution converts a display name—as it appears in formula source—into a
`BoundFormulaReference` and exact value. Name Manager produces
`NameManagerSnapshot`; Formula consumes that snapshot, evaluates referenced name
bodies, and constructs its internal `FormulaResolverSnapshot`.

```typescript
interface NameManagerSnapshot {
  id: string;                                // snapshot UUID
  scopeId: string;
  entries: ReadonlyMap<string, NameEntry>;   // keyed by displayName
  snapshotRevision: number;                  // max revision across all entries
  createdAt: string;
}
```

Resolution order is defined by Formula. Name Manager does not impose an
order—it provides the snapshot, and Formula's binder applies the language's
scoping rules.

### Ambiguous names

If two entries in the same snapshot share a display name (possible during a rename transition), the snapshot is marked `ambiguous: true` on those entries. The binder emits an `unknown_identifier` diagnostic with a hint listing the candidates.

---

## HTTP endpoints

The job registry uses exact path matching (no path-param routing), so IDs are passed as body or query params.

| Method | Path | Transport |
|---|---|---|
| `POST` | `/names` | Body: `{ scopeId, kind, displayName, body }` |
| `GET` | `/names` | Query: `?scopeId=x[&kind=variable\|function]` |
| `GET` | `/names/entry` | Query: `?id=xxx` |
| `PATCH` | `/names/rename` | Body: `{ id, newDisplayName, expectedRevision }` |
| `PATCH` | `/names/body` | Body: `{ id, body, expectedRevision }` |
| `DELETE` | `/names` | Body: `{ id }` |

---

## In-process interface

```typescript
export interface NameManager {
  // Read
  snapshot(req: SnapshotRequest): Promise<NameManagerSnapshot>;
  resolve(req: ResolveRequest): Promise<NameResolution>;
  get(id: string): Promise<NameEntry | undefined>;
  list(req: ListRequest): Promise<NameEntry[]>;

  // Write
  declare(req: DeclareNameRequest): Promise<NameEntry>;
  rename(req: RenameRequest): Promise<NameEntry>;
  update(req: UpdateBodyRequest): Promise<NameEntry>;
  delete(id: string): Promise<void>;
}

interface SnapshotRequest {
  scopeId: string;
}

interface ResolveRequest {
  scopeId: string;
  displayName: string;
}

interface NameResolution {
  found: boolean;
  entry?: NameEntry;
  ambiguous?: boolean;
  candidates?: NameEntry[];
}

interface DeclareNameRequest {
  scopeId: string;
  kind: NameKind;
  displayName: string;
  body: string;   // formula source text — expression for "variable", lambda for "function"
}

interface UpdateBodyRequest {
  id: string;
  body: string;
  expectedRevision: number;
}

interface ListRequest {
  scopeId: string;
  kind?: NameKind;  // optional filter
}

interface RenameRequest {
  id: string;
  newDisplayName: string;
  expectedRevision: number;   // optimistic concurrency
}
```

`createNameManager(store: NameManagerStore, config: NameManagerConfig, logger: Logger): NameManager` — Logger used for all mutations, timing, and error conditions.

---

## Persistence

```typescript
export interface NameManagerStore {
  getEntry(id: string): NameEntry | undefined;
  getByDisplayName(scopeId: string, displayName: string): NameEntry[];
  listScope(scopeId: string): NameEntry[];
  insert(entry: NameEntry): void;
  update(entry: NameEntry): void;
  softDelete(id: string, deletedAt: string): void;
}
```

SQLite implementation uses a `names` table prefixed with the same 16-char hex prefix scheme used by `SQLiteKnowledgeStore` (SHA-256 of `projectId`, first 16 hex chars). A unique index on `(prefix_scopeId, displayName)` where `deletedAt IS NULL` enforces no live duplicates within a scope.

---

## Rename semantics

1. Caller calls `rename({ id, newDisplayName, expectedRevision })`.
2. Store checks `revision === expectedRevision` — if not, returns `stale_revision` error (optimistic concurrency; caller must re-read and retry).
3. Store bumps `revision`, sets `displayName`, sets `updatedAt`.
4. Any `BoundFormulaReference` with `revision < newRevision` is now stale. Consumers holding bound expressions must decide: rebind or display `stale_binding` diagnostic.

Renames do **not** cascade or update existing bound expressions. Staleness is always surfaced to the capability that owns the bound expression — it controls whether to auto-rebind, warn, or block.

---

## Deletion semantics

Soft delete: `deletedAt` is set, `displayName` is preserved in the record for audit. Live name resolution ignores soft-deleted entries. A `BoundFormulaReference` to a deleted entry produces `unknown_identifier` at evaluation time with the `stale_binding` code.

Hard delete is not supported — the Name Manager is append-only for audit purposes.

---

## Configuration

```typescript
interface NameManagerConfig {
  maxDisplayNameBytes: number;   // UTF-8 length cap on display names
  maxNamesPerScope: number;      // hard cap per scope to prevent runaway growth
}
```

```yaml
# configuration.yaml
nameManager:
  maxDisplayNameBytes: 256
  maxNamesPerScope: 10000
```

---

## Relationship to Formula

Name Manager is injected into Formula. Formula obtains `NameManagerSnapshot`,
resolves and evaluates referenced name bodies, constructs
`FormulaResolverSnapshot`, and then invokes its pure binder/evaluator.

```
NameManager.snapshot()
  → Formula recognizes names and evaluates referenced bodies
    → FormulaResolverSnapshot (Formula-owned)
      → parse / bind / evaluate
        → FormulaValue | diagnostics
```

Formula is the only consumer-side component that performs this name-resolution
orchestration. Capabilities such as Document pass formula source and `scopeId`
to Formula; they do not call Name Manager or assemble resolver snapshots.

---

## Build order

1. `types.ts` — NameEntry, NameKind, NameManagerSnapshot, BoundFormulaReference
2. `store.ts` — NameManagerStore interface
3. `sqlite-store.ts` — SQLite implementation
4. `name-manager.ts` — NameManager class
5. `index.ts` — barrel
6. `4-job-wiring/name-manager/registerNameManagerEndpoints.ts` — HTTP wiring

---

## Key invariants

- Stable IDs never change; display names and body may change
- Revision increments monotonically on every rename or body update; compare-and-swap enforced
- No live duplicate display names within a scope
- Soft delete only; no hard delete
- Name Manager does not know about Formula; Formula receives Name Manager
  through its construction boundary
- Formula resolves built-ins itself and consults Name Manager snapshots for
  user-declared names
- Bodies are formula source text — the Name Manager never evaluates them or caches values
- Type/kind of a name's value is always resolved on demand by the consumer via Formula
- `projectId` is not stored in request types — it is implicit in the runtime object and the underlying store table
- All limits come from config
- Logger present throughout — all mutations, timing, and error paths are logged
- HTTP endpoints exist for user-facing create, delete, rename, update, and list operations
