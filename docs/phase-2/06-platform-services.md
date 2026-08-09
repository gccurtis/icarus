# 06 · Platform Services (`0-platform`)
*Verified against source at commit ef6d462, 2026-08-09.*

`src/0-platform/` holds seven directories. Six contain TypeScript; one contains a `.gitkeep`
and a documentation package. Together they are **52 files and 9,301 lines** — 19.4% of the
backend's 47,936 lines.

A platform module is an in-process runtime that capabilities call. The rule is enforced by
what these modules do *not* do: **no platform module registers an HTTP endpoint** (all 89 come
from `4-job-wiring`), **no platform module owns a job intent** (all 7 internal intents are
Document's), and **no platform module appears in the retention sweep** (all 11 ports are
capability-owned — see [04 · State and Persistence](04-state-and-persistence.md)). Layer
direction is measured and clean: `0-platform` never imports `#init`, `#transport`,
`#capabilities`, or `#job-wiring`.

One module breaks the "stateless" generalisation you might expect from that list. **Knowledge
owns persistent state** — 5 of the backend's 53 live tables, in `data/knowledge.db` — through
the single adapter that constitutes the `database` module.

## The seven modules

| Module | TS files | TS lines | Docs pages | Alias | State | Status |
| --- | ---: | ---: | ---: | --- | --- | --- |
| [`formula`](#formula) | 18 | 3,525 | 6 | `#formula`, `#formula/*` | none | Complete language; one silently-wrong parse path |
| [`rich-text`](#rich-text) | 12 | 2,218 | 6 | `#rich-text`, `#rich-text/*` | none | Complete value service; several inverses lossy |
| [`knowledge`](#knowledge) | 15 | 2,118 | 6 | `#platform/*` | `data/knowledge.db`, 5 tables | Wired, load-bearing, **zero test files** |
| [`intelligence`](#intelligence) | 5 | 914 | 6 | `#platform/*` | none | Only the embedding and tool-loop paths run |
| [`observability`](#observability) | 1 | 137 | 6 | `#platform/*` | none | Complete; sink lives in `1-init` |
| [`database`](#database) | 1 | 389 | 6 | `#platform/*` | (Knowledge's) | **Not a database platform** — one adapter |
| [`web-retrieval`](#web-retrieval) | 0 | 0 | 6 | — | none | **Scaffold only.** `.gitkeep` + 6 doc pages |
| **Total** | **52** | **9,301** | **42** | | | |

Only Formula and Rich Text have bare module aliases. Knowledge, Intelligence, Observability and
Database are reached through the `#platform/*` wildcard, which means their consumers deep-import
concrete files (`#platform/knowledge/knowledge.js`, `#platform/observability/logger.js`). See
[01 · Layers and Boundaries](01-layers-and-boundaries.md) for the full 32-entry alias map.

Each module carries a six-file `docs/` package (`README`, `concepts`, `types`, `runtime`,
`flows`, `invariants`) — 42 of the repository's 114 module doc pages. Those packages are owned
by a later documentation pass and are **not** uniformly accurate; the quality ranking is stated
per module below.

## How each module is injected

Everything is constructed by hand in
[`src/1-init/startBackend.ts`](../../apps/backend/src/1-init/startBackend.ts) (238 lines). There
is no DI container and no service locator.

| Module | Constructed at | Factory | Injected into |
| --- | --- | --- | --- |
| Observability | `startBackend.ts:49` | `createLogger(config)` | 19 of the 23 files in `1-init/create/` declare a `logger: Logger` parameter; also `registerHttpTransport` (`:204`) |
| Intelligence | `startBackend.ts:56` | `createIntelligence(config, logger)` | Knowledge (`:65`, as `Embedder`), Derived Outputs (`:88`) |
| Knowledge | `startBackend.ts:65` | `createKnowledge(projectId, intelligence, logger, resourceRegistry)` | Investigation (`:71`, narrowed to `Pick<Knowledge,"add"\|"remove">`), General Files (`:80`), Connector (`:81`), Derived Outputs (`:88`) |
| Formula | `startBackend.ts:73` | `createFormula(config, logger)` | `formulaResolver` (`:75`), Document (`:105`) |
| Rich Text | `startBackend.ts:79` | `createRichTextInstance(config, logger)` | Document (`:104`) |
| Database | — | *(no factory)* | Not injected. `SQLiteKnowledgeStore` is constructed inside `createKnowledge` |
| Web Retrieval | — | *(none exists)* | Nothing |

Two facts about that table are worth stating plainly. **The `database` module is never composed
as a platform service** — it is an implementation detail of Knowledge's factory. And
`knowledge.onSourceMutation(...)` at `startBackend.ts:95-97` is the only subscriber to the only
event any platform module emits; the returned unsubscribe closure is discarded.

## Test coverage, measured

| Module | Dedicated test file | Tests attributable | Real class instantiated in tests? |
| --- | --- | ---: | --- |
| Formula | none | 22 (indirect: `rich-text-formula` 4, `structured-data-formula` 18) | Yes, via Structured Data resolution |
| Rich Text | none | (same 22, of which 4 touch Rich Text directly) | Yes |
| Knowledge | **none** | 1 (inside `derived-outputs.test.ts:627`) | Once, on empty text |
| Intelligence | **none** | 1 (inside `runtime-wiring.test.ts:173`) | **Never.** Only `OpenRouterProvider` |
| Observability | `observability.test.ts`, `logging-detail.test.ts` | 8 | Yes |
| Database | **none** | 0 | **Never** |
| Web Retrieval | **none** | 0 | n/a |

Measured by running the four platform-relevant files together at HEAD:

```
$ tsx --conditions=development --test --test-concurrency=1 \
    test/capabilities/{observability,logging-detail,rich-text-formula,structured-data-formula}.test.ts
1..26
# tests 30   # pass 30   # fail 0
```

26 top-level tests, 30 test points, of the suite's 325 / 444. Full-suite status is on
[10 · Verified Status](10-verified-status.md).

---

## Formula

### What it is

A complete expression language, `formula/v1`, in 18 flat files. The pipeline is conventional:

```text
lexer.ts → parser.ts → binder.ts → evaluator.ts
           ast.ts      resolver.ts  builtins.ts / value.ts / rational.ts
```

Arithmetic is **exact `bigint` rational**, not IEEE floating point
([`rational.ts:1-3`](../../apps/backend/src/0-platform/formula/rational.ts)):

> ```
> // CanonicalRational — exact bigint arithmetic.
> // Denominator is always positive and coprime with the numerator.
> // Zero is always { numerator: 0n, denominator: 1n }.
> ```

Verified: `0.1 + 0.2` evaluates to exactly `0.3`; `1 / 3` stays `1/3` and displays as a fraction
because `display.ts:53-82` factors the denominator into 2s and 5s and only renders a decimal for
terminating rationals.

The module holds **no mutable state at all**. Its only runtime inputs are a `FormulaLimits`
object and a `Logger`.

### Public surface

`createFormulaEngine(limits, logger)` ([`engine.ts:379`](../../apps/backend/src/0-platform/formula/engine.ts))
returns a `FormulaEngine` with **five methods** (`engine.ts:95-101`):

| Method | Returns | Reads `request.limits`? | Notes |
| --- | --- | --- | --- |
| `parse` | `FormulaResult<FormulaExpression>` | yes | Rejects any `languageVersion !== "formula/v1"` with `unsupported_version` (`engine.ts:163-166`). `sourceDigest` is a 32-hex truncated SHA-256 |
| `validate` | `FormulaResult<FormulaValidation>` | **computes and discards** (`engine.ts:198`) | **Two levels of success.** Binding failure still returns `ok: true`; the failure is in `.valid === false` |
| `dependencies` | `FormulaResult<FormulaDependencyResult>` | **no** — the field exists, nothing merges it | Does not fail on binder diagnostics |
| `evaluate` | `FormulaResult<FormulaEvaluation>` | yes | Fails on any bind diagnostic; applies `maxCells` (`:261`) and `maxOutputBytes` (`:274`) post-hoc |
| `explain` | `FormulaResult<FormulaExplanation>` | no | **Zero callers anywhere.** No bind, no evaluate, no resolver, no logging, no `try/catch` |

`explain()` is implemented and exported on the interface, and `grep -rn "explain"` outside the
module returns nothing in `src/` or `test/`. Its request and result types
(`ExplainFormulaRequest`, `FormulaExplanation`) are not even on the public barrel
([`index.ts`](../../apps/backend/src/0-platform/formula/index.ts)) — a caller outside the module
could not name them without a subpath import.

Eight value kinds, stated at [`value.ts:1-2`](../../apps/backend/src/0-platform/formula/value.ts):

> ```
> // FormulaValue algebra — exactly eight kinds, no implicit coercion.
> // LambdaFunction.body is FormulaNode (imported from ast.ts).
> ```

`null`, `number`, `text`, `logic`, `list`, `record`, `table`, `function`. `list` / `record` /
`table` share one `FormulaTable { fields, rows }` carrier.

### Language surface

**Precedence**, read off the parser's call chain, lowest to highest: lambda (`parser.ts:91`) →
`||` → `&&` → `= !=` → `< <= > >=` → `+ -` → `* / %` → prefix `+ - !` → `^` (right-associative)
→ postfix (call, `.field`, `.{…}`, `[index]`, `[start:end]`, `!`, `?`). Verified: `2 ^ 3 ^ 2` is
`512`; `-2 ^ 2` is `-4`.

**27 built-in names**, case-insensitive, in `builtins.ts:23-28`; 23 distinct implementations
(four aliasing pairs: `AVG`/`AVERAGE`, `POWER`/`POW`, `CEIL`/`CEILING`, and `LAMBDA`/`FUNCTION`
as syntax names). Built-in names are reserved by the binder in **every** position, not only call
position (`binder.ts:32-34`):

> ```
>       // 2. Formula built-ins are language names and cannot be shadowed by
>       // project data. Structured Data rejects them at ingress as well, while
>       // this ordering also protects snapshots created from older databases.
> ```

A consequence: a bare `SUM` with no call parentheses is `unknown_identifier`, not a first-class
function value, and a project entry named `Text` can never be referenced from a formula at all.
Structured Data blocks that at ingress instead (`structured-data-formula.test.ts:333`).

The other load-bearing binder comment, `binder.ts:36-39`, explains the module's most important
safety property:

> ```
>       // 3. A previously-bound node is identity-bound, not name-bound. Looking
>       // it up by display name here would allow a rename followed by a new
>       // declaration under the old name to silently retarget the expression.
> ```

**Set operations** `.{ … }` accept only `record` or `table` and have exactly two AST body kinds
(`ast.ts:154-156`): `field-projection` and `condition-query`. All lookups are case-insensitive
(`normalizeKey` is `name.toLowerCase()`, `resolver.ts:36-38`).

**Two lambda limitations** that produce silent `parse_error`s for authors:

1. A lambda cannot be immediately invoked — `LAMBDA(x, x + 1)(4)` is
   `parse_error: Unexpected token after expression: '('`, because `parseLambdaOrLogicalOr`
   returns the node without routing it through `parsePostfix`. `(LAMBDA(x, x * 2))(5)` works.
2. A lambda cannot be an operand of any binary operator — `1 + LAMBDA(x, x)(2)` is
   `parse_error: Unexpected token 'LAMBDA'`, because `parsePrimary` has no `lambda` case.

**No arity validation on the variadic built-ins.** `MIN()` returns `null` with no diagnostic;
`SUM()` returns `0`, `PRODUCT()` returns `1`, `CONCAT()` returns `""`, `AND()` returns `TRUE`.

### Limits: 13 configured, 11 enforced, 1 partial, 1 never read

[`limits.ts:1`](../../apps/backend/src/0-platform/formula/limits.ts) opens with the design
statement:

> `// FormulaLimits — all values come from config, none hardcoded in the engine.`

That is true of *sourcing*. It is not true of *enforcement*.

| Limit | Default | Enforced | Site | Failure code |
| --- | ---: | --- | --- | --- |
| `maxSourceBytes` | 65,536 | Yes — but counts **UTF-16 code units**, not bytes | `parser.ts:656` | `parse_error` |
| `maxTokens` | 4,096 | Yes | `parser.ts:663` | `parse_error` |
| `maxNodes` | 2,048 | Yes, as an accumulating diagnostic rather than a hard stop | `parser.ts:72-74` | `parse_error` |
| `maxDepth` | 64 | Yes, same accumulating style | `parser.ts:82-85` | `parse_error` |
| `maxSteps` | 1,000,000 | Yes | `evaluator.ts:56` | `limit_exceeded` |
| `maxCallDepth` | 32 | Yes — **lambda application only** | `evaluator.ts:381` | `limit_exceeded` |
| `maxFields` | 256 | Yes — **record *literal* construction only** | `evaluator.ts:168` | `limit_exceeded` |
| `maxRows` | 100,000 | Yes — **list *literal* construction only** | `evaluator.ts:153` | `limit_exceeded` |
| `maxCells` | 1,000,000 | Yes — post-evaluation recursive count | `engine.ts:261` | `limit_exceeded` |
| `maxOutputBytes` | 1,048,576 | Yes — UTF-8 size of the JSON identity payload | `engine.ts:274` | `limit_exceeded` |
| `maxPowerMagnitude` | 1,000 | Yes — both `^` and `POWER`/`POW` | `evaluator.ts:248`, `builtins.ts:200` | `limit_exceeded` |
| **`maxIntegerBits`** | 4,096 | **NO** | — | — |
| **`maxRoundingPlaces`** | 20 | **PARTIAL** — positive places only | `builtins.ts:220` | `limit_exceeded` |

`maxIntegerBits` appears exactly five times in the whole repository: the declaration
(`limits.ts:14`), a pass-through inside `mergeLimits` (`engine.ts:124`), and three config lines
(`loadBackendConfig.ts:50`, `:214`, `:534`). **There is no enforcement site.** A configured
integer-width bound does nothing.

`maxRoundingPlaces` bounds the positive side only. A negative place escapes as a `RangeError`
thrown by `10n ** BigInt(-2)` inside `roundR` (`rational.ts:128`), past `callBuiltin`, into the
engine's outermost generic `catch` (`engine.ts:306-310`). Reproduced against the real engine at
HEAD:

```
ROUND(1.2345, -2)  =>  numeric_error: Unexpected evaluation error: undefined must be positive
```

That is not a typed diagnostic. It is a low-level exception with a nonsensical message.

Also unenforced: `maxRows` / `maxFields` against tables produced by `TABLE(...)`, by resolver
bindings, or by set operations. Only the terminal `maxCells` / `maxOutputBytes` checks bound
those.

### The projection-pipe bug — the only silently wrong answer in the backend

`parseSetBody` handles the projection-plus-filter form `.{fields | condition}` by discarding the
projection. [`parser.ts:335-347`](../../apps/backend/src/0-platform/formula/parser.ts), verbatim,
including the developer's own note:

```
    // Check for pipe — projection pipe
    if (check(ctx, "pipe")) {
      advance(ctx); // consume |
      const condition = parseConditionQuery(ctx);
      // projection pipe is a condition-query with projected fields noted on the SetOperationNode
      // We encode this as: first project (separate node), then filter
      // For simplicity, encode as condition-query and let the evaluator handle projection+filter
      // Actually, the design says to handle it natively. Let's encode as a combined body.
      // We'll extend SetOperationBody to support both:
      return { kind: "condition-query", condition };
      // NOTE: The projected fields are lost here — this is a simplification.
      // A full implementation would carry both. For now, condition-only.
    }
```

`SetOperationBody` was never extended. Reproduced by execution against the real engine at HEAD,
with a table `people(name, score, active)` holding `Ada/95/yes` and `Bob/70/no`:

| Expression | Result |
| --- | --- |
| `people.{name, score}` | fields `[name, score]`, 2 rows — correct projection |
| `people.{score > 80}` | fields `[name, score, active]`, 1 row — correct filter |
| `people.{name, score \| score > 80}` | fields **`[name, score, active]`**, 1 row — **wrong** |

**The expression parses, evaluates, and returns filtered rows with every column. There is no
diagnostic, no warning, and no log line.** This is the only place in the backend that returns a
silently wrong answer rather than an error; everything else fails loudly. A caller cannot detect
it without comparing the returned field list against the source expression.

Chaining is a working substitute in one direction: `people.{name, score}.{name}` correctly
returns `[{name: Ada}, {name: Bob}]`.

Two adjacent parser weaknesses: `isLikelyProjection` (`parser.ts:356-376`) defaults to
projection whenever an identifier is followed by a comma (`return true` at `:370`, commented
`// Default to projection for simplicity`), and its last two branches both return `false`, so
the condition-operator check at `:373-374` is redundant. A mixed body such as
`people.{name, score > 90}` is parsed as projection `{name}` and then fails with
`Expected '}' but got ','`.

### Diagnostics and the wire form

17 stable codes in `diagnostics.ts`, each with a constructor. Shape is
`{ code, message, span?, path?, details? }` — **`path` is declared at `diagnostics.ts:28` and
never populated anywhere.** Three codes have no producer in the module: `invalid_resolver_snapshot`
is emitted nowhere in the repository; `cycle_error` is emitted only by the Structured Data
adapter in `1-init` (`formula-name-resolver.ts:211, 219`); `unknown_function`'s constructor
(`diagnostics.ts:65`) has zero callers, though the code itself is produced by an object literal
at `builtins.ts:327`.

`toWire` ([`wire.ts:44`](../../apps/backend/src/0-platform/formula/wire.ts)) **throws
`TypeError: Formula function values are not wire-serializable`**. It does not return a
`FormulaResult`, does not emit a diagnostic, and does not substitute null. Callers must guard
with `isWireSerializable` first, and the three real call sites all do
(`4-job-wiring/structured-data/registerStructuredDataEndpoints.ts:302, 354, 404`).

`SourceSpan.startByte` / `endByte` are documented as byte offsets and are actually UTF-16
code-unit indexes. The lexer says so itself (`lexer.ts:1-4`):

> ```
> // Lexer — UTF-8 source → token stream.
> // All byte offsets are code-unit positions in the JS string (UTF-16),
> // which matches byte offsets for ASCII; non-ASCII identifiers are not
> // supported in formula/v1.
> ```

### The resolver seam

**`FormulaNameResolver` is not defined in this module.** Formula declares only the *snapshot*
contract (`resolver.ts`, 38 lines: `ProjectScope`, `ResolvedFormulaBinding`,
`ResolverSourceRevision`, `FormulaResolverSnapshot`). The named port lives one layer up in
[`1-init/create/formula-name-resolver.ts`](../../apps/backend/src/1-init/create/formula-name-resolver.ts)
(438 lines), which is why `4-job-wiring/structured-data/registerStructuredDataEndpoints.ts:8`
carries the only backward import in the tree — an `import type`, erased at build. Document
declares its own five-line narrowing, `DocumentFormulaResolver { buildSnapshot() }`
(`document/ports/formulaResolver.ts`).

The snapshot's `ReadonlyMap` is **not** deep-frozen at runtime; `readonly` is a compile-time
contract only. Snapshot `id` is a `randomUUID()`, so snapshot IDs are not deterministic;
`snapshotDigest` is.

### Consumers, logging, tests

Eight files import `#formula`: `0-platform/rich-text/types.ts` (one type only),
`1-init/create/{document,formula,formula-name-resolver}.ts`,
`3-capabilities/document/{application/documentService.ts, ports/formulaResolver.ts,
wire/valueSchemas.ts}`, and `4-job-wiring/structured-data/registerStructuredDataEndpoints.ts`.

The engine logs at `debug` for `formula.parse ok`/`failed`, `formula.validate`,
`formula.dependencies`, `formula.evaluate ok`/`failed`, and at `error` for three
unexpected-error paths. Payloads carry durations, counts, kinds, and limit names — **never the
source text and never the evaluated value**. `explain` logs nothing.

There is **no dedicated Formula test file**. Coverage is 22 tests, all indirect:
`rich-text-formula.test.ts` (4) and `structured-data-formula.test.ts` (18). Concretely:
**there is no parser test, no lexer test, no rational-arithmetic test, no operator-precedence
test, no index/slice test, no cardinality-promotion test, no set-operation test, and no test for
`explain`.** Only 2 of the 13 limits (`maxCells`, `maxOutputBytes`) have a test.

### Dead surface

`mergeLimit` (singular, `engine.ts:103-109`, never called — the plural `mergeLimits` is the real
one); `unknownFunction`; `invalid_resolver_snapshot`; `FormulaDiagnostic.path`; the `field`,
`index`, `slice` and `set-operation` variants of `ObservedDependency.access` (only
`{kind:"value"}` is ever emitted); every `BuiltinFunction` construction path, which makes
`applyFunction`'s builtin branch (`evaluator.ts:370-373`), `fnEqual`'s builtin branch
(`:306-308`) and `callBuiltin`'s `case "IF"` unreachable from any real evaluation;
`BUILTIN_IMPLEMENTATION_VERSION` (imported at `evaluator.ts:24`, never referenced);
`BuiltinCallContext.evalArg` (supplied at both call sites, never invoked); `explain`; and the
barrel exports `fromWire`, `toDecimalString`, `EMPTY_TABLE`, `TRUE_VALUE`, `FALSE_VALUE`,
`ProjectScope`, none of which has a consumer outside the module. `src/4-job-wiring/formula/`
exists on disk and is empty — an untracked leftover that will not appear in a fresh clone.

### Module docs

`formula/docs/` is the second-best package in the tree: unusually self-critical, and every
"current non-guarantee" in its `invariants.md` was independently verified true. Four gaps: it
lists `maxMarkRangeSpan` (a Rich Text field) among Formula's gaps; it understates the negative-
`ROUND` case as "may reach low-level arithmetic behavior" when it throws; it does not say
`CapturedLexicalBinding.reference` is never set; and it does not say how thin the direct
language coverage is. The superseded design page is at
[phase-1/platform/formula.md](../phase-1/platform/formula.md) — it specifies a third AST variant
`projection-query` that does not exist, and a `NON_SERIALIZABLE_VALUE` diagnostic that appears
nowhere in `src/`.

---

## Rich Text

### What it is

A pure value service over `{ atoms, marks }` in 12 flat files. It owns the inline content
vocabulary and nothing above it. [`types.ts:1-3`](../../apps/backend/src/0-platform/rich-text/types.ts):

> ```
> // Rich Text types — the canonical content model for inline text in Icarus.
> // Rich Text owns atoms, marks, positions, ranges, and the operations that
> // manipulate them. It does NOT own blocks, containers, layouts, or resources.
> ```

`interface RichContent { atoms: RichTextAtom[]; marks: RichTextMark[] }` is the entire content
type — **no id, no revision, no blocks**. Blocks belong to Document.

Rich Text imports Formula for exactly one symbol, `FormulaWireValue` (`types.ts:5`), and never
calls the Formula engine.

### Public surface

`createRichText(config, logger)` (`engine.ts:339`) returns a `RichText` with one readonly
property and 19 methods (`types.ts:254-293`): five semantic mark factories
(`bold`/`italic`/`underline`/`strike`/`code`), `link`, `style`, `fullRangeMark`,
`fullRangeStyle`, `overlayMarks`, `resolveStyling`, `validate`, `normalize`, `apply`,
`formulaFromDelimitedRange`, `clone`, `plainText`, `encode`, `decode`.

**4 atom kinds** — `text`, `formula`, `reference`, `hard-break`. **7 mark kinds** — `bold`,
`italic`, `underline`, `strike`, `code`, `style` (with 11 optional `TextStyleProperties`),
`link` (with `LinkTarget[]`). **5 link-target kinds** — `url`, `resource`, `evidence`,
`question`, `data`. `TextPosition` is `{ atomId, offset }` with offsets in UTF-16 code units.

**13 operations** (`types.ts:224-250`), grouped: text (`insert-text`, `delete-range`,
`replace-range`), atom (`insert-atom`, `delete-atom`, `replace-range-with-atom`,
`replace-content`), mark (`add-mark`, `remove-mark`, `set-link-targets`), formula
(`set-formula-expression`, `apply-formula-settlement`, `apply-formula-result` — the last marked
`/** Compatibility form. New code should use apply-formula-settlement. */`).

### Inverses: seven are exact, five are lossy or broken

`applyOperations` (`operations.ts:15-40`) `structuredClone`s the input once, reduces in order,
`unshift`es each inverse (so the inverse array is reverse-ordered), unions `affectedAtomIds`,
and keeps the **last** `dirtyRange` rather than a union.

Seven operations have exact, replayable inverses: `replace-range-with-atom`, `replace-content`,
`add-mark`, `remove-mark`, `set-link-targets`, `set-formula-expression`,
`apply-formula-settlement`. `apply-formula-result` inherits the last one's inverse by delegating
to it (`operations.ts:82-86`) — which also means it **always clears any existing diagnostic**,
because it passes no `diagnostic` field and omission is active clearing (`:669-679`).

The remaining five:

| Operation | Defect |
| --- | --- |
| `replace-range` | **Inverse is lossy by design.** The source says so at `operations.ts:262`: `text: "", // The inverse of replace is another replace — simplified`. Replacing `[1,3]` of `"abcdef"` with `"ZZZ"` yields the inverse `{type:"replace-range", range:{1,4}, text:""}` — the deleted `"bc"` is gone |
| `delete-atom` | **Inverse throws on replay.** It emits `{type:"insert-atom", at:{atomId:"<the deleted id>", offset:0}, atom:<deleted>}` (`operations.ts:337-341`); re-applying it hits `if (idx === -1) throw new Error(\`Atom not found: ${atomId}\`)` because the anchor atom is the one that was just removed. It also drops every mark whose start *or* end references the deleted atom (`:324-332`), while a mark that merely *spans* it survives and now spans a gap |
| `delete-range` | Cross-atom deletion (`operations.ts:200-237`) flattens the surviving text and joins the deleted fragments into a single `insert-text` inverse; the removed intermediate atoms are not reconstructible. It also does not remap mark offsets |
| `insert-text` | **Does not remap mark offsets at all.** Inserting `"XX"` at offset 0 of a 5-char atom leaves a bold mark ending at 5 while the atom is now 7 chars long |
| `insert-atom` | **Mid-atom insertion creates duplicate atom IDs.** `applyInsertAtom` (`operations.ts:286-291`) spreads `{...curr}` twice without allocating a new ID; inserting a hard-break at offset 3 of atom `a` produces atoms with IDs `a, br, a` |

Separately, neither `add-mark` nor `insert-atom` performs a duplicate-ID check on the way in, and
deleting the last atom is permitted — only a subsequent `validate` reports `atoms-empty`.

The one operation the module guards carefully is `replace-range-with-atom`, and its comment
explains why (`operations.ts:352-356`):

> ```
> /**
>  * Atomically replace a range in one TextAtom. Keeping this atomic is
>  * important: composing delete-range and insert-atom cannot assign the split
>  * suffix a stable ID or remap marks without exposing an invalid midpoint.
>  */
> ```

It checks range containment, atom existence and kind, integer and in-bounds offsets, an
`expectedText` stale-input match, replacement-ID freshness, and that `trailingTextAtomId` is
supplied **exactly when** there is both leading and trailing text — rejected otherwise
(`operations.ts:405-411`). Mark endpoints are then remapped edge-aware by
`mapReplacedTextPosition` (`:489-523`).

### `normalize`, `validate`, styling

`normalize` runs six passes (`normalize.ts:6-29`) and claims idempotence
(`// Idempotent: normalize(normalize(C)) === normalize(C).`), which holds for its own output.
**The adjacent-text merge is lossy**: `mergeTextAtoms` (`:102-123`) keeps only the first atom's
ID, and `remapAndFilterMarks` (`:127-157`) then discards every mark anchored to the vanished ID.
Given atoms `a("ab")` and `b("cd")` with a bold mark on `b`, normalize returns one atom
`a("abcd")` and **zero marks**. Deduplication compares only *consecutive* marks (`:161-169`) and
runs *before* sorting, so non-adjacent duplicates survive.

`validate` (179 lines) has 12 diagnostic codes and **never throws**. What it does not check:
`start <= end` (a mark with `start.offset = 3` and `end.offset = 1` on the same atom validates
clean); global atom ordering of start vs end; integer or finite offsets; offset bounds on
non-text atoms; `maxMarkRangeSpan`; atom payload validity; and consistency between a formula
atom's `expression` and its `displayText`. `RichTextDiagnostic` declares optional `position` and
`range` fields and **no validator ever sets either**.

The `isSurrogateSplit` comment names the high-surrogate range while the code correctly tests the
low-surrogate range `0xdc00–0xdfff` (`validate.ts:175-180`) — the code is right, the comment is
wrong.

`resolveStyling` returns `{ranges: [], plainText, links: []}` for content with **no marks** —
there is no coverage without a mark, which is why Document's projections always supply a
`fullRangeStyle`. Mark array order is the rendering order, deliberately
(`engine.ts:236-237`):

> ```
>       // Mark array order is the explicit rendering order. Callers and overlay
>       // results control precedence without allowing opaque IDs to affect it.
> ```

A mark referencing an unknown atom **throws** `Error: Mark range references unknown atom: <id>`
from `resolveStyling` (`engine.ts:401`) and `comparePositions` (`:420`, `:423`) — a
validation-class problem surfaced as an exception, inconsistent with `validate`'s non-throwing
contract.

**`deduplicateAndSortMarks` (`engine.ts:548-562`) does not sort.** Its body is a single
JSON-value dedupe loop returning input order; its only internal comment is
`// Simple deduplication by JSON value`. The name is wrong.

### Limits: 3 declared, 2 enforced

`RichTextLimits { maxAtomsPerContent, maxMarksPerContent, maxMarkRangeSpan }`, defaults
10,000 / 5,000 / 1,000. The first two are enforced in `validate.ts:55` and `:62`.
**`maxMarkRangeSpan` is declared, defaulted, config-parsed, and never read** — it appears only at
`types.ts:140`, `types.ts:146`, `loadBackendConfig.ts:66`, `:228`, `:651`.

The composed runtime never uses `DEFAULT_CONFIG` or `DEFAULT_LIMITS`; `createRichTextInstance`
builds `{ defaults: DEFAULT_STYLE, limits: config.richText }`. Those two constants are used only
by tests.

### Zero-caller exports

**`createRichTextIdFactory`** (`id-factory.ts:6`) and **`mergeStyleProperties`**
(`styles.ts:54`) each have exactly one occurrence in the entire repository — their own
definition. Neither is on the barrel; neither has an importer in `src/` or `test/`.

### Consumers, tests

17 files import `#rich-text`: two in `1-init/create/` (`document.ts`, `rich-text.ts`), nine
Document files (`application/documentService.ts`, four `domain/`, three `projections/`,
`wire/valueSchemas.ts`), and six Slides `domain/` files. **Document is the only composed host.** Slides calls
`richText.apply` (`slides/domain/reducer.ts:723, 1361`) and `richText.validate`
(`slides/domain/validation.ts:222, 356, 505`) at the domain level, but nothing constructs
Slides — see [07-capabilities/slides.md](07-capabilities/slides.md).

Only four methods log, all at `debug`: `overlayMarks`, `resolveStyling`, `validate` (**only when
`!result.ok`**), and `apply`. `apply` logs `ops: operations.map(o => o.type)` — type names, never
payloads. A throwing operation inside `apply` produces **no log at all**, because the log call
sits after the delegation returns.

Direct test coverage is **4 tests** in `rich-text-formula.test.ts`, covering Formula-atom
authoring, Formula settlement, and display formatting. There are **zero direct tests for**
`normalize`, `overlayMarks`, `resolveStyling`, `validate`, `clone`, `encode`/`decode`, or 10 of
the 13 operations. Document's four test files exercise Rich Text indirectly.

`decode` (`codec.ts:32-35`) is `JSON.parse` plus a cast with **no validation whatsoever** —
`decode('{"nope":1}')` returns `{nope: 1}` typed as `RichContent`.

### Module docs

`rich-text/docs/` is stale in one large section: every `3-capabilities/slide/**` and
`4-job-wiring/slide/**` path it cites is missing, `assertNoRichIdentityChurn` does not exist,
`slide-wire.test.ts` does not exist, and `startBackend.ts` contains no reference to Slide at all,
so the "blocked injection" it describes does not exist either. Its `README.md:9` links to
`docs/capabilities/rich-text.md`, a directory that does not exist. Its self-criticism about
`apply` (`invariants.md:52-63`) was checked line by line and is correct on every point.

---

## Knowledge

### What it is, and the honest headline

A retrieval runtime: window text, embed windows, cluster them into a lattice, descend from a
stored frontier, assemble regions. 15 files, 2,118 lines, in a flat layout plus `lattice/` and
`windowing/` subdirectories.

**It is wired, it is load-bearing, and it has no test file.** `find apps/backend -name '*.test.ts'`
returns no `knowledge.test.ts`, no lattice test, no windowing test, and no store test. Exactly
one test in the suite constructs the real `Knowledge` class
(`derived-outputs.test.ts:627`), against an in-memory store whose reads all return `[]` and an
embedder that returns `[1]` for every input — and both of its `add` calls pass `text: ""`, so
`windowText` returns `[]` and **no windowing, no embedding, no clustering, no descent, and no
region assembly ever executes**. What that test pins is the revision skip, the mutation event,
and Derived Outputs' generation fence.

Everything else in the suite that mentions Knowledge uses a hand-written double cast through
`as unknown as Knowledge`: `general-files.test.ts`, `connector.test.ts`, `investigation.test.ts`,
and 16 of `derived-outputs.test.ts`'s 17 tests.

### Public surface

`class Knowledge` (`knowledge.ts:59`), constructed with `(store, embedder, logger, opts?)`.
Seven public members:

| Member | Line | Production callers |
| --- | ---: | --- |
| `add(item)` | 100 | General Files, Connector, Investigation |
| `remove(sourceId)` | 226 | General Files, Connector, Investigation |
| `retrieve(query, options?)` | 308 | Derived Outputs |
| `resolveScope(scope?)` | 247 | Derived Outputs |
| `onSourceMutation(listener)` | 93 | `startBackend.ts:95` — one subscriber, Derived Outputs |
| `listSources()` | 236 | **none outside the module** |
| `searchTool()` | 370 | **none anywhere** |

`searchTool()` builds a `knowledge_search` `ToolBinding` whose handler calls `this.retrieve(query)`
with **no options**, so it would always be unscoped. `grep -rn "searchTool" src test` returns a
single hit: the definition. Derived Outputs builds its own *scoped* retrieval tool instead
(`derived-outputs.ts:1121-1150`) — which is the correct choice, and the reason this one is dead.

Who writes to Knowledge, and under what source-ID shape:

| Capability | `sourceId` | `label` | `revision` | Admission filter |
| --- | --- | --- | --- | --- |
| General Files | `general-file:<fileId>` | `general-file` | `file.contentHash` | only `kind === "general::file::text"` |
| Connector | `connector:<entryId>:<sha256(itemKey)>` | `connector-item` | `item.revisionToken` | only `status === "prose"` |
| Investigation | `finding:<findingId>` | `finding` | `sha256(claim)` | accepted Findings; **only the `claim` is indexed** |

### The revision model

There is exactly one revision concept in Knowledge, and it is an opaque caller string.
`SourceRecord.revision` is `TEXT NOT NULL DEFAULT ''`, compared for equality only, at
`knowledge.ts:118-122`:

```ts
const existing = await this.store.getSource(sourceId);
if (existing && revision !== "" && existing.revision === revision) {
  this.logger.debug("knowledge.add.skipped", { sourceId, label, revision });
  return { sourceId, skipped: true, windowsAdded: 0, windowsReused: 0, usage: NULL_USAGE };
}
```

Note the escape hatch: a source added with **no** revision (`revision = ""`) is always
re-ingested. There is no monotonic counter, no CAS, no history table, and no retention port —
**Knowledge is deliberately absent from the 11-port retention sweep**, because its index is
rebuildable derived state rather than a resource. `addedAt` survives re-ingest
(`existing?.addedAt ?? now`); windows, nodes and frontier are wholesale replaced.

A second, unrelated revision passes *through* Knowledge without being stored:
`KnowledgeResourceDescriptor.resourceRevision?: number` is the owning capability's numeric
revision, captured into a scope manifest and re-checked by `ResourceRegistry.read`
(`1-init/create/resource-reader.ts:236-242`). It never touches a Knowledge table.

The module stores **no embedding provider, model, or version** alongside a window, so changing
the embedding model silently invalidates every persisted vector with nothing to detect it.

### The chars-vs-bytes unit split

`windowText`'s options are named `targetRunes` / `overlapRunes` and every count in the
implementation is `text.length` over a JavaScript string — **UTF-16 code units**, neither Unicode
scalars nor bytes. So `KnowledgeWindow.start` / `.end` are JS string offsets, and they are stored
in columns literally named `start_byte` / `end_byte`.

In the same record, `SourceRecord.sizeBytes` uses `Buffer.byteLength(text, "utf8")` — **actual
bytes** (`knowledge.ts:115`). Two fields of one record, in two different units, one of which is
misnamed. For ASCII sources they agree; for anything else they do not.

### Retrieval

`retrieve` embeds the query, resolves scope, descends, filters, and assembles regions. Three
behaviours are worth stating:

1. **Scope selection tests for property presence, not value** (`knowledge.ts:317-325`). Passing
   `{ scopeManifest: null, scope: [...] }` is *unscoped* — the `scope` array is ignored.
2. **Scope filtering happens after descent, not during it** (`:342-345`). A scoped source can be
   starved by globally stronger out-of-scope branches inside the bounded descent and never
   appear in results.
3. **The empty-result path returns before the telemetry log** (`:335` precedes `:349`). A
   retrieval that finds nothing emits no record.

Descent (`lattice/descent.ts`) scores and sorts the entire stored frontier, pops `beam` entries
per iteration, and caps node expansions at `MAX_EXPANSIONS = 256`. `beam` is a per-iteration
batch size, **not** a width cap: `insertSorted`'s doc comment says
`/** Insert into a descending-sorted array, keeping it trimmed. */` and the body performs no
trimming, so `active` grows without bound. There is no top-K cut anywhere; every window that
ever scores at or above threshold is returned. `KnowledgeRetrievalOptions.topK` and
`KnowledgeOptions.defaultTopK` are both **assigned and never read**.

### The dead level-index feature

The IVF/PCA level index is declared end to end and reaches nothing:

| Piece | Location | Status |
| --- | --- | --- |
| `buildLevelIndex` | `lattice/knn.ts:198` | Exported from a barrel nobody imports; called by nothing |
| `getLevelIndex` / `putLevelIndex` / `deleteLevelIndex` | port `store.ts:41-43`, impl `knowledge-store.ts:289, 299, 309` | Implemented; **no production caller** — the only other hits in the tree are three no-op stubs in `derived-outputs.test.ts:132-134` |
| `kn_<p>_level_indices` table | `knowledge-store.ts:65-68` | Created on every startup; **never written and never read** |

The port comment at `store.ts:40` labels the group `// ── IVF level index (k-NN path only) ──`.
That k-NN path is not implemented in retrieval. The `database` module's `docs/concepts.md:39`
softens this to "currently persisted but not used", which is wrong on the write side too: the
table stays empty.

### `StreamWindower` — unreachable from the only ingestion path

`windowing/stream.ts` (178 lines) is a state-machine windower whose stated purpose is bounded
memory (`stream.ts:4-11`):

> ```
> /**
>  * State-machine text windower that accepts text in arbitrary chunks and emits
>  * WindowPieces as they complete. Memory usage is bounded to the current window
>  * tail — the full source text is never resident.
>  *
>  * Output is byte-identical to windowText() for the same text and geometry
>  * when all chunks are concatenated.
>  */
> ```

It is imported at `knowledge.ts:26` and never referenced again in that file. `Knowledge.add`
handles a `ReadableStream<string>` by calling `collectStream` (`knowledge.ts:475`), which
concatenates the entire stream into one string and then calls `windowText`. **The class's whole
reason to exist is defeated by the only path that could use it**, and its byte-identity claim is
unverified — there is no test.

### The barrel nobody imports

`knowledge/index.ts` (25 lines) and `knowledge/lattice/index.ts` (6 lines) are imported by
**nothing**. Every consumer deep-imports `#platform/knowledge/knowledge.js` or
`#platform/knowledge/types.js`. The module's own `README.md:23` lists the barrel under "Public
runtime"; the deep module paths are the real public surface.
`knowledge/windowing/index.ts` is the one barrel that is used, at `knowledge.ts:26`.

### Other verified defects

- **`rebuildCorpusTier` contradicts its own comment.** `knowledge.ts:426` reads
  `// Only include top-level source-tier nodes (highest level per source)`, and the code calls
  `getSourceNodeIds`, which is `SELECT id … WHERE source_id = ?` — every node at every level.
  Intermediate nodes and their parents enter the corpus tier together. There is no index on
  `level` to make the filtered query cheap even if it were written.
- **`getWindowIds` can never do what it documents.** Its 13-line doc comment describes crawling
  node members to recover a source's windows; the only caller reaches it exactly when
  `getSourceNodeIds` already returned zero IDs, at which point `getWindowIds` immediately returns
  `[]` (`knowledge.ts:501-506`). Net effect: an unchanged node-less source (0 or 1 window) drops
  out of the corpus frontier whenever some *other* source is mutated, and stays out until it is
  itself re-added.
- **`repairCorpus`** (`lattice/repair.ts`, 100 lines) is imported at `knowledge.ts:36` and never
  called. The whole file is dead, and contains dead code inside itself — `repair.ts:80` does
  `const srcWindows = await store.getWindows([]); void srcWindows;`.
- **Window embeddings are never normalized or validated**, although `cosineSim = dot`
  (`lattice/math.ts:21`) depends on unit length and `types.ts:37` comments the field
  `// unit-normalized`. Node centroids *are* normalized; window and query vectors are not.
- **No dimension check.** `dot` iterates `a.length` and reads `b[i]`, so a shorter `b` yields
  `NaN` silently.
- **No embedder cardinality check.** `vectors[j]` may be `undefined` (`knowledge.ts:150`), which
  reaches `JSON.stringify(undefined)` → `undefined` → a `better-sqlite3` bind failure at write
  time.
- **Duplicate window text inside one source collides.** IDs are `sha256(sourceId + "\x00" + text)`
  with no position component, so two identical windows share one ID: `putWindows` upserts the
  second over the first, `windowCount` counts both, and the clustering pool contains the same ID
  twice with identical vectors — a guaranteed clique.
- **A `Knowledge.add` is not atomic.** It performs twelve separate store calls with no mutex, no
  outer transaction, and no startup reconciliation. Two concurrent mutations on different sources
  interleave their corpus-frontier reads and writes, and the last `putFrontier` wins.
- **`add`/`remove` can reject after all writes succeeded.** `emitSourceMutation`
  (`knowledge.ts:454-470`) runs all listeners, logs the first failure as
  `knowledge.source-mutation.listener.failed` with `{operation, errorKind}`, and **rethrows**.

### Logging

Five records: `knowledge.add.skipped` (debug), `knowledge {op:"add"}` (info),
`knowledge {op:"remove"}` (info), `knowledge {op:"retrieve"}` (debug), and the listener-failure
error. **There is no failure log for a failed `add`, `remove`, or `retrieve`** — the error
propagates to the calling job.

Neither Knowledge nor Intelligence ever passes the third `LogOptions` argument, so every record
they emit is unlabelled and therefore `shape`. Note that `knowledge.add.skipped` nonetheless
carries `revision`, which for General Files and Investigation is a content hash.

The `costUsd` spread at `knowledge.ts:214` is effectively unreachable for multi-batch ingestion,
because Knowledge's own `addUsage` (`:50-57`) does not carry `costUsd` — unlike Intelligence's
(`intelligence.ts:30-39`), which does.

### Module docs

`knowledge/docs/` is accurate and unusually self-critical: its `invariants.md:50-62` lists ten
real defects, all independently confirmed. Four things it does not say: the barrel is imported by
nothing; `searchTool()` has zero callers (`flows.md:92` gets closest with "No current production
caller constructs this binding"); duplicate window text makes `windowCount` over-count; and the
`start`/`end` versus `sizeBytes` unit split. The superseded design page is at
[phase-1/platform/knowledge.md](../phase-1/platform/knowledge.md) — 526 lines describing a
`retrieveMany` that does not exist, CHECK constraints and foreign keys that do not exist, and
three named indexes where two single-column indexes exist.

---

## Intelligence

### What it is

An LLM boundary: cast-based route selection, structured output, a tool loop, and embeddings,
behind one provider adapter. Five files, 914 lines, and **no `index.ts` barrel** — consumers
deep-import `#platform/intelligence/{intelligence,tools,types}.js`.

### Public surface, and what actually runs

`class Intelligence` (`intelligence.ts:114`) has seven methods. Only three have a production
caller, and `grep -rn "this\.intelligence\." src` returns the complete list of call sites — three
lines:

| Method | Line | Production caller |
| --- | ---: | --- |
| `embed` | 255 | Knowledge, via `IntelligenceEmbedder` (`knowledge/embedder.ts:17`) |
| `reasonStructured` | 187 | Derived Outputs planning (`derived-outputs.ts:817`) |
| `reasonWithToolsStructured` | 229 | Derived Outputs synthesis (`derived-outputs.ts:939`) |
| `infer` | 127 | **none** |
| `inferStructured` | 144 | **none** |
| `reason` | 166 | **none** |
| `reasonWithTools` | 213 | **none** |

Because `infer` and `inferStructured` are the only callers of `Provider.infer`, **the entire
inference route map and `OpenRouterProvider.infer` are unreached in production**. The shipped
`configuration.yaml` defines 9 inference routes (all `purpose: general`, all
`openai/gpt-4.1-mini`, effort `low`) alongside 9 reasoning routes (all `openai/gpt-4.1`, effort
`medium`). **Nine of those eighteen routes are unreachable**, and the routing table is uniform
anyway — strength and speed currently select nothing. The only `purpose` string in the entire
codebase is `"general"`.

Route selection has **no fallback, no nearest-match, and no tier degradation**. An unknown tier
throws `Invalid intelligence <field> tier: '<value>'`; a missing key throws
`No configured <kind> cast route for '<key>'`; an unconfigured provider throws
`Intelligence provider '<name>' is not configured`. All three happen before any network I/O. A
duplicate route key is a **startup** failure (`Duplicate <kind> cast route`); a route naming an
unregistered provider is **not** — it fails on first use.

Embedding is not routed by cast at all: `embed` reads `config.embedding.provider` and
`config.embedding.model` directly. One provider, one model, process-wide —
`openai/text-embedding-3-small`.

`reason` and `reasonStructured` reject tool calls outright, with the redirect in the message:
`"Reason call returned tool calls; use reasonWithTools instead"` (`intelligence.ts:177`).

### The strict `response_format` on every round

`openrouter/provider.ts:133-140` hard-codes both the schema name and strict mode:

```ts
const schemaFormat = (schema: Record<string, unknown>): Record<string, unknown> => ({
  type: "json_schema",
  json_schema: {
    name: "structured_response",
    strict: true,
    schema
  }
});
```

A caller cannot opt out. In `reasonWithToolsInternal` the provider call at
`intelligence.ts:296-302` sends **both** `tools` and the strict `response_format` on **every
round**, including rounds where the model is expected to emit tool calls rather than the final
JSON. Nothing suppresses the response format until the final round.

### Tool-loop accounting

`reasonWithToolsInternal` (`intelligence.ts:272-348`), `DEFAULT_MAX_TOOL_ROUNDS = 8`:

- `rounds` counts **only rounds that contained tool calls**, so a single-shot answer returns
  `rounds: 0`.
- `calls` is the total tool-call count across all rounds; tool calls execute **serially**, in
  provider order.
- `usage` includes the final tool-free round.
- **On round exhaustion the accumulated `usage`, `messages` and `toolResults` are discarded** —
  the throw carries only a message string.
- `maxRounds` is not validated; `0` or negative throws immediately with no provider call.

`ToolSet` (`tools.ts:43-93`) throws on a duplicate tool name at construction, and `execute` never
throws — an unknown name returns `{ok:false, error:{code:"tool_not_found"}}` and a handler throw
returns `{ok:false, error:{code:"tool_failed"}}`. The `catch {}` at `:81` binds nothing, so the
original error object is deliberately unreachable. `ToolSet` does **not** validate handler
arguments against `inputSchema`, and `extractStructured` (`intelligence.ts:97-103`) is a bare
`JSON.parse` — **no schema validation is performed after parsing.**

The tool-loop methods return **inline anonymous object types**. The exported interface
`ToolExecutionResponse` (`tools.ts:33`) is the return annotation of nothing; it is dead.

There are **no `onRound` hooks**, no streaming, and no progress events. `grep -rn "onRound" src`
returns nothing.

### Provider error redaction — the one tested behaviour

`openrouter/provider.ts:266-278`:

```ts
if (!response.ok) {
  // Drain the response without carrying provider payloads into service
  // diagnostics or logs. Provider bodies may echo prompts, tool input,
  // account metadata, or other user-controlled content.
  await response.arrayBuffer();
  const requestId =
    response.headers.get("x-request-id") ??
    response.headers.get("x-openrouter-request-id");
  throw new Error(
    `OpenRouter request failed (${response.status})` +
      (requestId ? ` [requestId=${requestId}]` : "")
  );
}
```

This is the only Intelligence behaviour with a dedicated test:
`runtime-wiring.test.ts:173-200`, *"provider HTTP failures do not leak response bodies into
diagnostics"*, which patches `globalThis.fetch` to return a 400 with body
`"sensitive provider response"` and asserts the thrown message matches `/400/` and
`/provider-request-1/` and does not match the body.

**The `Intelligence` class itself is never instantiated in any test.** Route selection, purpose
normalization, duplicate-route rejection, tier validation, structured JSON parsing, the tool
loop, usage aggregation, round exhaustion, `ToolSet`, and every success path of the OpenRouter
adapter have zero coverage.

### Cancellation: plumbed end to end, supplied by nobody

Every network-facing method on both `Provider` (`infer`, `reason`, `embed` — `name()` is the
exception) and `Intelligence` takes `signal: AbortSignal | undefined` as its **first** parameter.
`postJson` (`openrouter/provider.ts:240-285`) creates a local `AbortController`, arms
a `setTimeout(…, config.timeoutMs)` (30,000 ms as shipped), and links the incoming signal with
`signal?.addEventListener("abort", linkedAbort)`.

Two facts:

- **An already-aborted incoming signal is silently ignored.** There is no `signal.aborted`
  pre-check, and `addEventListener("abort", …)` on an already-aborted signal never fires. The
  request goes out.
- **In production nothing supplies a signal at all.** `IntelligenceEmbedder` passes `undefined`
  with the reason stated at `knowledge/embedder.ts:9-12`:

  > ```
  > /**
  >  * Wraps an Intelligence instance as an Embedder. AbortSignal is undefined for
  >  * now — wire it through when request-level cancellation is added.
  >  */
  > ```

  Derived Outputs also passes `undefined` (`derived-outputs.ts:818`, `:940`). The plumbing exists
  end to end and is exercised by no caller. The job runtime has no `AbortSignal` either — see
  [02 · Request and Job Runtime](02-request-and-job-runtime.md).

The timeout covers **header and body read**, because `return (await response.json())` sits inside
the `try` and `clearTimeout` sits in the `finally`.

### The `OPENROUTER_API_KEY` rule

`OPENROUTER_API_KEY` is the **only** environment variable the backend reads for configuration,
and its precedence is the reverse of the usual convention.
[`loadBackendConfig.ts:412-424`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts):

```ts
const openRouterApiKeyFromEnv = process.env.OPENROUTER_API_KEY;
const effectiveOpenRouterApiKey =
  configuredOpenRouterApiKey === OPENROUTER_API_KEY_PLACEHOLDER &&
  typeof openRouterApiKeyFromEnv === "string" &&
  openRouterApiKeyFromEnv.length > 0
    ? openRouterApiKeyFromEnv
    : configuredOpenRouterApiKey;
```

**The environment wins only when the YAML value is still the literal placeholder**
`"replace-with-openrouter-api-key"` and the variable is a non-empty string. A real key written
into `configuration.yaml` cannot be overridden by the environment. The YAML's own comment at
`etc/configuration.yaml:31` reads
`# Replace with a real key or override via OPENROUTER_API_KEY in runtime env.` — accurate about
the placeholder path, silent about the precedence.

Two consequences: with the placeholder in YAML and no env var, the placeholder string is sent
verbatim as `Authorization: Bearer replace-with-openrouter-api-key`, because `!this.config.apiKey`
does not fire on a non-empty string — the failure surfaces as an OpenRouter 4xx. An **empty**
string in YAML never reaches the adapter; `parseString` throws at config-load time. There is no
`.env.example` in the repository, and `.gitignore` reserves the path for one.

### Wire-translation edges

`parseToolCalls` (`openrouter/provider.ts:51-90`) **silently drops** non-record entries, entries
missing `id` or `function.name`, and falls back to `{}` for unparsable arguments. `parseContent`
returns `""` for non-string content. `parseUsage` defaults every numeric field to `0` and
`costUsd` to `undefined`; **nothing in the request body asks the provider for cost or usage
accounting**, so both `reasoningTokens` and `costUsd` are best-effort reads of fields that may
not be there. `embed` maps `data.data[].embedding` by **array order and ignores each item's
`index` field**. `cloneMessages` copies each message, each tool-call object, and the top-level
`arguments` record — values nested inside `arguments` are not deep-cloned. Only `choices[0]` is
ever read.

### Logging

Six `logger.debug("intelligence", …)` calls, carrying
`{op, provider, model, durationMs, promptTokens, completionTokens, reasoningTokens, totalTokens,
costUsd?}` plus per-op extras. **No prompt, message, schema, tool argument, tool output, vector,
API key, or provider body is ever logged.** `reasonWithToolsStructured` reuses the
`reasonWithTools` op label, so the two are indistinguishable in the log stream. **There is no
failure log anywhere in Intelligence** — errors propagate to the caller.

### Module docs

`intelligence/docs/` is accurate on the hard parts (it correctly flags that `rounds` excludes the
final round, that exhaustion discards usage, and that `ToolExecutionResponse` is unused). Four
things it does not say: the `OPENROUTER_API_KEY` rule, that four of the seven methods have no
production caller, that an already-aborted signal is ignored, and that the strict
`response_format` is sent on every tool-loop round. The superseded design page is at
[phase-1/platform/intelligence.md](../phase-1/platform/intelligence.md).

---

## Observability

### What it is

**One file, 137 lines**:
[`0-platform/observability/logger.ts`](../../apps/backend/src/0-platform/observability/logger.ts).
It defines the `Logger` seam, level ranking, the detail-label mechanism, a no-op adapter, and a
filtering/entry-building adapter (`FileLogger`) that **does no file I/O of its own** and imports
no filesystem API. The concrete sink is 71 lines in
[`1-init/create/logger.ts`](../../apps/backend/src/1-init/create/logger.ts).

There is no metrics registry, no tracing or span API, no audit store, no remote exporter, no
child logger or log context, no redaction middleware, no HTTP endpoint, no job, and no table.

Seven exports: `LogLevel`, `LogDetail`, `LogOptions`, `LogEntry`, `Logger`, `NoopLogger`,
`FileLogger`. `LOG_LEVEL_RANK` is module-private.

```ts
interface Logger {
  debug(message: string, data?: unknown, options?: LogOptions): void;
  info(message: string, data?: unknown, options?: LogOptions): void;
  warn(message: string, data?: unknown, options?: LogOptions): void;
  error(message: string, data?: unknown, options?: LogOptions): void;
  close?(): Promise<void>;
}
```

`logger.ts:39-43` states the seam's whole point:

> ```
> /**
>  * The Logger interface is the only thing the rest of the codebase depends on.
>  * Callers never branch on whether logging is enabled; they always call a method
>  * and the implementation decides whether to do anything with it.
>  */
> ```

Measured usage: **48 source files import it; 361 call sites** — `debug` 125, `info` 157, `warn`
44, `error` 35. 19 of the 23 files in `1-init/create/` declare a `logger: Logger` parameter; the
four that do not are `config.ts`, `app.ts`, `registry.ts`, and `logger.ts` itself. Two exceptions
to the coverage are worth knowing: `Fastify({logger: false})` means
Fastify-level rejections (malformed JSON, wrong content type) **reach no log sink at all**, and
Context's wiring is handed no `Logger` whatsoever.

### The detail label — the most surprising runtime behaviour in the system

Introduced by `ef6d462`, the HEAD commit. It has five parts.

**(a) The type, and why it is a label rather than a rule change** (`logger.ts:10-22`):

> ```
> /**
>  * What kind of thing a record's `data` carries.
>  *
>  * - `shape` — counts, enums, IDs, durations. Safe everywhere.
>  * - `content` — names, titles, prompt text, field values, rows. The fastest way
>  *   to see what actually happened, and not something a production build should
>  *   be writing to disk by default.
>  *
>  * Labelling the record rather than loosening the rule is the point: the switch
>  * from development to production becomes one configuration value instead of an
>  * audit of every call site, and there is still something left to tighten.
>  */
> ```

**(b) It rides on the third parameter, not inside `data`.** `LogOptions { detail?: LogDetail }`,
with `logger.ts:25`:

> `/** Defaults to `shape`, so an unlabelled record is always safe to write. */`

**(c) Unlabelled means `shape`** (`logger.ts:120-122`):

> ```
>     // Unlabelled defaults to `shape`, so every existing call site stays safe
>     // without being touched.
>     const detail = options?.detail ?? "shape";
> ```

**(d) A content record in shape mode is dropped WHOLE, never redacted** (`logger.ts:123-125`),
for the reason given at `logger.ts:80-85`:

> ```
>     /**
>      * Which detail labels are written. `content` means everything; `shape`
>      * drops content-labelled records entirely rather than redacting their
>      * fields, because a half-redacted record is worse than an absent one — it
>      * looks complete.
>      */
> ```

**(e) The label is written into the record** (`logger.ts:132-134`):

> ```
>       // Written out so a reader can filter after the fact — the label is part of
>       // the record, not only a decision made at write time.
>       ...(detail === "content" ? { detail } : {})
> ```

Key order in the emitted JSON is fixed by construction (`logger.ts:127-135`): `timestamp`,
`level`, `message`, then `data` only when defined, then `detail` **only when the record is
content-labelled**. A `shape` record never carries a `detail` key. The level filter runs
**before** the detail filter (`:117` before `:123`), so level always wins.

### The default is `content`, and the shipped config does not mention it

`BackendConfig.logging` has four fields. `logging.detail` defaults to `"content"`
(`loadBackendConfig.ts:180`), directly under the comment at `:179`:

> `    // Developer-friendly by default. Production flips this one value.`

`etc/configuration.yaml`'s `logging:` block has **three** keys — `enabled`, `level`, `directory`
— each with an explanatory comment. `grep -n detail etc/configuration.yaml` returns nothing.

**The backend writes authored user content into `logs/backend-YYYY-MM-DD.log` by default, and
the shipped configuration file gives an operator no hint that the switch exists.** Production
flips one value; you have to already know the value is there. `etc/README.md` does not mention it
either.

Parsing is deliberately fail-open (`loadBackendConfig.ts:458-465`):

> ```
>       // Anything that is not exactly "shape" means write everything. An
>       // unrecognised value therefore fails open toward more logging, which is
>       // the safe direction while this is a development setting.
> ```

Note the asymmetry that comment does not mention: an unrecognised **string** yields `content`,
but a **non-string** throws, because `parseString` runs first.

### The nine content call sites

`grep -rn 'detail: "content"' src` returns 10 hits, one of which is the config parser itself. All
nine real sites are `debug`:

| File | Line | Message |
| --- | ---: | --- |
| `document/application/documentService.ts` | 491 | `document.duplicate.output-declared` |
| " | 589 | `document.marked-as-template.detail` |
| " | 690 | `document.prompt.rebound` |
| " | 704 | `document.bindings-applied.detail` |
| " | 750 | `document.template-submit.operations` |
| `templates/application/templateService.ts` | 215 | `templates.list.filtered` |
| " | 354 | `templates.register.detail` |
| " | 465 | `templates.update.detail` |
| " | 523 | `templates.instantiate.detail` |

Between them they write template names, descriptions and declared bindings at registration; the
arguments an instantiation supplied; what an update changed on both sides; what a search matched;
the prompt text and resolved context entries of every output a copy declares; and what each
Prompt Block ended up grounded on after a rebind. Three of the call-site comments explain the
editorial judgement:

- `templateService.ts:209-210` —
  > ```
  >       // The term and what it matched. A search returning nothing is the case
  >       // worth seeing, and counts alone cannot tell you why.
  > ```
- `templateService.ts:520-521` —
  > ```
  >       // The arguments themselves. Which Context each parameter got is the
  >       // question you actually have when an instance reads wrong.
  > ```
- `documentService.ts:680-681` —
  > ```
  >       // What this prompt is now grounded on, by name and target. The single
  >       // most useful line when a template produces an answer nobody expected.
  > ```

Two naming conventions coexist: a `.detail`-suffixed twin of a neighbouring `info` shape record
(`templates.register.detail` beside `templates.registered`), and a standalone content record with
no shape twin (`templates.list.filtered`). Neither is enforced.

### Two populations the label does not cover

**1. Slides has its own, incompatible mechanism.**
`3-capabilities/slides/persistence/sqliteSlidesStore.ts:144` exports `CONTENT_KEY = "content"`,
splitting the *payload* rather than labelling the *record*. Its doc comment (`:130-143`)
predicted the flag and expected a different implementation:

> ```
> /**
>  * The reserved log-payload key under which authored content is carried.
>  *
>  * A log payload is `{ ...shape, content?: { ...authored } }`. Shape is safe to
>  * emit anywhere: IDs, counts, revisions, digests, kinds, states. Content is
>  * whatever a person typed.
>  *
>  * This exists so the split is enforced in one place rather than remembered at
>  * every call site, and so a future `logContent: false` sink can strip
>  * `data[CONTENT_KEY]` without knowing anything about Slides. It belongs in
>  * `0-platform/observability` once that flag lands; it is here for now because
>  * Slides is the only capability observing the convention.
>  */
> ```

**The flag landed in this very commit and does not do that.** `FileLogger` never inspects `data`;
it reads only `options.detail`. Slides passes no `options`, so every Slides record defaults to
`shape` and would be written in full — including `data.content` — even with
`logging.detail: "shape"`. Nothing leaks today only because Slides is unreachable; the convention
is nevertheless broken, and two Slides tests that pin the split
(`slides-persistence.test.ts:712`, `:739`) would still pass in shape mode.

**2. Three live capabilities log content with no label at all.** `general-files.upload` logs
`fileName`; `context.declare` logs `displayName`; `connector.read-*` log `itemKey`, which for the
filesystem provider **is an absolute path**. By the module's own taxonomy those are `content`;
they are unlabelled, therefore `shape`, therefore always written.

### The sink

| Property | Behaviour | Site |
| --- | --- | --- |
| File name | `backend-YYYY-MM-DD.log`, recomputed on **every accepted entry** — rollover needs no timer | `create/logger.ts:10-14, 36` |
| Date source | **Local-time** `getFullYear`/`getMonth`/`getDate`, while `LogEntry.timestamp` is `toISOString()` (**UTC**) | `create/logger.ts:12` vs `logger.ts:128` |
| Buffering | One `createWriteStream(..., {flags:"a"})` per day | `create/logger.ts:40` |
| Serialization | `JSON.stringify(entry) + "\n"` — **no replacer, no key sorting, no canonicalization** | `create/logger.ts:51` |
| Stream errors | Caught, degraded to `process.stderr.write` — the only `process.stderr` use in `src` | `create/logger.ts:43-45` |
| Directory | `mkdirSync(dir, {recursive:true})` before the first write; **throws out of `createLogger` and aborts startup** if it fails | `create/logger.ts:26` |
| Disabled | `NoopLogger`, which does **not** implement `close` — hence `logger.close?.()` everywhere | `create/logger.ts:19-21` |
| Flush | `closeWriter` awaits `stream.end(cb)`; shutdown awaits `logger.close?.()` | `startBackend.ts:225` |
| Retention | **None.** One file per calendar day, forever | — |

The synchronous-`appendFileSync` concern recorded in the phase-1 docs was **resolved** in
`bc506b7`; the comment now reads the other way (`create/logger.ts:28-31`):

> ```
>   // One write stream per day, reopened on rollover. A stream buffers writes
>   // internally instead of the previous per-entry blocking appendFileSync, so
>   // dense logging (e.g. per-attempt lifecycle events) no longer puts a
>   // synchronous disk write directly on the request path.
> ```

and shutdown states its reason (`startBackend.ts:218-219`):

> ```
>     // Flush buffered log writes on shutdown so a killed process does not lose
>     // its tail of in-flight log entries.
> ```

Four remaining sharp edges:

- **`logging.level` is never validated and fails wide open.** `parseString` accepts any non-empty
  string (`loadBackendConfig.ts:452`) and `createLogger` casts
  `config.logging.level as LogLevel` (`create/logger.ts:66`). For an unrecognised value
  `LOG_LEVEL_RANK[level]` is `undefined`, so `LOG_LEVEL_RANK[level] < this.minLevel` is `false`
  for every level and **every record is written**. A typo produces maximum verbosity, silently.
  Contrast `logging.detail`, whose fail-open behaviour is deliberate and documented.
- **`close()` is a flush, not a latch.** `closeWriter` sets `stream = undefined` but leaves
  `currentFileName` set (`create/logger.ts:57-58`), so a subsequent `logger.info(...)` re-enters
  `streamForToday()` and its `|| !stream` branch **creates a fresh append stream**. Benign today
  because `close()` is only called immediately before `process.exit(0)`.
- **Sink-failure isolation is partial.** The stream `error` handler covers asynchronous write and
  open failures. `JSON.stringify(entry)` runs **on the caller's stack**, so a circular reference
  or a `bigint` in `data` still throws synchronously into whatever capability method called
  `logger.info(...)`. The comment at `create/logger.ts:41-42` ("A sink failure must not throw into
  a capability call") is true of the stream, not of serialization.
- **The local-time filename versus UTC timestamp mismatch.** In a non-UTC deployment the filename
  date and the timestamps inside that file disagree near midnight.

### Tests

`observability.test.ts` (67 lines, 3 tests) drives the **real** `createLogger` factory against a
`mkdtempSync` directory and reads the file back: buffering plus flush-on-close, level filtering
at `warn`, and `NoopLogger` with a safe optional `close`. It builds `fakeConfig` with only
`{enabled, level, directory}` and casts, so it never sets `logging.detail` and `FileLogger` falls
back to its own `content` default. It reads via `readdirSync(directory)[0]`, so it does not pin
rollover.

`logging-detail.test.ts` (65 lines, 1 top-level test with 4 subtests) bypasses the file sink and
constructs `new FileLogger("unused", level, (entry) => entries.push(entry), undefined, detail)` —
the injected-writer seam is the unit-test boundary. Its four subtests pin: unlabelled ⇒ shape and
always written; content written with its label in development and `[]` in production; the level
filter applying independently; and `NoopLogger` accepting the label. Its comment at lines 61-62 is
the reason the last one exists: *"Not a formality: NoopLogger is what every capability gets when
logging is disabled, so a signature mismatch here would break the disabled path only."*

**Neither test pins** daily rollover, an unknown configured level, `JSON.stringify` failure,
stderr fallback, `logging.detail` config parsing, or log retention.

**`CapturingLogger` — the double 23 test files use — silently discards the label.**
`test/helpers/testDoubles.ts:5-29` still declares `CapturedLog { level, message, data? }` and four
**two-parameter** methods. It compiles because TypeScript permits implementations
with fewer parameters, and because `tsconfig.json`'s `include` is exactly `["src/**/*.ts"]` — the
test tree is never typechecked. Consequence: **no capability test can assert on a `detail`
label**, and every capability test sees content records unconditionally. That is precisely why
`logging-detail.test.ts` builds a raw `FileLogger` instead of using the standard double.

### Dead surface

`FileLogger` declares two parameter properties it never reads: `private readonly directory`
(`logger.ts:76`) and `private readonly level` (`:77`). `grep -n "this.directory\|this.level"`
returns zero hits — only `minLevel`, derived at `:88` from the `level` *parameter*, affects
behaviour. TypeScript's unused checks do not catch parameter properties, and
`tsconfig.base.json` does not set `noUnusedLocals` anyway.

`LogOptions` and `LogDetail` are exported and imported by no other module; the nine call sites
use the inline literal `{ detail: "content" }` rather than the named type.

### Module docs

`observability/docs/` is **the worst module package in the tree**. It was written at `12fb72f`
(2026-07-31) and never updated for `bc506b7` or `ef6d462` (both 2026-08-02), which produces 29
separate contradictions: every statement that the sink is a synchronous `appendFileSync` with
"no buffer, batch, retry or fallback" and "no flush/close lifecycle"; `LogEntry` shown with 4
fields instead of 5; `Logger` shown with two-parameter methods and no `close`; `FileLogger` shown
with a 3-parameter constructor instead of 5; `BackendConfig.logging` shown with 3 fields instead
of 4. **The package never mentions the detail label, `LogDetail`, `LogOptions`, `logging.detail`,
or content logging — its newest and most consequential feature.**

The superseded top-level page is at
[phase-1/platform/observability.md](../phase-1/platform/observability.md); its central rule
(*"Never logged. User content, prompts, provider bodies, Formula source, persona section text,
comment bodies"*) is now the opposite of the shipped default.

---

## Database

### It is not a database platform

`src/0-platform/database/` contains **one implementation file** — `knowledge-store.ts`, 389
lines — plus a 0-byte `.gitkeep` and a six-page `docs/` folder. It is the SQLite implementation
of the **Knowledge** platform's `KnowledgeStore` port. It lives here only because Knowledge is
itself a platform service.

Verified absent:

- no shared `Database` interface, `ReadConnection`, or `TransactionConnection`;
- no `1-init/create/database.ts` factory — it is the only platform module that contains code and
  has no factory;
- no migration runner, migration ledger, `schema_migrations` table, or checksum;
- no process-wide connection and no connection pool;
- no shared transaction helper and no shared pragma helper.

Every capability opens its own `better-sqlite3` connection.
`grep -rln "better-sqlite3" --include='*.ts' src` returns **23 files**. `journal_mode = WAL` is set at **13 sites** and `busy_timeout` at **8** —
the pragma sets are not uniform, and `knowledge-store.ts:88-90` is one of the three that omit
`busy_timeout`, so contention on `knowledge.db` from a second connection fails immediately rather
than waiting. The full pragma census is in
[04 · State and Persistence](04-state-and-persistence.md).

The nearest thing to a shared persistence helper is
`src/0-utils/persistence/resourceHistory.ts` (243 lines) — **not in this directory** — which owns
the revision-history DDL, the two shared error classes, and the `ResourceRetentionPort` interface.

The module's own `docs/README.md:7` names this correctly and should survive any rewrite:

> "The older [Database platform design] describes an intended broader boundary; it must not be
> read as implemented behavior."

### `SQLiteKnowledgeStore`

Constructor `(projectId, dbPath)`: `mkdirSync` the parent, open, three pragmas (`journal_mode =
WAL`, `synchronous = NORMAL`, `foreign_keys = ON`), derive the table prefix, run `createSchema`.

`foreign_keys = ON` is inert here — **the DDL declares no foreign keys at all.**

Table naming (`knowledge-store.ts:16-18`):

> ```
> /** 16-hex-char prefix derived from SHA-256(projectId). */
> const tablePrefix = (projectId: string): string =>
>   createHash("sha256").update(projectId).digest("hex").slice(0, 16);
> ```

The prefix is the **only** SQL identifier ever interpolated into a statement; every caller value
is a bound parameter. The original `projectId` is never persisted, so a database cannot say which
project owns a prefix. The production path is the hard-coded `"./data/knowledge.db"`
(`1-init/create/knowledge.ts:8`) — **cwd-relative**, so starting the backend from the repository
root creates `<repo>/data/`, not `apps/backend/data/`.

**Five tables** (all `kn_<p>_`) and **two indexes**, both single-column `(source_id)`:

| Table | Purpose | Notable columns |
| --- | --- | --- |
| `sources` | Ingest registry, one row per source | `revision TEXT NOT NULL DEFAULT ''`, `window_count`, `size_bytes` (real bytes) |
| `windows` | Canonical retained text + embedding | `id` content-addressed; `start_byte`/`end_byte` hold **character** offsets; `embedding` is JSON `number[]` |
| `nodes` | The KLR lattice; `NULL source_id` = corpus tier | `centroid` JSON, `count`, `cohesion`, `member_ids` JSON |
| `frontier` | Descent entry surface, fully replaced per rebuild | `is_window INTEGER` |
| `level_indices` | Serialized IVF/PCA index | **Created on every startup, never written, never read** |

**Deliberately absent from all five**: no `FOREIGN KEY`, no `CHECK`, no `UNIQUE` beyond the
primary keys, no non-negativity, no `end >= start`, no `is_window IN (0,1)`, no JSON validity
check. All validation is upstream in Knowledge. There is no schema version and no migration
mechanism — only `CREATE TABLE IF NOT EXISTS`. An existing table with an incompatible definition
is silently left alone.

**Nothing in `apps/backend/src` states the no-migration policy in a comment.**
`grep -rn -i "no migration\|not migrate\|no legacy" src` returns zero hits; the policy exists only
in the archived notes, and is restated in
[04 · State and Persistence](04-state-and-persistence.md).

Seventeen port methods. `putWindows`, `putNodes` and `putFrontier` are each one `db.transaction`
(`putFrontier` is DELETE-all-then-insert); every other write is a single statement, and
`deleteSource` performs **no cascade**. `getWindows`/`getNodes` short-circuit on an empty array
and otherwise build one placeholder per id with **no chunking**, so a large id array from descent
can hit SQLite's parameter limit. Deserializers are `JSON.parse` plus a TypeScript cast, so
malformed-but-valid JSON passes through undetected.

Every method is declared `async` although `better-sqlite3` is synchronous — the promise is already
resolved by the time the caller observes it, so all SQLite work blocks the event loop. The adapter
takes no `Logger` and emits zero records.

`close()` exists at `knowledge-store.ts:314`, is **not** part of the `KnowledgeStore` port, and is
**never called** — `createKnowledge` keeps no handle to the store. That is one instance of a
repository-wide fact: nothing closes any SQLite connection in production.

### Tests

Zero. `grep -rn "knowledge-store" test` returns nothing and `SQLiteKnowledgeStore` is never
instantiated in any test. Schema creation, project isolation, batch rollback, frontier
replacement, and row round-trips are entirely unpinned.

### Module docs

`database/docs/` is **accurate** — its table and column listings match the DDL exactly, and it
correctly states the absence of a shared `Database`, a migration runner, a ledger, and a factory.
Two gaps: `concepts.md:45-50` lists three pragmas without noting that `busy_timeout` is omitted
here while 8 capability stores set it, and `concepts.md:39` says level indices are "currently
persisted but not used", when they are not persisted either. The superseded design page is at
[phase-1/platform/database.md](../phase-1/platform/database.md) — nothing on it is implemented.

---

## Web Retrieval

### Scaffold only

`find src/0-platform/web-retrieval -type f` returns exactly **seven files**: a 0-byte `.gitkeep`
and six markdown pages under `docs/`. **There is no `.ts` file of any kind** — no `index.ts`, no
`types.ts`, no provider adapter, no test.

Corroborating negatives, all checked:

- `1-init/create/webRetrieval.ts` does not exist.
- No `WebRetrieval`, `WebSearchRequest`, `WebSearchResult`, `WebFetchRequest`, or
  `WebFetchResult` symbol is declared anywhere in backend source.
- `BackendConfig` has no web or outbound section.
- `src/3-capabilities/` has no `research/` or `sources/` directory, and `src/4-job-wiring/` has no
  such group. Both are the consumers the archived design names.

The only outbound network use in the backend is Intelligence's OpenRouter client; the Connector is
a local-filesystem development provider. So there is **no SSRF surface today** — and also no
protocol allowlist, no private/loopback/link-local filtering, no redirect validation, no byte or
time bounds, no content-type limits, and no credential isolation for any code that might be added
later.

### Its documentation is the model the other packages should follow

`web-retrieval/docs/` is in drift on **no** behavioural claim — helped, obviously, by there being
no behaviour, but the package is instructive precisely because it does not pretend otherwise.
Its `runtime.md` states the inventory as a table of zeros — public methods 0,
auxiliary functions 0, provider adapters 0, factories 0, consumers 0, logs 0, tests 0 — and that
table is exactly correct. Its `README.md:30`:

> "No production code can currently search or fetch through this platform boundary. Any capability
> requiring web retrieval must first implement and compose it; using raw `fetch` elsewhere would
> bypass the intended security and normalization boundary."

And its `invariants.md:57` sets an explicit exit condition, which is the thing most module
packages lack:

> "Implementation should not be described as complete until source, factory/config wiring, one
> adapter, a fake, deterministic safety tests, Logger coverage, at least one real capability
> consumer, and documentation links all exist. Until then, the status in README remains
> 'scaffold only.'"

Its one mechanical defect: `README.md:25-26` links to `docs/capabilities/research.md` and
`docs/capabilities/sources.md`, a directory that does not exist. Those are two of the five broken
`docs/capabilities/` links in the module docs. The superseded design page is at
[phase-1/platform/web-retrieval.md](../phase-1/platform/web-retrieval.md) — aspirational in full.

---

## What no platform module has

Collected once, because it explains several capability-level behaviours documented elsewhere:

| Absent | Consequence |
| --- | --- |
| Any HTTP endpoint | All 89 registered endpoints come from `4-job-wiring`. See [02](02-request-and-job-runtime.md) |
| Any job intent or queue policy | The calling capability chooses the queue; a Knowledge ingest inherits its caller's serial or concurrent slot |
| Any retention port | Knowledge's index is rebuildable and is deliberately excluded from the 11-port sweep |
| Any `AbortSignal` supplied by a caller | Intelligence's cancellation plumbing exists end to end and is exercised by nobody |
| Any migration mechanism | `CREATE TABLE IF NOT EXISTS` only; incompatible existing tables are silently left alone |
| Any connection close in production | `SQLiteKnowledgeStore.close()` is unreachable; shutdown calls `process.exit(0)` with every handle open |
| Any validation of `logging.level` | A typo disables level filtering entirely |
| Any log retention | One file per calendar day, forever |

## Related pages

- [01 · Layers and Boundaries](01-layers-and-boundaries.md) — the alias map and the measured
  import directions.
- [04 · State and Persistence](04-state-and-persistence.md) — the 12 SQLite files, 53 tables, the
  pragma census, and the retention sweep.
- [07 · Capabilities](07-capabilities/README.md) — the consumers: [Document](07-capabilities/document.md)
  (Formula + Rich Text), [Derived Outputs](07-capabilities/derived-outputs.md) (Knowledge +
  Intelligence), [Structured Data](07-capabilities/structured-data.md) (Formula),
  [Investigation](07-capabilities/investigation.md), [Connector](07-capabilities/connector.md) and
  [General Files](07-capabilities/general-files.md) (Knowledge writes), and
  [Slides](07-capabilities/slides.md) (Rich Text at the domain level, unreachable).
- [09 · Configuration](09-configuration.md) — `logging.detail`, `OPENROUTER_API_KEY`, and the
  formula/richText limit blocks.
- [11 · Known Issues](11-known-issues.md) — the projection-pipe bug, the content-logging posture,
  and the unenforced limits, ranked against the rest of the backend.
