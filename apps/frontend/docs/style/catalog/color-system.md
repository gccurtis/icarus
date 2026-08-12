# Color system

> **Concrete tokens.** Every value here resolves to a [palette](palette.md)
> entry. Nothing in this document introduces a new color.

Color is a cognitive map for action, state, authorship, liveness, and trust. The
[palette](palette.md) says what the colors are; this says what they mean.

## Two vocabularies

The tiers use different words on purpose, because they measure different things:

- **Palette steps describe lightness.** `faded` → `deep`, lightest to darkest,
  identical in every theme.
- **Role steps describe emphasis.** `muted` → `strong`, quietest to loudest,
  relative to whatever surface the active theme is using.

So `--color-success-strong` is the loudest green available — dark in Celestial
Light, bright in Cyberpunk Night — while `--palette-green-strong` is one specific
dark green in both. The theme flip lives entirely in the mapping below.

| Role step | Contrast against surface | Use |
| --- | --- | --- |
| `muted` | Barely separated | Washes, zone fills, the quietest possible tint |
| `light` | Low | Hover washes, selected rows, badges, filled chips |
| `normal` | ≥ 3:1 | The base. Icons, borders, non-text UI, solid fills |
| `emphasized` | ≥ 4.5:1 | Hover and pressed states of the base; body text |
| `strong` | ≥ 7:1 | Maximum emphasis; small text, dense labels, headings |

`muted` and `light` are **surface** steps: they go behind content. `normal`
through `strong` are **content** steps: they go on top of it. A component that
puts a content step behind a surface step has the ramp backwards.

## Step mapping

One table, and it is the whole theming mechanism. Every role in every table below
resolves through it.

| Role step | Celestial Light | Cyberpunk Night |
| --- | --- | --- |
| `muted` | `faded` | `deep` |
| `light` | `muted` | `strong` |
| `normal` | `normal` | `light` |
| `emphasized` | `emphasized` | `muted` |
| `strong` | `strong` | `faded` |

Celestial Light reads down the ramp from the middle; Cyberpunk Night reads out
from both ends. This is why the palette carries seven steps for five roles — the
two themes need different headroom, and neither can borrow the other's.

The mapping is uniform across every hue. That only holds because the palette
ramps were built to a shared contrast contract, so no role needs a per-hue
exception.

## Semantic roles

The state roles. These carry meaning, and meaning is what most of the interface
should be reaching for.

| Role | Palette color | Means |
| --- | --- | --- |
| `--color-success-*` | `green` | Applied, accepted, valid, safe |
| `--color-danger-*` | `red` | Failed, rejected, destructive, denied |
| `--color-attention-*` | `amber` | Human judgment required; stale; pending review |
| `--color-intelligence-*` | `violet` | Derived work: prompts, memory, formulas, generated content |
| `--color-interactive-*` | `blue` | Can be acted upon: controls, links, focus |
| `--color-active-*` | `cyan` | Currently engaged, selected, live, resolving |
| `--color-inactive-*` | `grey` | Unavailable, disabled, or out of scope |

Each expands to the five role steps: `--color-success-muted` through
`--color-success-strong`, and so on.

**`interactive` and `active` are deliberately different hues.** Blue is the
affordance — this can be acted upon. Cyan is engagement — this is selected, live,
or resolving right now. A control is blue at rest and cyan while it is working,
and the two never have to be told apart by intensity alone.

**`inactive` is grey and needs no special case.** Because the grey ramp spans the
full range, disabled recedes toward the surface in both themes through the same
mapping as every other role.

## Default roles

The brand roles: what the product wears when nothing more specific applies —
headers, marketing surfaces, categorical series, illustration.

| Role | Palette color |
| --- | --- |
| `--color-primary-*` | `blue` |
| `--color-secondary-*` | `violet` |
| `--color-accent-1-*` | `teal` |
| `--color-accent-2-*` | `pink` |

`primary` and `interactive` share blue, and `secondary` and `intelligence` share
violet — the brand hues *are* the action and derivation hues, and pretending
otherwise would mean inventing colors with no job. The accents are deliberately
drawn from hues no semantic role claims, so brand color can never be mistaken for
state.

