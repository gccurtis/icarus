# Rich Text platform documentation

## Status and authority

Rich Text is an implemented, in-process Platform component for inline content. It owns atom/mark/range types, pure-ish content transformations, formula-atom authoring and settlement primitives, styling projection, validation/normalization, cloning, plain-text extraction, and a deterministic JSON/UTF-8 codec. It does not own document blocks, slide shapes, persistence, routes, Jobs, revisions, or conflict handling.

Document is a concrete runtime consumer. Slide contains domain reducers, projections, validation and endpoint/internal-Job declarations that consume Rich Text, but its barrel references a missing `application/slideService.ts`; the Slide paths documented here are therefore source-level integrations, not currently operable endpoints.

These pages describe the current files under [`rich-text/`](../). The older `repository Rich Text reference` describes a larger block-owning design that is not the implemented model: current `RichContent` is just `atoms + marks`, and host capabilities own all containers.

## Runtime position

```mermaid
flowchart LR
  Config["BackendConfig.richText"] --> Factory["createRichTextInstance"]
  Defaults["DEFAULT_STYLE"] --> Factory
  Logger["Logger"] --> Factory
  Factory --> RT["RichText"]
  RT --> Document["Document blocks/projections"]
  RT --> Slides["Slide domain/projection source<br/>(application service missing)"]
  FormulaType["FormulaWireValue"] --> RT
  Document --> Stores["Host Base + ChangeSets"]
  Slides --> Stores
```

Construction lives in `create/rich-text.ts`, and process composition is attempted in `create-runtime.ts`. The public package surface is `index.ts`.

## Dependency and source map

| Concern | Code authority | Role |
| --- | --- | --- |
| Public model | `types.ts`, `index.ts` | Atoms, marks, operations, outputs, `RichText` interface |
| Runtime facade | `engine.ts` | Factories, styling and method delegation/logging |
| Operation reduction | `operations.ts` | Batch apply, inverse primitives and footprints |
| Validation/canonicalization | `validate.ts`, `normalize.ts` | Structural diagnostics and normalization passes |
| Styling | `styles.ts`, `engine.ts` | Mark-to-style mapping, overlays, resolved ranges |
| Formula authoring | `formula-authoring.ts` | Delimited text to atomic `FormulaAtom` replacement |
| Utility forms | `codec.ts`, `clone.ts`, `plain-text.ts`, `id-factory.ts` | Encoding, ID remap, text projection, UUID factory |
| Document integration | `document/reducer.ts`, `documentService.ts` | Rich Text commands, Formula settlement, inverses |
| Document projections | `document/projections/` | Plain text, outline and styling |
| Slide integration | `slide/reducer.ts`, `slide/projections/` | Notes/text mutation and projections |
| Wire ingress | `document/valueSchemas.ts`, `slide/valueSchemas.ts` | Strict host-owned DTO validation |

Rich Text depends on Formula only for the `FormulaWireValue` type and on Observability for `Logger`. It never calls the Formula engine.

## Navigation

- [Concepts](concepts.md): atoms, marks, positions, host ownership, lifecycle, and styling.
- [Types](types.md): complete type families, operations, diagnostics, and persistence form.
- [Runtime](runtime.md): factory and every public runtime method plus helper ownership.
- [Flows](flows.md): Document/Slide endpoint and Job call chains.
- [Invariants](invariants.md): guaranteed outcomes, limitations, concurrency, failures, and tests.

## Executable references

- `Rich Text/Formula tests`
- `Document domain tests`
- `Document application tests`
- `Slide wire tests`
