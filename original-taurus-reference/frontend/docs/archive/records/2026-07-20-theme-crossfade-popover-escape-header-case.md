# Change record — 2026-07-20 — Theme cross-fade, Escape-to-close, non-uppercase headers

Three small polish items: the light/dark switch eases instead of snapping, popovers
close on Escape, and the table's column headers are no longer uppercase.

## Theme cross-fade

```css
@media (prefers-reduced-motion: no-preference) {
  .theme-transition, .theme-transition *, .theme-transition *::before, .theme-transition *::after {
    transition: background-color var(--motion-theme) var(--ease-taurus), … !important;
  }
}
```

**Why:** flipping the wordmark snapped between palettes abruptly. **How:** a new
`--motion-theme` (420ms) token plus a `.theme-transition` rule that transitions
background/border/text/fill/stroke. `toggleTheme` (theme.ts) adds the class to `<html>`
only for the duration of the switch (removed after 600ms), so colors cross-fade on
toggle but don't animate during normal interaction. Gated on `prefers-reduced-motion:
no-preference`, so reduced-motion users still switch instantly.

## Popover closes on Escape

```svelte
<svelte:window onkeydown={onKeydown} />
<!-- onKeydown: if (open && e.key === 'Escape') { open = false; triggerEl?.focus(); } -->
```

**Why:** the table's search (and filter) popovers needed a keyboard dismiss. **How:**
`Popover` now closes on Escape and returns focus to its trigger — applies to every
popover, including the table's Filter and Search.

## Column headers not uppercase

```svelte
class="… text-caption font-medium text-muted …"  <!-- was: text-label uppercase tracking-wide -->
```

**Why:** the all-caps Name/Type/Updated header read as shouty. **How:** the sort-header
buttons drop `uppercase tracking-wide` for a small, muted, normal-case label.
