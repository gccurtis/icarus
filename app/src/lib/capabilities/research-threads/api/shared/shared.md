# Shared Research Thread Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-thread.ts`](require-thread.ts) | that a thread id names a thread in the caller's project, and that a caller learns nothing from the answer when it does not |
| [`require-anchor.ts`](require-anchor.ts) | that a thread never points out of its own project |
| [`as-thread.ts`](as-thread.ts) | that the stored row stops at the boundary, so a storage decision cannot reach the public contract |

## `requireThread`

`read` and `revise` both start with it. **It throws "not found", never
"forbidden"** — telling absence and someone else's apart confirms that a
conversation about something is happening.

Its return type is the stored row: its callers are inside this capability and
want the fields they are about to patch or convert.

## `requireAnchor`

`start` and `revise` both set an anchor, and it is promoted rather than copied
because the invariant spans them: a thread either stays inside its project or it
does not.

It has nothing to prove for a `discover` thread, which is the mode rather than a
skipped check — [`researchThreadAnchor`](../../types/research-thread.ts) has
already refused an anchor the mode does not name.

## `asThread`

`list` and `read` both return the public shape, and it is one procedure so that a
column added to the row cannot appear in one read and not the other.
