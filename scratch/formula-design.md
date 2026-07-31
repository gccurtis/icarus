# Formula Capability Design

Source reference: `docs/capabilities/formula.md`

---

## What it is

Formula is a deterministic expression capability. It owns grammar, AST,
values, name recognition, binding, evaluation, and diagnostics. It owns no
project state and has no migrations. Name state remains owned by Name Manager,
which Formula receives as a construction dependency.

A Formula evaluation is completely determined by:

```
language version + normalized expression + frozen Name Manager snapshot + limits
  = typed value | diagnostics
```

Formula obtains the frozen name environment and resolves names. Everything that
persists an authored expression, accepted result, or ChangeSet belongs to the
capability that calls Formula—Structured Data, Spreadsheet, Analysis, Document,
or Slides.

---

## Where it lives

```
apps/backend/src/
  0-platform/
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
      limits.ts         # FormulaLimits enforcement (values come from config)
      diagnostics.ts    # FormulaDiagnostic codes + constructors
      wire.ts           # FormulaWireValue encoding/decoding
      engine.ts         # pure parse/bind/evaluate implementation
      formula.ts        # Formula — public interface, Name Manager orchestration
      index.ts          # barrel
```

Formula is a **platform capability**—it lives in `0-platform/` alongside
Knowledge and Intelligence. `createFormula` receives Name Manager,
configuration, and Logger, but not Intelligence. It has no HTTP endpoints;
callers receive a `Formula` instance and call its methods directly.

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
| `v.{f1, f2 \| cond}` | Projection pipe — project fields, then apply condition query |
| `v!` | Table → record iff exactly one row; else `cardinality_error` |
| `v?` | Table → record or null iff 0–1 rows; else `cardinality_error` |

### Condition query chaining

A condition query inside `{...}` may be a single predicate or a chain of predicates connected by logical operators. Parentheses group individual predicates:

```
cond-query  ::= cond-term (cond-op cond-term)*
cond-term   ::= "(" field op expr ")" | field op expr
cond-op     ::= "&&" | "||" | "^"
```

`^` means XOR inside condition nodes only. In expression position `^` remains arithmetic power.

```
# simple
v.{age > 18}

# chained
v.{(age > 18) && (status = "active")}
v.{(score > 90) || (override = true)}
v.{(flagA = true) ^ (flagB = true)}

# projection pipe — select fields, then filter rows
v.{name, score | (score > 90) && (active = true)}
```

The `|` separator is only valid inside `{...}`. Left of `|` is a comma-separated field list (projection); right of `|` is a condition query chain (filter). Both sides are optional independently — omitting the left gives pure condition query; omitting the right gives pure projection.

---

## Name recognition and resolution

Resolution order inside an expression:

1. Lambda parameters / captured lexical bindings
2. Current set-operation row fields (field-first)
3. Resolver snapshot
4. Built-in names in call position

Formula recognizes external names after parsing. At the start of a validate,
dependency, evaluate, or explain call, Formula asks its injected Name Manager
for the applicable immutable snapshot. Formula evaluates referenced name
bodies, detects cycles, and constructs its internal resolver snapshot. The pure
engine then receives that frozen value and performs no I/O.

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

## Public Formula interface

```typescript
export interface Formula {
  parse(req: ParseFormulaRequest): FormulaResult<FormulaExpression>;
  validate(req: ValidateFormulaRequest): Promise<FormulaResult<FormulaValidation>>;
  dependencies(req: FormulaDependencyRequest): Promise<FormulaResult<FormulaDependencyResult>>;
  evaluate(req: EvaluateFormulaRequest): Promise<FormulaResult<FormulaEvaluation>>;
  explain(req: ExplainFormulaRequest): Promise<FormulaResult<FormulaExplanation>>;
}

type FormulaResult<T> =
  | { ok: true; value: T }
  | { ok: false; diagnostics: FormulaDiagnostic[] };
```

Requests that can recognize names carry the applicable `scopeId`; they do not
accept a caller-built resolver snapshot.

`createFormula(nameManager: NameManager, config: FormulaConfig, logger: Logger):
Formula`—Name Manager supplies frozen name state. Logger is used for timing,
limit violations, unexpected branches, and internal errors.

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

All enforced during parse, bind, and evaluation. Every limit value comes from
backend configuration—no value is hardcoded in the engine. `FormulaLimits` is
constructed by `createFormula` from a `FormulaConfig` section in
`configuration.yaml`.

```typescript
interface FormulaLimits {
  maxSourceBytes: number;
  maxTokens: number;
  maxNodes: number;
  maxDepth: number;
  maxSteps: number;
  maxCallDepth: number;
  maxFields: number;
  maxRows: number;
  maxCells: number;
  maxOutputBytes: number;
  maxIntegerBits: number;
  maxPowerMagnitude: number;
  maxRoundingPlaces: number;
}
```

```yaml
# configuration.yaml
formula:
  maxSourceBytes: 65536
  maxTokens: 4096
  maxNodes: 2048
  maxDepth: 64
  maxSteps: 1000000
  maxCallDepth: 32
  maxFields: 256
  maxRows: 100000
  maxCells: 1000000
  maxOutputBytes: 1048576
  maxIntegerBits: 4096
  maxPowerMagnitude: 1000
  maxRoundingPlaces: 20
```

Identical inputs + limits produce identical results. Limit changes are versioned.

---

## Consumer responsibility

Formula has no database tables. Consumers own:

- Authored source + source digest
- The `scopeId` used for name recognition
- Bound references + dependency manifest returned by Formula
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
10. `engine.ts` — pure engine assembly
11. `formula.ts` — public `Formula` assembly with Name Manager and Logger

---

## Key invariants

- Pure: same inputs → byte-equivalent outputs (logger calls are side-effects only and do not affect output)
- No floating point in canonical values
- Exact: `0.1 + 0.2 = 0.3`
- No migrations: Formula owns no project state
- Diagnostics never enter the value algebra
- One-based positive indexes; negative from end; zero always invalid
- Slices: 1-based, half-open, clamped
- `^` is power in expressions; XOR only inside condition node composition
- `|` inside `{...}` is projection pipe; it has no meaning in expression position
- Cardinality `!`/`?` applied to a record always returns that record unchanged
- Bound names are stable through display-name renames
- All limit values come from config — the engine has no hardcoded defaults
- Formula receives Name Manager and owns name recognition; callers never build
  resolver snapshots
- Formula is not exposed via HTTP; callers use `Formula` in-process
