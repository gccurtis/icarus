# Formula types

## Public export surface

`index.ts` is the supported package surface. It exports the engine factory; request/result, value, AST, diagnostics, limits, resolver and dependency types; wire/display helpers; rational constructors; and value constructors. Lower-level lexer/parser/binder/evaluator functions are exported by their files but are not re-exported from the package index.

## Engine request and result family

Defined in `engine.ts`:

| Type | Essential fields | Meaning |
| --- | --- | --- |
| `FormulaLanguageVersion` | only `"formula/v1"` | Accepted language discriminator |
| `FormulaExpression` | `languageVersion`, `source`, `sourceDigest`, `root` | Parsed source plus AST |
| `FormulaResult<T>` | `ok`, optional `value`, optional `diagnostics` | Outer success/failure envelope |
| `ParseFormulaRequest` | `source`, `languageVersion`, optional limit overrides | Parse input |
| `ValidateFormulaRequest` | expression, optional resolver/limits | Binding validation input |
| `FormulaValidation` | bound expression, `boundIds`, diagnostics, `valid` | Successful validation operation, even when `valid=false` |
| `FormulaDependencyRequest` | expression, optional resolver/limits | Static dependency request; the current method does not use limits |
| `EvaluateFormulaRequest` | expression, required resolver, optional limits | Evaluation input |
| `FormulaEvaluation` | value, observed dependencies, two digests, versions, steps | Successful runtime result |
| `ExplainFormulaRequest` / `FormulaExplanation` | expression/resolver/limits; expression/steps | Shallow structural explanation; resolver/limits are currently unused |

The public `FormulaEngine` methods are cataloged in [runtime.md](runtime.md).

## AST family

`ast.ts` defines immutable discriminated nodes. Every node has a generated `id` and `SourceSpan`. The union includes:

| Family | Node discriminants |
| --- | --- |
| Scalars/names | `null-literal`, `number-literal`, `text-literal`, `logic-literal`, `name` |
| Structures | `list-literal`, `record-literal` |
| Operators/functions | `unary`, `binary`, `call`, `lambda` |
| Access | `field-access`, `index`, `slice` |
| Sets/cardinality | `set-operation`, `cardinality-promotion` |

`NameNode.binding` is an optional `BoundFormulaReference { kind: "binding"; bindingId; ownerRevision; valueDigest }`. Set-operation bodies are currently only `field-projection` or `condition-query`. Conditions are field comparisons, negation, or `and | or | xor` compositions.

`tokens.ts` defines the token discriminants and `SourceSpan`. Although fields are named `startByte` and `endByte`, the lexer currently stores JavaScript string indexes.

## Runtime value family

`value.ts` defines:

```text
FormulaValue
├── null
├── number -> CanonicalRational
├── text
├── logic
├── list   -> FormulaTable
├── record -> FormulaTable
├── table  -> FormulaTable
└── function -> BuiltinFunction | LambdaFunction
```

`FormulaTable` contains ordered field names and ordered recursive rows. Constructors enforce only the shapes encoded in their implementation:

- `makeList` always creates one `value` field and one row per element.
- `makeRecord` throws when field/value lengths differ and creates one row.
- `makeTable` throws when a row length differs from the field count.

`CanonicalRational` and `RationalWire` live in `rational.ts`. `makeRational` rejects a zero denominator, normalizes denominator sign, and divides by the greatest common divisor. `ZERO` is `0/1`; decimal input becomes an exact rational rather than floating point.

Function types are:

- `BuiltinFunction`: name plus `implementationVersion`.
- `LambdaFunction`: parameters, AST body, normalized source, captured lexical bindings, and `identityDigest`.
- `CapturedLexicalBinding`: name/value and an optional stable reference. The evaluator currently captures values from its local environment; snapshot references used in the body are represented in bound AST dependencies rather than copied into that local capture array.

`value-identity.ts` creates a JSON-compatible identity payload for every runtime kind, including function descriptors, and derives a 32-character digest.

## Resolver and dependency family

`resolver.ts` defines:

- `ProjectScope { userId, projectId }`;
- `ResolvedFormulaBinding`: stable reference, display/normalized names, runtime value, owner revision and value digest;
- `ResolverSourceRevision { sourceId, revision }`;
- `FormulaResolverSnapshot`: ID, project scope, readonly binding map, digest, and contributing source revisions.

The map is normally keyed by lowercase display name. Some evaluator paths also search values by `bindingId` because an AST binding is identity-addressed.

`dependencies.ts` defines:

- `SymbolicDependency { name, span }`;
- `ObservedDependency`: stable reference/revision/digest plus a typed access descriptor;
- `FormulaDependencyResult { symbolic, bound, observed?, dependencyDigest }`.

Static extraction fills `symbolic` and `bound`; engine evaluation separately fills observed dependencies. The current observed implementation reports `{ kind: "value" }` only.

The Structured Data adapter adds `FormulaNameResolver`, `FormulaResolutionIssue`, and `FormulaResolutionIssueCode` in `formula-name-resolver.ts`. Its issue codes are parse, evaluation, collection shape, unresolved dependency, and cycle failures.

## Diagnostics

`diagnostics.ts` defines `FormulaDiagnostic` with a stable `code`, human message, optional span/path and scalar details. Current codes are:

`parse_error`, `unknown_identifier`, `unknown_function`, `wrong_arity`, `type_error`, `divide_by_zero`, `numeric_error`, `invalid_index`, `index_out_of_range`, `unknown_field`, `invalid_table`, `cardinality_error`, `cycle_error`, `limit_exceeded`, `unsupported_version`, `stale_binding`, and `invalid_resolver_snapshot`.

Not every declared code has a current producer (`invalid_resolver_snapshot` is not emitted by the engine). Unexpected engine exceptions are caught and mapped to `parse_error` for parse/validate/dependencies or `numeric_error` for evaluate. Wire conversion is not wrapped in this diagnostic family and can throw.

## Limits

`limits.ts` defines thirteen numeric fields. Construction receives defaults from `BackendConfig.formula`; each engine request may supply a partial override.

| Limit | Current enforcement |
| --- | --- |
| `maxSourceBytes` | Parser compares `source.length` (UTF-16 units), not UTF-8 bytes |
| `maxTokens` | Parser excludes EOF from token count |
| `maxNodes`, `maxDepth` | Parser appends diagnostics and ultimately fails |
| `maxSteps` | Evaluator counts visited nodes |
| `maxCallDepth` | Lambda application only |
| `maxFields` | Record literal construction |
| `maxRows` | List literal construction |
| `maxCells` | Recursive post-evaluation count for list/record/table values |
| `maxOutputBytes` | UTF-8 byte size of JSON identity payload |
| `maxPowerMagnitude` | `^`, `POWER`, and `POW` |
| `maxRoundingPlaces` | Positive `ROUND` place counts; negative values are not rejected by this bound |
| `maxIntegerBits` | Present in config/type but not currently enforced |

## Wire and persistence forms

`wire.ts` defines `FormulaWireValue`: null, exact number strings, text, logic, and recursive list/record/table. Functions are deliberately absent.

- `isWireSerializable` recursively rejects functions.
- `toWire` recursively encodes and throws `TypeError` when it reaches a function.
- `fromWire` reconstructs runtime values. It assumes a well-formed typed input; it is not an ingress validator.

Document/Slide wire decoders validate their embedded `FormulaWireValue` independently at their boundaries. Formula itself owns no persisted row.

`display.ts` converts values to deterministic presentation-neutral text. Terminating rationals become decimals, non-terminating rationals use `numerator/denominator`, nested text is JSON-quoted, and functions become descriptors.
