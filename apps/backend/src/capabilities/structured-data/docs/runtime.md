# Structured Data runtime

## Construction

[`createStructuredDataInstance`](../../../initialization/runtimes/structured-data.ts) binds `config.projectId` into `SQLiteDataStore("./data/structured-data.db")`, then calls [`createStructuredData`](../structured-data.ts) with configured limits and the shared Logger. Despite an old store comment mentioning two instances, startup currently composes one project-scoped Structured Data service.

Startup separately creates [`FormulaNameResolver`](../../../initialization/runtimes/formula-name-resolver.ts) from Formula plus this exact service. Evaluated-value endpoints receive both objects.

## Public `StructuredData` methods

### Reads

| Method | Implementation | Logging |
|---|---|---|
| `bindingView()` | One `listAll`; map by normalized name; `viewRevision = max(entry.revision)`; random view ID | debug count/revision/duration |
| `get(id)` | Current-table lookup | none |
| `getByName(name)` | Trim name, case-insensitive current lookup | none |
| `list(kind?)` | Current-table list, optionally exact kind | none |
| `query(q)` | List, then text/context-overlap filters in memory | debug filter flags/count/duration |

### Shared mutations

| Method | Validation and mutation |
|---|---|
| `declare` | Validate/canonicalize name, check conflict and max count; validate body or complete collection schema/rows; UUID/revision 1 insert |
| `rename` | Load/check expected revision; validate name; case-insensitive conflict check unless normalized key unchanged; SQLite CAS update |
| `updateDescription` | Load/check expected revision; replace description; SQLite CAS update |
| `delete` | Load/check expected revision; archive snapshot `N`, append terminal `N + 1`, and remove current by SQLite CAS transaction |
| `purge` | Reject a current entry; require terminal deletion history; irreversibly remove retained history |
| `pruneHistory` / `purgeExpired` | Shared retention hooks for old current-entry snapshots and expired deleted entries |

### Kind-specific mutations

| Method | Validation and mutation |
|---|---|
| `updateBody` | Require formula/function entry; validate nonblank/byte-bound body; revision +1 CAS |
| `replaceSchema` | Require collection; validate complete replacement schema and every retained row under it; revision +1 CAS |
| `appendRows` | Require collection; validate only new payload plus final count; append; revision +1 CAS |
| `deleteRows` | Require collection; validate integer/unique/in-range indices and record cardinality; filter rows; revision +1 CAS |

`persistUpdate` calls the store CAS. If it loses, it reloads: absence becomes
`DataEntryNotFoundError`, otherwise the current revision becomes
`StaleDataRevisionError`. Startup's shared retention scheduler supplies the
cutoff. Defaults are 30 days and a 24-hour sweep interval, with one sweep
immediately after HTTP binds and per-capability failure isolation.

## Validation helpers

All are in [`validation.ts`](../validation.ts):

| Helper | Current responsibility |
|---|---|
| `canonicalizeDisplayName` / `normalizeDisplayNameKey` | Trim; then ASCII-case normalize to lowercase |
| `validateDisplayName` | String, nonblank, Formula identifier, non-reserved, configured byte limit |
| `validateDataKind` | Validate five data kinds; exported but service declaration branches directly instead |
| `validateFormulaBody` | String, nonblank, configured UTF-8 byte limit |
| `validateCollectionSchema` | Array, field limit, list cardinality, plain fields, hard-coded 256-byte Formula-compatible names, case-insensitive uniqueness, admitted kinds |
| `validateCollectionRows` | Array/count/record cardinality, plain rows, declared exact keys, admitted cells |
| `validateAppendRows` | Final count plus validation of only new rows |
| `validateDeleteIndices` | Array of unique, in-range integer indices; preserve one record row |

Null is accepted for every field kind. Formula cells are admitted by source shape/size and checked against expected field kind later by the resolver. Missing fields are omitted in storage and resolve as null.

## Formula name resolver

`FormulaNameResolverImpl` maintains a cached snapshot and an in-memory `issuesByEntryId` map. Cache identity hashes sorted `id:revision:displayName:kind` tuples. Because every supported content mutation increments revision, a changed body/schema/row invalidates the cache.

Every build iteratively calls two private groups:

- `resolveEntry`: parse/dependency/evaluate a variable/function, or delegate collection;
- `resolveCollection`: parse all formula cells, wait on missing bindings, evaluate cells, enforce expected kinds, and construct Formula list/record/table values.

`makeSnapshotFromBindings` records source IDs/revisions and a digest over normalized name, binding ID, owner revision, and value digest. Failures are logged and held as typed `FormulaResolutionIssue`; failed entries are absent from bindings.

## SQLite CAS and concurrency

All endpoint jobs use the concurrent queue. Update and delete correctness
therefore comes from SQLite transactions and `id + expectedRevision` current-row
predicates, not queue serialization. A second store/process with a stale
revision loses the CAS, which the service maps to a typed stale/not-found
outcome.

Declaration performs count/conflict reads before a plain insert. The case-insensitive unique index closes the name race, but the configured `maxEntries` check is not an atomic quota and can overshoot under competing declarations. A race-time constraint error maps through the generic 400 path.

## Logging and side effects

Successful mutations log IDs, kind/name where relevant, revisions/counts, and durations. `query` and `bindingView` log read metrics. Simple `get`, `getByName`, and `list` do not log at the capability layer. Resolver logs cache hits, built snapshots, and typed failures without logging Formula source text.

Structured Data has no cross-database write or compensation workflow. Shared
startup composition invokes its retention hooks; the capability owns no timer
or store close method itself.
