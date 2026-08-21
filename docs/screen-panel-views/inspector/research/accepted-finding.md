# An accepted finding

| Selecting | What it is | Sections |
| --- | --- | --- |
| An accepted finding, from any of the Findings views | A conclusion the project has adopted: retrievable everywhere, and no longer editable in place | Finding · Body · Standing on · Bears on · Actions |

## Layout

| 300px |
| --- |
| finding |
| finding |
| body |
| body |
| standing on |
| bears on |
| actions |

## Finding

State, title, and who accepted it. The two chips say the same thing from two
angles — it is accepted, and it is retrievable.

**Shows** — `Accepted` · `In the lattice`, then `Title`, `Accepted by · Ana Reyes`,
`When · 7 minutes ago`

**Needs** — `Finding` with an accepting actor and time.

## Body

The claim, read-only.

**Shows** — "Both January and March failures cleared upstream of the intended
device, at 0.42 s against a 0.61 s fuse."

**Needs** — the finding body.

## Standing on

Its sources, with how each was captured. Starts collapsed.

**Shows** — *feeder-12-relay.pdf · p.7* — Excerpt copied on accept;
*storm-log-2026-01.csv* — Resource source · locator only

The difference matters: an excerpt is preserved and survives the source changing;
a locator only points, and can rot.

**Needs** — `FindingSource` rows distinguishing a copied excerpt from a locator.

**Open** — `FindingSource.messageId` still names the obsolete `researchMessages`
table rather than the generic `messages` table.

## Bears on

Starts collapsed.

**Shows** — *H-3 · Coordination never redone · Supports*

**Needs** — `ResearchLink` rows with bearings.

## Actions

**Open as resource** treats it as the resource it is. **Withdraw** retracts it.

**Open** — withdrawal semantics. A finding that has been retrieved into a
generated block, or cited by another finding, cannot simply vanish.
