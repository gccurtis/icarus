## What it is

What a tab shows. A category is a directory under `categories/`; a view is a `.svelte` under its `content/`, `context/` or `inspector/`, and its key is its path — `document-editor.layout` is `categories/document-editor/context/layout.svelte` ([[check:key-vocabulary-matches-the-tree]]). The vocabulary the model publishes is generated from the same fact by `pnpm category-keys`, so the two cannot disagree. Ten categories and one general view exist.

## What it owns

- **Content views** (13 keys, all built): `document-editor.document`, `slide-deck-editor.deck`, `spreadsheet-editor.sheet`, `analysis.chart`, `research.thread`, `project-overview.overview`, `new-tab.launcher`, `agents.{library,persona,task,automation}`, `templates.{library,editor}`.
- **Context views** (86 keys, 4 built): `document-editor.layout`, `slide-deck-editor.{slides,stage}`, `templates.overview-library`. The other 82 are named in the vocabulary and drawn as a placeholder by the context surface.
- **Inspector lenses** (109 keys, 2 built): `document-editor.text-selection` and `templates.template`. The eight `general.*` keys in the vocabulary have no file; the one general view on disk, `general/function-builder`, has no key.
- **Procedures** per category — the document editor's nine ([[page:/algorithms/document-editor|explained]]), the slide deck editor's four ([[page:/algorithms/slide-deck|explained]]), project-overview's ten, new-tab's six — with tests under `procedures/test/`.
- **Documents** — each category except `document-editor` has a `<category>.md` describing what its views are meant to become. The counts above come from the code, not from those documents.

## What it may and may not import

[[check:view-imports-no-surface]]: a view shows another view by key, never by import; it does not reach back out to the surface it is rendered in; and it needs nothing beyond capabilities, components and workspace state. [[check:view-imports-no-other-category]]: a category's views reach `general/` and nothing in another category. [[check:runtime-through-workspace-state]]: no view attaches a resource runtime itself — `view.documentRuntime(id)` on workspace state is the one attachment, so two views of one document share one edit buffer.

## Shape on disk

```
app-views/
  categories/<category>/
    <category>.md
    content/<view>.svelte        key <category>.<view>
    context/<view>.svelte
    inspector/<lens>.svelte
    procedures/*.ts
    procedures/test/unit/*.test.ts
  general/<view>/
    <view>.svelte                key general.<view>
    *.ts
```

## Invariants

Four checks under `scripts/lint/views/`, plus the eight surface checks, which run over this tree too.

## What to open first

1. [[file:app/src/lib/representation/data/behavior/workspace/views.ts]] — the generated vocabulary; every key a surface can be asked for.
2. [[file:app/src/lib/app-views/categories/document-editor/content/document.svelte]] — the most complete view.
3. [[file:app/src/lib/app-views/categories/document-editor/context/layout.svelte]] — a context view, and the one followed in [[page:/traces/view|the view trace]].
4. [[file:app/src/lib/app-views/categories/new-tab/procedures/opening.ts]] — how a launcher opens a tab.
5. [[file:app/src/lib/app-views/general/function-builder/function-builder.svelte]] — the one general lens.

## Units
