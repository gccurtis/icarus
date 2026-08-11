# Doc-model Stage 5 — document default typography (Layout)

The final level of Omega's typography cascade (record 0082, E2): a document-wide
default font. Completes the doc-model adaptation.

## What

- **`types.ts`** — `Doc.base.defaultTypography` (a `CustomTypography`, the lowest
  cascade level).
- **`runtime.ts`** — the runtime seeds `defaultTypography` on load/reload; the new
  **`setDefaultTypography(patch)`** action merges the patch, drops blank fields, and
  emits **`set_default_typography`** (null clears). Exposed to panels via the session.
- **`LayoutPanel.svelte`** — a **Default typography** section (base font family / size /
  Text color / Fill) drives the action. This restores the "default font" the Layout
  panel lost when its rejected semantic-typography controls were removed in Stage 1 —
  now backed by the real cascade rather than semantic tokens.
- **`DocumentStage.svelte`** — the document default renders as the editor root's inline
  style, so all text inherits it; a block decoration or an inline `font`/`fg`/`bg` mark
  overrides it via CSS specificity (matching the backend's per-property cascade:
  inline → block → sub-kind → **document default** → built-in).

## The cascade, end to end (Stages 1–5)

- **inline** — `font`/`fg`/`bg` marks (Stage 2, the inspector's Font/Text/Fill).
- **block override** — `set_block_custom_typography` (`CustomTypography.fg/bg`, retained).
- **sub-kind default** — a custom sub-kind's style definition (round-trips today).
- **document default** — `set_default_typography` (this stage).
- **built-in** — the heading node CSS + base styles.

## Verification

- `pnpm check` **0 errors**; `pnpm test` **254 passed**.
- Op contract-matched to Omega (`set_default_typography` uses the `customTypography`
  field; `Base.defaultTypography`).
- Live browser E2E pending (no headless Chrome; stack up on `:5173`).
- Companions: 5 regenerated + byte-verified.

## Doc-model adaptation — complete

Stages 1–5 land the full Omega block model on the frontend: 7 kinds + text sub-kinds,
inline font/fg/bg typography with the 5-level cascade, general indent, native lists,
and the document default font. Remaining backend surfaces (workspace state, project
members, windowed rows) are separate capabilities tracked in the integration plan.
