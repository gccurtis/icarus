# Name Manager Capability Design

---

## What it is

The Name Manager is a platform capability that owns the stable identity of every user-facing name in a project. It provides the mapping layer between **display names** (mutable, user-editable) and **stable identifiers** (immutable, UUID-keyed) that Formula binder, dependency tracking, and ChangeSet history all rely on.

A name in the Name Manager is a declaration: "this stable ID is currently surfaced to users as this display name." Formula's `BoundFormulaReference` is stable across renames because the Name Manager is the single source of truth for what a stable ID means right now.

---

## Where it lives

```
apps/backend/src/
  0-platform/
    name-manager/
      types.ts        # NameEntry, NameScope, NameResolution, NameManagerSnapshot
      store.ts        # NameManagerStore interface (read + write)
      sqlite-store.ts # SQLite implementation
      name-manager.ts # NameManager class — the public in-process interface
      index.ts        # barrel
```

The Name Manager is a **platform capability**. It receives a Logger. It does not receive Intelligence or Formula. It has no HTTP endpoints; callers use `NameManager` in-process.

---

## Core types

```typescript
type NameKind =
  | "field"       // column in a table or record schema
  | "variable"    // named binding in a capability (cell, binding, node)
  | "formula"     // a named formula definition
  | "type"        // a named type alias or schema
  | "function";   // a user-defined function

interface NameEntry {
  id: string;           // stable UUID — never changes
  kind: NameKind;
  projectId: string;
  scopeId: string;      // logical container: table id, document id, sheet id, etc.
  displayName: string;  // current user-visible name
  revision: number;     // increments on every rename; starts at 1
  createdAt: string;    // ISO-8601
  updatedAt: string;    // ISO-8601
  deletedAt?: string;   // soft delete
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

Resolution is the act of converting a display name (as it appears in formula source) into a `BoundFormulaReference`. The Name Manager produces a `NameManagerSnapshot` that Formula's resolver snapshot is built from.

```typescript
interface NameManagerSnapshot {
  id: string;                                // snapshot UUID
  projectId: string;
  scopeId: string;
  entries: ReadonlyMap<string, NameEntry>;   // keyed by displayName
  snapshotRevision: number;                  // max revision across all entries
  createdAt: string;
}
```

Resolution order is defined by the **caller** (Formula engine, binder). The Name Manager does not impose an order — it provides the snapshot, and the binder applies the language's scoping rules on top.

### Ambiguous names

If two entries in the same snapshot share a display name (possible during a rename transition), the snapshot is marked `ambiguous: true` on those entries. The binder emits an `unknown_identifier` diagnostic with a hint listing the candidates.

---

## Public interface

```typescript
export interface NameManager {
  // Read
  snapshot(req: SnapshotRequest): Promise<NameManagerSnapshot>;
  resolve(req: ResolveRequest): Promise<NameResolution>;
  get(id: string): Promise<NameEntry | undefined>;

  // Write
  declare(req: DeclareNameRequest): Promise<NameEntry>;
  rename(req: RenameRequest): Promise<NameEntry>;
  delete(id: string): Promise<void>;
}

interface SnapshotRequest {
  projectId: string;
  scopeId: string;
}

interface ResolveRequest {
  projectId: string;
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
  projectId: string;
  scopeId: string;
  kind: NameKind;
  displayName: string;
}

interface RenameRequest {
  id: string;
  newDisplayName: string;
  expectedRevision: number;   // optimistic concurrency
}
```

`createNameManager(store, logger): NameManager` — plain factory.

---

## Persistence

```typescript
export interface NameManagerStore {
  getEntry(id: string): NameEntry | undefined;
  getByDisplayName(projectId: string, scopeId: string, displayName: string): NameEntry[];
  listScope(projectId: string, scopeId: string): NameEntry[];
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

The Name Manager produces `NameManagerSnapshot` → caller constructs `FormulaResolverSnapshot` → Formula binder maps display names to `BoundFormulaReference` → Formula evaluator is pure from that point forward.

```
NameManager.snapshot()
  → FormulaResolverSnapshot (caller-assembled)
    → FormulaEngine.parse() → AST
    → FormulaEngine.validate() → diagnostics
    → FormulaEngine.dependencies() → manifest
    → FormulaEngine.evaluate() → FormulaValue | diagnostics
```

Formula never calls Name Manager directly. The snapshot handoff is the coupling point.

---

## Build order

1. `types.ts` — NameEntry, NameKind, NameManagerSnapshot, BoundFormulaReference
2. `store.ts` — NameManagerStore interface
3. `sqlite-store.ts` — SQLite implementation
4. `name-manager.ts` — NameManager class
5. `index.ts` — barrel

---

## Key invariants

- Stable IDs never change; display names may change
- Revision increments monotonically; compare-and-swap on rename
- No live duplicate display names within a scope
- Soft delete only; no hard delete
- Name Manager does not know about Formula; Formula does not know about Name Manager
- All limits come from config
- Name Manager has no HTTP endpoints; callers use it in-process
