# Platform — Icarus Formula Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e50281938df1c7ea5379a697).

## Summary / Concept
> **Build position — Foundations 3.** Formula follows Intelligence and Context and precedes Data. It is the deterministic expression engine shared by Data, Spreadsheet, Analysis, Document, Slides, and any later capability that stores or evaluates authored expressions.
### Concept
Formula owns tokenization, parsing, AST construction, binding, dependency extraction, exact numeric arithmetic, recursive value semantics, evaluation, wire encoding, limits, and diagnostics.
```plain text
expression + immutable resolver snapshot + configured limits
  -> typed value or stable diagnostics
```
Formula is an in-process Platform service. Calling capabilities own authored source, accepted values, persistence, revisions, ChangeSets, HTTP exposure, and queue selection.
### Prerequisites
- Backend configuration supplies every evaluation limit.
- Platform Logger is passed at construction.
- Formula consumers supply an immutable `FormulaResolverSnapshot`.
- Data supplies the adapter that freezes names and exact structured values into that snapshot.
### Repository placement
```plain text
apps/backend/src/
  0-platform/
    formula/
      ast.ts
      binder.ts
      builtins.ts
      dependencies.ts
      diagnostics.ts
      engine.ts
      evaluator.ts
      index.ts
      lexer.ts
      limits.ts
      parser.ts
      rational.ts
      resolver.ts
      tokens.ts
      value.ts
      wire.ts

  1-init/
    create/
      formula.ts
```
```typescript
export const createFormula = (
  config: BackendConfig,
  logger: Logger
): FormulaEngine => createFormulaEngine(config.formula, logger);
```
### Implementation alignment
The pushed implementation contains the public engine, exact rational arithmetic, recursive value algebra, parser, binder, evaluator, built-ins, diagnostics, dependency extraction, wire format, configured limits, and initialization.
Two alignment conditions remain part of the contract:
1. A combined projection-and-filter expression retains both projected fields and its predicate in the AST. Parsing the pipe form must not discard the projected fields.
2. `toWire` returns a typed `NON_SERIALIZABLE_VALUE` diagnostic when a function occurs at any depth. It never substitutes `null`.
## Types & Interfaces
### Value algebra
```typescript
export type FormulaValue =
  | NullValue
  | NumberValue
  | TextValue
  | LogicValue
  | ListValue
  | RecordValue
  | TableValue
  | FunctionValue;

export interface CanonicalRational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface FormulaTable {
  readonly fields: readonly string[];
  readonly rows: readonly (readonly FormulaValue[])[];
}
```
Canonical numbers are reduced rationals backed by `bigint`. The denominator is positive, numerator and denominator are coprime, and zero is `0/1`. Arithmetic, comparison, modulo, integer powers, floor, ceiling, and rounding operate on this exact form.
Lists, records, and tables share the rectangular carrier:
- list: one field named `value`, with zero or more ordered rows;
- record: exactly one row, with zero or more named fields;
- table: zero or more fields and zero or more rows.
Every cell is another `FormulaValue`. A table cell may therefore contain a list, record, table, function, or scalar. Rectangularity constrains each carrier, not the depth of nested values.
```typescript
export function makeList(elements: FormulaValue[]): ListValue;
export function makeRecord(
  fields: string[],
  values: FormulaValue[]
): RecordValue;
export function makeTable(
  fields: string[],
  rows: FormulaValue[][]
): TableValue;
```
### Functions
```typescript
export type FormulaFunction =
  | {
      readonly kind: "builtin";
      readonly name: string;
      readonly implementationVersion: string;
    }
  | {
      readonly kind: "lambda";
      readonly parameters: readonly string[];
      readonly body: FormulaNode;
      readonly normalizedSource: string;
      readonly capturedBindings: readonly CapturedLexicalBinding[];
      readonly identityDigest: string;
    };
```
Lambda values retain their AST, normalized source, stable captures, and identity digest. Functions are executable runtime state, not persistent Formula values.
### Wire values
Persistent capability state and transport payloads import Formula’s JSON-safe algebra.
```typescript
export type FormulaWireValue =
  | { readonly kind: "null" }
  | {
      readonly kind: "number";
      readonly numerator: string;
      readonly denominator: string;
    }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "logic"; readonly value: boolean }
  | {
      readonly kind: "list" | "record" | "table";
      readonly fields: readonly string[];
      readonly rows: readonly FormulaWireValue[][];
    };

export function toWire(
  value: FormulaValue
): FormulaResult<FormulaWireValue>;

export function fromWire(
  value: FormulaWireValue
): FormulaResult<FormulaValue>;
```
The wire carrier preserves exact rationals and recursive tables. A function at any depth produces `NON_SERIALIZABLE_VALUE`. Data and every other persistent consumer import `FormulaWireValue`, `toWire`, and `fromWire` rather than defining another algebra.
### Set-operation AST
```typescript
export type SetOperationBody =
  | {
      readonly kind: "field-projection";
      readonly fields: readonly string[];
    }
  | {
      readonly kind: "condition-query";
      readonly condition: FormulaConditionNode;
    }
  | {
      readonly kind: "projection-query";
      readonly fields: readonly string[];
      readonly condition: FormulaConditionNode;
    };
```
The `projection-query` node is required for expressions such as:
```plain text
people.{name, score | (score > 90) && (active = true)}
```
### Resolver
```typescript
export interface BoundFormulaReference {
  readonly kind: "binding";
  readonly bindingId: string;
  readonly ownerRevision: number | string;
  readonly valueDigest: string;
}

export interface ResolvedFormulaBinding {
  readonly reference: BoundFormulaReference;
  readonly displayName: string;
  readonly normalizedLookupKey: string;
  readonly value: FormulaValue;
  readonly ownerRevision: number | string;
  readonly valueDigest: string;
}

export interface FormulaResolverSnapshot {
  readonly id: string;
  readonly bindings: ReadonlyMap<string, ResolvedFormulaBinding>;
  readonly snapshotDigest: string;
  readonly createdFrom: readonly ResolverSourceRevision[];
}
```
Evaluation performs no I/O after receiving the frozen snapshot. Lookup order is:
1. lambda parameters and captured lexical bindings;
2. current set-operation row fields;
3. built-ins in call position;
4. resolver snapshot bindings.
Bound references retain stable IDs, owner revisions, and value digests, so a display-name change cannot silently retarget an already bound expression. An already-bound node whose owner revision or value digest changes returns `stale_binding`; it is never rebound by display name to a different owner.
### Public engine
```typescript
export interface FormulaEngine {
  parse(request: ParseFormulaRequest): FormulaResult<FormulaExpression>;

  validate(
    request: ValidateFormulaRequest
  ): FormulaResult<FormulaValidation>;

  dependencies(
    request: FormulaDependencyRequest
  ): FormulaResult<FormulaDependencyResult>;

  evaluate(
    request: EvaluateFormulaRequest
  ): FormulaResult<FormulaEvaluation>;

  explain(
    request: ExplainFormulaRequest
  ): FormulaResult<FormulaExplanation>;
}

export interface ParseFormulaRequest {
  readonly source: string;
  readonly languageVersion: FormulaLanguageVersion;
  readonly limits?: Partial<FormulaLimits>;
}

export interface ValidateFormulaRequest {
  readonly expression: FormulaExpression;
  readonly resolver?: FormulaResolverSnapshot;
  readonly limits?: Partial<FormulaLimits>;
}

export interface EvaluateFormulaRequest {
  readonly expression: FormulaExpression;
  readonly resolver: FormulaResolverSnapshot;
  readonly limits?: Partial<FormulaLimits>;
}
```
Evaluation returns the typed value, observed dependencies, dependency digest, evaluation digest, evaluator discriminator, and step count.
### Limits
```typescript
export interface FormulaLimits {
  readonly maxSourceBytes: number;
  readonly maxTokens: number;
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly maxSteps: number;
  readonly maxCallDepth: number;
  readonly maxFields: number;
  readonly maxRows: number;
  readonly maxCells: number;
  readonly maxOutputBytes: number;
  readonly maxIntegerBits: number;
  readonly maxPowerMagnitude: number;
  readonly maxRoundingPlaces: number;
}
```
Parsing, binding, and evaluation enforce these configuration-supplied bounds deterministically.
### Diagnostics
Diagnostics remain outside the value algebra and carry stable codes and source spans. The contract covers parsing, unknown identifiers, function lookup, arity, type, arithmetic, indexing, field access, table shape, cardinality, dependency cycles, limits, binding, resolver snapshots, and non-serializable values. A caller can preserve its last accepted value while displaying diagnostics for the current source.
## Runtime Objects
### Operator precedence
From lowest to highest:
1. logical OR `||`;
2. logical AND `&&`;
3. equality `=` and `!=`;
4. comparison `<`, `<=`, `>`, `>=`;
5. additive `+` and `-`;
6. multiplicative `*`, `/`, `%`;
7. prefix unary `+`, unary `-`, and logical `!`;
8. power `^`, right-associative;
9. postfix calls, `.field`, `.{...}`, `[index]`, `[start:end]`, postfix `!`, and postfix `?`.
Prefix `!` is logical negation. Postfix `!` is exact-one cardinality promotion. Position makes the meanings unambiguous. `^` is arithmetic power in an expression and XOR inside condition-query composition. `&&`, `||`, and `IF` short-circuit; unselected work does not contribute observed dependencies.
### Structured access
#### Field access
- `record.field` returns the recursive field value.
- `table.field` returns a list containing that field from every row.
- An unknown field returns a typed diagnostic.
#### Positional indexing
Indexes are one-based. Zero is invalid. Negative indexes count backward from the end.
```plain text
values[1]   -> first element or row
values[-1]  -> last element or row
values[-2]  -> second-to-last element or row
values[0]   -> invalid_index
```
List indexing returns an element. Table indexing returns the selected row as a record.
#### Slicing
Slices are one-based, half-open, and clamped to valid boundaries. Negative bounds count from the end.
```plain text
values[1:3]  -> positions 1 and 2
values[:3]   -> beginning through position 2
values[3:]   -> position 3 through the end
values[-3:]  -> last three positions
values[:-1]  -> everything before the last position
```
List slices return lists. Table slices return tables with the same fields. An empty span returns the same structured kind with zero rows.
#### Projection
Projection operates set-wise:
```plain text
value.{name, score}
```
A table projection preserves row order and returns the selected columns. A record projection preserves record kind.
#### Condition query
A condition query evaluates once per row with row fields placed first in the environment.
```plain text
people.{status = "active"}
people.{(age >= 18) && (status = "active")}
people.{(score > 90) || (override = true)}
people.{(flagA = true) ^ (flagB = true)}
```
Comparisons support `=`, `!=`, `<`, `<=`, `>`, and `>=`. Composition supports `&&`, `||`, XOR through `^`, prefix negation, and parentheses. Filtering returns a table.
#### Projection and filtering together
```plain text
people.{name, score | (score > 90) && (active = true)}
```
The runtime filters rows, projects fields, and preserves deterministic row and field order.
#### Cardinality promotion
- `table!`: requires exactly one row and returns that row as a record.
- `table?`: zero rows returns null; one row returns a record.
- `record!` and `record?`: return the record.
- More than one row produces `cardinality_error`.
```plain text
people.{name = "Ada"}!
```
This makes set-to-object conversion an explicit assertion.
### Evaluation
```plain text
source
  -> lex
  -> parse immutable AST
  -> validate syntax and limits
  -> bind symbolic names against one resolver snapshot
  -> evaluate with exact values and step accounting
  -> record observed stable dependencies
  -> produce value or diagnostics
  -> encode through Formula wire format when persistence is required
```
Identical expression source, resolver snapshot, and limits produce byte-equivalent wire values and diagnostics.
### Data resolver adapter
The provisional Data capability owns the adapter that converts its immutable name snapshot and exact structured-value snapshot into Formula’s resolver contract.
```typescript
export interface DataFormulaResolverAdapter {
  snapshot(input: {
    readonly namespaceId: string;
    readonly declarationIds?: readonly string[];
    readonly dataRevision?: number;
  }): Promise<FormulaResolverSnapshot>;
}
```
The adapter:
1. freezes one Data name snapshot;
2. parses referenced declaration bodies;
3. extracts stable Data value references;
4. reads all values at one exact Data revision;
5. resolves declaration dependencies;
6. detects cycles;
7. evaluates declaration bodies;
8. constructs bound references from stable IDs and revisions;
9. computes canonical value and snapshot digests;
10. returns a frozen `FormulaResolverSnapshot`.
The current Structured Data resolver adapter is the implementation reference for this seam. Consolidating names, tables, and variables under Data does not change Formula’s dependency direction.
## Change Operations
Formula is pure and persistence-free. Parse, validate, dependency extraction, evaluate, explain, encode, and decode return values or diagnostics without mutating a Base or emitting a ChangeSet. Calling capabilities own source edits, accepted results, revisions, undo, redo, recomputation state, and caches.
## Endpoints
Formula exposes no product endpoint. Capability endpoints invoke `FormulaEngine` in-process with a frozen resolver snapshot and capability-owned request and response types.
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
<td>Parse, validate, evaluate, explain, or extract dependencies for a request</td>
<td>Owned by the calling capability</td>
<td>Selected by the caller</td>
<td>Inline or internal</td>
<td>Calls `FormulaEngine` and emits no Formula ChangeSet</td>
</tr>
<tr>
<td>Recalculation or projection rebuild</td>
<td>Owned by the calling capability</td>
<td>Concurrent computation; serial publication when state changes</td>
<td>Internal or deferred</td>
<td>Evaluates against one immutable snapshot; caller validates and publishes</td>
</tr>
</table>
## SQL Tables
Formula owns no SQL tables. Persistent consumers store Formula source and `FormulaWireValue` results in their own capability tables and use `toWire` and `fromWire`.
## Invariants
1. Formula owns deterministic language and evaluation semantics.
2. Consumers own authored source, accepted results, revisions, ChangeSets, and caches.
3. Identical expressions, snapshots, and limits produce byte-equivalent wire values and diagnostics.
4. Canonical numbers use exact rational arithmetic.
5. Structured cells recurse through the same value algebra.
6. Positive indexes are one-based, negative indexes count from the end, and zero is invalid.
7. Slices are one-based, half-open, and clamped.
8. Projection and filtering operate across complete sets.
9. Cardinality operators make set-to-object conversion explicit.
10. Resolver snapshots remain immutable for one operation.
11. Stable binding identities survive display-name changes.
12. Executable functions never enter the persistent wire algebra.
## Acceptance Criteria
- Exact decimal identities remain exact after evaluation and wire round-trip.
- Nested lists, records, and tables preserve shape and value identity.
- Combined projection-and-filter ASTs retain both fields and predicate.
- Negative indexing and slicing match the documented one-based rules.
- Postfix `!` rejects zero or multiple rows; postfix `?` accepts zero or one.
- Short-circuited branches do not contribute observed dependencies.
- Binding uses stable IDs, revisions, and value digests.
- Function encoding at any depth returns `NON_SERIALIZABLE_VALUE`.
- Every evaluation limit fails deterministically with a typed diagnostic.
