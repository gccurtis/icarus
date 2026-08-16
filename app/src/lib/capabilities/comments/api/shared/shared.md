# Shared Comments Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-thread.ts`](require-thread.ts) | that a thread id names one in the caller's project |

`reply`, `edit`, `resolve`, and `reopen` all start with it, which is what makes it
shared rather than one function's own.

## Not found, never forbidden

A thread in another project answers exactly as one that never existed. The
disclosure is worse here than on a document: telling the two apart would confirm
that a discussion about something is happening, which is a fact about people
rather than about storage.

`requireComment` is **not** here — it has one caller, `edit`, and it lives in that
directory. It also decides access from the comment's own `projectId` rather than
the thread's, which is the whole reason that column exists.
