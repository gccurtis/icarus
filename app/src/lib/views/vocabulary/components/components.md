# Vocabulary Components

Lives at `src/lib/views/vocabulary/components/components.md`. This is the one
document for the complete recursive component tree.

## Component Tree

```text
vocabulary.svelte
├── choosing                         components/choosing.svelte
├── panel-parts                      components/panel-parts.svelte
├── editing                          components/editing.svelte
├── screen-parts                     components/screen-parts.svelte
├── dragging                         components/dragging.svelte
├── compositions                     components/compositions.svelte
├── data-shapes                      components/data-shapes.svelte
├── entry                            components/entry.svelte
│   └── commented                    components/commented.svelte
│       └── comment-box              components/comment-box.svelte
├── stage                            components/stage.svelte
└── section-title                    components/section-title.svelte
    └── commented                    components/commented.svelte
```

The first seven are sections of the page, rendered in that order. The rest are
the page's own furniture, used by the sections. `commented` and `comment-box` are
drawn once above and reached from four more places: both tables render a
`comment-box` in a column of their own, and the compositions section renders one
under each panel.

## Inventory

<!-- generated:inventory:start -->
- [`choosing.svelte`](choosing.svelte)
- [`comment-box.svelte`](comment-box.svelte)
- [`commented.svelte`](commented.svelte)
- [`compositions.svelte`](compositions.svelte)
- [`data-shapes.svelte`](data-shapes.svelte)
- [`dragging.svelte`](dragging.svelte)
- [`editing.svelte`](editing.svelte)
- [`entry.svelte`](entry.svelte)
- [`panel-parts.svelte`](panel-parts.svelte)
- [`screen-parts.svelte`](screen-parts.svelte)
- [`section-title.svelte`](section-title.svelte)
- [`stage.svelte`](stage.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `stage`

- **Root:** [`stage.svelte`](stage.svelte)
- **Purpose:** the frame an example renders inside.
- **Inputs:** a width — `panel` pins to 300px, `screen` fills.
- **Outputs:** `None`
- **Owned children:** `None`
- **Layout and overflow:** clips its content; owns no scroll.

**Why the width matters.** Panel examples are shown at 300px because that is the
real width of a flank. A primitive that reads well at 800px and breaks at 300 is
the exact failure this page exists to catch, so showing one wide would defeat the
page.

### `entry`

- **Root:** [`entry.svelte`](entry.svelte)
- **Purpose:** one word of the vocabulary — what it is, when not to use it, the
  markup, and the rendered result.
- **Inputs:** a name, a use, an optional `instead`, the code as a string, a
  width, and the example as children.
- **Outputs:** `None`
- **Owned children:** [`stage.svelte`](stage.svelte)

**`instead` is the field that makes this a language rather than a list.** Knowing
that `PanelRow` exists is easy. Knowing that a row with no action is not a row,
and that a label-and-value pair is `PanelField` rather than a row with a
subtitle, is the part that is actually learned.

### `section-title`

- **Root:** [`section-title.svelte`](section-title.svelte)
- **Purpose:** a heading and where the thing it documents lives on disk, so every
  claim on the page is traceable.
- **Inputs:** a title, a source path, optional prose.
- **Outputs:** `None`
- **Owned children:** [`commented.svelte`](commented.svelte), so a section can be
  argued with as a whole rather than only word by word.

### `commented` and `comment-box`

- **Roots:** [`commented.svelte`](commented.svelte),
  [`comment-box.svelte`](comment-box.svelte)
- **Purpose:** the review gutter. `commented` is the two-column row — content,
  then the box; `comment-box` is the box, and is used on its own wherever the row
  is already a column of something else.
- **Inputs:** a scope and the row's label. Nothing else: the box builds its own
  id and reads its own thread.
- **Outputs:** `None` to its caller. A note is written to
  [`../shared/comment-log.svelte.ts`](../shared/comment-log.svelte.ts), which
  appends it to a file.

**The id is derived, never passed.** A scope and a label are already unique
together, so building the id from them means a row cannot collect notes under one
key and read them back under another — which is the mistake a hand-written id per
call site eventually makes.

**The gutter is a fixed 17rem column rather than a fraction**, so every box on
the page shares one right edge however wide the content beside it is. Both tables
match it with a column of the same width, which is why the tables lost their
surrounding border: a note box inside a bordered panel reads as part of the
table, and it is not.

### The seven sections

- **Roots:** [`choosing.svelte`](choosing.svelte),
  [`panel-parts.svelte`](panel-parts.svelte),
  [`editing.svelte`](editing.svelte),
  [`screen-parts.svelte`](screen-parts.svelte),
  [`dragging.svelte`](dragging.svelte),
  [`compositions.svelte`](compositions.svelte),
  [`data-shapes.svelte`](data-shapes.svelte)
- **Inputs:** `None`. Each holds its own illustrative content.
- **Outputs:** `None`. Example handlers are no-ops, with the one exception
  below — the page demonstrates shapes, and a working control here would be a
  fifth kind of lie.
- **Owned children:** `entry` and `stage`, and the primitives being documented.

**`editing` is the exception, and it has to be.** An edit control is judged by
its gesture: whether a double-click is discoverable, whether Escape abandons
cleanly, whether committing on blur feels like theft. None of that can be read
off a static picture, so the examples there hold local state and typing in one
changes it. Nothing is saved anywhere, which keeps the page's claim intact — the
state dies with the tab, and the last section says what a real one would have to
write to.

It exists at all because the vocabulary could only display. Every other section
documents a shape for something the model owns; a language with no way to hand a
value back is a language for a reader, and half of what these screens are for is
making things.

`choosing` comes first deliberately. The components are easy to enumerate;
choosing between two that could both hold the same content is the thing that has
to be written down, because otherwise every author decides it again and the
panels drift apart.

`data-shapes` comes last, and is what keeps the page honest: every example above
it renders a string, and it says form by form what a real one would have to ask
for.

## Tree Invariants

- **No section reads the client model.** The page renders without a project.
- **No example does anything.** Handlers are no-ops, so nothing here can be
  mistaken for a working surface.
- **No section styles a primitive.** If an example needs a wrapper to look right,
  the primitive is wrong and the fix belongs in `unique-components/`.
