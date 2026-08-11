# `TemplateSpace.svelte` — the preview, and the context it needs

The center of the screen when the space is Templates: a preview above, the template's context
slots below. They stack vertically and each scrolls inside itself, so the page never scrolls and
the document is read at its natural width rather than squeezed beside a sidebar.

## Prompt / Content

```svelte
<SegmentedControl bind:value={previewMode}
  segments={[{ value: 'prompt', label: 'Prompt' }, { value: 'content', label: 'Content' }]} />
```

Centred in the preview header. **Prompt** is the template as authored, its slots unfilled — a
prompt block reads `Reads ⌐Evidence¬`, a dashed, empty slot. **Content** is the same template with
its slots resolved: `Reads Q3 research inputs`. That is a template's value proposition made
visible in one toggle, and it is why choosing a context belongs on this screen at all.

## Templates are not document-only

The body dispatches on `template.kind`. Document renders as paper with prompt blocks in the
`intel` treatment; spreadsheet renders as a real grid with lettered columns and formula cells.
`bg-work` sits on the **scrolling element**, not the content, so the paper fills the frame instead
of stopping where the text ends.

**`slides` is a declared kind with no renderer here, on purpose.** A slide template is either a
single slide or a whole deck, and either way its preview must be the actual rendered slide;
standing in an outline would design the wrong thing.

## Edit, and where it goes

A preview shows structure; it cannot express typeface, weight, or reordering, and those are real
parts of authoring a template. So the header carries an `Edit` button. **Where it leads is not
decided** — it toasts today. The likely answer is the real document editor rather than a modal,
since a template *is* a document and that editor already exists.

## Context slots are not prompt placeholders

This was got wrong once and is worth stating plainly. A template's context variables are **not**
text substituted into prompt copy. Each is a named requirement for **background material**, filled
by a context from the library — and a prompt block *draws on* a slot rather than interpolating it,
which is exactly Omega's `BlockContext{Include, Exclude}` over declared variable names.

So the section is headed plainly **"Context"**, entries are plain names (`Evidence`,
`House style` — not `{{evidence}}`, no monospace, because none of this is code), and a prompt
block carries a `Reads <slot>` line beneath it instead of a token spliced into the sentence.

## Slots are authored, not just picked

```svelte
<section class="flex h-72 shrink-0 …">
  <div class="grid … grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
    <div>…slot list…</div>
    <div class="border-l border-border bg-panel p-3">…name / what it is for / context…</div>
```

A **fixed height** — the preview gives up room for it, because the two are equally important —
with the slot list scrolling on the left and an inspector-style editor on the right. Selecting a
slot lets you rename it, write what it is for, and choose its context. A read-only row of pills
would have implied the slots arrive fixed, when declaring them is half of what making a template
means.

## Choosing is a modal, not a menu

`Choose a context` opens a searchable modal. A dropdown anchored inside a short panel near the
bottom of the screen ran off the viewport, and the thing being chosen from is the whole library —
too much for a menu either way.

## Room for the AI bar

The outer column carries `pb-24` so [`LibraryQuarterback`](LibraryQuarterback.svelte.md), which
anchors to the foot of the work surface, never covers this space's last row.
