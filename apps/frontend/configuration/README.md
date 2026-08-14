# Configuration

Every `*.yaml` in this directory is read once at startup and merged into one
immutable snapshot. How that works — merge order, freezing, why values come back
as `unknown` — is documented beside the code that does it, in
[`src/lib/runtime/server/configuration/configuration.md`](../src/lib/runtime/server/configuration/configuration.md).

This file records only what is in the directory and which of it is live.

## Live

| File | Read by |
| --- | --- |
| `observability.yaml` | The logger: `logging.enabled`, `logging.level`, `logging.destination.*` |
| `persistence.yaml` | The project database registry: `persistence.directory` |
| `project.yaml` | Scope resolution: the single `projectId` and `userId` served before authentication exists |

## Not read by anything

Copied from the backend during the merge and kept rather than pruned, so
deleting them is a decision someone makes deliberately:

| File | Why it is dead |
| --- | --- |
| `server.yaml` | Describes Fastify's host, port, body limit, and request timeout. The Node adapter takes host and port from the environment. Its `workerPool` and `queue` sections describe a job scheduler that did not survive the endpoint layer, and had no reader even before that |
| `context.yaml` | No context capability exists |
| `document.yaml` | The document capability is designed, unbuilt, and reads none of these keys |
| `formula.yaml` | No formula capability exists |
| `intelligence.yaml` | No provider is called. Its comment promises that `OPENROUTER_API_KEY` in the environment "also works" — nothing reads any environment variable |
| `retention.yaml` | No reader |
| `rich-text.yaml` | Rich content hardcodes its limits |
| `structured-data.yaml` | No structured-data capability exists |

Several of these end with a comment introducing the *next* file alphabetically —
an artifact of the original one-file split, carried through the copy.

## local.yaml

Git-ignored, and merged last so it wins. It is where a real API key goes;
everything else here is tracked. Nothing currently reads a secret from it.
