# Styles

| View | What it is for | Sections |
| --- | --- | --- |
| Styles | The named cell styles this spreadsheet uses | Named styles |

The same principle as the document and the deck: format lives on a named style,
not as a per-cell override, so a change reaches every cell that shares it.

## Layout

| 300px |
| --- |
| search |
| named styles |
| named styles |
| footer |

## Named styles

Each row is a name and its distinguishing property.

**Shows**

- Header — 600 · centered
- Currency — `$#,##0.00`
- Total — 600 · top border

**Needs** — the spreadsheet's `StyleSet`.

**Open** — a cell style mixes typography, alignment, borders and value format.
Whether value format belongs on a style or on the cell is a real question: two
cells can want the same font and different decimal places.

## Panel furniture

A search over styles, and **New style** at the foot.
