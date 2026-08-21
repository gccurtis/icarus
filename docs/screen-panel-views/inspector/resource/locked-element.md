# A locked element

| Selecting | What it is | Sections |
| --- | --- | --- |
| A layout-owned element, selected in the layout subscreen | Content the layout owns and a slide cannot touch | Content · Frame · Editing |

Selectable in the layout subscreen only. On a slide it is visible and inert.

## Layout

| 300px |
| --- |
| content |
| frame |
| editing |

## Content

**Shows** — "Northwind Grid Resilience"

**Needs** — the layout element's content.

## Frame

Position and size, plus who owns it — the owner chip is the point of the section.

**Shows** — `X · 0.040`, `Y · 0.800`, `Width · 0.260`, `Owner · Layout`

**Needs** — the element frame and its owner.

## Editing

Layout-owned and editable only in the layout subscreen. Selecting it there names
Layout, not Slide, as its owner — so the breadcrumb tells you where you are
before you try to type.

**Needs** — nothing.
