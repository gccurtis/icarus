# 01 · Layers and Boundaries

## The numbered-directory system

The directory names under `apps/backend/src` carry a numeric prefix. This is the single most
important structural convention in the repo, and it is doing two jobs at once:

1. **It encodes dependency direction.** Imports are meant to point from a higher number to a
   lower one (with one deliberate exception, below).
2. **It makes violations visible in a file listing.** You do not need a lint rule to notice
   that `0-platform/knowledge` importing from `3-capabilities/document` would be wrong — the
   numbers read backwards.

```text
0-platform  ─┐
0-utils     ─┴─→  1-init  ─→  2-transport
                     │             │
                     ├─→ 4-job-wiring ─→ 3-capabilities
                     └─→ 3-capabilities
```

| Layer | Owns | May import |
| --- | --- | --- |
| `0-platform` | Reusable in-process runtimes: Formula, Rich Text, Knowledge, Intelligence, Logger, the Knowledge SQLite adapter | Node stdlib, provider adapters behind its own ports, `0-utils` types |
| `0-utils` | Config loading, `RequestEnvelope`, Job types, `JobRegistry`, `JobScheduler`, internal-job runtime | Node stdlib, narrow third-party utilities |
| `1-init` | Composition root: construction order, DI, startup lifecycle, cross-capability adapters | Everything concrete |
| `2-transport` | The Fastify wildcard handler and envelope normalisation | Request types + registry/scheduler interfaces |
| `3-capabilities` | Domain types, invariants, application services, owned ports, persistence, projections | Platform interfaces, shared primitives, other capabilities' *public* types |
| `4-job-wiring` | Exact method/path → Job factory mappings, wire validation, queue/response choice, internal-stage intents | Capability public ports, Job primitives |

Both `0-platform` and `0-utils` are level 0 — they are peers, not ordered relative to each
other. `0-platform` holds *runtimes injected into capabilities*; `0-utils` holds
*transport-neutral primitives*. `0-platform` code does import `0-utils` types (e.g.
`knowledge` has no `0-utils` dependency, but the pattern is permitted).

The two authoritative statements of this scheme are
[`docs/runtime/repository-boundaries.md`](../runtime/repository-boundaries.md) and
[`docs/runtime/backend-map.md`](../runtime/backend-map.md). They call the numbering the
"placement laws" and describe the whole thing as one composition graph.

### Why 4 sits above 3 in number but below it in the call graph

`4-job-wiring` calls into `3-capabilities`, so by the "higher imports lower" rule it should
be numbered lower. The numbering instead reflects **construction order and adaptation
distance**: job wiring is the outermost adapter, furthest from the domain, and it is
registered last during startup. `repository-boundaries.md` draws the flow explicitly as
`2-transport → 4-job-wiring → 3-capabilities`. Read the numbers as "distance from the
domain core", not strictly as import direction.

## Subpath import aliases

Deep relative imports are banned in favour of Node subpath imports declared in
`apps/backend/package.json` `imports` and mirrored in `tsconfig.json` `paths`. Two families:

**Layer aliases** — one per layer, wildcard only:

```text
#platform/*  #utils/*  #init/*  #transport/*  #capabilities/*  #job-wiring/*
```

**Module aliases** — a bare specifier plus a wildcard, for modules with a curated barrel:

```text
#formula  #rich-text  #structured-data  #context  #derived-outputs
#activity  #document  #general-files  #connector
```

The bare form (`import { … } from "#document"`) resolves to that module's `index.ts` barrel;
the wildcard form (`#document/domain/model.js`) reaches inside. Note both forms exist for
each, and the codebase uses the bare form for cross-module imports and the wildcard form for
intra-module and occasional deep access.

**Not every module has a bare alias.** `#capabilities/slide/index.js` is imported by its full
layer path because Slide has no dedicated alias yet; likewise Knowledge, Intelligence, and
Observability are reached via `#platform/knowledge/knowledge.js` etc. There is a live
regression test that specific aliases exist (`runtime-wiring.test.ts` asserts
`#general-files`, `#connector` and their wildcards are present) — added because a missing
alias only fails at runtime in the built output.

All imports carry the `.js` extension even in `.ts` source, because `moduleResolution` is
`NodeNext`.

## The one deliberate inversion

`3-capabilities/context/types.ts` re-exports `ContextEntry` **from
`0-platform/knowledge/types.ts`**, with an explicit comment:

```ts
// ContextEntry is defined in knowledge/types.ts (the platform layer that needs it).
// Context imports it from there to avoid duplicating the atom.
```

So the shared atom lives at the *lower* layer that consumes it, and the owning capability
imports it upward-in-name but downward-in-layer. This is consistent with the shared-contract
rule: put the type where the dependency direction stays legal, and let the owner re-export.
`structured-data` and `derived-outputs` then import `ContextEntry` from `#context/types.js`,
so the ownership story stays readable at call sites.

## Cross-capability dependency rule: narrow inbound ports

