# Tailwind Integration

`tailwind.css` registers the canonical token API in Tailwind v4 namespaces and
binds the `dark:` variant to themes whose declared `color-scheme` is dark.
Removing it removes utility generation but leaves canonical tokens complete.

The adapter maps color roles and neutral material into `--color-*`, typography
into `--font-*` and `--text-*`, the spacing unit into `--spacing`, shape into
radius and shadow namespaces, and motion into duration and easing namespaces.
