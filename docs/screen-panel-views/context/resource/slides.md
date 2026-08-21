# Slides

| View | What it is for | Sections |
| --- | --- | --- |
| Slides | The deck, as an ordered list, and everything you do to a slide | One section per section of the deck |

The first rail entry and the default. Reordering, sectioning and the four slide
actions all happen here.

## Layout

| 300px |
| --- |
| actions |
| sections of the deck |
| sections of the deck |
| sections of the deck |
| sections of the deck |
| sections of the deck |

## Sections of the deck

Each section of the deck is a section of this panel, holding the slides in it as
thumbnails.

**Shows**

- **Opening** · 2 — slides 1–2
- **The case** · 4 — slides 3–6, with slide 4 current
- **Close** · 2 — slides 7–8, one hidden

**Needs** — the deck's slide order, its sections, per-slide hidden state, and a
thumbnail render per slide.

**Open** — slides have thumbnails, not persisted names, so a section list cannot
be read as text. A section is anchored to its first slide, which means reordering
re-interprets where the boundaries fall.

## Panel furniture

The action row: **New**, **Duplicate**, **Delete**, **Hide**. These act on the
selected slide and sit at the top of the panel that shows it.

**Needs** — duplicating a slide mints new IDs for the slide and every identified
descendant, or two slides share element IDs.
