# Celestial

**Published:** 2026-09-05 · https://claude.ai/code/artifact/c2fa0c13-aa85-4563-9a6f-05e88c3b8d88
**Branch:** `work/styling` off `98d9cd0`

> A formless citadel amongst the clouds, whose curves channel the manifestation of the solar will.

The six aesthetic documents are reproduced on the page and live at
`app/src/lib/styles/aesthetic/`. That is the copy to read. What follows is everything else the
artifact carries.

## The two materials

| Material | Reads | Character |
| --- | --- | --- |
| **Celestial Helios** | light | the solar will manifest directly — day, warm paper, the source |
| **Celestial Selene** | dark | the same will returned by another body — night, cool void, reflection |

`data-appearance="helios" | "selene"`. They are **not required to mirror each other**; they are
required to be good.

## What the review notes changed

| Note | Change |
| --- | --- |
| "celestial is the aesthetic, so material dir should probably be called material" | `celestial/` → `material/`. Celestial names the aesthetic at the top of the tree |
| "a surfaces dir could be very helpful" | New `styles/surfaces/` — the named arrangements a screen is built out of |
| "the right things visible **in the right place**" | Law 2 rewritten; `arrangement.md` opens on placement, order, and grouping |
| "anchor on rhythm, not symmetry" | Symmetry section replaced by rhythm, with the two promises as the test |
| "provenance is what we're actually after" | The uncertainty framing is gone. If origin cannot be established, the value is not shown. New `Untraceable` state |
| "motion without intent is disruption" | Now the law. `motion.md` names the exact two things motion may say |
| "as many curves as is necessary" | The two-curve ceiling removed |
| "header rows should be a different background; first column left, rest centred" | Fixed as a system convention in `.data-table` |
| "distinction as a form of communication" | Promoted to a law of its own |
| "light and dark don't have to be mirrors" | Structure allows full divergence; Selene uses it for three entries |
| "legibility — font size could be larger" | `type.md`: the fine steps are for chrome, not content |
| "don't overdo the semantics" | `states.md` opens by saying the matrix is a floor, not a cage |

## The tree

```
styles/
  app.css
  aesthetic/            Celestial. the feeling. no CSS.
    aesthetic.md  light.md  type.md  motion.md  arrangement.md  states.md
  material/             what it is made of
    material.md  ramps.css  slots.css
    helios/{helios.css, helios.md}
    selene/{selene.css, selene.md}
  surfaces/             what it is built out of
    surfaces.md  surfaces.css
  tokens/               the public API
    tokens.md  color.css  typography.css  space.css  shape.css  motion.css
  integrations/
    tailwind/  shadcn/
```

`surfaces/` is the layer that was actually missing. A token says a seam is one pixel and names the
subtle border colour; it does not say that a group of cells laid on that colour with one-pixel gaps
reads as *one object with internal structure*. That second thing is the design decision, and until
it had a name every screen re-derived it.

Removed: seven checks under `scripts/lint/styles/`, `scripts/lint/shared/styles.mjs`, both
generators, and the `new-theme` / `new-token` package scripts. `one-stylesheet-entry` survives,
rewritten and self-contained.

## Renames

| Was | Now | Why |
| --- | --- | --- |
| `--theme-*` | `--material-*` | the layer is achromatic material doing jobs |
| `data-theme="celestial\|cyberpunk"` | `data-appearance="helios\|selene"` | nobody chooses a style; they choose which body is doing the lighting |
| `spacing.css` | `space.css` | it holds the unit, the densities, and measure |

## Palette

Eleven shared values changed to make one ladder serve both readings. **Aether Blue `#3657C9` and
Vesper Violet `#6F49D8` are untouched.** The `black` family was rebuilt (it was stepped like a
chromatic ramp — coarse at the top, crushed at the bottom, and its planes live at the bottom);
`grey-normal` was made genuinely tint-free; `orange`, `yellow` and `teal` `normal` steps were
darkened so a boundary clears 3:1 on the panel plane rather than only on the work surface.

Selene then declares three of its own:

| Entry | Shared | Selene | Wash | Why |
| --- | --- | --- | --- | --- |
| `blue-deep` | `#131F4B` | `#1B2C6B` | 1.04 → 1.27 | invisible as a wash on Selene's work plane |
| `violet-deep` | `#291B50` | `#36246A` | 1.07 → 1.27 | same |
| `grey-strong` | `#1D2329` | `#414B58` | 1.04 → 1.86 | it is Helios' primary ink, so it sat on Selene's work plane; `inactive`'s hover wash was fainter than its resting wash |

Both soft spots recorded last round are now gone. Every Selene wash sits between 1.22 and 1.35 and
every hover wash is stronger than the wash it replaces. Measured tables for both materials are in
`material/helios/helios.md` and `material/selene/selene.md`.

## The demos

`/demo` is rebuilt as a walk through the six documents in reading order — laws, ladders, roles,
planes, type, motion, arrangement, states, registry — with the Helios/Selene switch in a sticky
veil nav. New sections: `laws`, `motion`, `arrangement`. `geometry.svelte` was folded into
arrangement.

`/demo/blocks` now floats its document page on the pasteboard and sets it in the reading voice,
which is the type argument made visible rather than asserted.

## What ran

56 lint checks clean · 0 typecheck errors across 2183 files · 591 unit tests · 99 script tests ·
production build succeeds.

Both materials were rendered headless and read. Three defects that measurement could not catch were
fixed: an eyebrow inside an inverted block kept its role colour and was unreadable; the type
section left 400px of dead space; and thirteen states in a three-column seam grid left two cells
showing bare seam ground.

## Open

1. **The semantic-overlay components.** Its treatment — mono eyebrows, a live dot with a halo, a
   radial wash — is now in the system as `.eyebrow`, `.live-dot` and `--token-atmosphere`. Going
   through that page component by component for what else is worth taking is its own pass.
2. **How far Selene should diverge.** Three overrides today, each fixing a measured defect. The
   structure allows a fully distinct chromatic set; taking it is a deliberate project.
