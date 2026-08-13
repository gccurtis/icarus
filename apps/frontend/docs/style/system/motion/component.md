# Motion — component

> **Concrete tokens.** Exact values, identical in every theme. The stylesheet
> declares these once; nothing may hard-code them at a call site.

The stance these serve is [theory](theory.md).

## Easing

| Token | Value |
| --- | --- |
| `--ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

## Durations

| Token | Duration | Range | Use |
| --- | --- | --- | --- |
| `--motion-micro` | 100ms | 80–120ms | Press feedback, hover, checkbox, toggle |
| `--motion-small` | 150ms | 120–180ms | Small transitions, tooltips, inline reveal |
| `--motion-panel` | 220ms | 180–240ms | Panel collapse and expand, drawer, tab change |
| `--motion-overlay` | 260ms | 200–280ms | Modals, popovers, elevated overlays |

## Choreography

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
