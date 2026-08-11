# Inline styling + cascading typography (backend-outstanding Phase E)

The full styling vocabulary becomes inline (atom-level), and block, sub-kind, and
document only provide defaults. An atom's effective typography resolves **per
property** down a five-level cascade.

## E1 — Inline typographic marks

Three mark kinds join the inline vocabulary, set through the existing
`add_mark` / `update_mark` lifecycle:

- **`font`** — `Attrs{ family?, size? }` (at least one; each bounded by the
  `CustomTypography` field caps).
- **`color`** — `Attrs{ value }`, the foreground.
- **`background`** — `Attrs{ value }`, the background / highlight.

`color` and `background` values are validated by **`validCSSColor`**: a hex color,
a functional color (`rgb`/`rgba`/`hsl`/`hsla`) over a restricted character set, or
a plain alphabetic named color. The character restriction blocks a value from
smuggling extra CSS (`;`, `:`, `{`, …).

**Markdown** renders only the representable marks (bold/italic/strike/code/link);
`font`/`color`/`background` have no delimiters, so they are silently dropped on
export, and the parser never produces them. No styling round-trip is promised.

## E2 — Cascading typography

- **Block override** — `styleRef.overrides.custom` (existing
  `set_block_custom_typography`); `CustomTypography` gains a **`Background`**
  field alongside its family/size/color.
- **Sub-kind default** — a `StyleDefinition` gains **`Custom *CustomTypography`**;
  a custom (registry-backed) sub-kind contributes its definition's `Custom`.
- **Document default** — `Base.DefaultTypography *CustomTypography`, set via the
  Base-level **`set_default_typography`** op (nil clears; full changeset
  lifecycle, `document-typography` rebase footprint, `DocumentWide` in history).
- **Built-in** — the lowest level: shipped typography for `body` and
  `heading_1…6` (`builtinSubKindTypography`).

**Resolver.** `ResolveTypography(base, block, inline)` returns an
`EffectiveTypography`, taking each property (family, size, color, background) from
the first level that sets it:

    inline mark → block override → sub-kind default → document default → built-in

Resolution is per property and independent — an inline color leaves the family to
be inherited from a lower level. It is a pure backend function (a client renders
by running the same cascade); the backend's job is to validate and store the
layers consistently.

## Tests

- Unit (`core/capability/document`): font/color/background marks accepted with
  valid attrs and rejected for an unsafe color or an empty font; `set_default_
  typography` set/clear + undo; the five-level cascade with independent
  per-property resolution; built-in heading/body sizes; Markdown drops
  non-representable marks while keeping bold.
- Dev-test: `dev-test/typography` extended — set a document default, add inline
  color/background/font marks, reject an unsafe color, and confirm export drops
  the non-representable styling.

## Settled

- Font/color/background are inline marks (`add_mark` lifecycle), colors validated
  as safe CSS. ✓
- `CustomTypography` carries fg + bg; `StyleDefinition` and `Base` carry a default
  `CustomTypography`; `set_default_typography` is a full-lifecycle Base op. ✓
- Per-property cascade resolver, inline → block → sub-kind → document → built-in. ✓
- Markdown is lossy for styling; our layers are the source of truth. ✓

## Follow-up: fg / bg naming

The two color style elements are named **`fg`** (foreground) and **`bg`**
(background) throughout, rather than a `color` field that reads as ambiguous. The
mark kinds are `fg` / `bg`; `CustomTypography` and `EffectiveTypography` carry
`Foreground` / `Background` fields serialized as `fg` / `bg` (this also renames
the pre-existing custom-typography `color` key to `fg`). Behavior is unchanged;
only the names are clearer and symmetric.
