# A slide

| Selecting | What it is | Sections |
| --- | --- | --- |
| A slide in the Slides panel | The slide itself: its notes, its layout, its section, and what you do to it | Speaker notes · Slide · Actions · Reset |

Selecting the slide rather than something on it.

## Layout

| 300px |
| --- |
| speaker notes |
| speaker notes |
| slide |
| slide |
| actions |
| reset |

## Speaker notes

The notes, first, because they belong to the slide and the slide is where you
look for them. They are off the canvas: what a slide says is not what it shows.

**Shows** — "Lead with the relay finding, not the spend. If asked about the 2024
precedent, the docket number is in the appendix."

**Needs** — the slide's notes content.

**Open** — notes appear here, in the Notes view, and in a notes lens of their own.
One should be authoritative.

## Slide

**Shows**

| | |
| --- | --- |
| Layout | Title and two panes |
| Section | The case |
| Hidden | off |
| Background | Inherited from layout |

**Needs** — the slide's layout reference, its section, a hidden flag, and an
optional background override.

## Actions

**Duplicate**, **New after**, **Delete**.

**Needs** — duplication that mints new IDs for the slide and every identified
descendant.

## Reset

**Reset to layout** — disabled. Starts collapsed.

**Open** — available only when `fromPlaceholder` resolves to exactly one role,
which placeholders without stable keys cannot guarantee.
