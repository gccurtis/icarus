# Shared Activity Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`record.ts`](record.ts) | that an entry is written by whoever did the thing, in the same transaction, with a timestamp and a label it did not choose |

## `record`

Its callers are other capabilities rather than functions of this one, which is
unusual and correct: activity is the thing every capability writes to and none
owns. `access` has the mirror case — `resolveScope` is called only from the
deployment root.

**It is not registered anywhere.** The `api/` set and the deployment door name
the same functions, and `record` is in neither, because a client that can append
to the log makes the log worthless as evidence.

`at` is stamped inside, and a `user` or `system` label is resolved inside. Both
are refusals to trust the writer about the record of its own writing. The three
remaining actor kinds name tables that arrive in passes 7 and 8; until then their
label must be supplied, and an entry with no legible actor throws rather than
storing a blank name — the caller is another capability, so that is a programming
error and failing the mutation is how it gets found.
