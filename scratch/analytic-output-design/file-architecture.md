# Analytic Output — file architecture

## Layout

Flat capability shape with `kebab-case` filenames, matching Context, Structured
Data, Findings, and Persona. The layered `domain/application/ports` shape is for
capabilities with a state machine and a large operation union; this one has a
record, an executor, and seven endpoints.

```text
apps/backend/src/
  3-capabilities/analytic-output/
    types.ts          AnalyticOutput, AnalyticDefinition, placements, filters,
                      views, materialization types, errors
    canonical.ts      definition and result digests
    validation.ts     ingress validation + view placement rules
    executor.ts       the nine-step order; pure, no I/O
    input-reader.ts   AnalyticInputReader port
    store.ts          AnalyticOutputStore port (synchronous)
    sqlite-store.ts   SQLiteAnalyticOutputStore
    analytic-output.ts createAnalyticOutput(store, inputReader, limits, logger)
    index.ts          barrel
    docs/             README, concepts, types, runtime, flows, invariants

  4-job-wiring/analytic-output/
    registerAnalyticOutputEndpoints.ts

  1-init/create/
    analyticOutput.ts
```

`executor.ts` is the file that matters. It is **pure**: frozen input value plus
definition in, result rows plus resolved view plus diagnostics out. No store, no
logger, no clock, no reader. Every rule in the canonical model's executor order
becomes a test that needs nothing but two literals.

That purity is also what makes `executorVersion` meaningful. A version number
attached to a function that reaches into a database describes nothing.

## Dependency direction

```text
types ◄── canonical, validation, executor, store, sqlite-store
             ▲
analytic-output.ts ──► store (port)
                   ──► input-reader (port)

input-reader implementation ──► #formula  (composition only)
```

Rules:

- **`executor.ts` imports only `types.ts`** and Formula's value helpers. It
  never imports the store or the reader.
- **The capability never imports `#structured-data`.** Project data arrives
  through `AnalyticInputReader`, whose only implementation lives in composition
  over the existing `FormulaNameResolver`. Structured Data owns declarations;
  Formula owns the resolver; this capability owns neither and should not be
  able to reach either directly.
- **Formula types are imported as types.** `FormulaWireValue` crosses the
  boundary as a value; the engine does not.

## Composition

```ts
// 1-init/create/analyticOutput.ts

export const createAnalyticOutputInstance = (
  config: BackendConfig,
  logger: Logger,
  deps: { resolver: FormulaNameResolver }
): AnalyticOutputCapability => {
  const store = new SQLiteAnalyticOutputStore(config.projectId, config.dataDir);

  // The reader is the only place that knows about Formula resolution.
  // Bindings are keyed by normalized display name, so locating a stored
  // bindingId is a scan of the snapshot rather than a map lookup.
  const inputReader: AnalyticInputReader = {
    async read(bindingId) {
      // FormulaNameResolver lives at 1-init/create/formula-name-resolver.ts
      // and exposes buildSnapshot(), per formula-resolution-design.md.
      const snapshot = await deps.resolver.buildSnapshot();
      for (const binding of snapshot.bindings.values()) {
        if (binding.reference.bindingId !== bindingId) continue;
        if (!isWireSerializable(binding.value)) {
          throw new AnalyticInputUnavailableError(bindingId, "not_serializable");
        }
        return {
          bindingId,
          displayName: binding.displayName,
          ownerRevision: binding.ownerRevision,
          valueDigest: binding.valueDigest,
          snapshotDigest: snapshot.snapshotDigest,
          value: toWire(binding.value)
        };
      }
      throw new AnalyticInputUnavailableError(bindingId, "unknown_binding");
    }
  };

  return createAnalyticOutput(store, inputReader, config.analytic, logger);
};
```

Construction order in `startBackend.ts`: after Structured Data and the Formula
resolver, before anything that reads analytic outputs. It has no internal jobs
and no scheduler involvement, so there is no registrar face to wire.

## Aliases

| alias | target |
| --- | --- |
| `#analytic-output` | `3-capabilities/analytic-output/index.ts` |
| `#analytic-output/*` | `3-capabilities/analytic-output/*` |

Both need explicit `development`, `types`, and compiled `default` conditions so
dev and tests select source rather than a stale `dist`.

## Tests

| File | Covers |
| --- | --- |
| `analytic-output-executor.test.ts` | the nine-step order, purely |
| `analytic-output-domain.test.ts` | validation, view rules, digests |
| `analytic-output-persistence.test.ts` | revision CAS, publish race, idempotency, retention |
| `analytic-output-wire.test.ts` | endpoint decoding, error → code mapping |

Executor cases worth writing first, because each encodes a decision that is
easy to reverse by accident:

- a filter removes rows **before** a sum, and the sum reflects it;
- a limit of 10 on a grouped result yields ten groups, not ten input rows;
- `mean` of exact `1/3` and `2/3` is exactly `1/2`, not `0.5000000000000001`;
- `countDistinct` treats `0.5` and `1/2` as one value;
- a `list` input normalises to one `value` field, a scalar to one row;
- a horizontal bar reverses the resolved view's X/Y without moving shelf items;
- an unresolvable field path produces a diagnostic materialization, not a throw.

Persistence cases:

- a stale `expectedRevision` changes zero rows and throws;
- a publish whose frozen revision no longer matches leaves the pointer alone
  and stores the materialization as unpublished;
- editing a definition leaves `latest_materialization_id` intact;
- a repeated `idempotencyKey` returns the first materialization.

Architectural regression test, in the style of the existing `runtime-wiring`
greps: no `#structured-data` import anywhere under
`3-capabilities/analytic-output/`.
