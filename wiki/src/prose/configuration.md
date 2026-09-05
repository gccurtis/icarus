## The files

Seven YAML files under `app/configuration/`, read once at startup by the server configuration object and merged into one frozen snapshot; a git-ignored `local.yaml` merges last and wins. Values come back as `unknown` and are read through `requiredString` and `requiredNumber`, which name the key in their error. What reads each file, from the code:

- `dev.yaml` — [[file:app/src/lib/runtime/server/scope.server.ts]]: the one identity and project handle that exist before authentication does.
- `observability.yaml` — the logger, in `model/server/observability`.
- `representation.yaml` — `representation.store.directory` is read by [[file:app/src/lib/model/server/store/constructor.ts]]; `representation.domains` is read by [[check:domain-graph-is-declared]]. The directory's README still lists this file under "declared, not yet read"; the code has moved on.
- `revisions.yaml` — the resource runtimes, through the published keys: flush after 50 ops or 2 s, re-read the leader every 5 s. The `resources.*` keys (rebase window, consolidation, history depth, checkpoint interval) are declared and not read by anything under `src/`.
- `workspace.yaml` — the workspace ledger: flush after 8 ops or 750 ms.
- `slide-deck.yaml` — the stage: 720 units high, 52 rem wide, zoom 50–200 in steps of 5, gutters 0.75–2.5 rem.
- `semantic-overlay.yaml` — the segmentation policy's seven numbers ([[page:/algorithms/semantic-overlay|explained]]). Nothing under `src/` reads it through the configuration object; the overlay demo's implementation page quotes the block as text, and the algorithm takes its `TranslationConfiguration` as an argument.

## What the browser sees

The client never receives the merged YAML. [[file:app/src/routes/app/[project]/+layout.server.ts]] publishes an allowlist, `PUBLISHED_KEYS`, rebuilt into the nested shape so `revisions.changeSets.flushAfterOps` is the same path on both sides; a key missing a value is omitted rather than published as `undefined`. Thirteen keys cross today, listed below with their current values.
