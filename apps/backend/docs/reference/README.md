# Reference Documentation

Documents under this directory describe earlier backend designs and
implementations. They are retained for historical context. They are not the
authority for any code that runs today, and they are not maintained — their
internal links point at files that have since moved or been deleted.

The current design of a capability lives inside the capability itself:
`overview.md` at its root, and a document named after every directory below it.
See [`../capability-directory-redesign.md`](../capability-directory-redesign.md).

## Archived Capabilities

Each entry is the six-file set — `README`, `concepts`, `flows`, `invariants`,
`runtime`, `types` — that documented the implementation now frozen in
[`reference/`](../../reference/README.md).

| Capability | Why it is here |
| ---------- | -------------- |
| [Built-in](capabilities/built-in/README.md) | Described the `JobRegistry`/`JobScheduler` queue that `GET /health` and `POST /echo` ran on. The queue moved to `reference/workflows/`; the endpoints are now plain endpoint-jobs. |
| [Data Manager](capabilities/data/manager/README.md) | Superseded by the capability's own documents when it moved onto the directory template. |
| [Intelligence](capabilities/platform/intelligence/README.md) | Designed but never built in this tree. Retained because the design is the starting point whenever it is picked up. |
| [Rich Text](capabilities/resource-support/rich-content/README.md) | The predecessor to Rich Content, which owns canonical content objects rather than an editor representation. |
