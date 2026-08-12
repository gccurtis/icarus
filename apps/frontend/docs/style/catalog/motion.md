# Motion

> **Concrete tokens.** Exact values. The stylesheet declares these once;
> nothing may hard-code them at a call site.

Motion explains **cause**. It answers where a thing came from, what it came out
of, and whether the system is still working. It is never spectacle, and it never
asks the user to wait through it.

## Easing

| Token | Value |
| --- | --- |
| `--ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

One curve for the whole system. It leaves quickly and arrives gently, which reads
as responsive on the way out and calm on the way in. A second curve would imply a
second kind of causation, and there is not one.

## Durations

| Token | Duration | Range | Use |
| --- | --- | --- | --- |
| `--motion-micro` | 100ms | 80–120ms | Press feedback, hover, checkbox, toggle |
| `--motion-small` | 150ms | 120–180ms | Small transitions, tooltips, inline reveal |
| `--motion-panel` | 220ms | 180–240ms | Panel collapse and expand, drawer, tab change |
| `--motion-overlay` | 260ms | 200–280ms | Modals, popovers, elevated overlays |

The ranges exist so a one-off adjustment stays inside the family. A duration
outside every range needs a reason in the commit message.

## Choreography

Movement follows the spatial logic already established by
[the layout zones](../component/layout.md#zones). If a user can predict where a
thing will come from, the animation has done its job before it plays.

- **Panels move toward the edge they collapse into.** Context leaves to the left,
  the inspector to the right.
- **The drawer enters from the right edge it is anchored to**, at
  `--motion-panel`, over a work surface that does not move.
- **The composer expands from its bottom anchor.** The anchor stays put; the
  input grows upward. Nothing below it shifts.
- **Overlays rise and fade together** at `--motion-overlay`, from near the
  control that opened them.
- **Reversal retraces.** Closing plays the opening in reverse, at the same
  duration. An element that enters from the right and leaves downward makes the
  layout feel unreliable.

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
  minutes belongs to [state](../component/components-and-states.md#state-matrix), not motion.
  Resolving is a status, and status is text plus color, not animation.
- **Nothing animates on load.** Entrance animations on first paint delay the
  first read of a work surface for no information gain.

## Reduced motion

`prefers-reduced-motion: reduce` collapses animations and transitions to
approximately zero globally.

**State clarity is not part of what gets reduced.** A drawer that slid in now
appears; it still appears, still takes the right edge, still traps nothing, and
still announces itself. Reduced motion removes choreography, never information —
if a state was legible only because something moved, that state was
under-specified.
