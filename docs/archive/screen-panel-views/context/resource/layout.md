# Layout

| View | What it is for | Sections |
| --- | --- | --- |
| Layout | Paper, dimensions, gutters, furniture and numbering | Paper · Dimensions · Gutters · Header and footer · Page numbering |

Everything that applies to every page. What is set here is drawn on the page
itself as a dashed guide, so the margin is visible where you write rather than
measured on a ruler above it — which is why there is no ruler.

## Arrangement

| 300px |
| --- |
| paper |
| dimensions |
| gutters |
| gutters |
| header and footer |
| page numbering |

## Paper

**Shows** — `Size · Letter`, `Orientation · Portrait`

**Needs** — `PageSetup` paper and orientation.

## Dimensions

The three sizes a page has at once, in the order they derive from each other: the
sheet, the text area the gutters leave inside it, and what it is actually drawn
at. Read together they say where the character and line budgets below came from —
a wrong margin or a wrong measure shows up here rather than as a page that
mysteriously holds too little.

**Shows** — `Page · 8.50 × 11.00 in`, `Text area · 7.00 × 9.50 in`, `Drawn at · 52.00 × 67.29 rem`

**Needs** — paper and orientation for the first, the margins for the second, and
the rendered page width for the third. All three are derived; none is stored.

## Gutters

All four, named as inside and outside rather than left and right, because a bound
document has a wider inside margin and the setting has to survive a page turn.

**Shows** — `Top · 0.75 in`, `Right · 0.75 in`, `Bottom · 0.75 in`, `Left · 0.75 in`

**Needs** — four margin values on `PageSetup`, and a renderer that draws them.

## Typesetting

The page layout derives the estimate the initial editor uses to move plain text
to the next page.

**Shows** — `Font size · 16px`, `Line height · 26px`, `Characters · 82 per line`, `Lines · 35 per page`

**Needs** — the paper dimensions, margins, and documented average glyph width
assumption. This is a layout estimate until the editor paginates from measured
line boxes.

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
