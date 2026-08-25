# Project Overview — the workspace

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The only state this screen has | A grounding zone: reset, re-align, and launch from | Header · Create · Review · Resources |

Three bands: who and what this project is, then the two things you came for side
by side — what to make, and what is waiting on you — then everything the project
contains.

**Nothing on this board scrolls; two of its bands do.** The board is a grid of
bounded rows rather than content-height ones, so a long feed or a forty-row
project cannot push the table off the bottom. Where a region holds more than it
has height for, the region gives in — the feed scrolls inside its own frame and
so does the table — because a screen you have to scroll is a screen you cannot
take in at a glance, which is the only thing this one is for.

A band that scrolls is a promise that everything in it is reachable. A table cut
to its first five rows is not: it makes a project look smaller than it is, and
leaves the reader to discover from a note that there was more.

**Neither band draws a scrollbar**, on the rule every surface here keeps: the
entry or the row cut off at the frame already says there is more, and a gutter
would spend width — the last column's width, in the table's case — repeating it.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `capabilities.project.project` | Capability | the project's name and description |
| `capabilities.project.people` | Capability | everyone in the project, and which of them are here now |
| `capabilities.collaboration.mentionsForViewer` | Capability | what a person addressed to you |
| `capabilities.project.activity` | Capability | what has happened, newest first |
| `capabilities.project.resources` | Capability | every first-class thing in the project, one row each |
| `capabilities.library.threads` | Capability | the enquiries a Research chat can be opened onto |
| `capabilities.library.analyses` | Capability | the charts an Analysis graph can be opened onto |

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
| resources | resources |

Two tracks: what you can make is a short stack of pills and what is waiting on
you is prose, so the second gets the width.

Three rows, and only the last is elastic. The header is what it is; the middle
row is one measurement taken once; and Resources takes the remainder. Giving it
the remainder is what makes the table inside it scrollable at all — a band with
no height of its own has nothing for a table to give in to.

**Create and Review are two halves of one row and end level, by construction
rather than by agreement.** The band is defined as *four Review entries tall*,
and everything else is derived from it: the feed takes it, Create divides it into
five, and the grid row is it plus the label above. Sizing each half and then
checking the pair is how two numbers drift apart the first time either one of
them changes.

An entry is what an entry is made of — a title line, a caption line and its own
padding — rather than a measured pixel count, which would drift the day the type
scale moves.

Below 60rem the bands stack with Review above Create — stacked, the top band is
the one you see first, and what is waiting on you outranks what you might start.
Stacked, the promise changes and says so: four bands cannot all keep their height
in one column, so every row goes back to its content and the surface takes the
scrolling. A table squeezed into whatever three other bands left over is a table
showing two rows, which is worse than a page that scrolls.

## Header

The project's name and description, and everyone who is in it.

**Example** — `Northwind Grid Resilience` over "Winter-storm hardening case for
the 2026 rate filing.", then three avatars, two of them haloed, and a `+1` chip

### Structure

- `ScreenHeader` — title and `about`, with the faces in its `actions` snippet
  - `PanelFaces` — everyone, present first, and the overflow

### Props

`PanelFaces` takes `actors`, `limit` 3, a label, `onselect`, and an `overflow`
snippet of `DropdownMenu` items. A face and a name in the menu do the same
thing — open that person — because the chip is only where the strip ran out of
room, not a different kind of answer.

Each actor carries `present`. **Presence is a halo and never only a colour**: it
is in the ring, in the face's own title, and again in words beside every name in
the menu.

### Behavior

**There is no Settings button.** Settings are a property of the project rather
than of this screen, and they live in the top bar — a settings control in the
first row of the first tab would make administration the first thing the screen
offers.

**The faces are everyone, those who are here first.** A strip of the present
alone answers "who is here" and leaves "who is in this project" unanswerable from
the header; a strip in roster order can push a present person behind the chip,
which loses the one fact the halo exists to show. Within each half nothing is
ranked.

**The chip opens the rest under itself.** "Who else is in this project" is a list
of four names, and sending someone to a panel to read four names is a journey for
an answer that fits where the question was asked. Selecting a name opens
[that person](../../inspector/collaboration/person.md);
[the roster panel](../../inspector/collaboration/people.md) is what the *context*
panel's Overview reaches, where there is room for the things a menu cannot hold.

## Create

Five pills, stacked, each in its own hue, under a *Create* label.

**Example** — **Create**, then `Document` · `Slide deck` · `Spreadsheet` ·
`Research chat` · `Analysis graph`

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
everywhere else on the plane and a permanently cyan pill would look selected.
Document keeps `interactive`: it is the commonest thing anyone makes, and blue is
the hue the application already spends on what it wants you to press.

The pills fill the band rather than carrying a height of their own, so five of
them come out level with the four entries beside them.

### Behavior

**Five, and two of them are things you open rather than files you make.** A
research thread and an analysis are first-class objects of this project, and
starting either is a creation act like any other — so they stand with the other
three rather than being reachable only by whoever remembers where threads and
charts live.

The first three open a new editor tab on a minted resource. **The id has to read
as a name**, because the tab strip labels an editor tab by its `resourceId` — and
it carries a counter, so a second Document lands on its own tab rather than on
the first one's. Two blank documents are two things.

Research chat and Analysis graph each open a tab on something that has none yet,
and on the first one there is when every one of them already has a tab. A thread
and a chart are what those tabs are *for*, so nothing here mints one — but a pill
that did nothing at all in that case would read as a broken control rather than
as an honest one.

