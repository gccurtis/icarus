# shadcn Integration

`bridge.css` maps the vocabulary hard-coded by shadcn-svelte components to
canonical tokens, so the components work unmodified and stay updatable. The
alternative was rewriting every component's class list, which would have to be
redone on every upgrade.

Every value in it is a `var()` reference into a layer that already exists, so
all of it follows an appearance change at runtime. Nothing in it introduces a
color or picks an intensity.

It is declared twice — once inside `@theme static` to satisfy utilities, and
once unprefixed at `:root`. The second block is not redundant: several
components reach for these through arbitrary values such as
`shadow-[0_0_0_1px_var(--sidebar-border)]`, which reference the raw custom
property and never the `--color-*` namespace. Without it those references
resolve to nothing, and the failure is silent — an invalid shadow color simply
does not paint.

`variants.css` maps shorthand state variants to the attributes bits-ui emits.

`generated.css` is the destination configured in `components.json`. The CLI may
overwrite it, and it is deliberately imported by nothing. Anything the registry
wants to inject lands in a file the app never loads; whatever we actually want
is expressed by hand in `bridge.css` or `variants.css`.

Removing this directory may break registry components. It must not remove or
alter any canonical token.
