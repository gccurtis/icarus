# Rich Text guarantees and invariants

## Outcome guarantees

| Preconditions/input | Guaranteed current outcome |
| --- | --- |
| Valid one-text-atom `{{nonblank}}` range plus collision-free supplied IDs | One guarded atomic Formula replacement operation |
| `replace-range-with-atom` applied to unchanged expected text | Source split/replacement, boundary-aware mark remap and exact `replace-content` inverse |
| Formula settlement on an existing Formula atom | Exact replacement/clearing of accepted value, display and diagnostic, with reversible prior settlement |
| Same content and same operation list without random-ID factories | Same returned content/inverse/footprint |
| `encode` on structurally identical object/array ordering | Same UTF-8 JSON bytes with sorted object keys |
| Plain-text projection | Ordered text + display text + newline for hard breaks; marks ignored |
| Mark factory with supplied ID | Exact supplied identity and range/payload |
| Failed operation within `apply` | Caller input remains untouched because work occurs on a clone; no partial result returned |

## Content and validation invariants

`validate` currently guarantees diagnostics for nonempty atom list, unique atom/mark IDs, configured atom/mark count limits, mark endpoint existence, text endpoint bounds/non-negativity, empty same-position ranges, empty link targets, and endpoints splitting a UTF-16 surrogate pair.

It does not currently guarantee:

- start precedes end in atom order or within one atom;
- integer/finite offsets;
- non-text endpoint offset bounds;
- `maxMarkRangeSpan` enforcement;
- atom payload validity (blank IDs, URL format, Formula wire shape, style ranges/properties);
- Formula/reference display consistency;
- that every mark lies within content in a globally ordered sense.

Host Document/Slide decoders add strict recursive ingress validation and aggregate-level rules.

## Styling invariants

- Config defaults are the base of each emitted resolved segment.
- Covering marks overlay in their explicit array order; opaque mark IDs do not choose precedence.
- `overlayMarks` applies supplementary properties before authoritative properties.
- A supplementary semantic mark is not reintroduced when its concrete property disagrees with the authoritative merged value.
- Link marks produce targets but no style property.
- Non-text mark boundaries snap to complete atom display length.
- Synthetic overlay IDs are deterministic for deterministic ordered inputs.

There is no full-coverage guarantee without marks spanning the content. `resolveStyling` emits only segments between mark endpoints. It does not deduplicate links. Supplementary links passed directly to `overlayMarks` are not carried; current host projections extract and append links separately.

## Normalization invariants and limits

For its own output shape, normalization is designed to be idempotent: non-text endpoints are snapped, empty/dead/out-of-bounds marks removed, adjacent text atoms merged, adjacent equivalent marks deduplicated, and marks sorted.

It is not a lossless canonicalization guarantee for arbitrary content. Adjacent text merge preserves the first atom ID but does not remap mark endpoints from later merged IDs, so those marks are dropped. Deduplication checks only consecutive equivalent marks before final sorting and ignores IDs when comparing same-kind/range/payload. Callers that require semantic preservation should avoid relying on normalization to merge independently addressed text atoms.

## Application and inverse behavior

`apply` is deterministic and caller-input-safe but is not a validating transaction. Current limitations that hosts must account for:

- ordinary `insert-text`/`delete-range` do not remap mark offsets;
- middle `insert-atom` splits a text atom by copying its ID to both text fragments, creating duplicate IDs;
- generic cross-atom delete flattens text and does not reconstruct removed atoms/marks in its inverse;
- `replace-range` produces a simplified inverse with empty replacement text, not the deleted source;
- `delete-atom` produces an `insert-atom` inverse anchored to the deleted atom ID, which is no longer present;
- deleting the final atom is allowed by apply, though validation reports `atoms-empty` afterward;
- add-mark/insert-atom do not check duplicate IDs;
- footprint `dirtyRange` is the last operation's dirty range, not a union.

