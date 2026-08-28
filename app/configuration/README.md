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
| `revisions.yaml` | Resource runtimes, through the client configuration: `revisions.changeSets.*` |

Eight further files were carried over from the deleted backend and read by
nothing — limits for capabilities that do not exist, Fastify's host and port, and
an intelligence provider nothing calls. They were removed when the two
applications became one, rather than left to be mistaken for settings that take
effect.

One of them is worth knowing about: `rich-text.yaml` named
`maxAtomsPerContent`, `maxMarksPerContent`, and `maxMarkRangeSpan`. **Rich
Content does not enforce any of them**, and did not before either. If those
bounds are wanted they belong in that capability's admission, not in a file
nothing reads — see
[`rich-content/overview.md`](../src/lib/capabilities/rich-content/overview.md).

## Declared, not yet read

| File | Waiting on |
| --- | --- |
| `representation.yaml` | `representation.store.directory` — the store is still built from a constant in `store.server.ts`. This is what the server model's store object will be handed once that object exists. |

One entry, and it should stay a short list. A setting nothing reads is
indistinguishable from a setting that does not work, which is why the eight
above were deleted rather than kept. This one is here because the alternative was
a literal path to find and replace later, and it says so in the file itself.

## local.yaml

Git-ignored, and merged last so it wins. It is where a real secret goes;
everything else here is tracked.
