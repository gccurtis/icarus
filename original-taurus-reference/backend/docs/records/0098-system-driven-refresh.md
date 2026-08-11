# System-driven refresh + attribution (live-document Slice G)

The seventh slice of the live-document program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md);
plan: [`docs/superpowers/plans/2026-07-26-system-driven-refresh.md`](../superpowers/plans/2026-07-26-system-driven-refresh.md)).
When a connector sync changes a source, the server refreshes every dependent
prompt block itself.

## What changed

- **`connector.Cascader`** port — `RefreshDependents(projectID, sourceType, sourceID)`
  — plus `Connectors.cascader` + `UseCascader`. `applySync` calls it after a
  successful, changed sync (best-effort, off the result), so it fires exactly on
  change and never on a no-op. The connector depends only on this abstract port —
  not on `document` or the job queue.
- **`refreshCascader{docs, queue}`** in `core/wiring` implements it: map the
  synced connector to a `document.ScopeOrigin`, ask `Documents.DependentPrompts`
  (Slice F) who depends on it, and enqueue a `document.resolve` job (mode
  `reload`) per dependent — the same payload the transport's resolve route uses.
- **Wiring** injects `refreshCascader{docs, queue}` into the connector service.

## Attribution and logging come for free

Prompt resolution is already authored by the **system actor** (`prompt.go`
`systemAuthor`) and writes back through the normal changeset pipeline, which
emits the Activity edit event. So a cascade-driven refresh is an accountable
journal entry with no new attribution code — the resolve job the cascade enqueues
is byte-for-byte the one a user triggers.

## Best-effort

A cascade error (dependents query or enqueue) is logged and swallowed; it never
propagates into the sync that triggered it, so surfacing new content never breaks
ingestion.

## Verification

- Unit (`core/capability/connector`, deterministic): the cascader fires once on a
  changed sync and not on a no-op sync.
- Unit (`core/wiring`, deterministic): `refreshCascader` enqueues exactly one
  `document.resolve` reload job per dependent with the right payload, and nothing
  for a source with no dependents.
- End-to-end (folder change → block re-resolves on its own → Activity shows a
  system-attributed edit) is a live, model-backed path, exercised in the
  end-to-end demo (Slice I), not with a stubbed model.

## Settled

- A changed source drives refresh of its dependents server-side, via the
  reference graph (Slice F). ✓
- Refresh is system-attributed and Activity-logged by reusing the existing
  resolve path — no new attribution code. ✓
- Best-effort: the cascade never fails a sync. ✓
- Parked (spec non-goal): the frontend "updating in progress" hold-state UX and
  continuous no-viewer polling cadence.
