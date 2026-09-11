## Where the model lives

The data model is code, not documents. Row shapes are declared in [[file:app/src/lib/representation/store/tables.ts]] — `TABLE_NAMES` lists the 42 tables and `TableFields` maps each to its `<Table>Fields` type — and every field type comes from a domain under `representation/data/types/`. The archived `docs/tables/` describe what the tables were meant to be; this page reads what they are. A row is its fields plus `_id` and `_creationTime` ([[file:app/src/lib/representation/data/types/core/id.ts]]); an `Id<"documents">` is a branded string, `documents:12`, minted by the store from the highest existing number.

## The domain graph

Thirteen domains under `data/types/`, and which may import which is declared in [[file:app/configuration/representation.yaml]] — `templates: [content, core, documents, presentations, spreadsheets]` and so on. [[check:domain-graph-is-declared]] reads the real imports against the declaration and refuses a cycle. The diagram is drawn from the declaration.

## The tables

Every table, with every field and its declared type, read from `tables.ts`. Optional fields are marked. Five of them are the resource tables the editors read and write — `documents`, `presentations`, `spreadsheets` and their `*Snapshots` and `*ChangeSets` — and `workspaceSnapshots` and `workspaceRevisions` hold the workspace ledger.

## The store

The store is a directory of JSON files, one per table, read once at startup and written whole on every commit ([[file:app/src/lib/model/server/store/methods/shared/load.server.ts]], [[file:app/src/lib/model/server/store/methods/shared/persist.server.ts]]). The directory comes from `representation.store.directory` in `representation.yaml` — `data` — read by [[file:app/src/lib/model/server/store/constructor.ts]]; the committed `app/seed/*.json` tables are copied there by `pnpm seed`.

Every operation is spelled as a path, `<table>[.<id>[.<field>…]]`, parsed by [[file:app/src/lib/representation/store/path.ts]]: `read("documentSnapshots")` answers a table, `read("documents.documents:3")` a row, `read("documents.documents:3.title")` a field. `update` and `remove` take the same paths; `create` takes a table and the fields and mints the id. `_id` and `_creationTime` cannot be written. `asStorable` refuses `undefined`, functions, symbols, bigints and cycles before anything reaches disk, so a write cannot half-persist. [[file:app/src/lib/model/server/store/definition.ts]] is the whole object; the `store` capability exposes the four operations to the browser under a scope.

The archived store document says 35 tables and names a `store.server.ts`; both are stale, and [[page:/gaps|Gaps]] records it.
