# Objects — editing a layout

| View | What it is for | Sections |
| --- | --- | --- |
| Objects | What the layout owns, split by what a slide may touch | Locked content · Placeholders |

The split is the whole point of a layout, so the panel is built on it rather than
listing everything together and marking each row.

## Layout

| 300px |
| --- |
| locked content |
| placeholders |
| placeholders |

## Locked content

Content the layout owns outright. Slides using this layout show it and cannot
change it — a footer wordmark, a slide number.

**Shows** — *Footer wordmark*, *Slide number*

**Needs** — the layout's own elements.

## Placeholders

Frames a slide fills in. A slide gets its own copy of each and then owns that
copy — the layout supplies the frame and the style key, not the content.

**Shows** — *title*, *body*, *body* — the second body marked "Same role as the one
above"

**Needs** — the layout's placeholder list with role and style key.

**Open** — placeholders have no stable key. Two with the same role cannot be told
apart, which is why the second one has to be described by its neighbour rather
than named, and why placeholder selection and duplicate-role reset are both
gated.
