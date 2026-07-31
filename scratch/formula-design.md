# Formula Capability Design

Source reference: `docs/capabilities/formula.md`

---

## What it is

Formula is a pure, deterministic expression evaluator. It is a capability — it owns grammar, AST, values, evaluation, and diagnostics. It owns no project state. No migrations.

A Formula evaluation is completely determined by:

```
language version + normalized expression + resolver snapshot + limits = typed value | diagnostics
```

Everything that touches project state (bindings, cell values, accepted results, ChangeSets) belongs to the capability that calls Formula — Structured Data, Spreadsheet, Analysis, Document, Slides.

---

## Where it lives

```
apps/backend/src/
  3-capabilities/
    built-in/
      formula/
        value.ts          # FormulaValue union + FormulaTable carrier
        rational.ts       # CanonicalRational bigint arithmetic
        tokens.ts         # Token types + SourceSpan
        lexer.ts          # UTF-8 → token stream
        ast.ts            # FormulaNode discriminated union
        parser.ts         # tokens → AST
        binder.ts         # AST + resolver snapshot → bound AST
        resolver.ts       # FormulaResolverSnapshot type + helpers
        dependencies.ts   # symbolic + bound + observed dependency extraction
        evaluator.ts      # bound AST + snapshot → FormulaEvaluation
        builtins.ts       # built-in function registry
        limits.ts         # FormulaLimits defaults + enforcement
        diagnostics.ts    # FormulaDiagnostic codes + constructors
        wire.ts           # FormulaWireValue encoding/decoding
        engine.ts         # FormulaEngine — the single public in-process interface
        index.ts          # barrel

  4-job-wiring/
    formula/
      registerFormulaEndpoints.ts
      createFormulaJobs.ts
```

No platform dependency. Formula does not receive a Logger or Intelligence — it is a pure compute library.

---

## Language version

```typescript
type FormulaLanguageVersion = "formula/v1";
```

Version is stamped on every `FormulaExpression`. Future language changes introduce a new version string — they never silently change the meaning of persisted source.

---

## Value algebra

Exactly eight kinds. No implicit coercion between kinds.

```typescript
type FormulaValue =
  | NullValue
  | NumberValue
  | TextValue
  | LogicValue
  | ListValue
  | RecordValue
  | TableValue
  | FunctionValue;
```

### Numbers — exact rationals

```typescript
interface CanonicalRational {
  numerator: string;   // signed base-10 integer
  denominator: string; // positive base-10 integer, always coprime with numerator
}
```

Runtime arithmetic uses `bigint`. Wire encoding uses decimal strings. No JavaScript `number` floating-point in the canonical path. `0.1 + 0.2 === 0.3` is a hard invariant.

### Structured values — one shared carrier

`list`, `record`, and `table` all share:

```typescript
interface FormulaTable {
  fields: readonly string[];
  rows: readonly (readonly FormulaValue[])[];
}
```

| Kind | Shape constraint | Meaning |
|---|---|---|
| `list` | One field named `value`, 0+ rows | Ordered sequence |
| `record` | Exactly one row, 0+ fields | Keyed value |
| `table` | 0+ fields, 0+ rows | Rectangular relation |

Cells are recursive — a table column may contain nested records, lists, or tables. Construction validates and freezes.

### Functions — first-class

```typescript
type FormulaFunction =
  | { kind: "builtin"; name: string; implementationVersion: string }
  | { kind: "lambda"; parameters: readonly string[]; body: FormulaNode;
      normalizedSource: string; capturedBindings: readonly CapturedLexicalBinding[];
      identityDigest: string };
```

Lambda source and stable captures are persisted, not opaque closures. Arbitrary wire JSON cannot instantiate a function.

---

## Grammar — formula/v1

Follow the reference grammar verbatim. Key points:

- Postfix binds tightest: `.field`, `.{...}`, `[i]`, `[a:b]`, `!`, `?`, calls
- `^` is right-associative arithmetic power in expressions; logical XOR in condition nodes only
- Prefix `!` = logical NOT; postfix `!` = exact-one cardinality promotion — unambiguous by position
- `IF(c, t, f)` is lazy — only the selected branch is evaluated

### Structured access summary

| Syntax | Semantics |
|---|---|
| `v.field` | Record cell / table column as list |
| `v[1]` / `v[-1]` | 1-based index; negative from end; 0 = invalid |
| `v[1:3]` | 1-based half-open slice; negative boundaries from end; clamp |
| `v.{f1, f2}` | Field projection — preserves kind and row order |
| `v.{field op expr}` | Condition query — filters rows; returns table |
| `v!` | Table → record iff exactly one row; else `cardinality_error` |
| `v?` | Table → record or null iff 0–1 rows; else `cardinality_error` |

---

## Name resolution

Resolution order inside an expression:

1. Lambda parameters / captured lexical bindings
2. Current set-operation row fields (field-first)
3. Resolver snapshot
4. Built-in names in call position