Accordingly, exact undo is only guaranteed where a host/test establishes it for the operation subset. `replace-range-with-atom`, `replace-content`, mark add/remove, link-target update, formula-expression update and Formula settlement have direct reversible implementations. Document and Slide layer their own operation/inverse/revision constraints above this runtime.

## Formula invariants

- Delimiter authoring never parses/evaluates Formula.
- The extracted expression preserves whitespace inside delimiters.
- A middle replacement requires a separately supplied trailing text atom ID, preventing identity reuse in that atomic path.
- `expectedText` rejects stale source.
- Accepted Formula value and diagnostic are mutually controlled by settlement omission, not automatically mutually exclusive in the raw `FormulaAtom` type.
- Formula functions cannot appear in accepted values because `FormulaWireValue` has no function kind.

## Determinism, concurrency, and idempotency

The runtime keeps no content state and can serve concurrent callers. Each apply call clones its input and uses local mutation only. Callers must not concurrently mutate the same input object while a method reads it.

Random UUID defaults make factory output nondeterministic when IDs are omitted. Supplied deterministic IDs make mark/formula authoring reproducible. Rich Text owns no idempotency keys; host revisions and request IDs control replay. Codec determinism includes object-key sorting but preserves array order and JavaScript JSON semantics.

`clone` remaps IDs deterministically only when its supplied factory is deterministic. It is a shallow payload clone, so mutation of nested targets/styles/accepted values can be observed across original and clone.

## Failure behavior

Validation returns diagnostics. Most other invalid operations throw ordinary `Error`. `decode` can throw JSON parse errors; its default `TextDecoder` is nonfatal and can replace malformed UTF-8 before parsing. `fullRange*` throws on empty atoms. Styling comparison throws on unknown atom references.

No runtime method wraps failures in a Rich Text-specific error hierarchy. Endpoint consumers map host decoder/domain errors, not these raw errors directly. `apply` does not log its thrown failure because logging occurs only after a successful return.

## Logging and information handling

Successful apply logs operation type names/counts and input atom/mark counts. Overlay/style logs counts/durations. Failed validation logs counts, not diagnostic messages or content. Text, Formula source/results, targets, URLs and style values are not included by Rich Text logging.

Logger calls are synchronous and unguarded. A logger implementation that throws can change the method outcome. Rich Text does not attach request/job/resource IDs because they are absent from its inputs.

## Security and trust boundary

- Direct `decode` is not safe ingress validation; hosts must decode strictly or call validate.
- Link targets are data only; Rich Text does not fetch URLs or enforce schemes.
- Formula/reference display text is trusted authored/derived content and is not sanitized for HTML.
- Style values are not CSS-sanitized by this runtime.
- Operations can allocate arbitrarily large strings unless host payload limits intervene; Rich Text count limits do not bound text bytes.

## Tests proving current behavior

- [`rich-text-formula.test.ts`](../../../../test/capabilities/rich-text-formula.test.ts): atomic delimiter conversion/mark remap/exact inverse, malformed/stale rejection, settlement clearing/inverse, deterministic Formula display.
- [`document-domain.test.ts`](../../../../test/capabilities/document-domain.test.ts): style precedence independent of opaque IDs, authoritative overlay behavior, nested projections, Formula footprints, and an exact host-level Rich Text mutation inverse.
- [`document-application.test.ts`](../../../../test/capabilities/document-application.test.ts): durable host revisions, conflict/replay and Formula/Prompt workflows.
- [`slide-wire.test.ts`](../../../../test/capabilities/slide-wire.test.ts): strict recursive Rich Content DTOs, rejection of invalid embedded Formula values and payload budgets.

## Explicit non-goals

No standalone endpoint, queue, persistence, revision, ChangeSet, block/container model, rendering, HTML escaping, target resolution, Formula evaluation, editor selection, collaborative transform, or general exact-undo engine is implemented here.
