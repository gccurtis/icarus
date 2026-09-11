## The files

Top-level YAML files under `app/configuration/` are read once at startup by the server configuration object and merged into one frozen snapshot. The git-ignored `local.yaml` merges after ordinary sections; an explicitly selected process overlay merges after that. Values come back as `unknown`; each consumer admits the current shape it requires and reports absent or malformed settings. There are no compatibility keys or fallback values. [[file:app/configuration/README.md]] records the live consumers:

- `dev.yaml` — [[file:app/src/lib/runtime/server/scope.server.ts]]: the one identity and project handle that exist before authentication does.
- `external-files.yaml` — native-byte storage and the upload, path, batch, and download admission bounds.
- `intelligence.yaml` — OpenRouter, grounded synthesis, provider limits, and Research execution policy.
- `observability.yaml` — the logger, in `model/server/observability`.
- `representation.yaml` — `representation.store.directory` is read by [[file:app/src/lib/model/server/store/constructor.ts]]; `representation.domains` is read by [[check:domain-graph-is-declared]].
- `revisions.yaml` — document, presentation, and spreadsheet submission and synchronization thresholds, through the published keys.
- `workspace.yaml` — workspace ledger submission thresholds.
- `presentation.yaml` — stage geometry, zoom bounds, and gutters.
- `semantic-overlay.yaml` — embedding construction, semantic translation/indexing, material description, and bounded native-image preparation ([[page:/algorithms/semantic-overlay|explained]]).

`category-readiness.yaml` is an executable architecture manifest, not a runtime feature setting. The JSON checker configuration and baseline are not merged by the YAML loader. Files in `overlays/` remain inert unless a process selects one explicitly.

## What the browser sees

The client never receives the merged YAML or provider credentials. [[file:app/src/routes/app/[project]/+layout.server.ts]] publishes an allowlist, `PUBLISHED_KEYS`, rebuilt into the nested shape so `revisions.changeSets.flushAfterOps` is the same path on both sides. Only resource/workspace submission thresholds, resource synchronization timing, and slide stage/zoom/gutter settings cross this boundary. A missing value is omitted; the client's required reader then reports the missing key rather than silently supplying a default.
