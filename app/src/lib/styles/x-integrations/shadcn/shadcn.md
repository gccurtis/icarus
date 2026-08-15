# shadcn Integration

`bridge.css` maps the vocabulary hard-coded by shadcn-svelte components to
canonical tokens. `variants.css` maps shorthand state variants to attributes
emitted by bits-ui.

`generated.css` is the destination configured in `components.json`. The CLI may
overwrite it, but it is deliberately never imported. Generated declarations
are accepted only by expressing them intentionally in `bridge.css` or
`variants.css`.

Removing this directory may break registry components but must not remove or
alter any canonical token.
