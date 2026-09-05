## The path

A context view, `document-editor.layout`, followed from the key that names it to the pixels the context panel draws. The key is a path, and every hop reads it as one.

## Step by step

1. **The key exists in the vocabulary.** [[file:app/src/lib/representation/data/behavior/workspace/views.ts]] lists `"document-editor.layout"` in `CONTEXT_VIEWS`, hand-written so a view can be named before it is built. [[check:key-vocabulary-matches-the-tree]] refuses a file under `categories/*/context/` that the list does not name.
2. **The file exists.** [[file:app/src/lib/app-views/categories/document-editor/context/layout.svelte]] is `categories/<category>/context/<name>.svelte`; its key is its path. It imports workspace state and the panel vocabulary and nothing from a surface ([[check:view-imports-no-surface]]) or another category ([[check:view-imports-no-other-category]]).
3. **The rail offers it.** `OPENING["document-editor"]` in [[file:app/src/lib/representation/data/behavior/workspace/opening.ts]] names the key in its `rail` and as its default `context`, so `railFor("document-editor")` lists it and `defaultContext("document-editor")` returns it. The extraction shows 63 context keys on some rail.
4. **It has a label and an icon.** [[file:app/src/lib/surfaces/context/procedures/rail-entries.ts]] is a `Record<ContextView, { label, icon }>`; a key without an entry does not compile, which is how an unbuilt view still gets a rail pin.
5. **A tab opens.** `workspaceState.open({ category: "document-editor", resourceId })` performs `open` with a view minted from `OPENING` — content `document-editor.document`, context `document-editor.layout` — then `activate`. The ops land in the ledger and, after 8 ops or 750 ms, on the server ([[page:/algorithms/workspace|Workspace ledger]]).
6. **The surface resolves it.** [[file:app/src/lib/surfaces/context/context.svelte]] reads `view.context`, turns `"document-editor.layout"` into `/src/lib/app-views/categories/document-editor/context/layout.svelte`, and looks that up in `import.meta.glob("$lib/app-views/categories/*/context/*.svelte")`. The loader resolves, the component mounts keyed on the active key. Had the file not existed, the same surface draws `PanelPlaceholder` naming the key — which is what the other 82 context keys get today.
7. **It reads, never receives.** The view takes no content as a prop ([[check:view-takes-ids-and-callbacks]]); it reads `workspaceState()` and the document runtime through it, so the layout panel and the editor look at one body.

## Adding a view

`pnpm new-view -- document-editor context outline` writes `categories/document-editor/context/outline.svelte` and adds `"document-editor.outline"` to `CONTEXT_VIEWS`. Two things remain by hand and both fail loudly if forgotten: the rail entry in `rail-entries.ts` (the `Record` type refuses a missing key) and, if the view should be reachable from the rail, its place in `OPENING["document-editor"].rail`. A content view is simpler: `pnpm new-view -- document-editor content print` writes the file and `pnpm category-keys` regenerates `CONTENT_VIEWS` from the tree.
