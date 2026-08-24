# Project Overview — the workspace

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The only state this screen has | A grounding zone: reset, re-align, and launch from | Header · Create · Review · Filters · Project work |

Three bands: who and what this project is, then the two things you came for side
by side — what to make, and what is waiting on you — then everything the project
contains.

**Nothing on this board scrolls.** The board is a grid of bounded rows rather than
content-height ones, so a long feed or a forty-row project cannot push the table
off the bottom. Where a region holds more than it has height for, the region
gives in — the feed scrolls inside its own frame and the table stops at five rows
— because a screen you have to scroll is a screen you cannot take in at a glance,
which is the only thing this one is for.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `capabilities.project.project` | Capability | the project's name and description |
| `capabilities.project.people` | Capability | who is here now, for the presence faces |
| `capabilities.collaboration.mentionsForViewer` | Capability | what a person addressed to you |
| `capabilities.project.activity` | Capability | what has happened, newest first |
| `capabilities.project.resources` | Capability | every first-class thing in the project, one row each |

The project is not among them as a prop. It is read from `/app/[project]` once
and carried on the client model, so a workspace that took it would be offering a
second answer to a question already settled.

**Health is not among them.** What cannot proceed belongs in the status bar
rather than in the place a person comes to re-orient, so this board has no
connector band to feed.

## Layout

| minmax(0, 2fr) | minmax(0, 3fr) |
| --- | --- |
| header | header |
| create | review |
| filters | filters |
| work | work |

Two tracks: what you can make is a short stack of pills and what is waiting on
you is prose, so the second gets the width. The middle row is capped rather than
`auto`, which is what makes the two regions inside it bounded and the whole board
fit. Below 60rem the bands stack with Review above Create — stacked, the top band
is the one you see first, and what is waiting on you outranks what you might
start.

## Header

The project's name and description, and who is in it right now.

**Example** — `Northwind Grid Resilience` over "Winter-storm hardening case for
the 2026 rate filing.", then three presence avatars and an overflow chip

### Structure

- `ScreenHeader` — title and `about`, with the faces in its `actions` snippet
  - `PanelFaces` — the people present, and the overflow

### Props

`PanelFaces` takes `actors`, `label` "Here now", `onselect` and `onoverflow`.

### Behavior

**There is no Settings button.** Settings are a property of the project rather
than of this screen, and they live in the top bar — a settings control in the
first row of the first tab would make administration the first thing the screen
offers.

Selecting a face opens [that person](../../inspector/collaboration/person.md);
the overflow chip opens [all of them](../../inspector/collaboration/people.md),
because "+4 more" is a question about the group rather than about anyone in it.

## Create

Five pills, stacked, each in its own hue, under a *Create* label.

**Example** — **Create**, then `Document` · `Slide deck` · `Spreadsheet` ·
`Research chat` · `Upload file`

### Structure

- `ScreenGroup` labelled *Create*
  - five buttons, stacked, each with its kind's icon and its own tint

### Props

**The colour is the thing you aim at, so the labels stay plain nouns** rather
than "New document" five times.

The palette assigns exactly five hues to no meaning at all — blue, cyan, violet,
pink and teal — and those are the five. Green, red, amber and grey are excluded
on purpose: a pill is an offer, and an offer wearing the success or danger role
reads as a verdict on something. Cyan is taken through its `secondary` name
rather than its `active` one, because `active` means "currently engaged"
everywhere else on the plane and a permanently cyan Upload pill would look
selected. Document keeps `interactive`: it is the commonest thing anyone makes,
and blue is the hue the application already spends on what it wants you to press.

### Behavior

**Five, not four: Research chat is a thing you make.** A thread is a first-class
object in this project and starting one is a creation act like any other, so it
stands with the other four rather than being reachable only by whoever remembers
where threads live.

The first three open a new editor tab on a minted resource. **The id has to read
as a name**, because the tab strip labels an editor tab by its `resourceId` — and
it carries a counter, so a second Document lands on its own tab rather than on
the first one's. Two blank documents are two things.

