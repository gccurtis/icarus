## What it is

Things that draw. A component takes props and emits events; it imports none of `$capabilities`, `$model`, `$runtime` or `$representation` ([[check:component-takes-only-props]]), so it can be rendered on a demo page with made-up data and behaves the same inside a surface. It is the largest tree by file count — 391 files — because the vendored shadcn parts live here, one directory per component.

## What it owns

- **Authored vocabularies** under `authored/`, each entered at its index ([[check:vocabulary-is-entered-at-index]]): `panel` (the whole context/inspector vocabulary — 49 parts), `screen` (the content-plane vocabulary — 32 parts), `chart` (the chart family, [[page:/algorithms/charts|explained]]), `block` (content blocks), `drag`, `overlay`, `resize-handle` and `carousel-shelf`.
- **Vendored shadcn-svelte parts** under `vendored/`, 43 of them plus `utils.ts`. A vendored file imports no first-party tree ([[check:vendor-is-unedited]]) and spells its imports the way the CLI writes them ([[check:vendor-keeps-its-own-spelling]]), so the next regeneration overwrites nothing that matters.
- **One development component**, [[file:app/src/lib/components/development/trace.svelte.ts]], a tracer used by the vocabulary demo and by `chart.svelte`.

## What it may and may not import

Other vocabularies at their index, vendored parts, `$development-components`, and third-party packages (bits-ui, layerchart, konva is not here — it is in the presentation view). Never a model, a capability, the runtime or the representation. A view that needs data hands it down as props or ids.

## Shape on disk

```
components/
  authored/<vocabulary>/
    index.ts                   export { default as X } from "./x.svelte"
    *.svelte
    *.ts                       helpers a vocabulary needs (chart-spec, palette, layout)
  vendored/<part>/
    index.ts
    *.svelte
  vendored/utils.ts            cn(), from the registry
  development/
    trace.svelte.ts
    test/unit/
```

## Invariants

Four checks under `scripts/lint/components/`. The vendored pair is what makes "use shadcn as shipped" enforceable rather than aspirational.

## What to open first

1. [[file:app/src/lib/components/authored/panel/index.ts]] — its header comment is the panel vocabulary's charter, and the exports are the whole list.
2. [[file:app/src/lib/components/authored/screen/index.ts]] — the same for the content plane.
3. [[file:app/src/lib/components/authored/chart/chart-spec.ts]] and [[file:app/src/lib/components/authored/chart/plot/layout.ts]] — what a chart is, and how marks get their boxes.
4. [[file:app/src/lib/components/authored/block/index.ts]] — "the block is data; the box is a rendering decision".
5. [[file:app/src/lib/components/vendored/utils.ts]] — the `cn()` every vendored part uses.

## Units
