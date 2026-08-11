# LayoutPanel.svelte

The document's **Layout** context panel. Since workstream B removed pagination, this panel owns
exactly one thing: the document's **default typography** — the lowest level of the typography
cascade. The page-geometry controls (size, orientation, width/height, margins) that used to
fill it are gone: documents render as one continuous flow, so there is no page geometry to
edit; the paper's width and margins are read-only server truth rendered by the stage.

## Script — the default-typography seam

```svelte
  // Documents render as one continuous flow, so there is no page geometry to
  // edit here — the paper's width and margins are read-only server truth. What
  // this panel owns is the document's base (default) typography, the lowest
  // level of the typography cascade.
  const defaultFont = $derived<CustomTypography>($editorSession?.defaultTypography ?? {});
  const defaultFontSize = $derived(parseInt(defaultFont.fontSize ?? '', 10) || 16);
  function setDefault(patch: Partial<CustomTypography>) {
    $editorSession?.actions.setDefaultTypography(patch);
  }
```

`defaultFont` reads the session's document-wide default typography; `setDefault` writes a
partial patch through the `setDefaultTypography` action, which merges it and emits Omega's
`set_default_typography` op. The font size renders as a plain number (px) while Omega stores
the string form.

## The notice

```svelte
  <CanonicalLayoutNotice
    message="This document has no canonical layout — block layout changes preview locally but are not saved."
  />
```

Shared with the Details inspector (`shared/CanonicalLayoutNotice.svelte`): the component owns
the `supportsCanonicalLayout` condition and the styling, each panel words its own warning. The
wording here dropped its "page and …" phrasing when the page controls left.

## Markup — the Default typography section

```svelte
  <section class="space-y-2.5">
    <h3 class="text-label font-medium text-primary">Default typography</h3>
    <p class="text-caption text-muted">The document's base font — blocks and selections override it.</p>
    <Combobox … ariaLabel="Default font" … />
```

Under the "Document defaults" caption, one section: the default font family (a `Combobox` over
the shared inspector font options from `$lib/features/shared/inspector-options`, their neutral
home since workstream D's L5 move), the default size (a `NumberField`, 8–72px), and two native
color inputs for the default text and fill colors. Every control writes through `setDefault`,
so a change is one merged patch and one op. Blocks and selections override these values further
up the cascade (per-block custom typography, then inline marks).
