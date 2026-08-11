# Reference graph: which prompt blocks depend on a source (live-document Slice F)

The sixth slice of the live-document program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md);
plan: [`docs/superpowers/plans/2026-07-26-reference-graph.md`](../superpowers/plans/2026-07-26-reference-graph.md)).
It answers "which prompt blocks depend on source X?" — the query the refresh
cascade (Slice G) needs.

## What changed

- **`Documents.DependentPrompts(projectID, origin ScopeOrigin) ([]PromptLocation, error)`**
  — returns every prompt block in the project whose resolved context scope
  (`resolveBlockScope`, Slice E) includes the origin.
- **`PromptLocation{DocumentID, BlockID}`** — the cascade's unit of work.

## Why it's a read, not an index

A prompt block depends on exactly the sources in its resolved scope (Slice E's
`includes − excludes`). So the dependency graph is **derivable** from data we
already store — there is no separate edge table to maintain, and therefore no
drift and no second source of truth. `DependentPrompts` scans the project's
documents on demand and matches each block's scope against the origin. For the
proto's document sizes this is adequate; the signature admits a persisted
incremental index later without changing callers. This supersedes the earlier
inert per-source revision plumbing.

## Verification

- Unit (`core/capability/document`, deterministic — no model): a source is
  matched to exactly the block scoped to it; a source with no dependents returns
  nothing; unscoped prompt blocks and non-prompt blocks never match. Full package
  green.

## Settled

- "Scope is the dependency edge" — the graph is derived from each block's scope,
  queried by `DependentPrompts`, not stored separately. ✓
- Acting on the result (enqueue a refresh for each dependent) is Slice G, kept in
  the composition layer so the capability stays a pure read.
