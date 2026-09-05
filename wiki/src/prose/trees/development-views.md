## What it is

Surfaces that ship nowhere. Nine of them, mounted under `/demo`, each shaped like a surface — root component, concerns, document — and free to import anything, because nothing shipped may import them ([[check:nothing-imports-development]]). They are where a vocabulary is reviewed, a stack of screens is generated, and an algorithm is watched.

## What it owns

- `demo` — the design-system catalogue: palette, roles, typography, surfaces, states, geometry, overlays, the registry components; `/demo`.
- `vocabulary` — every panel and screen part with a comment log beside it; `/demo/vocabulary` and its `comments` endpoint.
- `stack-builder` — reads the vocabulary catalogue and generates mock screens; `/demo/stack-builder` with `generate`, `manifest` and `mock` endpoints, whose `.server.ts` procedures are the only server modules in a view tree.
- `review` — a grid map, tree and value editor over a state; `/demo/review` is not a route today, so this surface is reachable only through code.
- `semantic-overlay` — the segmentation algorithm, inspectable; `/demo/semantic-overlay` and `/demo/semantic-overlay/implementation`.
- `analysis-demo`, `plot-demo`, `blocks-demo`, `thread-demo` — chart, plot, block and thread stages; `/demo/analysis`, `/demo/plot`, `/demo/blocks`, `/demo/thread`.

## What it may and may not import

Anything. The trade holds in one direction only: a development surface may take from every tree, and no tree may take from it. The surface checks still apply — concerns are one of five, effects declare runes, shared hands out no instance.

## Shape on disk

```
development-views/
  <surface>/
    <surface>.md
    <surface>.svelte
    components/*.svelte
    effects/*.svelte.ts
    procedures/*.ts, *.server.ts
    shared/*.svelte.ts
    test/
```

## Invariants

One check of its own, `nothing-imports-development`, plus the surface checks.

## What to open first

1. [[file:app/src/lib/development-views/vocabulary/vocabulary.md]] — what the catalogue is for and how a review is read back.
2. [[file:app/src/lib/development-views/stack-builder/stack-builder.md]] and [[file:app/src/lib/development-views/stack-builder/procedures/manifest.ts]].
3. [[file:app/src/lib/development-views/semantic-overlay/semantic-overlay.svelte]] — the overlay demo, beside [[page:/algorithms/semantic-overlay|its explanation]].

The `/demo/context`, `/demo/inspector` and `/demo/workspace` routes glob `app-views/panels/**` and `app-views/workspaces/**`, neither of which exists; they render nothing. `review` has no route. Recorded under [[page:/gaps|Gaps]].

## Units
