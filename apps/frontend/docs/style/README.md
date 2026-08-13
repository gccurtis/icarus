# Design system

A design system for calm, precise, information-dense application interfaces —
the kind where a user reads far more than they click, where the system produces
derived content the user must be able to trust, and where depth has to be
available without being imposed.

Nothing here names an application, a feature, or a screen. The system is
expressed in design dimensions so it stays true regardless of what is built on
top of it.

## North star

**Intuitiveness means the product is easy to think in.** The interface should
make the next plausible action mentally available without product-specific
rituals, hidden gestures, or memorized commands.

## Governing principles

1. **The work surface is sacred.** The center stays calm, spacious, and legible.
2. **Disclosure is product architecture.** Show primary actions; group secondary
   actions under predictable abstractions.
3. **Recognition beats recall.** Prefer labels, visible state, examples, and
   stable placement.
4. **Intelligence stays out of the way.** Derived work appears as useful output,
   quiet live objects, explicit scope, and reviewable change.
5. **The future is calm, not neon.** Precision, depth, responsiveness, and
   restraint create the futuristic character.
6. **Trust is visible.** Derived and agentic work is attributable, inspectable,
   reversible, and explicit about state.

The stance these serve is the [mandate](mandate.md).

## Two axes

Color is the only dimension that varies, and it varies along two independent
axes. Everything else — type, spacing, shape, motion, layout, interaction — is
the same in every combination.

| Axis | Decides | Lives in | Switch with |
| --- | --- | --- | --- |
| **Chromatic theme** | What colors exist, at what intensities, and which end of the range the interface reads from | [`themes/`](themes/) | `data-theme` |
| **Semantic set** | Which hue is primary, secondary, tertiary, and the two accents | [`system/color/semantic-sets/`](system/color/semantic-sets/) | `data-set` |

The default composition is **Celestial × blue-primary**, bound to bare `:root`,
so a page that sets no attribute gets it. Two themes and three sets ship today —
six looks from one component tree, with no component changing between any of
them.

```js
document.documentElement.dataset.theme = "cyberpunk";   // celestial | cyberpunk
document.documentElement.dataset.set   = "pink-primary"; // blue- | cyan- | pink-primary
```

Both axes are live in the app header. Because the alternates bind to
`[data-theme=…]` and `[data-set=…]` at the same specificity as the defaults'
bare `:root`, the alternates are imported **after** the defaults — source order
breaks the tie.

The axes are independent by construction: a theme never names a job, and a set
never names a value. Neither can drift into the other's territory, because
neither has the vocabulary to.

## The resolution chain

Four layers. Each answers exactly one question, and a component only ever sees
the last one.

| Layer | Owns | Answers |
| --- | --- | --- |
| **1 · palette** *(theme)* | `--palette-green-normal: #2E9160` | What colors exist, at what intensities |
| **2 · slots** | `--hue-green-fill` | Which intensity does each job, given the ground |
| **3 · anchors** *(set)* | `--anchor-primary-fill` | Which hue is primary, secondary, tertiary |
| **4 · roles** | `--color-interactive-fill` | Which purpose each job-role serves |

Only layer 1 changes with the theme; only layer 3 changes with the set. Layers 2
and 4 are written once and never re-declared.

**A component picks a job, never a color and never an intensity.** It reaches
for `--color-success-text`; it may not reach for `--color-success-strong`,
`--hue-green-text`, or `--palette-green-strong`. The first does not exist, and
the last two generate no utilities, so the rule is enforced by the build rather
than by review.

## Documents

### [`themes/`](themes/) — the chromatic material

A theme is a palette, a `color-scheme`, and its choice of which achromatic
family carries planes and which carries text. It contains no job names at all.
The [contract](themes/README.md) is what a new theme must satisfy.

| Theme | |
| --- | --- |
| [Celestial → theory](themes/celestial/theory.md) | Pearl, illuminated stone, restrained blue-violet light |
| [Celestial → palette](themes/celestial/palette.md) | `color-scheme: light`. Thirteen ramps, seven steps each |
| [Cyberpunk → theory](themes/cyberpunk/theory.md) | Neon signage over a blue-black city, lit from within |
| [Cyberpunk → palette](themes/cyberpunk/palette.md) | `color-scheme: dark`. Authored for a dark ground, not mirrored |

### [`system/`](system/) — theme-independent

Where a dimension has both a feeling and a value table, it splits `theory.md`
from `component.md`. Where its theory is a few sentences, it stays one file —
`spacing` and `shape` do.

| Module | Covers |
| --- | --- |
| [color/slots](system/color/slots.md) | The seven purpose slots and the light/dark step table |
| [color/roles](system/color/roles.md) | The eleven roles × seven slots, and the usage laws |
| [color/semantic-sets](system/color/semantic-sets/README.md) | What a set may and may not decide |
| color/utilities | Where the theme's planes, ink, and seams are exposed to consumers. No document yet — see `system/color/utilities.css` |
| [typography](system/typography/) | Fonts and scale · hierarchy laws and copy voice |
| [motion](system/motion/) | Easing, durations, choreography · motion laws |
| [interaction](system/interaction/) | State matrix and iconography · disclosure |
| [accessibility](system/accessibility/) | Hard requirements · stance and review gates |
| [spacing](system/spacing.md) | The 4px scale and its one declared base unit |
| [shape](system/shape.md) | Radii, borders, elevation, surface recipes |

Where an implementation and a table disagree, that is a bug in one of them — fix
it and say which one was wrong. Where an implementation contradicts theory, the
implementation is wrong.

## Expression

Tokens are declared as **CSS custom properties and nothing else**, so nothing in
the system depends on a particular framework to express it.

Where a build mechanism is load-bearing it is named rather than hidden. Which
`@theme` variables survive into the stylesheet decides whether a token resolves
at all at runtime, which is why [color/roles](system/color/roles.md) documents
it and why every public namespace is declared `static`.

| Namespace | Layer | Holds |
| --- | --- | --- |
| `--palette-*` | 1 | Color primitives. The only literal color values |
| `--surface-*` `--ink-*` `--border-*` | 1 | Planes, text, and seams — the theme's own choice |
| `--hue-*` | 2 | A hue's seven job slots |
| `--anchor-*` | 3 | The five identity anchors a set fills |
| `--color-*` | 4 | The roles. The only color layer a component may use |
| `--text-*` `--font-*` | — | Type steps and families |
| `--spacing` | — | The 4px base unit every step multiplies |
| `--radius-*` `--shadow-*` | — | Corner and elevation |
| `--motion-*` `--ease-*` | — | Duration and easing |

Three rules make the system work regardless of implementation:

- **Every value is declared once.** Color values live in a theme's palette;
  every other dimension declares its values in its own table. A hard-coded hex,
  pixel, or duration at a call site is a defect.
- **Consumers reference roles, never primitives.** A component reaches for
  `--color-success-text` or `--ink-secondary`. The layers below exist so the
  roles have something to resolve to.
- **Only color varies.** Type, spacing, radius, shadow geometry, and motion are
  identical in every theme and every set.

## How to change styling

1. Change the token in the layer that owns it — the chain above says which.
2. Update the matching value in the document here, so this spec stays true.
3. If the change reverses a stated law rather than tuning a value, say so in the
   commit message. Laws are meant to be expensive to change.
