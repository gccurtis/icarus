# Shared Types

Lives at `types/types.md`.

`types/` holds the canonical model. There are no stored row shapes here because
this capability stores nothing — and no wire shapes, because there is no wire
format to describe: Convex generates the client API from the functions it pushed.

**Every file is written validator-first.** `export const xValidator = v.union(…)`
then `export type X = Infer<typeof xValidator>`. The validator is what Convex
actually enforces; the TypeScript type is generated *from* it. Writing an
interface beside a validator would be reviewing something no request ever passes
through.

## Files

| File | Holds |
| --- | --- |
| [`actor.ts`](actor.ts) | `Actor` — four kinds, each id named after its own variant |
| [`resource.ts`](resource.ts) | `ResourceKind`, `ResourceRef`, and `kindMatches` |
| [`resource-selection.ts`](resource-selection.ts) | `SetTerm`, `ResourceSelection`, `PortableSelection` |
| [`resource-set-expression.ts`](resource-set-expression.ts) | `ResourceSetExpression`, `Selector`, and `normalize` — **superseded**, see below |
| [`page-setup.ts`](page-setup.ts) | `PaperSize`, `PageSetup` |
| [`style-set.ts`](style-set.ts) | `TextStyle`, `StyleSet` |

## Two selection types, and one of them is going

`resource-selection.ts` is the rebuilt vocabulary, and it is what new code uses.
`resource-set-expression.ts` is the shape [`$model`'s
copilot](../../../model/client/copilot) was built against and still compiles
against; it goes when that object is ported. Nothing imports both.

## Two files carry behaviour

Everything else is shape. These two are functions, and they are here rather than
in an `api/shared/` because each defines what its type *is* rather than
performing a step in a procedure — the same reason
[`canonicalKey`](../../settings/types/settings.ts) sits with `Setting`.

### `kindMatches(pattern, kind)`

Split both on `::` and compare segment by segment; the pattern matches when it is
a segment-wise prefix.

Comparing **segments** rather than raw string prefixes is the part that matters:
`connector::google` must not match `connector::googlesheets`, and a `startsWith`
would say it does. Arbitrary depth then comes free, because the comparison never
knows how many levels there are.

### `normalize(expression)`

The canonical form of a `ResourceSetExpression`, applied on write. Duplicates
collapse; a broader selector absorbs the ones it covers within the same list; a
selector in both lists loses its include.

**Two details go past the letter of the
[design](../../../../../../docs/stage-0/0-foundation-design.md#resourcesetexpression--18-imports),
and both serve the canonical form it asks for.** A `resourceKind` absorbs
narrower *kinds* and not only `resource` selectors — otherwise
`[external, external::image]` is one set with two spellings, which is the thing
being fixed. And selectors are sorted by key, because otherwise `[a, b]` and
`[b, a]` are one set written two ways and deep equality still fails.

## `ResourceKind` is an open string

It is `v.string()`, not a union of literals, and there is deliberately **no
exported list of base kinds**. A connector is a provider and a version rather
than one thing, and integrations keep arriving; naming the kinds in an array
would invite reading an open space as closed, which is the one thing the open
string exists to avoid.

The cost is honest and worth stating: nothing validates the string, so a typo in
a kind is a silent miss rather than a rejected write.

## `PageFurniture` is not here

Headers, footers and page numbers belong to
[`documents`](../../../../../../docs/data-models/general-resources/document.md#header-and-footer)
and ship with it. `PageSetup` is here because three resources genuinely use it —
a document's page, a deck's handout, a sheet's print setup — while only documents
have furniture, and a type used by one capability lives with it.