**There is no Upload here.** Bringing a file in is not making one, and the
picker lives where the rest of *bring in* does — on New tab, which is the screen
for arriving with something you already have.

## Review

What is addressed to you and what has happened, in one band with two faces.

**Example** — **Review** with `Mentions 3` `Activity 5` at the far end, over
three rows; the first reads **Mira Jain** mentioned you on **Q3 Resilience
Memo** / "@ana can you confirm 1,842,000 against the relay lo…" — 2h

**Nests** — the two lists share the frame and the toggle switches between them

### Structure

- `ScreenGroup` labelled *Review*, with the switch in its `actions`
  - `ToggleGroup` — **Mentions**, with its count, and **Activity**, with its own
  - a bordered frame, exactly four entries tall
    - one row per mention: who, what they did, where, and enough of what they
      said to decide
    - one row per event: who, the verb, the subject, and when

### Props

**The band is named like Create's, and the switch rides at the far end of the
label row.** A caption and its controls on one line puts every control on this
board in the same place relative to what it acts on; and a band with a label
beside a band without one starts its contents nine pixels lower, which reads as
two halves that do not line up rather than as one row.

The frame's height is four entries computed off the type tokens rather than
guessed, so it is exactly four in both states — and it is the measurement the
band beside it is cut from, which is what keeps the two level.

### Behavior

**A single-choice toggle, because the two are alternatives.** One is showing and
the other is not. Two independent buttons could be pressed into a state the feed
below has no way to draw, and a control that can say something the screen cannot
answer is a control that will eventually be asked to.

**Both lists are the same size.** The two are alternatives, so a frame that
resized as you switched would move the table below it every time.

**A row is two lines, and long text is truncated with an ellipsis.** An excerpt
allowed to run to four lines would push the third row out of the frame, which
would let the deepest thread on the screen decide how much of the rest you can
see.

A mention opens [the comment](../../inspector/collaboration/comment.md) it names;
an event opens [the activity record](../../inspector/project/activity.md) it
names. An agent replying in a thread you follow is a mention. A resource changing
is not — that is Activity, behind the other half of the toggle.

## Resources

Everything the project contains, as one table, under the controls that narrow it.

**Example** — **Resources**, then search · `All kinds` · `Anyone` ·
`Updated`|`↑` · "12 of 12", then

| Name | Kind | Updated | Updated by |
| --- | --- | --- | --- |
| Q3 Resilience Memo | Document | 4 minutes ago | Ana Reyes |
| Why did Feeder 12 fail twice? | Research | Yesterday | Ana Reyes |
| NERC-2025-winter-review.pdf | External file | 4 days ago | SharePoint — Ops Reports |

### Structure

- `ScreenGroup` labelled *Resources*
  - `ScreenFilters` — the search, the order and the matched-of-total count
    - `select` ×2 — kind, and who last updated it
    - `Button` `size="icon-sm"` in the `order` snippet — which way the order runs
  - `ScreenTable` `scroll` — four columns, every row, scrolling inside the band

### Props

Every kind is here — documents, decks, spreadsheets, Research threads, analyses,
external files, findings, connectors — because "what is in this project" is one
question.

**The order wears no glyph and the direction shares its frame.** A control
reading *Updated* has already said it is the order, and an arrow beside that word
is the same claim twice; the one arrow on the row that means something is the
direction's. Which way the order runs is half of one decision, so the two sit
inside one border with a seam between them rather than as two controls that
happen to be adjacent.

**Both filters offer what the work contains, not what the vocabulary allows.**
An agent and a connector both update resources and neither is a member, so a
roster would leave five of the twelve rows unreachable. A written-out list of
kinds fails the other way round: it is a second record of what a project can
hold, and the first row it falls behind on is a row you can see in the table and
cannot select in the control offered for selecting it.

### Behavior

**The count is the whole answer.** The table shows every row that matched, and
the rows scroll inside the band, so "12 of 12" over a table you can reach the
bottom of means what it says.

**The headings stay while the rows move.** A column you cannot name is a column
you have to scroll back up to read.

**The sort sorts, and it has a direction.** An order is a claim about the rows,
so choosing one reorders the table and the button beside it says which way. *The
direction's label says what it means for the current order* — "ascending" over a
relative age is the opposite way round from "ascending" over a name, so the
control reads *Newest first* / *Oldest first* on Updated and *A to Z* / *Z to A*
on the other two, rather than leaving the reader to work it out from the result.

*Updated* is prose — "4 minutes ago", "Yesterday" — so ordering by it means
reading it. Anything unparseable sorts to the far end rather than to the top,
where an unreadable date would look like the freshest row.

**There is no Status column.** A row is a thing, not a health report: what cannot
proceed is in the status bar, and everything else is left to be what it is.

**Selecting a row opens the lens that answers for its kind**, and double-clicking
it opens the thing itself. Two acts, and conflating them would mean you could not
look at anything without leaving the board you came to.

| A row of | Selecting opens | Double-clicking opens |
| --- | --- | --- |
| Document, deck, spreadsheet | [the resource](../../inspector/project/resource.md) | its editor, in a tab of its own |
| Research | [the thread](../../inspector/research/research-thread.md) | the thread's Research tab |
| Analysis, template | [the resource](../../inspector/project/resource.md) | the permanent tab, moved onto it |
| External file | [the file](../../inspector/project/file.md) | the same lens — no screen holds a file |
| Finding | [the finding](../../inspector/research/accepted-finding.md) | the same lens |

**A kind with no screen opens its lens rather than nothing.** A file, a finding,
a connector and a Context are things you look at rather than places you go, and
the honest answer to *open this* is the panel that can read it.
