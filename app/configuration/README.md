# Configuration

Every `*.yaml` in this directory is read once at startup and merged into one
immutable snapshot. How that works — merge order, freezing, why values come back
as `unknown` — is documented beside the code that does it, in
[`src/lib/model/server/configuration/configuration.md`](../src/lib/model/server/configuration/configuration.md).

This file records only what is in the directory and which of it is live.

## Live

| File | Read by |
| --- | --- |
| `dev.yaml` | Scope resolution: `development.userId`, `development.projectId`, `development.projectToken` — the one identity that exists before authentication does |
| `observability.yaml` | The logger: `logging.enabled`, `logging.level`, `logging.destination.*` |

## Written ahead of their reader

| File | Read by | Lands in |
| --- | --- | --- |
| `revisions.yaml` | `revisions` — rebase window, consolidation interval, retention depth | pass 2 |
| `knowledge.yaml` | `knowledge` — windowing, clustering, descent | pass 6 |

These two are the exception to the rule below, and they are deliberate: both hold
numbers the [data models](../../docs/data-models/) refuse to carry, so writing
them down was part of settling the model rather than part of building the
capability. Both say in their own comments that the values are starting points
rather than measured ones.

**Nothing else here is unread.** Eight files were carried over from the deleted
backend and read by nothing — limits for capabilities that do not exist,
Fastify's host and port, and an intelligence provider nothing calls. They were
removed when the two applications became one, rather than left to be mistaken for
settings that take effect. The lesson that produced this section is that a file
nobody reads is indistinguishable from one that does not work.

## local.yaml

Git-ignored, and merged last so it wins. It is where a real secret goes;
everything else here is tracked.
