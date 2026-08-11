# Taurus style system (authoritative)

> Status: **authoritative**. These documents pin the styling Taurus Alpha
> actually implements, and their concrete values match [`src/app.css`](../../src/app.css).
> The historical design direction and rationale live in the reference baseline at
> [`docs/support/reference/style/`](../support/reference/style/README.md). When this spec and the
> reference disagree, **this spec wins**; when the code and this spec disagree,
> that is a bug in one of them — fix it and record the decision.

The styling mandate is to make Taurus feel like an **angelic citadel built from
astro-tech**: luminous, calm, precise, structurally obvious, and easy to think
in. This is a discipline for light, structure, elevation, legibility, restraint,
and quiet power — not literal religious imagery or ornamental futurism.

## North star

**Intuitiveness means the product is easy to think in.** The interface should
make the next plausible action mentally available without Taurus-specific
rituals, hidden gestures, or memorized commands.

## Governing principles

1. **The work surface is sacred.** The center stays calm, spacious, and legible.
2. **Disclosure is product architecture.** Show primary actions; group secondary
   actions under predictable abstractions.
3. **Recognition beats recall.** Prefer labels, visible state, examples, and
   stable placement.
4. **Intelligence stays out of the way.** AI appears as useful work, quiet live
   objects, explicit scope, and reviewable change.
5. **The future is calm, not neon.** Precision, depth, responsiveness, and
   restraint create the futuristic character.
6. **Trust is visible.** Derived and agentic work is attributable, inspectable,
   reversible, and explicit about state.

## Documents

| Doc | Authority |
| --- | --- |
| [Aesthetic mandate](aesthetic-mandate.md) | Committed stance |
| [Color system](color-system.md) | Concrete tokens (exact hex, both themes) |
| [Typography system](typography-system.md) | Concrete tokens (scale, fonts) |
| [Surfaces, components, and motion](surfaces-components-motion.md) | Concrete tokens (geometry, radii, motion, surfaces) |
| [Interaction and disclosure](interaction-disclosure.md) | Committed stance |
| [AI Agent Surface](ai-quarterback-surface.md) | Committed stance + implemented frontend shell |
| [Accessibility and usability](accessibility-usability.md) | Committed stance + implemented baseline |

**Concrete tokens** docs enumerate exact implemented values (hex, sizes, token
names, Tailwind utility names). **Committed stance** docs record the principles
we hold ourselves to; where we have already implemented part of one, it is
marked. Deviations get recorded as change records under `docs/archive/records/`.

## Theme posture

Taurus Alpha ships **two themes** as first-class token sets:

- **Celestial Light** — the current **default**, bound to `:root`.
- **Eclipse** — the dark alternate, activated by `data-theme="eclipse"` on the
  root element.

The reference baseline nominated Celestial Light as default and Eclipse as a
first-class alternate; we have adopted that. The default remains provisional
until the first real shell and editor vertical justify a settled choice — but it
is a real, implemented default today, not a placeholder. Theme mechanics are
specified in [Color system → Theming mechanics](color-system.md#theming-mechanics).

## How to change styling

1. Change the token in [`src/app.css`](../../src/app.css).
2. Update the matching value in the relevant doc here so this spec stays
   authoritative.
3. On commit-and-push, record the decision in `docs/archive/records/`.

Source of the original direction: [Taurus Design System — Index](https://app.notion.com/p/392b6410e50281f1a374fa89a941626a)
(preserved under `docs/support/reference/style/`).
