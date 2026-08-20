# A proposed finding

| Selecting | What it is | Sections |
| --- | --- | --- |
| A finding proposed beside the answer | A conclusion offered for acceptance: still editable, not yet part of the project | Finding · Body · Standing on · Bears on · Accept |

The most important lens on the screen. Accepting here is what turns a
conversation into knowledge, so the panel is built as a review: read it, fix it,
decide.

## Layout

| 300px |
| --- |
| finding |
| body |
| body |
| body |
| standing on |
| bears on |
| accept |

## Finding

State and title, the title editable before acceptance.

**Shows** — `Proposed`, then `Title · No coordination study exists after the 2024
reconductoring`

**Needs** — a proposed-finding record with a title.

**Open** — a proposed finding has no state in the model at all. Proposed, accepted
and dismissed must exist before any of this can ship.

## Body

The claim in full, editable. What you accept is what enters the lattice — so the
edit has to happen before acceptance, not after, and the section says so.

**Shows** — "Neither the filings index nor the Commission's public docket lists a
coordination study dated after the 2024 reconductoring, which raised available
fault current on the tie by roughly 18%."

**Needs** — an editable body on the proposal.

## Standing on

What it rests on. A finding is a conclusion rather than a quotation, so its
sources are evidence rather than the thing itself — and they can be lattice
sources, web sources, or both.

**Shows** — *feeder-12-relay.pdf · p.7*; *nerc.gov/docket/2024-882*

**Needs** — source references on the proposal, with locators.

## Bears on

What it says something about, and in which direction.

**Shows** — *Q-14 · Why did Feeder 12 fail twice?*; *H-3 · Coordination never
redone* — Supports

**Needs** — proposed `ResearchLink` rows with a bearing per link.

## Accept

**Accept finding** and **Dismiss**.

Accepting writes a `Finding` and its `ResearchLink` rows and makes it retrievable
across the project. That is a durable act with a wide blast radius, which is why
it is its own section rather than a button in a row of four.

**Needs** — one transactional accept that writes the finding and its links
together.
