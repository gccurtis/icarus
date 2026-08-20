# A source

| Selecting | What it is | Sections |
| --- | --- | --- |
| A source in the Sources view, or under a finding | Something that was read, and the passage that mattered | Source · Excerpt · Retrieval detail · Used by · Actions |

## Layout

| 300px |
| --- |
| source |
| excerpt |
| excerpt |
| retrieval detail |
| used by |
| actions |

## Source

**Shows** — `Title · feeder-12-relay.pdf`, `Kind · external file`, `Locator · page 7`

**Needs** — the source reference, its kind, and a locator appropriate to the kind
— a page, a cell, a URL fragment.

## Excerpt

The passage itself, which is the reason the source is listed.

**Shows** — "…the recloser operated at 0.42 s, ahead of the 0.61 s fuse clearing
time, so the fault was cleared upstream of the intended device…"

**Needs** — the retrieved region's text.

## Retrieval detail

Scores, shown only when the retrieval tool supplied them. Starts collapsed.

**Shows** — `Relevance · 0.86`, `Density · 0.41`

These are tool output, not generic source fields, and the section says so — a
web source will not have them.

**Needs** — the tool call's per-region scores, carried through to the source row.

## Used by

What this source ended up supporting. Starts collapsed.

**Shows** — *This answer*; *1 accepted finding*

**Needs** — a reverse link from source to the answers and findings citing it.

## Actions

**Open resource** goes to the underlying resource.

**Open** — a web source has no resource to open, only a URL, and a captured page
is a third thing again.
