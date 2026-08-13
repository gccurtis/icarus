# Reference Documentation

Documents under this directory describe earlier backend designs and
implementations. They are retained for historical context. They are not the
authority for any code that runs today.

They name source files in prose rather than linking to them. The files they
describe are not where these documents were written to expect: the paths they
used no longer exist, and the frozen copy in `reference/` is explicitly not a
library — it is a record that will rot and can be deleted without losing
anything permanent. Linking live documents into it would create a dependency on
something slated to disappear, so a file that can no longer be reached is named
and not linked. The only links that remain are between these documents
themselves.

The current design of a capability lives inside the capability itself:
`overview.md` at its root, and a document named after every directory below it.
See [`../capability-directory/capability-directory.md`](../capability-directory/capability-directory.md).

## Archived Capabilities

Each entry is the six-file set — `README`, `concepts`, `flows`, `invariants`,
`runtime`, `types` — that documented the implementation now frozen in
[`reference/`](../../../../reference/README.md).

| Capability | Why it is here |
| ---------- | -------------- |
| [Built-in](capabilities/built-in/README.md) | Described the `JobRegistry`/`JobScheduler` queue that `GET /health` and `POST /echo` ran on. The queue moved to `reference/workflows/`; the endpoints are now plain endpoint-jobs. |
| [Data Manager](capabilities/data/manager/README.md) | Superseded by the capability's own documents when it moved onto the directory template. |
| [Intelligence](capabilities/platform/intelligence/README.md) | Designed but never built in this tree. Retained because the design is the starting point whenever it is picked up. |
| [Rich Text](capabilities/resource-support/rich-content/README.md) | The predecessor to Rich Content, which owns canonical content objects rather than an editor representation. |
