# Inspector + layout typography un-mocked → semantic style registry

Goals 2.1 and 2.2 from the integration plan — replace the free-form font/size/color mock controls
with Omega's semantic style registry. Builds on the style-registry foundation
(2026-07-25-style-registry-foundation). Verified live against a fresh build of Omega `main` on `:8444`.

## Why a registry, not a control swap

Omega has no font-family/px-size/hex-color model. Typography is a set of semantic *tokens*
(`body`, `body_small`, `label`, `title`, `heading`, `display`, `code`, `quote`) carried by named
style definitions; every reference must resolve to a definition in the document registry, which is
empty by default. So both goals seed **one definition per typography token** (applicable to every
Alpha block kind) and then reference it.

## Shared helper — `$systems/documents/styles.ts`

`TYPOGRAPHY_TOKENS` (picker options), `typographyStyleDefinition`/`typographyStyleId` (idempotent
seeding), `defaultTypographyForKind` (the convention: paragraph→body, headings→display/title/
heading, prompt→label), `kindDefaultTypography` + `effectiveTypography` (resolution: override →
assigned style → kind default → convention), and `typographyCss` (token → CSS for rendering).

## Runtime + rendering

- The runtime holds the `styleRegistry` authoritatively (set on load/reload), plus optimistic
  `pendingBlockStyleRefs`. Two actions: `setBlockKindTypography` (seed + `set_style_default`) and
  `setBlockTypography` (seed + `assign_block_style`), each queuing `put_style_definition` first so
  it applies before its dependent op in the changeset.
- The session exposes `styleRegistry` + per-block `blockTypographies` (effective typography).
- The pagination plugin gained a `blockTypography` decoration channel; the runtime decorates each
  block whose effective typography differs from its kind convention (so unstyled blocks keep base
  CSS), mapping the token to CSS — changes render live, like alignment/columns.

## Goal 2.2 — LayoutPanel

Body (paragraph) + per-heading typography selects bound to `setBlockKindTypography`, reading the
current default from the registry. Removed `mockDocumentLayout` + `HeadingStyle` (context.ts), the
mock font/size/color controls, and the Mock badges.

## Goal 2.1 — DetailsPanel

The "Font and color" mock block (font Combobox, size NumberField, FG/BG color palette) is replaced
by a single **Typography** select bound to `setBlockTypography` for the selected block(s); the
current value comes from `blockTypographies`. Removed `inspectorMockDefaults` (inspector.ts) and the
color-picker scaffolding. `inspectorFontOptions`/`inspectorColorPalette` are kept — the Fabric.js
slide editor still uses them for real fonts/colors.

## Verification

- Exact runtime op payloads round-trip on `:8444` in the batched form the runtime emits:
  `put_style_definition`+`set_style_default(heading_1)` in one changeset → `201`;
  `put_style_definition`+`assign_block_style(block)` in one changeset → `201`; both persist across
  reload (registry defaults, definition, block `styleRef`). Constraints confirmed (styleId must
  exist + `appliesTo` the kind; overrides gated by `allowOverrides`).
- `svelte-check` clean; full vitest suite 197/197 (updated `identity.test.ts` — a Goal-3.4 straggler
  that still asserted the retired mock "Taurus" persona).

## Still mocked / out of scope

Non-typography facets (spacing/padding/border/background/tone) are seeded to neutral defaults and
not yet surfaced as controls; named style *management* (rename/delete/replace) is not exposed. These
are natural follow-ups on the same registry.