A capability never imports another capability's service class or persistence. It declares
**the narrow interface it needs**, in its own `ports/` directory, and composition supplies
something that satisfies it structurally.

Document is the clearest example. It declares four external ports:

| Port | Shape | Satisfied by |
| --- | --- | --- |
| `ports/documentStore.ts` | The full store contract Document owns | `SQLiteDocumentStore` |
| `ports/derivedOutputs.ts` | 6 methods of `DerivedOutputService` | The real Derived Outputs service, passed as-is |
| `ports/formulaResolver.ts` | **One** method: `buildSnapshot()` | `FormulaNameResolver` (which has 2 methods) |
| `ports/activityPublisher.ts` | **One** method: `publish(fact)` | An adapter built in `1-init/create/document.ts` |

`DocumentFormulaResolver` narrowing a 2-method interface to 1 is the pattern in miniature:
Document states exactly what it consumes, and can be tested with a one-method double.

The Activity port goes further — it is a *translation* seam. Document publishes its own
`DocumentCommittedFact` (with Document's origin vocabulary: `interactive | agent |
automation`); the adapter in `1-init` maps that to Activity's `ActivityTransaction` (origin
`user | agent | automation | system`, with `interactive → user`). Neither capability knows
the other's vocabulary. Activity's own docs state this plainly: *"The Activity package
deliberately has no dependency on Document, Slide, Connector, General, or another producing
kind."*

## The composition root

[`1-init/startBackend.ts`](../../apps/backend/src/1-init/startBackend.ts) is 173 lines and is
the only place where concrete wiring happens. Its construction order is load-bearing and
commented as such:

```text
config → logger
  → activity                (first: no resource dependency, but resources publish into it)
  → intelligence
  → contextManager → resourceRegistry   (registry composed empty, populated later)
  → knowledge(resourceRegistry)
  → formula → structuredData → formulaResolver
  → richText
  → generalFiles, connector
  → resourceRegistry.registerGeneralFiles(...) / registerConnector(...)   ← back-fill
  → derivedOutputs(knowledge, intelligence, resourceRegistry)
  → knowledge.onSourceMutation(→ derivedOutputs.recordKnowledgeSourceMutation)
  → app, scheduler, registry
  → documentJobs / slideJobs (SchedulerInternalJobsRuntime)
  → document(…, documentJobs) → registerDocumentInternalJobs
  → slide(…, slideJobs)       → registerSlideInternalJobs
  → register*Endpoints × 8
  → document.recoverPendingAttempts() / publishPendingActivity() / slide.recoverPendingAttempts()
  → syncScheduler = new ConnectorSyncScheduler(...)
  → registerHttpTransport(app, …)
  → await app.listen(...)
  → syncScheduler.start()        ← only AFTER listen succeeds
```

Two comments in that file explain non-obvious ordering decisions, and both are worth
preserving:

- Activity is built first *"before resource integrations eventually publish their accepted
  transactions into it"*.
- `syncScheduler.start()` is deliberately after `app.listen`: *"Otherwise a listen failure
  would leave interval timers keeping the failed startup process alive."* There is a
  source-scanning regression test asserting the `syncScheduler.start()` call appears after
  `await app.listen` in the file text.

### The mutable-during-composition escape hatch

`resourceRegistry` (from `1-init/create/resource-reader.ts`) is a genuine two-phase
construction: Knowledge needs a `KnowledgeResourceResolver` before General Files and
Connector exist, so the registry is created empty and back-filled. Its type is documented
honestly:

```ts
/**
 * Mutable only during composition. Once startup registers the concrete
 * capabilities, callers use this object through the narrow ResourceReader and
 * KnowledgeResourceResolver interfaces.
 */
export type RuntimeResourceRegistry = ResourceReader & KnowledgeResourceResolver & {
  registerGeneralFiles(service: GeneralFileService): void;
  registerConnector(service: ConnectorService): void;
};
```

This object is architecturally significant: it is the **single place** that translates
Context leaf entries into Knowledge source IDs, and the single place that enforces
scoped-read authorisation for Derived Output tools (its `read()` refuses any resource not
present in the frozen scope manifest, logging `resources.read.denied`).

### `1-init/create/` is not all trivial factories

Most files there are 10–20 line constructors. Two are not:

- `formula-name-resolver.ts` (438 lines) — an **adapter**, not a factory. It resolves every
  Structured Data entry into a `FormulaResolverSnapshot` using iterative fixpoint passes
  bounded by entry count, classifies failures into typed issues (`parse_error`,
  `cycle_error`, `unresolved_dependency`, …), and caches by an entries signature. It lives in
  `1-init` because it points *from* Structured Data *toward* Formula, and neither package may
  depend on the other. Formula's own docs state: *"Formula does not import Structured Data;
  the initialization-layer adapter points from Structured Data toward Formula."*
- `resource-reader.ts` (281 lines) — the cross-capability registry described above.

If you find yourself writing cross-capability translation logic, `1-init/create/` is where it
belongs.
