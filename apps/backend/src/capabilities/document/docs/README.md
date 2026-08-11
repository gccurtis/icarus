# Document capability

## Implementation status

Document is implemented end to end in the current tree. Its canonical model,
reducer, strict wire decoders, SQLite store, application service, two public
endpoint mappings, seven internal-job mappings, startup construction, attempt
recovery, and post-commit transaction-outbox publication to Activity are
present. The tests cover domain behavior, wire admission, persistence,
application workflows, and job wiring.

Document owns canonical authored state through a current/history split. The
typed `documents` table contains live heads only; `document_resources` anchors
retained body history; and `document_history` stores superseded heads and
terminal deletion revisions. Logical delete removes current and operational
state, while guarded purge irreversibly removes the retained root and owned
Derived Output history.
Rich Text owns authored text atoms/marks and text-operation semantics. Derived
Outputs owns generated prompt definitions and immutable output revisions.
Formula owns parse/evaluation semantics. The shared internal-jobs runtime owns
queue admission, while Document persists the durable attempt/stage authority.

## Documentation map

- [Concepts](concepts.md): vocabulary, aggregate, ownership, and architecture.
- [Types](types.md): canonical, command, query, attempt, store, wire, error, and
  projection families.
- [Runtime](runtime.md): construction, all public runtime methods, store API,
  and domain/helper families.
- [Flows](flows.md): endpoint, command/query, prompt, formula, compaction, and
  recovery call chains with queue choices.
- [Invariants](invariants.md): admission guarantees, identity/history rules,
  concurrency, recovery, limits, security, tests, and non-goals.

## Current source map

| Layer | Authority and entry points |
| --- | --- |
| Public exports | [`index.ts`](../index.ts) |
| Aggregate types | [`domain/model.ts`](../domain/model.ts) |
| Canonical encoding/digests | [`canonical.ts`](../domain/canonical.ts) |
| Reducer/inverses/rebase | [`reducer.ts`](../domain/reducer.ts), [`inverses.ts`](../domain/inverses.ts), [`rebase.ts`](../domain/rebase.ts) |
| Validation/identity/layout/tree | [`validation.ts`](../domain/validation.ts), [`identities.ts`](../domain/identities.ts), [`layout.ts`](../domain/layout.ts), [`tree.ts`](../domain/tree.ts) |
| Application runtime | [`documentService.ts`](../application/documentService.ts) |
| Default creation | [`createService.ts`](../application/createService.ts) |
| Store contract/adapter/schema/mappers | [`documentStore.ts`](../ports/documentStore.ts), [`sqliteDocumentStore.ts`](../persistence/sqliteDocumentStore.ts), [`sqliteSchema.ts`](../persistence/sqliteSchema.ts), [`sqliteMappers.ts`](../persistence/sqliteMappers.ts) |
| External runtime ports | [`activityPublisher.ts`](../ports/activityPublisher.ts), [`derivedOutputs.ts`](../ports/derivedOutputs.ts), [`formulaResolver.ts`](../ports/formulaResolver.ts) |
| Wire admission | [`commandSchemas.ts`](../wire/commandSchemas.ts), [`querySchemas.ts`](../wire/querySchemas.ts), [`operationSchemas.ts`](../wire/operationSchemas.ts), [`valueSchemas.ts`](../wire/valueSchemas.ts) |
| Rebuildable projections | [`dependencies.ts`](../projections/dependencies.ts), [`outline.ts`](../projections/outline.ts), [`plainText.ts`](../projections/plainText.ts), [`styling.ts`](../projections/styling.ts) |
| Instance factory | [`create/document.ts`](../../../initialization/runtimes/document.ts) |
| Public endpoints | [`registerDocumentEndpoints.ts`](../../../api/routes/document/registerDocumentEndpoints.ts) |
| Internal jobs | [`createDocumentJobs.ts`](../../../api/routes/document/createDocumentJobs.ts), [`registerDocumentInternalJobs.ts`](../../../api/routes/document/registerDocumentInternalJobs.ts) |
| Startup composition | [`create-runtime.ts`](../../../initialization/create-runtime.ts) |

## Configuration and storage

The instance factory opens `./data/documents.db` and project-hashes every table
prefix, so projects in the same SQLite file have isolated tables. Document
compaction and content limits come from `config.document`; current defaults
retain 5 Bases, 1,000 ChangeSets, and 1,000 terminal attempts. Shared revision
retention comes from `config.retention`; old superseded heads are pruned and a
terminally deleted Document is purged after the cutoff. Limits are documented
in [Invariants](invariants.md).

## Related material

These in-capability docs describe executable code and take precedence when a
design page differs. Broader intent remains useful in
[`docs/capabilities/document.md`](../../../../../../docs/capabilities/document.md)
and the
[`scratch/document-design`](../../../../../../scratch/document-design)
package.

Tests are in
[`document-domain.test.ts`](../../../../test/capabilities/document-domain.test.ts),
[`document-wire.test.ts`](../../../../test/capabilities/document-wire.test.ts),
[`document-persistence.test.ts`](../../../../test/capabilities/document-persistence.test.ts),
and
[`document-application.test.ts`](../../../../test/capabilities/document-application.test.ts).
