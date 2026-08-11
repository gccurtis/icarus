# src/lib/data/resources.ts — breakdown

Companion to [resources.ts](resources.ts). A data-layer barrel: it re-exports the
resources system so the legacy `$data/resources` import path keeps resolving after the
data-layer → systems migration. The Resource shape and kind vocabulary, the `resources`/
`availableKinds` stores, the cursor-paged catalog load, and the create/delete/rename
client that this file once held now live across `src/lib/systems/resources/`
(`types.ts`, `store.ts`, `api.ts`, `registry.ts`).

## Re-export

### Forward everything from the resources systems barrel

```ts
export * from '$systems/resources/index';
```

`$systems/resources/index` is the single resources surface, re-exporting the resource
types and kind helpers, the resource stores, the HTTP client, and the registry.
Re-exporting it here keeps existing `$data/resources` importers resolving unchanged while
the implementation lives under `src/lib/systems/resources/`.
