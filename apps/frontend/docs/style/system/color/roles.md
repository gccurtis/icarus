# Roles

> **Concrete tokens.** The only color layer a component may reach for. Every
> token here names a job, never an intensity and never a hue.

Color is a cognitive map for action, state, authorship, liveness, and trust. The
[palette](../../themes/celestial/palette.md) says what the colors are,
[slots](slots.md) says which intensity does each job; this says what they mean.

Token form: `--color-<role>-<slot>`, as in `--color-success-text`. Every role
expands to all seven [slots](slots.md#the-seven-slots).

## Two kinds of binding

The difference is the whole point of the layering.

**Meaning is fixed here.** Success is green, danger is red, attention is amber,
in every theme and every set. A theme owns what its green *is*; it does not own
what green *means*. A [set](semantic-sets/README.md) may not move these at all.

**Identity resolves through an anchor**, so a set decides it. `interactive` is
the primary anchor, `intelligence` the secondary, `active` the tertiary — which
is what keeps the brand hues and the action hues from ever drifting apart.

## Meaning roles

| Role | Resolves to | Means |
| --- | --- | --- |
| `--color-success-*` | `green` | Applied, accepted, valid, safe |
| `--color-danger-*` | `red` | Failed, rejected, destructive, denied |
| `--color-attention-*` | `amber` | Human judgment required; stale; pending review |
| `--color-inactive-*` | `grey` | Unavailable, disabled, or out of scope |

**`inactive` is grey and needs no special case.** Because the grey ramp spans the
full range, disabled recedes toward the surface through the same slot table as
every other role, whatever the theme.

## Identity roles

| Role | Anchor | Means |
| --- | --- | --- |
| `--color-interactive-*` | `primary` | Can be acted upon: controls, links, focus |
| `--color-active-*` | `tertiary` | Currently engaged, selected, live, resolving |
| `--color-intelligence-*` | `secondary` | Derived work: prompts, memory, formulas, generated content |

**`interactive` and `active` are deliberately different hues.** One is the
affordance — this can be acted upon. The other is engagement — this is selected,
live, or resolving right now. A control wears the first at rest and the second
while it is working, and the two never have to be told apart by intensity alone.
Keeping them distinguishable is a
[set's obligation](semantic-sets/README.md#the-contract), not a suggestion.

## Brand roles

What the product wears when nothing more specific applies — headers, marketing
surfaces, categorical series, illustration.

| Role | Anchor |
| --- | --- |
| `--color-primary-*` | `primary` |
| `--color-secondary-*` | `secondary` |
| `--color-accent-1-*` | `accent-1` |
| `--color-accent-2-*` | `accent-2` |

`primary` and `interactive` share an anchor, and `secondary` and `intelligence`
share one — the brand hues *are* the action and derivation hues, and pretending
otherwise would mean inventing colors with no job. The accents are drawn from
hues no meaning role claims, so brand color can never be mistaken for state.

## Ink and planes

Text and surfaces are roles too, but they are declared by the theme rather than
resolved through a hue, because which achromatic family carries them is a
theme's decision. They are enumerated in the
[theme contract](../../themes/README.md#3-planes-seams-and-text) and their
geometry is in [shape](../shape.md).

Metadata bearing on trust, provenance, or recovery uses `--ink-secondary`, not
`--ink-muted`. Muted is for text a user may safely skip; provenance is never
that.

## The role layer is declared in full

Every one of the 77 tokens is emitted whether or not the current build uses it.
This is deliberate and it costs about 1.5 kB gzipped.

The reason is a sharp edge in the build: **a token referenced only through
`var()` is invisible to the tooling.** Tailwind decides which `@theme`
variables to emit by looking at the utility classes it generated, so
`var(--color-success-surface)` written in a style attribute, a custom CSS
block, or a canvas call does not count as a use. Left to prune, the role layer
emitted 20 of 77 tokens: every unused role — all four brand roles, all of
`intelligence` — resolved to nothing at runtime, and the failure was silent.
A swatch simply painted the page background.

Declaring the layer in full is what makes the role vocabulary *public*: a
consumer may reach for any role token from any kind of CSS, not only from a
utility class.

The layers beneath this one — `--palette-*`, `--hue-*`, `--anchor-*` — were
never at risk. They live outside `@theme` entirely, which is the same decision
that stops them from generating utilities.

## Usage laws

- **Reach for meaning, not hue.** Components use the meaning and identity roles.
  Brand roles are for brand and categorical work; the palette is for neither.
- **Reach for a job, not an intensity.** `--color-success-text`, never
  `--color-success-strong`. The second does not exist, and that is deliberate.
- `interactive` is action, not decoration.
- `active` is engagement, liveness, and resolution.
- `intelligence` is derived work, not ordinary navigation.
- `attention` means human judgment is required.
- `danger` means failure, denial, or destruction — not mere absence.
- `success` means confirmed or safe — not generic positivity.
- `inactive` means unavailable, and always says why.
- Glow is allowed only when it carries state.
- **Respect the ramp.** `surface` slots go behind content; `text` and `on-fill`
  go on top of it.
- **Color never works alone.** Pair it with copy, an icon, position, border, or
  shape. The required pairings are enumerated in
  [the state matrix](../interaction/component.md#state-matrix).

The last law is what keeps thirteen colors from becoming noise. If a new meaning
seems to need a new hue, it almost always needs a second cue on an existing one.

## Contrast

The slots are a contrast contract, and every theme must satisfy it against its
own work surface: `border` meets 3:1 for non-text UI, `fill` meets 4.5:1 so
`on-fill` is legible on it, and `text` meets 7:1 for small or dense text. A
component that picks the right slot for the job is compliant by construction.

Pairings outside that contract — a role's `text` on another role's `fill`, a
content slot on an elevated rather than work surface — are measured before use.
Full requirements are in [Accessibility](../accessibility/component.md).
