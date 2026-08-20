# A search result

| Selecting | What it is | Sections |
| --- | --- | --- |
| A result from a test search against this Context | What the search found, where it came from, and what was actually searched | What was found · Where · Scoring · What was searched |

The retrieval test. It answers the only question that matters about a scope: if
an agent searched this, what would it get?

## Layout

| 300px |
| --- |
| what was found |
| what was found |
| where |
| scoring |
| what was searched |

## What was found

The passage, verbatim.

**Shows** — "…no coordination study appears in the filings index after the 2024
reconductoring, though the reconductoring itself raised available fault current
on the tie…"

**Needs** — the retrieved region's text.

## Where

**Shows** — `Source · feeder-12-relay.pdf`, `Page · 7`, `Offsets · 18420 → 18604`

**Needs** — the region's source and locator.

**Open** — offsets are internals. They are useful for debugging retrieval and
meaningless to anyone else; whether they belong in the product view needs
deciding.

## Scoring

Starts collapsed.

**Shows** — `Relevance · 0.86`, `Density · 0.41`

**Needs** — the retrieval scores.

## What was searched

The scope as it stood when the search ran — which is what makes the result
interpretable. Starts collapsed.

**Shows** — `Contents · 211 resources`, `Searchable · 88 of them`, `At · 12:04:31`

**Needs** — the resolved manifest used for the search, recorded with it.
