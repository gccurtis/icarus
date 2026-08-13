# Motion — theory

> **Committed stance.** Discipline rather than values. The values are in
> [component](component.md).

Motion explains **cause**. It answers where a thing came from, what it came out
of, and whether the system is still working. It is never spectacle, and it never
asks the user to wait through it.

Motion does not vary by theme. A theme changes what the interface is made of,
never how it moves.

## One curve

One easing curve for the whole system. It leaves quickly and arrives gently,
which reads as responsive on the way out and calm on the way in. A second curve
would imply a second kind of causation, and there is not one.

Durations come in four steps with stated ranges. The ranges exist so a one-off
adjustment stays inside the family; a duration outside every range needs a
reason in the commit message.

## Motion laws

- **Layout stays stable.** Content does not reflow, jump, or resize as a
  side-effect of an animation. Reserve the space first.
- **No bounce, no overshoot.** Precision instruments do not wobble.
- **No item-by-item choreography.** A list appears; it does not perform.
- **No perpetual spinners.** Prefer determinate progress. Where the duration is
  genuinely unknown — a long computation, an agent task — use a calm
  indeterminate indicator paired with copy naming the current stage, not a
  spinner that says only "something is happening".
- **Long work reports, it does not entertain.** Work measured in seconds or
  minutes belongs to [state](../interaction/component.md#state-matrix), not
  motion. Resolving is a status, and status is text plus color, not animation.
- **Nothing animates on load.** Entrance animations on first paint delay the
  first read of a work surface for no information gain.

## Movement follows the layout

Movement follows the spatial logic already established by the shell's zones. If
a user can predict where a thing will come from, the animation has done its job
before it plays. The
specific choreography is enumerated in [component](component.md#choreography).

## Reduced motion

`prefers-reduced-motion: reduce` collapses animations and transitions to
approximately zero globally.

**State clarity is not part of what gets reduced.** A drawer that slid in now
appears; it still appears, still takes the right edge, still traps nothing, and
still announces itself. Reduced motion removes choreography, never information —
if a state was legible only because something moved, that state was
under-specified.
