# Layout

> **Compositions.** How the shell is arranged and how it behaves under pressure.
> The dimensions it arranges are enumerated in
> [Spacing](../catalog/spacing.md).

Layout is what makes complexity feel weightless. Spatial zones stay in the same
place, at the same size, doing the same job, so a user navigates by memory of
*where* rather than by reading every label again.

## Zones

The shell is a stable frame with one variable center:

```text
┌─────────────────────────────────────────────────────────┐
│  top bar                                     --spacing-topbar
├─────────────────────────────────────────────────────────┤
│  tab strip                                --spacing-tabstrip
├────┬───────────────┬────────────────────┬───────────────┤
│    │               │                    │               │
│rail│   context     │    work surface    │   inspector   │
│    │               │                    │               │
│    │ --spacing-    │      (flexible)    │ --spacing-    │
│    │    context    │                    │    inspector  │
├────┴───────────────┴────────────────────┴───────────────┤
│  status                                     --spacing-status
└─────────────────────────────────────────────────────────┘
```

- **Context is a map.** It answers "where am I and what else is here?"
- **The work surface is the product.** Everything else exists to serve it.
- **The inspector is a lens.** It answers "what is this selected thing?"
- **Status is infrastructural.** Sync, queue, and connection state live here and
  never interrupt.

The drawer is not in the diagram because it is not a permanent zone. It arrives
over the right edge when an object needs more room than the inspector has.

## Layout laws

- **Zones do not move.** A panel may collapse or resize; it may not relocate.
  Stable placement is how recognition beats recall.
- **The center is where generosity beats density.** When a layout must lose
  space, it comes out of chrome first — see
  [design law 1](../theory/aesthetic-mandate.md#design-laws).
- **Resize stays inside the range.** A user may resize a panel between its
  minimum and maximum; nothing may drag it outside them. Below the minimum a
  panel stops being readable, and above the maximum it starts competing with the
  work surface.
- **The drawer supersedes the inspector.** Both are anchored to the right edge,
  and they never split it. While a drawer is open it takes the edge and the
  inspector is suspended rather than squeezed — the alternative is two narrow
  columns that are each too small to work in.
- **The drawer overlays; it does not reflow the work surface.** Content stays
  visible and in place behind it, so opening detail never costs the user their
  position.
- **Collapse before you shrink.** When space runs short, collapse a whole zone to
  its rail rather than compressing every zone below its minimum.
- **One scroll context per zone.** Nested scrolling regions inside a panel make
  position unrecoverable.
