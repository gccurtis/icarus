# 2026-07-27 — Workstream D, part 6: L5, L6, PC1 — the reorg is COMPLETE

The last three catalog rows. With this commit **every row in the issues catalog is closed and
all reorg workstreams (A–E) have shipped**.

## L5 — the inspector option lists get a neutral home

`systems/documents/inspector.ts` held three UI option lists (fonts, reference types, the color
palette) that the *slide* editor's panels also imported — slides depending on the documents
system for constants that are not document-domain knowledge. They now live in
`features/shared/inspector-options.ts`, beside the other cross-feature tables (`kinds.ts`,
`transfer.ts`); `inspector.ts` is deleted (its geometry helpers had already died with the Row
lens in D6) and the documents barrel no longer exports it. Six importers rewired mechanically.

## L6 — the two typography systems, signposted (and the semantic cascade stays)

Evaluated rather than assumed: **both systems are current, with different jobs.**

- Semantic tokens (`SemanticTypography`, `styles.ts`) back **block-type** styling — the
  inspector's "Text type" (Title / Heading / Body / …) resolved through Omega's style registry.
- `CustomTypography` (`types.ts`) + the inline font/fg/bg marks back **real-font** styling —
  the shipped direction for user-facing font choices.

A block renders as its token's CSS, overridden by custom typography, then by inline marks.
The "retire the semantic cascade if unused" option is **rejected** — it is the Text-type
system, actively written by `setBlockKindTypography`/`setBlockTypography`. Signpost comments
now sit in both files (and companions) so neither reads as superseding the other.

## PC1 — `2026-07-24-runtime-architecture.md` matches shipped reality

Per decision §8.3, the doc — not the code — was updated. Its status header now records the one
deliberate divergence: the proposed `WorkSurface` **registry-dispatch never shipped and will
not be built**. The shipped `WorkSurface` switches on `tab.kind`/`resourceKind` and each stage
self-acquires its runtime; the registry earns its keep for lifecycle (per-kind registration,
acquire/dispose, `active()` for siblings), not stage dispatch. The registry-dispatch section
carries an inline "Not shipped — decided against" note so its code sample cannot be mistaken
for intent.

## Close-out docs

- Catalog rows L5/L6/PC1 struck with what happened — the catalog now has **no open rows**.
- The reorg plan's status header reads COMPLETE, listing all workstreams and the D records.
- Orientation §7 no longer names an active plan; the reorg docs stay as the architecture
  reference. The stale "E — DO THIS FIRST" bullet now records E as done.

## Verification

- `pnpm check` — 0 errors, 0 warnings
- `pnpm test` — 343/343
- `pnpm build` — clean
- companions — verifier OK on all ten touched sources
- `pnpm test:e2e` — **14/14**
