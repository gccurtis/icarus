# Rich Text types

## Public export surface

[`index.ts`](../index.ts) exports `createRichText`, the `RichText` interface, all public content/operation/result types, and default config/style/limits. Helper functions in codec, operations, styles, validation, normalization and ID factory are file-level exports but are not all package-index exports.

## Content and atom family

Defined in [`types.ts`](../types.ts):

| Type | Shape and role |
| --- | --- |
| `RichContent` | Mutable-array-by-type value containing `RichTextAtom[]` and `RichTextMark[]` |
| `TextAtom` | stable ID, `kind: text`, UTF-16 string |
| `FormulaAtom` | stable ID, expression, optional accepted Formula wire value, display text, optional diagnostic |
| `ReferenceAtom` | stable ID, `LinkTarget`, display text |
| `HardBreakAtom` | stable ID and discriminant only |

`RichContent` has no content ID or revision. Hosts provide those identities around it.

## Position, range, mark and style family

- `TextPosition { atomId, offset }`: offset is a UTF-16 code-unit index.
- `TextRange { start, end }`: intended half-open atom-relative range.
- `SimpleRangeMark<T>`: bold/italic/underline/strike/code discriminant, ID and range.
- `StyleMark`: ID/range plus partial `TextStyleProperties`.
- `LinkMark`: ID/range plus a nonempty-by-validation target array.

`TextStyleProperties` has optional font family/size/weight, italic/underline/strike/code, colors, letter spacing and line height. Units are not runtime-validated; comments describe font size as em-relative.

`LinkTarget` discriminants are:

- URL: `href`;
- resource: kind, ID and optional locator;
- evidence: evidence ID;
- question: question ID;
- data: entry ID and optional locator.

No target resolution or URL policy is implemented in Rich Text.

## Formula family

`FormulaAtom` imports `FormulaWireValue` from [`#formula`](../../formula/index.ts). `RichTextFormulaDiagnostic` is intentionally looser than `FormulaDiagnostic`: string code/message and an optional numeric source range. `FormulaAtomSettlement` contains optional accepted value, required display text and optional diagnostic. Omission actively clears the corresponding optional atom field during settlement.

`FormulaAuthoringResult` returns allocated atom ID, extracted source, and operations. The helper currently always returns exactly one `replace-range-with-atom` operation.

## Operation family

[`RichTextOperation`](../types.ts) currently includes:

| Group | Operations |
| --- | --- |
| Text | `insert-text`, `delete-range`, `replace-range` |
| Atom | `insert-atom`, `delete-atom`, `replace-range-with-atom`, internal exact `replace-content` |
| Mark | `add-mark`, `remove-mark`, `set-link-targets` |
| Formula | `set-formula-expression`, `apply-formula-settlement`, compatibility `apply-formula-result` |

`replace-range-with-atom` includes `expectedText` as a stale-input guard and requires `trailingTextAtomId` exactly when replacing the middle of one text atom. `replace-content` is the exact snapshot inverse primitive produced internally; because it is public in the union, a caller can also submit it.

## Result and diagnostic family

| Type | Fields | Meaning |
| --- | --- | --- |
| `ValidationResult` | `ok`, `diagnostics` | Non-throwing selected structural validation |
| `RichTextDiagnostic` | string code/message, optional position/range | Validation output; current validators mostly omit position/range fields |
| `ApplyResult` | `content`, `inverse`, `footprint` | Operation reduction result |
| `Footprint` | affected atom IDs, optional dirty range | Coarse host conflict/projection hint |
| `ResolvedStyleRange` | range, resolved properties, active mark IDs, optional links | One marked segment |
| `ResolvedStyling` | ranges, whole plain text, collected links | Rendering projection |

Validation diagnostic codes currently produced by [`validate.ts`](../validate.ts):

- `atoms-empty`, `duplicate-atom-id`, `duplicate-mark-id`;
- `too-many-atoms`, `too-many-marks`;
- `mark-range-start-not-found`, `mark-range-end-not-found`;
- `mark-offset-out-of-bounds`, `mark-offset-negative`;
- `empty-mark-range`, `link-no-targets`, `surrogate-split`.

`apply` failures are thrown `Error` objects with messages; there is no typed operation-error class/result union.

## Configuration and IDs

`RichTextConfig` contains `defaults: TextStyleProperties` and `limits: RichTextLimits`. [`DEFAULT_STYLE`](../types.ts) supplies system font, 1em size, weight 400, false decorations/code, inherited/transparent colors, zero spacing and 1.5 line height.

Limits are atom count, mark count and mark-range span. The first two are enforced by validation. `maxMarkRangeSpan` is currently stored but never read.

`RichTextIdFactory` has `atomId()` and `markId()`. [`createRichTextIdFactory`](../id-factory.ts) returns UUID generators. Hosts/tests may inject deterministic factories. Mark factory methods on `RichText` independently default to random UUIDs.

## Runtime interface

`RichText` exposes a readonly config plus mark factories, overlay/style projection, validation/normalization/application, Formula authoring, clone/plain-text, and codec methods. Every method is described in [runtime.md](runtime.md).

## Wire and persistence form

Rich Text has no separate DTO type in this module. [`encode`](../codec.ts) sorts every plain object's keys during `JSON.stringify` and UTF-8 encodes the JSON. Array order remains significant. [`decode`](../codec.ts) decodes UTF-8 and casts parsed JSON to `RichContent` without validation.

Document and Slide define strict recursive ingress schemas in their own [`valueSchemas.ts`](../../../3-capabilities/document/wire/valueSchemas.ts) and [`valueSchemas.ts`](../../../3-capabilities/slide/wire/valueSchemas.ts). Hosts persist Rich Content inside their snapshots/ChangeSets rather than a Rich Text table.

[`clone`](../clone.ts) creates new atom/mark arrays, assigns new IDs, and remaps range endpoint IDs. It is not a full structural deep clone: nested style property/target/wire-value objects are shared because atoms/marks are spread shallowly.
