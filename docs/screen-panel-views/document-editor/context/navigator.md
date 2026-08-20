# Navigator

| View | What it is for | Sections |
| --- | --- | --- |
| Navigator | Getting somewhere in a long document | Outline · Pages · Breaks and furniture |

Two ways to move: by structure and by page. A chip switches between them, because
they answer different questions — "where is the recommendation" and "what is on
page 4".

## Layout

| 300px |
| --- |
| search |
| outline |
| outline |
| outline |
| outline |
| breaks and furniture |

*Pages* is not a second region. It replaces *outline* in the same one, and chips
at the top switch between them.

## Outline

Headings, nested by level, each with the page it currently falls on.

**Shows**

- Q3 Resilience Memo — p.1
- What the field data shows — p.2
- Recommendation — p.3
- Statutory basis — p.3
- Appendix — event log — p.5

**Needs** — heading blocks with their level, and a computed page for each.

**Open** — the page number is a label on a computed layout, not an identifier. It
changes when paper or gutters change, and must never be treated as stable.

## Pages

The same document as a page list rather than a heading list.

**Shows** — page thumbnails or numbered rows, whichever survives review.

**Needs** — the computed pagination.

**Open** — thumbnails need the document rendered small, which is expensive for a
long document. Numbered rows with their first heading may be enough.

## Breaks and furniture

Explicit structure — page breaks the author put in — and the header and footer,
reachable from here rather than only by clicking the page edge. Starts collapsed.

**Shows** — *Explicit page break* — p.4; *Header*; *Footer*

**Needs** — explicit break blocks, and routes to the canonical furniture editors.

## Panel furniture

A filter over the outline.
