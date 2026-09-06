# Demo Components

Lives at `src/lib/development-views/demo/components/components.md`. This is the one
document for the complete recursive component tree. Nested component directories
do not carry their own Markdown files.

## Component Tree

The tree is flat. Every section is a leaf rendered directly by the view root, in
the reading order of the documents under `styles/aesthetic/`.

```text
demo.svelte
├── section-nav.svelte           the reading order, as a rail
├── laws.svelte                  01 · Aesthetic
├── palette.svelte               02 · Material
├── roles.svelte                 02 · Material
├── surfaces.svelte              03 · Light
├── typography.svelte            04 · Type
├── motion.svelte                05 · Motion
├── arrangement.svelte           06 · Arrangement
├── states.svelte                07 · States
├── registry-components.svelte   08 · Registry
├── overlays.svelte              08 · Registry
├── disclosure.svelte            08 · Registry
├── controls.svelte              08 · Registry
├── feedback.svelte              08 · Registry
├── data.svelte                  08 · Registry
├── structure.svelte             08 · Registry
├── demo-index.svelte            the way to the other demo pages
└── section-heading.svelte       rendered by every section above
```

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`arrangement.svelte`](arrangement.svelte)
- [`controls.svelte`](controls.svelte)
- [`data.svelte`](data.svelte)
- [`demo-index.svelte`](demo-index.svelte)
- [`disclosure.svelte`](disclosure.svelte)
- [`feedback.svelte`](feedback.svelte)
- [`laws.svelte`](laws.svelte)
- [`motion.svelte`](motion.svelte)
- [`overlays.svelte`](overlays.svelte)
- [`palette.svelte`](palette.svelte)
- [`registry-components.svelte`](registry-components.svelte)
- [`roles.svelte`](roles.svelte)
- [`section-nav.svelte`](section-nav.svelte)
- [`section-heading.svelte`](section-heading.svelte)
- [`states.svelte`](states.svelte)
- [`structure.svelte`](structure.svelte)
- [`surfaces.svelte`](surfaces.svelte)
- [`typography.svelte`](typography.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `section-heading.svelte`

- **Root:** [`section-heading.svelte`](section-heading.svelte)
- **Purpose:** A section's eyebrow, title, optional lede, and the document that
  specifies it.
- **Inputs:** `eyebrow: string`, `title: string`, `source: string`, `lede?: string`
- **Outputs:** `None`
- **Owned children:** `None`
- **Focus behavior:** Not focusable.
- **Layout and overflow:** Column, no scroll owner.
- **Accessibility:** Renders the section's `h2`.

The eyebrow carries the number and the document name, so a reader can see which
of the six aesthetic documents a section is demonstrating before reading it.

### `palette.svelte`

- **Root:** [`palette.svelte`](palette.svelte)
- **Purpose:** Renders the shared ladders as swatches.
- **Inputs:** `None`
- **Outputs:** `None`
- **Owned children:** `section-heading.svelte`
- **Focus behavior:** Not focusable.
- **Layout and overflow:** A grid inside a horizontally scrolling frame.
- **Accessibility:** Each swatch is titled by its property name.

The only component permitted to reference private `--palette-*` properties.
Switching the appearance moves exactly three of its swatches — the entries
Selene overrides.

### `section-nav.svelte`

- **Root:** [`section-nav.svelte`](section-nav.svelte)
- **Purpose:** The eight sections in the reading order of the documents, with the
  document each one demonstrates.
- **Inputs:** `None`. The order is the documents' order and belongs here.
- **Outputs:** `None`. Anchors.
- **Owned children:** `None`
- **Focus behavior:** Every link is keyboard reachable.
- **Layout and overflow:** A sticky rail beside the content at `lg` and above;
  below that, a horizontally scrolling strip under the shell's bar.
- **Accessibility:** Both forms carry the same accessible name.

It is a rail rather than a bar because the list is a **table of contents for a
long document**, and a table of contents that stays beside the reading is worth
more than one that scrolls past it. The appearance control is not here: it
applies to every demo, so it lives on
[the shell](../../demo-shell/demo-shell.md).

### `motion.svelte`

- **Root:** [`motion.svelte`](motion.svelte)
- **Purpose:** Demonstrates the two things motion is allowed to say, by making
  the reader cause one of them and observe the other.
- **Inputs:** `None`
- **Outputs:** `None`
- **Owned children:** `section-heading.svelte`
- **Focus behavior:** Two buttons, both keyboard operable.
- **Layout and overflow:** Two seam-grid cells; each replays its animation on a
  keyed block.

It is the one section that cannot be judged from a screenshot, which is why the
two examples sit side by side: the difference between `ease-standard` and
`ease-arrival` is only legible in comparison.

### Components owning local state

| Component | State | Purpose |
| --- | --- | --- |
| [`motion.svelte`](motion.svelte) | `caused`, `happened` | Replay keys for the two animations |
| [`controls.svelte`](controls.svelte) | `bold`, `marks`, `live`, `confidence`, `scope`, `kind` | Drives the form primitives so each renders in a real state |
| [`data.svelte`](data.svelte) | `cardWidth`, `cardHeight`, `windowWidth`, derived `visible` | Drives the responsive data examples |
| [`disclosure.svelte`](disclosure.svelte) | `commandOpen`, `lastRan` | Whether the command dialog is open, and which command last ran |
| [`registry-components.svelte`](registry-components.svelte) | `inputValue` | Drives the registry input example |

State stays in the component that owns it. No section reads another's state, so
this view has no `shared/`.

## Key Selection

`None`. No model key chooses which component renders; the view root renders every
section in a fixed order.

## Tree Invariants

- Every section renders `section-heading.svelte` as its first child, so each
  claim on the page names the document that specifies it.
- Sections own their own layout. The view root owns page width, padding, the
  section anchors, and the gaps between sections.
- No section reads the client model or calls a capability. This surface renders
  the styling pipeline's public output and nothing else.
- No section applies or offers the appearance. That belongs to the demo shell,
  which frames every page under `/demo`.
- Only `palette.svelte` reads private `--palette-*` properties. Every other
  component references public `--token-*` values or a named surface.
