# Blocks Demo

Lives at `src/lib/views/blocks-demo/blocks-demo.md`. Trees live in the concern
document linked below.

## Purpose

Content blocks on the two surfaces that hold them, with the panel that inspects
one, at `/demo/blocks`.

## The claim

The document and the slide render the *same component* with the same data. The
only difference between them is that the slide turns chrome on and the document
does not.

**A content block is data. The box around it is not.** Edges, handles and hover
states are a rendering layer a surface opts into for its own reasons — slides,
where the box is the thing being arranged, and never documents, where visible
block boundaries turn prose into a form. Keeping that as a prop rather than a
fact about the component is what lets one block type serve both.

## The three sizings, and why there are exactly three

- `flow` — the column sets the width, the text sets the height. A document's
  paragraph. It cannot choose its own width without breaking the column it is
  in, and cannot have a fixed height without clipping or leaving a hole.
- `grow` — the text sets the width up to a maximum, and the height is set. A
  slide's text object: a title four words long should be four words wide,
  because on a slide a box is a composition element rather than a column.
- `fixed` — both are set. A shape, an image, a chart. Its size is the point and
  the text inside is a passenger.

## Why the inspector is on this page

What a block can be asked is a function of how it is sized, and that is only
visible with the surfaces beside it. A `flow` paragraph has no width control at
all — not a disabled one, none — because the column owns its width and a control
that cannot work should not be drawn. A `grow` object has a height but no width.
A `fixed` shape has both.

## Boundary

This view owns the sample blocks and the two surfaces' conventions — the
document's measure and padding, the slide's aspect ratio. It does not own the
block components, which live in `unique-components/block/`.

## Public Contract

- **Entry:** [`blocks-demo.svelte`](blocks-demo.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | `None` | — | — | The view takes no props; the route renders it directly |

## Dependencies

- `$lib/unique-components/block` — the subject
- `$lib/unique-components/panel` — the inspector
- `$lib/unique-components/screen` — the surface around both

It reads no client model and calls no capability.

## Concerns

- [`components/`](components/components.md)
