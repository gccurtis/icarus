# Design — one template

| View | What it is for | Sections |
| --- | --- | --- |
| Design | Styles and page setup for the template body | Styles · Page |

The ordinary editor's Styles and Page views, collapsed into one because a
template is usually short and the two together fit.

## Layout

| 300px |
| --- |
| styles |
| page |

## Styles

**Shows** — *Body*, *Heading 1*

**Needs** — the template body's `StyleSet`.

**Open** — whether a template's styles travel with the result. If they do, using a
template imports a style set into the project; if they do not, the result looks
different from the template.

## Page

**Shows** — `Paper · Letter`, `Gutters · 1 in`

**Needs** — `PageSetup` on the template body.

**Open** — merging Styles and Page into one view is a density decision that suits a
short template and will not suit a long one. Worth revisiting once real templates
exist.