`orange` and `yellow` are claimed by nothing. They are the first colors to reach
for when a categorical series needs more than four.

## Ink roles

Text. Primary and secondary come from the theme's contrasting neutral; muted
comes from `grey`, which belongs to neither theme and so reads as recessive in
both.

| Token | Use | Celestial Light | Cyberpunk Night |
| --- | --- | --- | --- |
| `--ink-primary` | Body and headings | `grey-strong` `#1D2329` | `white-light` `#F7F4EC` |
| `--ink-secondary` | Supporting text, recessed panels, provenance | `grey-emphasized` `#3A424D` | `white-strong` `#D8D3C4` |
| `--ink-muted` | Metadata, helper text, timestamps | `grey-normal` `#6C716C` | `grey-light` `#93A0B4` |
| `--ink-on-fill` | Text and icons on a solid role fill | `white-muted` `#FFFEFA` | `black-strong` `#05070A` |

Metadata bearing on trust, provenance, or recovery uses `--ink-secondary`, not
`--ink-muted`. Muted is for text a user may safely skip; provenance is never
that.

## Surfaces, borders, and depth

Surface, border, and selection colors are roles too, but they belong with the
geometry they are always used alongside. They live in
[Surfaces](surfaces.md), together with radii and shadows.

## Usage laws

- **Reach for meaning, not hue.** Components use the semantic roles. Default
  roles are for brand and categorical work; the palette is for neither.
- Blue (`interactive`) is action, not decoration.
- Cyan (`active`) is engagement, liveness, and resolution.
- Violet (`intelligence`) is derived work, not ordinary navigation.
- Amber (`attention`) means human judgment is required.
- Red (`danger`) means failure, denial, or destruction — not mere absence.
- Green (`success`) means confirmed or safe — not generic positivity.
- Grey (`inactive`) means unavailable, and always says why.
- Glow is allowed only when it carries state.
- **Respect the ramp.** `muted` and `light` go behind content; `normal` through
  `strong` go on top of it.
- **Color never works alone.** Pair it with copy, an icon, position, border, or
  shape. The required pairings are enumerated in
  [the state matrix](../component/components-and-states.md#state-matrix).

The last law is what keeps thirteen colors from becoming noise. If a new meaning
seems to need a new hue, it almost always needs a second cue on an existing one.

## Theming mechanics

The palette is declared once, outside both themes. Each theme layer declares only
mappings:

```css
:root {
  /* The palette. Theme-independent, and the only literal values. */
  --palette-blue-normal: #3657C9;
  --palette-blue-light: #6E8BFF;
  /* …the complete set from the palette tables… */
}

:root,
[data-theme="celestial"] {
  color-scheme: light;

  --color-interactive-normal: var(--palette-blue-normal);
  --surface-work: var(--palette-white-muted);
  --ink-primary: var(--palette-grey-strong);
  /* …the complete set of roles… */
}

[data-theme="cyberpunk-night"] {
  color-scheme: dark;

  --color-interactive-normal: var(--palette-blue-light);
  --surface-work: var(--palette-black-emphasized);
  --ink-primary: var(--palette-white-light);
  /* …the complete set of roles… */
}
```

- Celestial Light is bound to bare `:root`, so it is the default with no
  attribute set. `[data-theme="celestial"]` is accepted as an explicit opt-in, so
  a theme switch can name either theme rather than special-casing removal.
- Switch by setting the attribute on the root element:
  `document.documentElement.dataset.theme = "cyberpunk-night"`.
- Each layer sets `color-scheme`, so native controls, scrollbars, and the caret
  match the surface.
- A new theme is a new mapping block. It adds no color values, and it cannot
  introduce one — which is what keeps themes from drifting apart.

## Contrast

The role steps are a contrast contract, and it holds in both themes: `normal`
meets 3:1 against the theme's work surface for non-text UI, `emphasized` meets
4.5:1 for body text, and `strong` meets 7:1 for small or dense text. A component
that picks the right step for the job is compliant by construction.

Pairings outside that contract — colored text on a colored fill, a content step
on an elevated rather than work surface — are measured before use. Full
requirements are in [Accessibility](../theory/accessibility.md).
