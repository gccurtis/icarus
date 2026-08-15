# Demo Components

Lives at `src/lib/views/demo/components/components.md`. This is the one
document for the complete recursive component tree. Nested component directories
do not carry their own Markdown files.

## Component Tree

The tree is flat. Every section is a leaf rendered directly by the view root, in
this order.

```text
demo.svelte
├── appearance-bar.svelte
├── palette.svelte
├── roles.svelte
├── surfaces.svelte
├── typography.svelte
├── registry-components.svelte
├── overlays.svelte
├── disclosure.svelte
├── controls.svelte
├── feedback.svelte
├── data.svelte
├── structure.svelte
├── states.svelte
├── geometry.svelte
└── section-heading.svelte      rendered by every section above
```

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`appearance-bar.svelte`](appearance-bar.svelte)
- [`controls.svelte`](controls.svelte)
- [`data.svelte`](data.svelte)
- [`disclosure.svelte`](disclosure.svelte)
- [`feedback.svelte`](feedback.svelte)
- [`geometry.svelte`](geometry.svelte)
- [`overlays.svelte`](overlays.svelte)
- [`palette.svelte`](palette.svelte)
- [`registry-components.svelte`](registry-components.svelte)
- [`roles.svelte`](roles.svelte)
- [`section-heading.svelte`](section-heading.svelte)
- [`states.svelte`](states.svelte)
- [`structure.svelte`](structure.svelte)
- [`surfaces.svelte`](surfaces.svelte)
- [`typography.svelte`](typography.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `section-heading.svelte`

- **Root:** [`section-heading.svelte`](section-heading.svelte)
- **Purpose:** A section title and the document that specifies it.
- **Inputs:** `title: string`, `source: string`
- **Outputs:** `None`
- **Owned children:** `None`
- **Behavior delegated to the view root:** `None`
- **Focus behavior:** Not focusable.
- **Layout and overflow:** Column, no scroll owner.
- **Accessibility:** Renders the section's `h2`.

### `palette.svelte`

- **Root:** [`palette.svelte`](palette.svelte)
- **Purpose:** Renders the chromatic ramps as swatches.
- **Inputs:** `None`
- **Outputs:** `None`
- **Owned children:** `section-heading.svelte`
- **Behavior delegated to the view root:** `None`
- **Focus behavior:** Not focusable.
- **Layout and overflow:** Grid of swatches.
- **Accessibility:** Each swatch is labelled by its property name.

The only file permitted to reference private `--palette-*` properties. Its path
is named in `scripts/lint/styles/rules.mjs` and must be updated if it moves.

### `appearance-bar.svelte`

- **Root:** [`appearance-bar.svelte`](appearance-bar.svelte)
- **Purpose:** Selects the chromatic theme and the semantic set the whole page
  renders through.
- **Inputs:** `None`
- **Outputs:** `None`. It applies the selection through
  [`effects/apply-appearance.svelte.ts`](../effects/apply-appearance.svelte.ts)
  rather than reporting it upward.
- **Owned children:** `Select`, `Label`
- **Behavior delegated to the view root:** `None`
- **Focus behavior:** Both selects are keyboard reachable and labelled.
- **Layout and overflow:** Sticky to the top of the scrolling page, full-bleed
  against the view root's padding, and wraps on narrow viewports.
- **Accessibility:** Each select carries a `Label`; the bar is labelled
  "APPEARANCE".

### Components owning local state

| Component | State | Purpose |
| --- | --- | --- |
| [`appearance-bar.svelte`](appearance-bar.svelte) | `theme`, `set` | The active chromatic theme and semantic set |
| [`controls.svelte`](controls.svelte) | `bold`, `marks`, `live`, `confidence`, `scope`, `kind` | Drives the form primitives so each renders in a real state |
| [`data.svelte`](data.svelte) | `cardWidth`, `cardHeight`, `windowWidth`, derived `visible` | Drives the responsive data examples |
| [`registry-components.svelte`](registry-components.svelte) | `inputValue` | Drives the registry input example |

State stays in the component that owns it. No section reads another's state, so
this view has no `shared/`.

## Key Selection

`None`. No model key chooses which component renders; the view root renders every
section in a fixed order.

## Tree Invariants

- Every section renders `section-heading.svelte` as its first child, so each
  claim on the page names the document that specifies it.
- Sections own their own layout. The view root owns page width, padding, and the
  gaps between sections.
- No section reads the client model or calls a capability. This surface renders
  the styling pipeline's public output and nothing else.
- Only `palette.svelte` reads private `--palette-*` properties. Every other
  component references public `--token-*` values.
