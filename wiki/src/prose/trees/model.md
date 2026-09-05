## What it is

Objects with a lifetime. A model object is something the application holds exactly one of — the workspace state of this browser tab, the open document runtimes, the server's store — built once by the runtime and reached everywhere else through its index ([[check:object-is-entered-at-its-index]], [[check:constructor-is-called-by-the-runtime]]). Importing a model module never builds anything ([[check:nothing-builds-at-module-load]]); holding an instance is the runtime's job.

Nine client objects and three server objects exist. The client ones that react — `commands`, `document-runtimes`, `slide-deck-runtimes`, `spreadsheet-runtimes`, `tab-list`, `workspace-state` — define themselves in `definition.svelte.ts` so their `$state` compiles ([[check:runes-match-the-extension]]); the rest are plain.

## What it owns

- **Client:** `workspace-state` (the ledger of tabs, views, frames; [[page:/algorithms/workspace|explained]]), its two collaborators `tab-list` and `tab-views`, the three resource runtime families `document-runtimes`, `slide-deck-runtimes` and `spreadsheet-runtimes` ([[page:/algorithms/revisions|explained]]), `commands` (ids, chords, bindings), `configuration` (the published slice of the YAML) and `storage` (what survives a reload, in localStorage).
- **Server:** `configuration` (the merged YAML), `observability` (a pino logger) and `store` (the JSON-file store over the 42 tables).

An object exposes keys, never components ([[check:object-exposes-no-component]]): what a key renders as is a view's decision.

## What it may and may not import

Objects import the representation, each other's indexes, and — on the client — capability indexes for the crossing. What a method reaches is its own object's definition and shared steps. A `.server.ts` index marks a server object so a browser import fails at build ([[check:object-layout]], subject `index-matches-environment`). The across checks apply as everywhere: a client object cannot take server code and vice versa ([[check:client-server-separation]]).

## Shape on disk

```
model/
  model.md
  client/<object>/
    <object>.md
    index.ts                   the only import target
    types.ts                   the model's public interface
    definition.svelte.ts       or definition.ts when nothing reacts
    constructor.ts             create<Object>(...)
    methods/<method>.ts        or methods/<method>/<method>.ts for a family
    methods/shared/*.ts
    test/{unit,regression,non-functional}/
  server/<object>/
    index.server.ts
    ...the same
```

What an object does lives under `methods/`; its root holds only what it is ([[check:object-layout]]). A method directory holds a file of its own name ([[check:method-entry-matches-directory]]), and where a method document draws a call tree, every path in it exists ([[check:method-tree-paths-resolve]]).

## Invariants

Nine checks under `scripts/lint/model/`. The two that shape everything are `object-layout` and `constructor-is-called-by-the-runtime`: an object is four files and a methods directory, and exactly one caller builds it.

## What to open first

1. [[file:app/src/lib/model/model.md]].
2. [[file:app/src/lib/model/client/workspace-state/types.ts]] — the interface every surface reads: tabs, active, frame, context, inspected, selection, open, close, undo, redo.
3. [[file:app/src/lib/model/client/workspace-state/definition.svelte.ts]] — `WorkspaceStateData` holds the log, the undone stack, the buffer and the revision; `WorkspaceState` is the interface over it.
4. [[file:app/src/lib/model/client/document-runtimes/methods/flush/flush.ts]] — coalesce, submit, rebase once on stale, needs-review on anything else.
5. [[file:app/src/lib/model/server/store/definition.ts]] — thirty lines that are the whole server store.

[[file:app/src/lib/model/client/workspace-state/workspace-state.md]] says "Nothing here is persisted yet"; `restore`, `flush` and `methods/shared/submit.ts` persist through the workspace capability. Recorded under [[page:/gaps|Gaps]].

## Units
