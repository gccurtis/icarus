# Shared Persona Thread Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-thread.ts`](require-thread.ts) | that a thread id names a thread in the caller's project, and that a caller learns nothing from the answer when it does not |
| [`as-thread.ts`](as-thread.ts) | that the stored row stops at the boundary, so a storage decision cannot reach the public contract |

## `requireThread`

`read`, `branch`, and `rename` all start with it. **It throws "not found", never
"forbidden"** — telling absence and someone else's apart confirms that a
conversation with somebody is happening.

**The project is the whole check.** Any member may read any thread, so there is
no author comparison here to forget, and adding one would invent a rule nobody
has asked for.

Its return type is the stored row: its callers are inside this capability and
want the fields they are about to patch or copy a persona from.

## `asThread`

`list` and `read` both return the public shape, and it is one procedure so that a
column added to the row cannot appear in one read and not the other.
