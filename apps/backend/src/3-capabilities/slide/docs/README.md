# Slide capability

## Implementation status: incomplete and not runnable

Slide currently contains a substantial representation-v1 domain model, pure
reducer/inverses, recursive validation, strict wire decoders, project-scoped
SQLite store, projections, an instance factory, endpoint mappings, and internal
job mappings. Domain, persistence, and wire tests exist.

However, [`index.ts`](../index.ts) exports
`./application/slideService.js`, while
`application/slideService.ts` does not exist. Therefore `SlideCapability`,
`SlideDependencies`, and `createSlideCapability` have no implementation. The
instance factory, endpoint/internal-job wiring, and startup references cannot
form a working runtime in the current tree. `/slides/command` and
`/slides/query` are described below as present wiring declarations, not as
operable endpoints.

No document in this package should be read as claiming the missing application
workflow is implemented.

## Documentation map

- [Concepts](concepts.md): current vocabulary, canonical aggregate, ownership,
  and the implementation gap.
- [Types](types.md): canonical, operation, command/query, persistence, wire,
  error, and projection families.
- [Runtime](runtime.md): implemented pure/store/factory functions, declared
  wiring, and the missing runtime methods.
- [Flows](flows.md): executable domain/store flows versus currently unreachable
  endpoint and prompt-job chains.
- [Invariants](invariants.md): what current validators/reducers/stores guarantee,
  and what cannot be guaranteed without the service.

## Current source map

| Layer | Current source/status |
| --- | --- |
| Public barrel | [`index.ts`](../index.ts); references missing service module |
| Aggregate types | [`domain/model.ts`](../domain/model.ts) |
| Canonical encoding/digests | [`canonical.ts`](../domain/canonical.ts) |
| Reducer/inverse/rebase | [`reducer.ts`](../domain/reducer.ts), [`inverses.ts`](../domain/inverses.ts), [`rebase.ts`](../domain/rebase.ts) |
| Geometry/tree/validation/identity | [`geometry.ts`](../domain/geometry.ts), [`tree.ts`](../domain/tree.ts), [`validation.ts`](../domain/validation.ts), [`identities.ts`](../domain/identities.ts) |
| Defaults/blank Deck | [`createService.ts`](../application/createService.ts) |
| Application service | **Missing:** `application/slideService.ts` |
| Store contract/adapter/schema/mappers | [`slideStore.ts`](../ports/slideStore.ts), [`sqliteSlideStore.ts`](../persistence/sqliteSlideStore.ts), [`sqliteSchema.ts`](../persistence/sqliteSchema.ts), [`sqliteMappers.ts`](../persistence/sqliteMappers.ts) |
| Derived Outputs port | [`derivedOutputs.ts`](../ports/derivedOutputs.ts) |
| Wire admission | [`commandSchemas.ts`](../wire/commandSchemas.ts), [`querySchemas.ts`](../wire/querySchemas.ts), [`operationSchemas.ts`](../wire/operationSchemas.ts), [`valueSchemas.ts`](../wire/valueSchemas.ts) |
| Projections | [`dependencies.ts`](../projections/dependencies.ts), [`outline.ts`](../projections/outline.ts), [`plainText.ts`](../projections/plainText.ts), [`styling.ts`](../projections/styling.ts) |
| Instance factory | [`create/slide.ts`](../../../1-init/create/slide.ts); blocked by missing service |
| Public wiring | [`registerSlideEndpoints.ts`](../../../4-job-wiring/slide/registerSlideEndpoints.ts); declared but unreachable |
| Internal wiring | [`createSlideJobs.ts`](../../../4-job-wiring/slide/createSlideJobs.ts), [`registerSlideInternalJobs.ts`](../../../4-job-wiring/slide/registerSlideInternalJobs.ts); declared but no runtime target |
| Startup references | [`startBackend.ts`](../../../1-init/startBackend.ts); currently references incomplete construction |

## Authority and dependencies

For implemented code, the `DeckSnapshot` is canonical authored state, the
reducer owns operation semantics/inverses/touched IDs, validation owns recursive
structural admission, Rich Text owns notes/text semantics, and the SQLite store
owns atomic persistence primitives. Derived Output IDs and image snapshot IDs
are external references.

There is no current application authority coordinating commands, revisions,
Prompt Content attempts, recovery, or compaction. The types/store/wiring define
the intended seam, but only a future `slideService.ts` can implement it.

## Tests and design material

Implemented layers are covered by
[`slide-domain.test.ts`](../../../../test/capabilities/slide-domain.test.ts),
[`slide-wire.test.ts`](../../../../test/capabilities/slide-wire.test.ts), and
[`slide-persistence.test.ts`](../../../../test/capabilities/slide-persistence.test.ts).
There is no Slide application-service test because that service is absent.

Broader design intent is in
[`docs/capabilities/slides.md`](../../../../../../docs/capabilities/slides.md)
and
[`scratch/slides-design`](../../../../../../scratch/slides-design). These
in-capability docs deliberately separate that intent from implemented code.