The resolver snapshot is immutable. Resolution may do I/O to gather values before evaluation, but evaluation itself is pure.

```typescript
interface FormulaResolverSnapshot {
  id: string;
  scope: { userId: string; projectId: string };
  bindings: ReadonlyMap<string, ResolvedFormulaBinding>;
  snapshotDigest: string;
  createdFrom: readonly ResolverSourceRevision[];
}
```

Bound `NameNode` instances carry a stable `BoundFormulaReference` so renames never silently retarget an expression.

---

## Public engine interface

```typescript
export interface FormulaEngine {
  parse(req: ParseFormulaRequest): FormulaResult<FormulaExpression>;
  validate(req: ValidateFormulaRequest): FormulaResult<FormulaValidation>;
  dependencies(req: FormulaDependencyRequest): FormulaResult<FormulaDependencyResult>;
  evaluate(req: EvaluateFormulaRequest): FormulaResult<FormulaEvaluation>;
  explain(req: ExplainFormulaRequest): FormulaResult<FormulaExplanation>;
}

type FormulaResult<T> =
  | { ok: true; value: T }
  | { ok: false; diagnostics: FormulaDiagnostic[] };
```

`createFormulaEngine(): FormulaEngine` — a plain factory, no Logger, no Intelligence.

---

## HTTP jobs — all concurrent inline

Every Formula request is bounded concurrent work. No serial queue use.

| Endpoint | Handler |
|---|---|
| `formula.parse.v1` | `handleParse` |
| `formula.validate.v1` | `handleValidate` |
| `formula.dependencies.v1` | `handleDependencies` |
| `formula.evaluate.v1` | `handleEvaluate` |
| `formula.explain.v1` | `handleExplain` |

Long recalculation loops belong to the owning capability, not Formula.

---

## Diagnostics

```typescript
type FormulaDiagnosticCode =
  | "parse_error" | "unknown_identifier" | "unknown_function"
  | "wrong_arity" | "type_error" | "divide_by_zero" | "numeric_error"
  | "invalid_index" | "index_out_of_range" | "unknown_field"
  | "invalid_table" | "cardinality_error" | "cycle_error"
  | "limit_exceeded" | "unsupported_version" | "stale_binding"
  | "invalid_resolver_snapshot";
```

Diagnostics live outside the value algebra. A consumer can hold a last-good value while showing the current failure. Codes and spans are stable machine contracts; messages are human-readable.

---

## Limits

All enforced during parse, bind, and evaluation:

```typescript
interface FormulaLimits {
  maxSourceBytes: number;   // default 65_536
  maxTokens: number;        // default 4_096
  maxNodes: number;         // default 2_048
  maxDepth: number;         // default 64
  maxSteps: number;         // default 1_000_000
  maxCallDepth: number;     // default 32
  maxFields: number;        // default 256
  maxRows: number;          // default 100_000
  maxCells: number;         // default 1_000_000
  maxOutputBytes: number;   // default 1_048_576
  maxIntegerBits: number;   // default 4_096
  maxPowerMagnitude: number; // default 1_000
  maxRoundingPlaces: number; // default 20
}
```

Identical inputs + limits produce identical results. Limit changes are versioned.

---

## Consumer responsibility

Formula has no database tables. Consumers own:

- Authored source + source digest
- Resolver snapshot construction
- Bound references + dependency manifest
- Accepted result values + evaluation digests
- ChangeSet append for result settlement
- Cache keyed on `languageVersion + sourceDigest + resolverSnapshotDigest + limitsVersion + evaluatorVersion`

Settlement is compare-and-swap on owner revision + source revision + dependency version + generation token.

---

## Build order

1. `value.ts` + `rational.ts` — algebra foundation, pure bigint math
2. `tokens.ts` + `lexer.ts` — UTF-8 tokenizer
3. `ast.ts` + `parser.ts` — grammar → AST
4. `resolver.ts` — snapshot types
5. `binder.ts` — symbolic names → stable references
6. `dependencies.ts` — manifest extraction
7. `evaluator.ts` + `builtins.ts` + `limits.ts` — core evaluation
8. `diagnostics.ts` — diagnostic constructors
9. `wire.ts` — JSON encoding / decoding
10. `engine.ts` — `FormulaEngine` assembly
11. `4-job-wiring/formula/` — HTTP endpoint registration

---

## Key invariants

- Pure: same inputs → byte-equivalent outputs
- No floating point in canonical values
- Exact: `0.1 + 0.2 = 0.3`
- No migrations: Formula owns no project state
- Diagnostics never enter the value algebra
- One-based positive indexes; negative from end; zero always invalid
- Slices: 1-based, half-open, clamped
- `^` is power in expressions; XOR only inside condition node composition
- Cardinality `!`/`?` applied to a record always returns that record unchanged
- Bound names are stable through display-name renames
