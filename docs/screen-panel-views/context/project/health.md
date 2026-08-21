# Health

| View | What it is for | Sections |
| --- | --- | --- |
| Health | Only the things that genuinely cannot proceed | Connectors · Extraction · Automations |

The machine's problems, kept out of Mentions so that a person addressing you and
a token expiring never compete for the same attention.

Nothing derived appears here. A prompt block and a formula both read their value
when they run, so neither can fall behind and neither is ever listed as a problem.

## Layout

| 300px |
| --- |
| connectors |
| extraction |
| automations |
| footer |

## Connectors

Connections that cannot sync, and connections that can — the working ones are
shown so the section is a state of the world rather than a list of complaints.

**Shows**

- *SharePoint — Ops Reports* — Authentication expired 6d ago
- *Google Drive — Filings* — Synced 2h ago · 148 files

**Needs** — `Connector` sync state, last sync time and error.

## Extraction

Files nothing can be read out of. Until text comes out of a file, nothing in it
is retrievable, which makes this a retrieval problem rather than a file problem.

**Shows** — *NERC-2025-winter-review.pdf* — Scanned PDF, no text layer

**Needs** — extraction state and failure reason on `ExternalFile`.

## Automations

Rules that could not dispatch.

**Shows** — *Nightly filing digest* — Last dispatch failed

**Needs** — last-fire outcome on `Automation`.

**Open** — with no run table, "last dispatch failed" is all there is. The row must
not imply a history it cannot show.

## Panel furniture

**Open Automations** at the foot.
