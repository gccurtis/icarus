# Access Types

Lives at `types/types.md`.

`types/` holds the canonical model and the public contract. It contains no stored
row shapes: a row carries `_id`, `_creationTime`, and a `subject` that no consumer
should have to know about.

## Files

| File | Holds |
| --- | --- |
| [`access.ts`](access.ts) | `Scope`, `Role`, and the three development constants |

`Scope` lives here rather than in `$convex/functions` because it is a statement
about the model — who is asking and about what — and because every capability in
the application imports it while only the gate constructs one.

The `DEVELOPMENT_*` constants are here for one reason: `resolveScope` reads them
and `seed` writes rows matching them, and a value two procedures must agree on
belongs where both can see it rather than in either.
