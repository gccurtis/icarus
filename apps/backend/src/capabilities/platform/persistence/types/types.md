# Persistence Types

Lives at `types/types.md`.

`types/` holds the database type every capability parameterizes Kysely with. The
runtime object's own interface, `DatabaseRuntime`, is declared with the class
implementing it in
[`runtime-objects/database/definition.ts`](../runtime-objects/database/definition.ts).

## Files

| File | Holds |
| ---- | ----- |
| `database.ts` | `BackendDatabase`, the interface capabilities augment with the tables they own |

## Public Types

### Type: `BackendDatabase`

The set of tables in the backend's database, expressed as one Kysely database
interface. It is declared empty here and stays empty: a capability adds its
tables by augmenting this module beside its own schema.

```ts
export interface BackendDatabase {}
```

A capability holding a `Kysely<BackendDatabase>` therefore sees every table in
the runtime, including tables it does not own. That is deliberate — one client,
one transaction scope — and the cross-capability import rule, not the type, is
what keeps a capability out of another's tables.

Augmentation targets this file, because declaration merging applies to the
module that declares the interface, not to `index.ts` which re-exports it:

```ts
declare module "#capabilities/platform/persistence/types/database.js" {
  interface BackendDatabase {
    rich_content: RichContentTable;
  }
}
```
