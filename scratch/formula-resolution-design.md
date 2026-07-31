# Formula Resolution Design

## Decision Summary

This design keeps a strict separation:

1. **Structured Data is formula-agnostic**.
   It stores declarations (names + payload text/rows/schema) and returns
   descriptor objects.
2. **Formula performs semantic resolution/evaluation**.
   It decides when text must be parsed/evaluated and when direct translation is
   enough.
3. **Validation is mostly lazy**.
   We do cheap ingress checks on write, and perform deeper checks/evaluation on
   demand in Formula.

This avoids circular imports and supports large external tables without eager,
expensive full-table validation.

---

## Circular dependency (and how we avoid it)

Potential loop:

1. To evaluate a variable body, we need Formula.
2. To evaluate a formula that references names, Formula needs a resolver.
3. Resolver must read declarations from Structured Data.

If Structured Data imports Formula to evaluate entries, and Formula imports
Structured Data to resolve names, that becomes a direct architectural cycle.

**Rule**: Structured Data never imports Formula. Formula can depend on a
resolver contract that is implemented using Structured Data descriptors.

---

## Descriptor contract (Structured Data -> Formula)

Structured Data returns **declaration descriptors**, not evaluated values.

```ts
type DeclaredKind = "variable" | "function" | "table" | "record" | "list";

interface FormulaTextPayload {
  source: string;
}

interface CollectionPayload {
  schema: FieldDef[];
  rows: DataRow[]; // cells may be literals or { formula: string }
}

interface StructuredDataDescriptor {
  id: string;
  displayName: string;
  kind: DeclaredKind;
  revision: number;
  description: string;
  contextEntries: ContextEntry[];
  payload: FormulaTextPayload | CollectionPayload;
}
```

Formula receives these descriptors and applies kind-specific translation rules.

---

## Translation + evaluation ownership

| Kind | Structured Data behavior | Formula behavior |
|------|---------------------------|------------------|
| `table` | Store and return schema+rows | Translate directly to `TableValue`; evaluate formula cells lazily/on demand |
| `record` | Same storage shape as table | Translate directly to `RecordValue` |
| `list` | Same storage shape as table | Translate directly to `ListValue` |
| `function` | Store lambda source text | Parse to lambda `FunctionValue` (no call-time execution yet) |
| `variable` | Store source text | Parse/bind/evaluate to produce bound value |

Important: table/record/list/function are "same" in the sense that they are
declarations returned as descriptors and resolved by Formula. The only runtime
difference is what translation/evaluation step Formula applies.

---

## Write-time vs read-time validation

### Write-time (cheap, always)

1. Name uniqueness, revision checks, payload shape checks
2. Schema presence for collection kinds
3. Optional lightweight syntax check for formula text (parse only; no binding/eval)

### Read/evaluation-time (lazy, demand-driven)

1. Variable body evaluation
2. Function lambda semantic validity during parse/bind
3. Formula-cell evaluation in collection rows
4. Schema/value-kind conformance checks when values are read/evaluated

This keeps ingestion fast and scalable for connector-backed or very large tables.

---

## Resolver architecture

Use a wiring-layer resolver adapter. It imports both Formula and Structured Data;
capability modules remain decoupled.

```
3-capabilities/
  structured-data/      (no formula import)
  formula/              (no structured-data import)

1-init/ or 4-job-wiring/
  formula-name-resolver.ts   (imports both)
```

```ts
interface FormulaNameResolver {
  buildSnapshot(): Promise<FormulaResolverSnapshot>;
}
```

### Snapshot build flow

1. Read descriptors from Structured Data (`bindingView` / `list`).
2. Normalize names.
3. Translate direct kinds (`table`/`record`/`list`) to values.
4. Parse functions to lambda `FunctionValue`.
5. Evaluate variables using currently-available bindings.
6. Iterate until stable; detect cycles; emit diagnostics.

This preserves Formula as the only semantic evaluator.

---

## Endpoint shape

Two useful endpoints at wiring layer:

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/project/formula/evaluate` | body: `{ source: string }`, evaluated against current descriptor-derived snapshot |
| `GET`  | `/project/formula/snapshot` | debug view of current resolver snapshot |

No Structured Data endpoint needs to execute Formula directly.

---

## Concrete changes needed

1. Keep `3-capabilities/structured-data` free of Formula imports.
2. Add descriptor-oriented helper methods if needed:
   - `listDescriptors()` or re-use current list output as descriptor payload.
3. Add wiring-layer adapter file:
   - `apps/backend/src/1-init/create/formula-name-resolver.ts`.
4. Add formula job wiring:
   - `apps/backend/src/4-job-wiring/formula/registerFormulaEndpoints.ts`.
5. Register formula endpoints in startup after Formula + Structured Data are created.
6. Add resolver cache keyed by descriptor view revision.
7. Add cycle detection and diagnostics in variable evaluation loop.

---

## Non-goals

1. Full eager table-wide schema conformance validation at ingestion time.
2. Structured Data computing final Formula values itself.
3. Circular capability dependency between Structured Data and Formula.
