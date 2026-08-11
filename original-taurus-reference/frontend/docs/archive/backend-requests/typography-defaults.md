# Backend request — document & per-kind typography defaults (+ text-kind terminology)

**Priority:** Medium · **Status:** ✅ **Shipped** — `Base.DefaultTypography` + `set_default_typography`; Alpha's Layout lens sets it

## What the front-end needs

Real-font **defaults**, so the Layout panel can set typography once instead of per
block:

1. **A document default font** — a page-level real font (family / size / color)
   every block inherits unless it overrides. (The Layout panel's "default font under
   Page.")
2. **Per-kind default real typography** — a real font for `paragraph` ("Body
   default") and each `heading_N`, not a semantic token.

Today **custom typography (real fonts) is per-block only** — stored on a block's
`styleRef.overrides.custom` and set via `set_block_custom_typography`. **Style
definitions carry only semantic tokens** (`StyleDefinition` has no font field), and
there is **no document- or kind-level default font** in the model. So a document-wide
or per-kind real-font default has nowhere to persist.

## Proposed API

**Omega owns the contract**; two shapes that would fit:

- **Document default:** a `defaultTypography: CustomTypography` on the document base
  (or `layoutRules`), set via a `set_default_typography` op.
- **Per-kind default:** either add a `custom: CustomTypography` to `StyleDefinition`
  (so a kind's default style can carry a real font, resolved by the existing
  `set_style_default`), or a `set_kind_default_typography` op mapping a block kind →
  `CustomTypography`.

Resolution order the cockpit expects: **block custom → kind default → document
default → built-in**.

## 3 — A background color on custom typography

The inspector's color control should be **two** controls — **foreground (text)** and
**background** — but Omega's `CustomTypography` is `{ fontFamily, fontSize, color }`:
only a foreground `color`, no background. A real (arbitrary) block **background color**
has nowhere to persist (the semantic `background` facet is tokens, not a color).

Proposed: add `backgroundColor string` to `CustomTypography` (stored verbatim, length-
bounded like the others), set through the existing `set_block_custom_typography` op. Then
the inspector's **fg** wires to `color` (backable today) and **bg** to `backgroundColor`.

## Related — text-kind terminology alignment

Two naming/model mismatches worth aligning so the cockpit and engine speak the same
language (a discrepancy today; the cockpit translates at the boundary):

- Block **kind `paragraph`** vs the semantic type **`body`** — the cockpit shows
  "Body" for the default text type but the kind is `paragraph`. Aligning them (kind
  `body`, or the semantic tokens named after kinds) removes the translation.
- A **`text` kind with text sub-kinds** (paragraph, heading 1–6, …) would formalize
  the **text-type vs element** split the cockpit already uses (text types convert
  in place; elements are inserted), giving both sides one shared vocabulary.

## What it unblocks (front-end)

The Layout panel's real-font defaults (gap **G6** in
[`alpha-remaining-gaps-2026-07-25.md`](alpha-remaining-gaps-2026-07-25.md); A2 design
in [`../superpowers/specs/2026-07-25-a2-block-kinds-design.md`](../superpowers/specs/2026-07-25-a2-block-kinds-design.md)):
page default font + body/heading real typography.

## Front-end follow-up (once shipped)

Restore the Layout panel's typography section as **real** controls (font family / size
/ color for the page default and per-kind defaults) with `setDefaultTypography` /
`setKindDefaultTypography` runtime actions. Until then Layout shows **Page + Margins**
only; the internal semantic registry stays (it still drives default heading sizes) but
is not surfaced.
