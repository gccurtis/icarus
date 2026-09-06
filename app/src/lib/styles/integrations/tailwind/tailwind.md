# Tailwind Integration

`tailwind.css` registers the canonical token API in Tailwind v4 namespaces and
binds the `dark:` variant to the dark appearance. Removing it removes utility
generation but leaves canonical tokens complete.

The adapter maps color roles and achromatic material into `--color-*`, faces and
weights into `--font-*` and `--font-weight-*`, the type scale into `--text-*`
with paired line heights, tracking into `--tracking-*`, measure into
`--container-*`, the spacing unit into `--spacing`, shape into radius, blur, and
shadow namespaces, and motion into duration and easing namespaces.

Two things are deliberately not registered.

**Control heights.** Tailwind has no height namespace; `h-*` reads multiples of
`--spacing`. The three densities are 28, 32, and 40 pixels, which are `h-7`,
`h-8`, and `h-10` on the four-pixel grid. CSS that wants the name uses
`var(--token-control-height)` directly.

**The palette and the slot table.** Declared outside `@theme` on purpose, so
Tailwind generates no utilities from them. A component cannot write
`bg-palette-blue-normal`, because that utility does not exist.

## Every named scale must be told to tailwind-merge

Each scale here is spelled with a word rather than a number or a t-shirt size,
so `tailwind-merge` has nothing to recognise and fails silently in both
directions: it read `text-caption` as a color and let a later color delete it,
and it did not recognise `rounded-control` as a radius at all, so a later
`rounded-full` never lost to it. One scale dropped what it should have kept; the
other kept what it should have dropped, and neither produced a warning because
both outputs were still valid class lists.

**A new `--text-*`, `--tracking-*`, `--container-*`, `--radius-*`, `--shadow-*`,
`--blur-*`, or `--ease-*` registered here belongs in the scale list in
`components/vendored/utils.ts` too.** Nothing enforces it; what enforces it is
that the next person to override one loses, quietly.

## Defaults

The bare `transition-*` utility is pointed at `--token-motion-micro` and
`--token-ease-standard`. Tailwind's own defaults are 150ms and a symmetric
curve, so without this every registry component animates on a timing this system
never chose; `micro` rather than `small` because the bare utility is
overwhelmingly used for press, hover, and toggle feedback.
