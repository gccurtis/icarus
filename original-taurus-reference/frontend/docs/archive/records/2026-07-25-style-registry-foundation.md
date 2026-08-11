# Semantic style-registry foundation (Phase 2 base)

Foundational plumbing for Phase 2 typography (Goals 2.1/2.2) — surface Omega's semantic style
registry through the Alpha document layer and add the four style changeset ops. Verified live
against a fresh build of Omega `main` on `:8444`.

## Omega's model (why this isn't a control swap)

Omega typography is a **semantic token registry**, not free-form fonts. A document's `base`
carries `styleRegistry: { definitions, defaults }`; each block may carry a `styleRef`
(`{ styleId, overrides }`). Tokens: typography (`body`, `body_small`, `label`, `title`,
`heading`, `display`, `code`, `quote`) plus spacing/padding/border/background/tone facets.
Every reference must resolve to a definition in the registry, and the registry is **empty by
default** — so real typography requires seeding definitions before assigning them.

## Changes

- `types.ts` — added the semantic token unions, `StyleDefinition`, `StyleDefault`,
  `StyleOverrides`, `BlockStyleRef`, `StyleRegistry`; `Block.styleRef`; `styleRegistry` on
  `Doc['base']`; the four style ops on the `ChangeOp` union (`put_style_definition`,
  `set_style_default`, `assign_block_style`, `set_block_style_overrides`) + their payload
  fields; and an `emptyStyleRegistry` const.
- `api.ts` — `normalizeDocument` now surfaces `base.styleRegistry` (empty arrays when absent)
  and preserves each block's `styleRef`; `operationLabel` maps the four new ops.
- `api.test.ts` — label assertions for the four ops.

## Verification

- Full op round-trip on `:8444` (correct changeset shape `{submissionId, expectedRevision,
  operations, ops}`): `put_style_definition` → `201` (definition in registry);
  `set_style_default paragraph→body` → `201` (defaults persisted); `assign_block_style` → `201`
  (block.styleRef.styleId=body); `set_block_style_overrides typography→heading` → `201`
  (block.styleRef.overrides.typography=heading). Constraints confirmed: assign/default require
  the styleId to exist and `appliesTo` the kind; overrides require an existing styleRef and are
  gated by the definition's `allowOverrides`.
- `svelte-check` clean; documents tests 23/23.

Goals 2.1 (inspector semantic typography) and 2.2 (layout per-kind defaults) build on this.
