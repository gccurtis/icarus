# Rich Text runtime and functions

## Construction and state

`createRichText` constructs `RichTextImpl` with a `RichTextConfig` and `Logger`. `createRichTextInstance` combines `DEFAULT_STYLE` with `BackendConfig.richText` limits. `startBackend` injects the singleton into Document and attempts to inject it into Slide; the latter construction is currently blocked by the missing Slide application service module.

The runtime stores only config and logger. Content is always passed in/out; the service owns no content repository. Most helpers are pure with respect to caller input, although returned arrays/objects are ordinary mutable JavaScript values.

## Public method catalog

### Configuration

`config` exposes the exact config object supplied at construction. It is readonly by TypeScript, not deep-frozen.

### Mark factories

- `bold`, `italic`, `underline`, `strike`, `code(range, id?)`: return a simple mark, using a random UUID when ID is absent.
- `link(targets, range, id?)`: returns a link mark without validating target count/content.
- `style(props, range, id?)`: returns a style mark without validating property values.
- `fullRangeMark(kind, atoms, id?)`: spans first atom offset zero through the last atom's runtime length.
- `fullRangeStyle(props, atoms, id?)`: same range computation for a style mark.

Full-range methods throw on an empty atom array. Formula/reference length is display-text length; hard-break length is zero.

### `overlayMarks(authoritative, supplementary, atoms)`

Snaps endpoints for non-text atoms and clamps overlong text endpoints; rejects unknown atom IDs while ordering boundaries. It segments on all endpoints, computes supplementary then authoritative style properties, carries links and compatible semantic marks, appends a flattened style mark, and deduplicates by full JSON value. Generated IDs use `$rich-text-overlay:<segment>:...` and are deterministic for ordered inputs.

It logs duration and source/result mark counts. It does not call `validate` or preserve supplementary links (authoritative links are carried; supplementary link marks are not added by `carryForwardMarks`). Document/Slide intentionally remove links before overlay and append them afterward.

### `resolveStyling(content)`

Snaps mark endpoints, segments at mark boundaries, starts each segment from configured defaults, overlays covering marks in array order, and gathers link targets. It returns marked ranges plus `plainText(atoms)`. No boundaries means no ranges. Link targets are not deduplicated. It logs duration and counts.

### `validate(content)`

Delegates to `validate.ts` with configured limits. It reports empty atoms, duplicate IDs, count limits, missing endpoint atoms, selected offset problems, empty marks, empty link targets and UTF-16 surrogate splits. It logs only failed validations and does not throw for normal diagnostics.

### `normalize(content)`

Delegates to `normalize.ts`: snap non-text endpoints, remove empty marks, merge adjacent text atoms, filter dead/out-of-bounds marks, remove adjacent equivalent marks, then sort marks by atom order/start offset. It does not log or validate the result.

### `apply(content, operations)`

Delegates to `applyOperations`, which `structuredClone`s input, reduces operations in order, reverses inverse order, unions affected IDs and retains the most recent dirty range. If an operation throws, the caller's original content was not mutated and no result is returned. It logs duration, input counts, operation count and operation type names.

Operation helper behavior:

- text insert/delete/replace edits text atoms;
- atom insert/delete changes atom order and removes marks directly referencing a deleted atom;
- `replace-range-with-atom` performs a guarded single-text-atom split/replacement with exact snapshot inverse and mark endpoint remapping;
- `replace-content` swaps the whole value with an exact snapshot inverse;
- mark operations add/remove/update;
- Formula operations update expression or atom settlement fields.

`apply` does not automatically enforce uniqueness, validate bounds for every operation, update ordinary mark offsets after text edits, normalize, or ensure nonempty content.

### `formulaFromDelimitedRange(content, range, ids)`

Delegates to `formula-authoring.ts`. It requires one text atom, integer ordered in-bounds offsets, exact `{{...}}` delimiters and a nonblank interior. It allocates Formula/trailing text IDs and returns a guarded atomic replacement operation. It does not parse Formula source.

### `clone(content, ids)`

Delegates to `clone.ts`. It remaps all atom/mark IDs and mark endpoints and creates new top-level arrays/objects. Nested payloads remain shared. Missing range IDs remain unchanged rather than failing.

### `plainText(atoms)`

Delegates to `plain-text.ts`. It concatenates text, Formula/reference display text and newline for hard breaks. It does not inspect marks.

### `encode(content)` and `decode(bytes)`

Delegate to `codec.ts`. Encode sorts object keys recursively through a JSON replacer and returns UTF-8 bytes. Decode parses JSON and casts it; malformed JSON throws and malformed Rich Content is not diagnosed until explicit validation/host ingress.

## Auxiliary helper groups

### Styles — `styles.ts`

`overlay(base, over)` copies defined overlay properties. `markToProperties` maps semantic marks to concrete style values (`bold` → weight 700, `code` → code true/monospace); links map to no visual properties. `mergeStyleProperties(authoritative, supplementary)` is a named supplementary-then-authoritative overlay.

### Engine range helpers — `engine.ts`

Helpers compute atom order, position comparisons, full ranges, snapped marks, all segment boundaries, containment, synthetic carried marks and JSON-value deduplication. Unknown atom IDs throw during position comparisons/boundary collection rather than becoming validation diagnostics.

### Operation helpers — `operations.ts`

One switch dispatches every operation. Helpers mutate the cloned working arrays. `mapReplacedTextPosition` gives boundary-aware mark remapping for atomic Formula authoring. Formula settlement reconstructs the atom while deliberately omitting old accepted value/diagnostic unless supplied in the new settlement.

### Validation/normalization — `validate.ts`, `normalize.ts`

These are independent opt-in passes. Validation builds atom/mark ID sets and an atom map. Normalization uses separate passes and does not reuse validation.

### ID factory — `id-factory.ts`

`createRichTextIdFactory()` is available by direct module import and returns random UUID atom/mark functions. The package index exports the interface but currently does not re-export this factory.

## Logging and side effects

Only overlay, styling resolution, failed validation, and apply emit logs. Logged application data includes operation type names and counts, not text, expressions, targets, style values, or accepted Formula values. Other methods are silent. Logger exceptions are not caught.

Random UUID allocation is the only nondeterministic behavior in mark/default ID factories; callers can supply IDs for deterministic output.
