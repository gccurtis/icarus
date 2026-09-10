# Configuration

Every top-level `*.yaml` in this directory is read once at startup and merged into one
immutable snapshot. How that works — merge order, freezing, why values come back
as `unknown` — is documented beside the code that does it, in
[`src/lib/model/server/configuration/configuration.md`](../src/lib/model/server/configuration/configuration.md).

This file records only what is in the directory and which of it is live.

## Runtime configuration

| File | Read by |
| --- | --- |
| `dev.yaml` | Scope resolution: `development.userId`, `development.projectId`, `development.projectToken` — the one identity that exists before authentication does |
| `external-files.yaml` | External native-byte storage plus upload, path, batch, and download admission bounds |
| `intelligence.yaml` | The OpenRouter model, provider limits, grounded synthesis, and research-chat execution policy |
| `observability.yaml` | The logger: `logging.enabled`, `logging.level`, `logging.destination.*` |
| `representation.yaml` | Store construction reads `representation.store.directory`; the architecture checker reads the declared representation-domain graph |
| `revisions.yaml` | Document, deck, and spreadsheet runtimes read the published submit and synchronization thresholds |
| `semantic-overlay.yaml` | Embedding construction, semantic translation/indexing, material description, and bounded native-image preparation |
| `slide-deck.yaml` | The slide runtime's stage geometry, zoom bounds, and gutters |
| `workspace.yaml` | The workspace runtime's durable-change submission thresholds |

`category-readiness.yaml` is an executable architecture manifest rather than a
runtime feature setting. The authoritative-data checker requires one exact
readiness state for every category. Like every top-level YAML file, it is present
in the merged snapshot, but no runtime feature consumes it. The JSON files
`architecture-checkers.json` and `architecture-baseline.json` belong only to the
checker runner and are not merged by the YAML configuration loader.

There are no compatibility keys or fallback values. Each consumer owns exact
admission for the current key it reads and fails startup or the request when the
key is absent or malformed. Removing or renaming a setting therefore means
changing its only current consumer at the same time, never adding an alias or a
migration reader.

## local.yaml

Git-ignored, and merged after the ordinary sections so it wins. It is where a
real secret goes; everything else here is tracked.

## Process overlays

Files under `overlays/` are never merged implicitly. A process may opt into one
with `ICARUS_CONFIGURATION_OVERLAY=overlays/<name>.yaml`. The path is confined to
one file directly inside that directory, and the selected file merges after
`local.yaml`. This is for isolated process infrastructure such as deterministic
browser providers; it is not a second local-configuration mechanism.
