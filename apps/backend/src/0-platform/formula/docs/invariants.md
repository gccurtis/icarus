# Formula guarantees and invariants

## Outcome guarantees

Given syntactically valid `formula/v1` source, a resolver snapshot treated as immutable, and limits that permit the work, Formula returns either a typed `FormulaEvaluation` or diagnostics. It does not persist or publish the result.

| Preconditions/input | Guaranteed current outcome |
| --- | --- |
| Same source, binding identities/values and effective enforced limits | Same value identity, dependency digest and evaluation digest |
| Decimal literal | Exact reduced rational, never IEEE-754 evaluation arithmetic |
| Wire-serializable runtime value | Recursive exact JSON-safe `FormulaWireValue` round-trip |
| Function anywhere in a runtime value | `isWireSerializable=false`; `toWire` throws `TypeError` |
| Bound name whose ID/revision/digest no longer exists exactly | `stale_binding`; no display-name retargeting |
| Unknown unbound name | Binding/evaluation diagnostic, not a successful null |
| Structured Data declaration that fails to resolve | Absent binding plus typed resolver issue |
| `&&`, `||`, or named built-in `IF` with an unselected branch | Branch is not evaluated or observed |
| One-based positive/negative valid index | Selected list element or table row record |
| Cardinality promotion outside allowed row count | `cardinality_error` |

## Numeric and shape invariants

- `makeRational` always returns a positive denominator and reduced fraction; zero normalizes to `0/1`.
- `makeRecord` has exactly one row and equal field/value counts.
- `makeTable` checks every row width against the field count.
- `makeList` has one field named `value`.
- Ordinary operators require compatible kinds; only explicit conversion built-ins coerce.
- Division/modulo by zero and unsupported/non-integer powers become diagnostics at the engine boundary.
- Equality is structural and ordered for table fields/rows; function equality uses implementation/identity digests.

## Binding and dependency invariants

- Lambda locals take precedence over built-ins and project bindings.
- Built-in calls take precedence over project bindings and are case-insensitive.
- Newly bound references carry the source entry ID, owner revision and value digest.
- Previously bound nodes are matched by binding ID, not their old display name.
- Bound dependency digests are order-independent because references are sorted by ID.
- Snapshot digests include normalized name and owner identity, so delete/recreate with the same name/value changes the digest.
- Static bound dependencies are deduplicated by ID; symbolic dependencies are not.

`ReadonlyMap` and readonly fields are compile-time contracts only. Formula does not freeze snapshot objects, so runtime mutation by a caller can violate determinism.

## Concurrency and idempotency

`FormulaEngineImpl` has no per-request mutable state and is safe for concurrent calls when the supplied snapshot is not mutated. The parser's module-level node counter is shared, but generated node IDs do not participate in ordinary value/dependency digests; parsed AST IDs are not reproducible across calls or processes.

The Structured Data resolver has mutable cache and issue maps and does not serialize concurrent `buildSnapshot` calls. Builds read a complete `bindingView` and produce independent maps; callers should not treat cache population as an idempotency or transaction boundary. Structured Data persistence/revision checks provide the authoritative concurrency controls.

Formula has no idempotency key because it performs no accepted write.

## Limits: guarantees and current gaps

Enforced bounds cover token/node/depth counts, evaluator steps, lambda call depth, list rows, record fields, recursive output cells, output identity bytes, power magnitude, and positive rounding places. Failure uses `limit_exceeded` except parser node/depth bounds, which currently use `parse_error` messages.

Current non-guarantees:

- `maxIntegerBits` is configured but unused.
- `maxSourceBytes` compares UTF-16 code units, despite its name.
- `maxMarkRangeSpan` is unrelated Rich Text configuration and has no Formula effect.
- `FormulaDependencyRequest.limits`, `ExplainFormulaRequest.limits`, and resolver on explain are currently unused.
- Large tables created by `TABLE` or resolver bindings are not checked against `maxRows`/`maxFields` during their construction; final `maxCells`/`maxOutputBytes` still apply to an evaluation result.
- Negative `ROUND` places are not bounded by `maxRoundingPlaces` and may reach low-level arithmetic behavior.

## Failure behavior

Normal language errors are data: stable diagnostics with optional spans/details. Public parse/evaluate methods catch unexpected exceptions and return a failed `FormulaResult`. Low-level constructors, rational helpers, wire conversion, and display/from-wire helpers can throw when called directly.

`validate` uses two levels of success: the method can return `ok: true` while its `FormulaValidation.valid` is false. Consumers must inspect `valid` and diagnostics. `dependencies` does not surface binder diagnostics and may return unresolved symbolic names.

Errors remain distinct from null at resolver/engine boundaries. Internal helper failures carry `NULL_VALUE` only as an implementation placeholder paired with diagnostics.

## Logging and information handling

The engine records operation name, duration, diagnostic counts, step/count/limit metadata and unexpected error messages. It does not log source or result values. Resolver warnings include display names and diagnostic messages, so they are not guaranteed content-free. No Formula method attaches request IDs; correlation is supplied by surrounding endpoint/Job/Document logs.

Logger calls are synchronous interface calls. Formula does not catch logger sink errors, so a throwing logger can change control flow despite the intended observability boundary.

## Security and trust boundary

- Parser input is untrusted authored source and is bounded only by currently enforced limits.
- Resolver snapshots are trusted in-process objects; Formula does not validate map shape or digest consistency.
- `fromWire` trusts its typed input and is not an HTTP decoder.
- Formula supports no dynamic code execution, filesystem/network access, or host function injection.
- Diagnostic messages can repeat identifier/source fragments; callers decide what is safe to expose or log.

## Tests proving current behavior

[`structured-data-formula.test.ts`](../../../../test/capabilities/structured-data-formula.test.ts) covers Structured Data-only resolution, case-insensitive name collisions, formula cells, built-ins/lambda locals, function identity/non-serialization, reserved built-ins, long dependency chains, output cell/byte limits, stale binding without retargeting, owner-sensitive snapshot digests, typed resolver failures, collection ingress validation, and SQLite revision races.

[`rich-text-formula.test.ts`](../../../../test/capabilities/rich-text-formula.test.ts) covers deterministic display formatting and Formula wire settlement in Rich Text. [`document-application.test.ts`](../../../../test/capabilities/document-application.test.ts) exercises the host's durable workflows; Formula-specific internal queue classification is represented in [`createDocumentJobs.ts`](../../../4-job-wiring/document/createDocumentJobs.ts).

## Explicit non-goals/current omissions

- No direct Formula HTTP API, Job, SQL table, editor ownership, recalculation graph, or persisted cache.
- No combined projection-and-filter result: pipe parsing currently drops projected fields.
- No true byte spans for non-ASCII source.
- No runtime-deep-frozen snapshot.
- No fine-grained observed field/index/slice access despite the broader type.
- No guarantee that a `FormulaExpression` object is byte-identical across parses because node IDs differ.
- No function wire form.
