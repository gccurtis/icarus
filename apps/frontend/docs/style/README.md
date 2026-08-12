# Design system

A design system for calm, precise, information-dense application interfaces —
the kind where a user reads far more than they click, where the system produces
derived content the user must be able to trust, and where depth has to be
available without being imposed.

The mandate is an **angelic citadel built from astro-tech**: luminous, calm,
precise, structurally obvious, and easy to think in. This is a discipline for
light, structure, elevation, legibility, restraint, and quiet power — not
literal religious imagery or ornamental futurism.

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

## Documents

Three tiers, ordered from why to what to how. A document's directory tells you
what kind of claim it makes, and a reader can usually stay in one tier.

### `theory/` — what the system believes

Descriptive. No token values, no compositions. These are the arguments the rest
of the system has to satisfy, and the place to look when deciding whether
something is allowed rather than how to build it.

| Doc | Covers |
| --- | --- |
| [Aesthetic mandate](theory/aesthetic-mandate.md) | Thesis, metaphors, design laws, review test |
| [Interaction and disclosure](theory/interaction-and-disclosure.md) | Disclosure ladder, grouping test, visible paths |
| [Accessibility](theory/accessibility.md) | WCAG 2.2 AA target, focus, keyboard, contrast, cognitive load |

### `catalog/` — what the values are

Enumeration. Each document owns one token family and lists it exhaustively.
These are the implementable specification: everything a stylesheet must declare
appears in exactly one catalog table.

| Doc | Covers |
| --- | --- |
| [Palette](catalog/palette.md) | Thirteen color ramps, seven steps each. The only literal color values |
| [Color system](catalog/color-system.md) | Palette → meaning: semantic, brand, and ink roles |
| [Surfaces](catalog/surfaces.md) | Surface and border colors, radii, shadows, selection |
| [Typography](catalog/typography.md) | Fonts, type scale, hierarchy laws, copy voice |
| [Spacing](catalog/spacing.md) | The 4px scale, shell geometry, panel width bounds |
| [Motion](catalog/motion.md) | Easing, durations, choreography, reduced motion |

### `component/` — how they combine

Composition. Where several token families meet and produce something concrete: a
panel, a shell, a control with twelve states. More specific than theory, less
atomic than catalog.

| Doc | Covers |
| --- | --- |
| [Layout](component/layout.md) | Shell zones, resize and collapse behavior, drawer rules |
| [Surface recipes](component/surface-recipes.md) | Elevation levels, named surface compositions, scrolling |
| [Components and states](component/components-and-states.md) | Component principles, iconography, the full state matrix |

Where an implementation and a catalog table disagree, that is a bug in one of
them — fix it and say which one was wrong. Where an implementation contradicts
theory, the implementation is wrong.

## Expression

Tokens are declared as **CSS custom properties and nothing else**. No document
here names a utility class, a CSS framework, or a UI framework. Token names are
grouped by namespace so they read as plain CSS and stay portable into a
framework's theme layer without renaming:

| Namespace | Holds |
| --- | --- |
| `--palette-*` | Color primitives. The only literal color values in the system |
| `--color-*` | Brand and semantic color roles, resolved from the palette |
| `--surface-*` `--ink-*` `--border-*` | Applied color roles: planes, text, seams |
| `--text-*` | Type steps — size and line height |
| `--font-*` | Font families |
| `--spacing-*` | Rhythm and shell geometry |
| `--radius-*` `--shadow-*` | Corner and elevation |
| `--motion-*` `--ease-*` | Duration and easing |

Three rules make the system work regardless of implementation:

- **Every value is declared once.** Color values live in the
  [palette](catalog/palette.md); every other dimension declares its values in its
  own catalog table. A hard-coded hex, pixel, or duration at a call site is a
  defect.
- **Consumers reference roles, never primitives.** A component reaches for
  `--color-success-normal` or `--ink-secondary`, never `--palette-green-normal`.
  The palette exists so the roles have something to resolve to.
- **Only color varies by theme.** Type, spacing, radius, shadow geometry, and
  motion are identical in both themes, so a theme layer contains nothing but
  color mappings.

## Theme posture

Two themes, both first-class and both complete — every semantic token resolves in
each:

- **Celestial Light** — the default, bound to `:root`.
- **Cyberpunk Night** — the dark alternate, activated by
  `data-theme="cyberpunk-night"` on the root element.

Mechanics are specified in
[Color system → Theming mechanics](catalog/color-system.md#theming-mechanics).

> The name *Cyberpunk Night* sits in tension with the mandate's law that the
> interface must not feel like saturated cyberpunk (see
> [Aesthetic mandate](theory/aesthetic-mandate.md#it-should-not-feel-like)). The
> name is deliberate; the law still governs the values. The dark theme is a
> dimensional, low-glare night surface, not a neon one.

## How to change styling

1. Change the token in the stylesheet that declares the theme layers.
2. Update the matching value in the document here, so this spec stays true.
3. If the change reverses a stated law rather than tuning a value, say so in the
   commit message. Laws are meant to be expensive to change.
