# A named style

| Selecting | What it is | Sections |
| --- | --- | --- |
| A style in the Styles view, or the style link on a selection | One named style: its typography and spacing, edited once for everywhere it is used | Identity · Typography · Spacing · Usage |

Editing a style changes every block using it. That is the point of a style and
the risk of one, which is why Usage is a section rather than a footnote.

## Layout

| 300px |
| --- |
| identity |
| typography |
| typography |
| spacing |
| usage |

## Identity

**Shows** — `Name · Body`, `Based on · Default`

**Needs** — style name and its parent.

**Open** — inheritance depth. A style based on a style based on a style is hard to
reason about in a 320px panel.

## Typography

**Shows** — `Family · IBM Plex Sans`, `Size · 15 pt`, `Line height · 26 pt`, `Weight · 400`

**Needs** — the typography fields on `StyleSet`.

## Spacing

Starts collapsed.

**Shows** — `Space after · 8 pt`, `Indent · 0 in`

**Needs** — spacing fields on the style.

## Usage

How much this affects. Starts collapsed.

**Shows** — "Applied to 41 blocks in this document."

**Needs** — a count of blocks referencing this style.

**Open** — the count should be visible *before* an edit, not after. Whether it
belongs at the top of the lens instead is a review question.
