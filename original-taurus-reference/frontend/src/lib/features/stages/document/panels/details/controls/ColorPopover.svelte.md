# ColorPopover.svelte

The colour palette that drops from the FG and BG swatches in the typography controls. One
component serves both; `target` only changes the labels and whether a "Clear BG" action is
offered.

## Palette grid, reporting a choice upward

```svelte
{#each inspectorColorPalette as color (color)}
  <button
    onclick={() => onpick(color)}
    aria-label={`${target === 'fg' ? 'FG' : 'BG'} ${color}`}
    aria-pressed={current === color}
    class={cn('size-4 rounded-sm border',
      current === color ? 'border-action ring-1 ring-action' : 'border-border-strong')}
    style={`background-color: ${color}`}
  ></button>
{/each}
```

The popover is deliberately dumb: it renders the shared palette and calls `onpick`. It does
not touch `editorSession`, does not know whether it is open, and does not close itself —
`TypographyControls` owns open/closed state and applies the mark, because that component also
has to close the *other* popover when one opens. Keeping the write in one place is what makes
that possible.

`aria-pressed` marks the active swatch and the label carries the target and the hex, so both
popovers are unambiguous to assistive tech and addressable in tests.

## Custom colour and clearing

```svelte
<button onclick={oncustom}>Custom color…</button>
{#if target === 'bg'}
  <button onclick={() => onpick('')}>Clear BG</button>
{/if}
```

`oncustom` asks the parent to open the hidden native `<input type="color">`; the picker lives
in `TypographyControls` because it is shared by both targets and must outlive either popover.

Clearing is offered for background only. An empty value means "no `bg` mark", which is the
document's normal state; foreground always resolves to *some* colour, so a "clear" there would
be indistinguishable from picking the default text colour.

The swatch backgrounds are interpolated into `style`. The values come from
`inspectorColorPalette` (a fixed constant from `$lib/features/shared/inspector-options`, its
neutral home since workstream D's L5 move), so nothing user-supplied reaches CSS here —
unlike the document render path, which is the CSS-injection surface tracked as **S2** in the
issues catalog.
