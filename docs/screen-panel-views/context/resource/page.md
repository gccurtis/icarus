# Page

| View | What it is for | Sections |
| --- | --- | --- |
| Page | Paper, gutters, furniture and numbering | Paper · Gutters · Header and footer · Page numbering |

Everything that applies to every page. What is set here is drawn on the page
itself as a dashed guide, so the margin is visible where you write rather than
measured on a ruler above it — which is why there is no ruler.

## Layout

| 300px |
| --- |
| paper |
| gutters |
| gutters |
| header and footer |
| page numbering |

## Paper

**Shows** — `Size · Letter | A4`, `Orientation · Portrait | Landscape`

**Needs** — `PageSetup` paper and orientation.

## Gutters

All four, named as inside and outside rather than left and right, because a bound
document has a wider inside margin and the setting has to survive a page turn.

**Shows** — `Top · 1.00 in`, `Bottom · 1.00 in`, `Inside · 1.25 in`, `Outside · 1.00 in`

**Needs** — four margin values on `PageSetup`, and a renderer that draws them.

**Open** — inside/outside only means something for a two-sided document. Whether
one-sided documents show left/right instead needs deciding.

## Header and footer

The reserved bands and whether the first page differs. Starts collapsed.

**Shows** — `Header · 0.5 in`, `Footer · 0.5 in`, `First page differs · on`

**Needs** — header and footer heights, and a first-page-differs flag.

## Page numbering

Starts collapsed.

**Shows** — `Start at · 1`, `Position · Footer, outside`, `Show on first · off`

**Needs** — numbering start, position and first-page visibility. Page numbers are
generated from these, never typed as footer content.
