# External Files API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — one project's files |
| [`ingest/`](ingest/ingest.md) | `ingest` | mutation — records an arrived file |
| [`record-extraction/`](record-extraction/record-extraction.md) | `recordExtraction` | mutation — keeps what was read out of one |
| [`remove/`](remove/remove.md) | `remove` | mutation — deletes a file and its bytes |
| [`shared/`](shared/shared.md) | — | `requireFile`, which three of the four start with |

## One `ingest` rather than an upload and a sync

The four origins differ in what they carry, not in what happens next: the bytes
are already stored, the name decides the kind, and the row is written the same
way. Splitting them would produce four functions differing by a literal, each
free to drift on the parts that must not.

What differs is what a caller may claim. The door fixes the origin at `upload`,
because that is the only one a browser can honestly make; the other three arrive
with server-side callers in later passes.

## No `rename`

A file's metadata describes bytes that cannot change, so there is no edit to a
file — only a new file that supersedes it. `ingest` with `supersedes` is that,
and it is why this capability has three mutations rather than four.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). `ingest` names how the file got
here — `uploaded`, `synced`, `generated`, `captured` — because that is the part a
reader of the log cannot reconstruct.