Research chat opens a research tab on a thread that has no tab yet: a thread is
what a research tab is *for*, so there is nothing to open until one is named.
Upload file opens [the upload lens](../../inspector/library/upload.md), which
holds the picker and the ingestion state — the same place *Bring in* sends it,
because a second way in must not be a second place.

## Review

What is addressed to you and what has happened, in one region with two faces.

**Example** — `Mentions 4` `Activity` over three rows; the first reads **Mira
Jain** mentioned you on **Q3 Resilience Memo** / "@ana can you confirm 1,842,000
against the relay lo…" — 2h

**Nests** — the two lists share the frame and the two buttons switch between them

### Structure

- two `Button`s — **Mentions**, with its count, and **Activity**
- a bordered frame, exactly three entries tall
  - one row per mention: who, what they did, where, and enough of what they said
    to decide
  - one row per event: who, the verb, the subject, and when

### Props

**No band label.** The two buttons already say what is below them, and a *Review*
caption over a control reading *Mentions* is the same word twice. Create has one
because five pills need to be told what they are.

The frame's height is three entries computed off the type tokens rather than
guessed, so it is exactly three in both states.

### Behavior

**Both lists are the same size.** The two are alternatives, so a frame that
resized as you switched would move the table below it every time.

**A row is two lines, and long text is truncated with an ellipsis.** An excerpt
allowed to run to four lines would push the third row out of the frame, which
would let the deepest thread on the screen decide how much of the rest you can
see.

A mention opens [the comment](../../inspector/collaboration/comment.md); an event
opens [the activity record](../../inspector/project/activity.md). An agent
replying in a thread you follow is a mention. A resource changing is not — that
is Activity, behind the second button.

## Filters

The controls over the table below: a search, a kind filter, an actor filter, a
direction and a sort, with a count.

**Example** — search · `All kinds` · `Anyone` · ↑ · `Updated` · "24 of 24"

### Structure

- `ScreenFilters` — the search, the sort and the matched-of-total count
  - `select` ×2 — kind, and who last updated it
  - `Button` `size="icon-sm"` — the direction, immediately left of the order

### Props

The direction button rides in `children` because that is the only slot
`ScreenFilters` opens, which puts it immediately left of the order — still
adjacent, which is all it needs to be read as the order's other half.

The actor list is taken from the work rather than from the roster. **An agent and
a connector both update resources and neither is a member**, so a list of people
would leave five of the twelve rows unreachable by this filter.

### Behavior

**The sort sorts, and it has a direction.** An order is a claim about the rows,
so choosing one reorders the table and the button beside it says which way.

**The direction's label says what it means for the current order.** "Ascending"
over a relative age is the opposite way round from "ascending" over a name, so
the control reads *Newest first* / *Oldest first* on Updated and *A to Z* / *Z to
A* on the other two, rather than leaving the reader to work it out from the
result.

*Updated* is prose — "4 minutes ago", "Yesterday" — so ordering by it means
reading it. Anything unparseable sorts to the far end rather than to the top,
where an unreadable date would look like the freshest row.

## Project work

Everything the project contains, as one table, cut to five rows.

**Example**

| Name | Kind | Updated | Updated by |
| --- | --- | --- | --- |
| Q3 Resilience Memo | Document | 4 minutes ago | Ana Reyes |
| Why did Feeder 12 fail twice? | Research | Yesterday | Ana Reyes |
| NERC-2025-winter-review.pdf | External file | 4 days ago | SharePoint — Ops Reports |

### Structure

- `ScreenTable` — four columns, five rows
- `ScreenNote` — present only when the filters have hidden something

### Props

Every kind is here — documents, decks, spreadsheets, Research threads, analyses,
external files, findings, connectors — because "what is in this project" is one
question.

### Behavior

**Five rows, and the filters are how you see the sixth.** The note under the
table says so, gives the count, and points at
[the Overview panel](../../context/overview/project.md) for the whole figure — a
table that silently stopped at five would be a project that looked smaller than
it is.

**There is no Status column.** A row is a thing, not a health report: what cannot
proceed is in the status bar, and everything else is left to be what it is.

Selecting a row opens [the resource](../../inspector/project/resource.md).
