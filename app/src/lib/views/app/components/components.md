# App Components

Lives at `src/lib/views/app/components/components.md`. This is the one document
for the complete recursive component tree. Nested component directories do not
carry their own Markdown files.

## Component Tree

```text
app.svelte
├── top-bar                          components/top-bar.svelte
└── status-bar                       components/status-bar.svelte
```

The four remaining zones are sibling views, not components, and appear in
[app.md](../app.md) under composed views. What separates them is the promotion
test's first clause: each of those reads the client model, and neither of these
does.

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`status-bar.svelte`](status-bar.svelte)
- [`top-bar.svelte`](top-bar.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

Both are leaves with no inputs and no outputs. The inventory rows above are the
whole contract; what each will become is recorded here because both are expected
to be promoted rather than grown.

### `top-bar`

- **Root:** [`top-bar.svelte`](top-bar.svelte)
- **Purpose:** the first rung of the disclosure ladder — primary actions and
  critical state, always visible and never route-dependent.
- **Inputs:** `None`
- **Outputs:** `None`
- **Owned children:** `None`
- **Behavior delegated to the view root:** placement
- **Focus behavior:** nothing focusable yet
- **Layout and overflow:** fills its grid row; does not scroll
- **Accessibility:** a `banner`-shaped header with no interactive contents yet
- **Promotes when:** it reads sync state, holds a command palette, or otherwise
  needs the client model.

### `status-bar`

- **Root:** [`status-bar.svelte`](status-bar.svelte)
- **Purpose:** infrastructural state — sync, queue, connection — which reports
  and never interrupts.
- **Inputs:** `None`
- **Outputs:** `None`
- **Owned children:** `None`
- **Behavior delegated to the view root:** placement
- **Focus behavior:** nothing focusable yet
- **Layout and overflow:** fills its grid row; does not scroll
- **Accessibility:** a `contentinfo`-shaped footer with no interactive contents
  yet
- **Promotes when:** it reads connection state, which is the first thing it is
  for.

## Key Selection

`None`. Neither component is chosen by a model key; both are always rendered.

## Tree Invariants

- **Neither component reads the client model.** That is the whole reason they
  are components here rather than views, so a model read in either is the signal
  to promote it, not to leave it.
- **Neither owns its position.** Each fills the wrapper the frame places, so
  both stay renderable outside the grid.
