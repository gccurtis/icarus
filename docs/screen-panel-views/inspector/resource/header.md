# The header

| Selecting | What it is | Sections |
| --- | --- | --- |
| The header band on any page | The document's one header, and the space it occupies | Header · Spacing · First page · Editing |

## Layout

| 300px |
| --- |
| header |
| spacing |
| first page |
| editing |

## Header

The content, editable.

**Shows** — "Northwind Grid Resilience — Commission filing"

**Needs** — the header furniture content.

## Spacing

**Shows** — `From top · 0.5 in`, `Height · 0.76 in`

**Needs** — the header's offset and its measured height. Height is measured from
content, not set, unless the model says otherwise.

**Open** — whether header height is authored or derived. If derived, it should be
shown as a fact rather than as a field.

## First page

Whether the first page differs, and what it carries if it does.

**Shows** — `Differs · on`, `First-page header · Empty`

**Needs** — a first-page-differs flag and a second header body.

## Editing

Each furniture path has one canonical editor. Its appearance on every page is a
read-only projection of that one state — you are never editing "the header on
page 3".

Stated in the panel because the header is visibly repeated, and repetition
suggests independent copies.
