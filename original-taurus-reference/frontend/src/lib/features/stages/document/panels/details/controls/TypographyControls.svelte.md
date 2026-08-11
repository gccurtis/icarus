# TypographyControls.svelte

Inline formatting for the three text-bearing lenses — Selected Text (`run`), Next Text
(`new-text`), and New Block. Font family and size, foreground and background colour, the mark
toggles, and the reference/link field. The font and reference-type option lists come from
`$lib/features/shared/inspector-options`, their neutral home since workstream D (the
`$data/document-inspector` facade and then `systems/documents/inspector.ts` both retired).

Everything here is a **range-based mark**. It applies to the current selection or is stored as
the pending format for the next typed character; nothing in this component writes a block-level
property. That is the line that separates it from `TextTypeAndSpacing`, which is block- and
row-scoped.

## Props: the typography state and a re-seed key

```svelte
let { typography, selectionKey }: { typography: TypographyState; selectionKey: string } = $props();
```

The three lenses that render this all intersect `TypographyState`, so each passes its own
`selection` straight through. Taking the state as a prop rather than re-deriving it from the
store is what lets the component stay mode-agnostic: it never asks which lens it is inside.

## Local drafts and popover state

```ts
let fgOpen = $state(false);
let bgOpen = $state(false);
let colorTarget = $state<'fg' | 'bg'>('fg');
let colorPicker = $state<HTMLInputElement>();
let linkDraft = $state('');
let linkFor = $state('');
```

All of this used to live in `DetailsPanel` alongside the state of every other control. Owning
it here is the point of the decomposition — the state and the markup that reads it are now one
unit, and nothing else can perturb it.

Opening one colour popover closes the other, which is why both flags live in this component
rather than inside `ColorPopover`: a popover cannot close its sibling.

## Re-seeding the reference draft

```ts
$effect(() => {
  if (selectionKey !== linkFor) {
    linkFor = selectionKey;
    linkDraft = typography.linkHref ?? '';
    referenceType = 'link';
  }
});
```

The link field is a local draft so that typing is not overwritten by every store update. It
adopts the new target's href only when the selection key actually changes — the guard is what
makes it safe to run in an effect that fires on any session change.

## Applying colour

```ts
function applyColor(target: 'fg' | 'bg', value: string) {
  $editorSession?.actions.setInlineStyle(target, value ? { value } : null);
  fgOpen = false;
  bgOpen = false;
}
```

One writer for both palette picks and the native picker, so closing behaviour cannot drift
between the two paths. A blank value clears the mark, which is how "Clear BG" is expressed.

The hidden `<input type="color">` lives here rather than in the popover because it is shared by
both targets and must outlive whichever popover requested it — the popover unmounts as soon as
the click closes it.

## Marks and the quote action

The five mark toggles are driven by `typography.marks`, so their pressed state reflects what is
actually present in the selection. `Quote` sits beside them but is not a mark — it wraps the
selection in quotation marks as a plain text edit, which is why it has no pressed state.
