# A text block inside an element

| Selecting | What it is | Sections |
| --- | --- | --- |
| Text inside an element, entered by clicking into it | The ordinary content object inside the spatial box | Text · Style · Marks · Inline formula · Ancestry |

The block is the same kind of thing the document editor edits. The element around
it is the slide's contribution.

## Layout

| 300px |
| --- |
| text |
| style |
| marks |
| inline formula |
| ancestry |

## Text

**Shows** — "Three failures in eleven weeks, all traced to the same
mis-coordinated relay pair."

**Needs** — the block's text.

## Style

**Shows** — `Named style · Body`, `Alignment · Left | Center | Right`

**Needs** — the block's style reference into the deck `StyleSet`, and its
alignment.

## Marks

**Shows** — Bold · Italic · Underline · Link

**Needs** — the mark set the block model supports.

## Inline formula

A formula inside the slide's text, listed as a row that opens the variable.

**Shows** — `=outage.feeder12.minutes` — 1,842,000 · read when the slide is shown

**Needs** — inline formula entities in slide blocks, with resolved values.

**Open** — "read when the slide is shown" needs defining. On deck open, on slide
selection, and on presentation are three different behaviours with three
different costs.

## Ancestry

Why there are two lenses here at all. Starts collapsed.

The element is the spatial container; the block is the ordinary content object
inside it. Element frame, rotation and overflow never leak into block content.

**Needs** — nothing.
