# Tab List Methods

Lives at `methods/methods.md`.

Four, and each is a single write against the two fields the definition holds.
The three lookups — `at`, `find`, `indexOf` — stay on the definition, because a
file per one-line read would be four more files saying nothing.

| File | Effect | Description |
| --- | --- | --- |
| `mint.ts` | mutator | Advances the counter and returns a record. Adds nothing to the strip |
| `add.ts` | mutator | Splices a record in, clamped into range, and returns the index |
| `remove.ts` | mutator | Splices one out by id, and returns where it was |
| `activate.ts` | mutator | Moves the cursor, if the id names a tab |

`add` clamps rather than refusing, because the index it is given comes from an
inverted `close` — a position recorded when the strip was one longer, which is a
valid request for the end of the strip rather than an error.

There is no `shared/`. Nothing here is used by two of the others.
