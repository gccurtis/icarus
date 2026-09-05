## What it is

What the server can be asked to do. A capability is a directory holding an index, its types, its constants and its procedures ([[check:capability-layout]]), and its index is the only thing the rest of the repository may name ([[check:nothing-reaches-inside-a-capability]]). When the index is `index.remote.ts`, its exports are SvelteKit remote functions — `query(...)` and `command(...)` — and that file is the one client→server crossing in the repository ([[check:one-crossing]]).

Five capabilities exist today: `development` (who am I, from `dev.yaml`), `document` and `slide-deck` (read a leader body, submit a change set), `store` (create, read, update, remove by path) and `workspace` (read and submit the workspace ledger).

## What it owns

- **Procedures** under `api/<name>/<name>.ts`, one directory per procedure, whose entry is named for the directory at every depth ([[check:entry-matches-directory]]). Every entry opens with `requireScope()` ([[check:no-procedure-acts-outside-a-scope]]) and validates its input straight after ([[check:procedure-validates-first]]); a validator is the `validate-<name>.ts` beside the entry.
- **Shared steps** under `api/shared/` — `leader.ts` finds the leader snapshot for a resource; `touched.ts` and `without-shared-references.ts` strip what a change set must not carry.
- **Types** under `types/`, one file per procedure, re-exported from the index so a caller speaks in them without reaching inside.
- **Tests** under `test/unit`, `test/regression` or `test/non-functional` and nowhere else ([[check:tests-are-one-of-three-kinds]]).

A capability holds nothing between calls ([[check:capability-holds-nothing]]): no mutable module state, nothing constructed at import.

## What it may and may not import

[[check:capability-imports]] says it in four subjects: a server model object at its index, never a path inside it; the server graph through `start.server`; nothing from a view or a client model; another capability at its index only. And [[check:storage-through-a-model]]: nothing here imports `$representation/store` — the object that owns the store's lifetime is the only way in.

## Shape on disk

```
capabilities/
  capabilities.md
  <name>/
    <name>.md
    index.remote.ts            query(...) and command(...) over the procedures
    api/
      <procedure>/<procedure>.ts
      <procedure>/validate-<procedure>.ts
      <procedure>/<step>.ts
      shared/*.ts
    types/<procedure>.ts
    constants/*.ts
    test/{unit,regression,non-functional}/*.test.ts
```

## Invariants

Eleven checks govern this tree: the ten under `scripts/lint/capabilities/` and `one-crossing` under `across/`. Read `no-procedure-acts-outside-a-scope` and `one-crossing` first; between them they are the whole security model.

## What to open first

1. [[file:app/src/lib/capabilities/capabilities.md]].
2. [[file:app/src/lib/capabilities/document/index.remote.ts]] — seven lines, and the shape every index has.
3. [[file:app/src/lib/capabilities/document/api/submit-document-changes/submit-document-changes.ts]] — scope, validate, find the leader, refuse if stale, apply, write the change set and the snapshot. [[page:/traces/capability|Traced end to end]].
4. [[file:app/src/lib/runtime/server/scope.server.ts]] — where `requireScope()` comes from and why the lookup is the authorization.
5. [[file:app/src/lib/capabilities/store/index.remote.ts]] — the generic path store the views read titles and rows through.

[[file:app/src/lib/capabilities/slide-deck/slide-deck.md]] says nothing here writes; the code has `submitSlideDeckChanges`. [[file:app/src/lib/capabilities/workspace/workspace.md]] is a placeholder. Both are recorded under [[page:/gaps|Gaps]].

## Units
