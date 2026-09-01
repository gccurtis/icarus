# Tab Views Methods

Lives at `methods/methods.md`.

Two, and the rest of the surface is one call to `patch` with a different slice.

| File | Effect | Description |
| --- | --- | --- |
| `of.ts` | accessor | The view for an id, or a throw naming the id |
| `patch.ts` | mutator | Replace an entry with itself plus a change |

`patch` is where copy on write lives. It reads through `of`, so a write to an id
that was never stored fails the same way a read does rather than quietly creating
a half-built view out of the change it was handed.

There is no `shared/`. `of` is used by `patch` and by the definition, which makes
it a method with two callers rather than a step two methods both take.
