# Architecture — Icarus Runtime Foundation & Repository Boundaries

> Mirrored from [Notion](https://app.notion.com/p/3adb6410e50281e09d83ed36daacf8d8).

> **Repository authority.** These boundaries describe the numbered layout on the pushed Icarus backend.
## Bottom line
The backend is one composition graph with five numbered layers. Platform services and capabilities expose typed in-process interfaces. Transport and job wiring are adapters around those interfaces. Logical build groups organize implementation order without adding runtime wrapper services or directories.
```plain text
0-platform and 0-utils
        ↓
1-init composition
        ↓
2-transport request capture
        ↓
4-job-wiring request-to-job mapping
        ↓
3-capabilities application ports
```
Dependency arrows in source code point toward lower-level contracts: domain code never imports transport, scheduler, or provider SDKs.
## Backend repository
```plain text
apps/backend/
  etc/
    configuration.yaml
  src/
    0-platform/
      database/
      formula/
      intelligence/
      knowledge/
      observability/
      web-retrieval/
    0-utils/
      config/
      jobs/
      types/
    1-init/
      create/
      startBackend.ts
    2-transport/
      registerHttpTransport.ts
    3-capabilities/
      <capability>/
    4-job-wiring/
      internal/
      <capability>/
  test/
```
## Layer responsibilities
<table fit-page-width="true" header-row="true">
<tr>
<td>Layer</td>
<td>Owns</td>
<td>Imports</td>
</tr>
<tr>
<td>`0-platform`</td>
<td>Reusable runtime implementations and interfaces: Intelligence, Formula, Knowledge, Logger, database adapters</td>
<td>Standard libraries, provider adapters behind platform ports, `0-utils` types</td>
</tr>
<tr>
<td>`0-utils`</td>
<td>Configuration loading, request envelope, Job types, registry, scheduler primitives</td>
<td>Standard libraries and narrow third-party utilities</td>
</tr>
<tr>
<td>`1-init`</td>
<td>Concrete construction order, configuration binding, dependency injection, migration startup, server lifecycle</td>
<td>Every concrete component needed for composition</td>
</tr>
<tr>
<td>`2-transport`</td>
<td>Fastify wildcard handler and conversion to `RequestEnvelope`</td>
<td>Request types, registry/scheduler interfaces</td>
</tr>
<tr>
<td>`3-capabilities`</td>
<td>Domain types, invariants, application services, owned ports, persistence adapters, migrations, rebuildable indexes</td>
<td>Platform interfaces and shared primitives</td>
</tr>
<tr>
<td>`4-job-wiring`</td>
<td>Exact endpoint mappings, request validation, Job factories, queue/response selection, internal-stage dispatch</td>
<td>Capability public ports and Job primitives</td>
</tr>
</table>
## Platform placement
A component belongs under `0-platform` when it is a reusable runtime interface called by capabilities and has no direct product endpoint requirement. Intelligence, Formula, and Knowledge follow this rule.
```plain text
0-platform/formula
  pure evaluation engine

0-platform/intelligence
  provider-neutral model interface and provider adapters

0-platform/knowledge
  grounded ingest and retrieval interface
```
Construction factories live under `1-init/create/` and return the public Platform interface. Capabilities receive those interfaces through dependency injection.
## Capability placement
A regular capability lives directly under `3-capabilities/<name>/`:
```plain text
3-capabilities/<name>/
  domain/
    model.ts
    operations.ts
    validation.ts
    errors.ts
  application/
    service.ts
  ports/
    store.ts
    dependencyPorts.ts
  persistence/
    migrations.ts
    sqliteStore.ts
  indexes/
  index.ts
```
Small atomic capabilities may keep these files at the capability root. Large editor capabilities separate `domain`, `application`, `ports`, `persistence`, and `indexes`. The ownership rule remains the same.
Capability code owns:
- canonical records or aggregates;
- stable identifiers and revisions;
- validation and normalized representation;
- a closed mutation vocabulary;
- pure reduction and inverse generation where ChangeSets apply;
- narrow inbound and outbound ports;
- table definitions, migrations, constraints, and indexes;
- rebuildable projections derived from canonical state.
## Job-wiring placement
```plain text
4-job-wiring/<capability>/
  register<Capability>EndpointMappings.ts
  create<Capability>Jobs.ts
  <capability>JobPayloads.ts
```
Endpoint registration performs exact method/path mapping. A Job factory validates the envelope, closes over the capability service, and returns a fresh `JobDefinition` with static `queueType` and `responseMode`.
```typescript
interface JobDefinition<TResponse = unknown> {
  id: string;
  queueType: "serial" | "concurrent";
  responseMode: "inline" | "deferred";
  execute(signal?: AbortSignal): Promise<TResponse>;
}
```
Internal compute and settlement work follows the same rule. A capability application service returns a typed stage intent; `4-job-wiring/internal` converts that intent into another Job.
## Scope seam
Runtime scope is configuration, not a capability or request router. Initialization constructs bound stores and injects them into Platform services and capabilities. The exact configuration contract lives on [Icarus Runtime Scope Configuration](../platform/runtime-scope.md).
```typescript
export function createDocument(
  config: BackendConfig,
  dependencies: DocumentDependencies,
  logger: Logger
): DocumentCapability {
  const store = createDocumentStoreFromRuntimeConfig(config);
  const attribution = createRuntimeAttribution(config);

  return createDocumentCapability(
    store,
    dependencies,
    attribution,
    logger
  );
}
```
This configuration usage stays in `1-init`. The returned capability methods accept document IDs, revisions, and typed commands.
## Shared-contract rule
A type remains capability-owned unless two or more runtime or frontend consumers require the same semantic contract.
- Formula value, diagnostic, resolver, and expression types belong to Formula.
- `ContextEntry` belongs to Context and is re-exported for Knowledge and capability prompts.
- `ProjectTargetRef` and the closed target-kind vocabulary belong to Project and are consumed through public contracts.
- Document, Slides, and Spreadsheet target types belong to their owning editors.
- Request envelope and Job primitives belong to `0-utils`.
- Browser-shared DTOs may be exported through the existing shared package when both backend and frontend import them.
Sharing a type does not transfer ownership of the underlying data. Consumers import or structurally satisfy the public contract and retain their own persistence.
## Dependency rules
- Domain modules are pure and deterministic.
- Application services sequence ports, idempotency, history admission, and async stages.
- Persistence implements the capability-owned store interface.
- Capability A consumes capability B through the narrow interface A needs; it does not import B's persistence.
- Platform services do not import product capabilities.
- Transport performs no domain mutation.
- Job wiring performs no domain reduction.
- Logger calls cannot change domain outputs.
- Rebuildable indexes never become sources of truth.
## Capability addition pattern
1. Complete **Summary / Concept**, including prerequisites, authority, build position, and runtime placement.
2. Freeze **Types & Interfaces** for domain values, commands, queries, results, errors, and narrow ports.
3. Define **Runtime Objects** and the `1-init/create/<name>.ts` construction factory.
4. Implement the closed **Change Operations**, revision behavior, receipts, ChangeSets, and async stage intents.
5. Register **Endpoints** through exact method/path mappings.
6. Add **Jobs** under `4-job-wiring/<name>`, including queue, response, called port, emitted operations, and continuations.
7. Implement and validate **SQL Tables**, migrations, repository transactions, constraints, and indexes.
8. Register mappings in `startBackend.ts` after every prerequisite has been constructed.
9. Verify domain tests, store-contract tests, endpoint mapping, queue choice, retry behavior, projection rebuilds, and restart recovery.
## Verification
```plain text
configuration
  -> bound stores
  -> Platform services
  -> capability services
  -> endpoint Job factories
  -> generic transport
  -> scheduler queues and worker pool
```
A valid implementation can be read in that direction without hidden service locators, implicit sibling imports, or request-selected persistence.
