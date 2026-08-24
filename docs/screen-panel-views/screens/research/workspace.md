# Research — the workspace

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The only centre this screen has | One line of enquiry: the turn you are on, and what it produced | Screen header · Ask · Answer · Findings · Composer |

**A thread is a tab.** It is a thing you open, work in and close — like a document
and unlike a library — so a research tab is keyed by the thread's own id, several
are open at once in the frame's strip, and closing one closes a tab. A private
strip inside this screen would be a second answer to a question the frame already
answers, and it would put one screen's internal navigation in the row that says
what you are working on.

**Which threads exist is the rail's business; which are open is the frame's.**
[The Threads view](../../context/library/threads.md) lists every thread in the
project, and opening one mints or activates its tab. A list of threads is a map,
and a map belongs in the panel that holds maps rather than in a centre of its
own.

The centre is anchored to a single turn rather than scrolled through all of them.
Earlier turns are [the History view](../../context/research/history.md) in the
context panel; this is the question you just asked, sitting beside what it
produced.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.resourceId` | Model | which thread this tab is for |
| `view.tabs` | Model | which threads already have a tab, so **New thread** opens one that does not |
| `capabilities.research.thread` | Capability | the thread: title, mode, agent, anchor |
| `capabilities.research.threadsIn` | Capability | every thread in the project, to pick the next one from |
| `capabilities.research.currentTurn` | Capability | the turn this screen is anchored to: prompt, time, answer |
| `capabilities.research.searchScope` | Capability | what the thread can search, and whether the web is in it |
| `capabilities.research.sourcesForTurn` | Capability | what was read for this turn, with locators and excerpts |
| `capabilities.research.traceIn` | Capability | the tool calls behind each turn |
| `capabilities.research.proposedIn` | Capability | what this turn proposed |
| `capabilities.research.acceptedIn` | Capability | what this thread has accepted |
| accept/dismiss decisions | Prop | held on the screen, because proposed, accepted and dismissed have no state in the model |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a workspace that took it would be offering a second
answer to a question already settled.

## Layout

| 1.35fr | 1fr |
| --- | --- |
| screen header | screen header |
| ask | findings |
| answer | findings |
| answer | findings |
| composer | composer |

**The tracks are 1.35fr and 1fr because the judgment is made across them.**
Accepting a finding is decided while reading the answer, so the two have to be
readable at once — but the answer is prose at a reading measure and a finding is
a title and a line, so the answer gets the larger share and the findings column
stays a column rather than becoming a second body of text.

**The ask band is `auto` and the answer's two are `1fr` each.** A prompt is two
lines, and giving it a literal third of the plane would be a hole above the thing
that matters; whatever height the ask does not want, the answer takes. *Answer*
and *findings* scroll inside themselves so that neither pushes the composer off
the foot of the screen.

Below 60rem a reading measure and a column of cards stop fitting side by side, so
the grid becomes one column in the order of the turn — what you asked, what came
back, what it produced — with the composer still last, and the surface itself
takes over the scrolling.

## Screen header

Which thread this is, what job it has, who is answering, and the way to another.

**Example** — **Why did Feeder 12 fail twice?** · `Question` · a *Grid Analyst*
selector · **New thread**

### Structure

- `h1` — the thread's title
- `PanelChip` — the mode, as a label rather than a control
- `Select` — the answering persona
- `ScreenAction` — **New thread**, pushed to the end of the row

### Props

**The title is here.** A research tab is keyed by the thread, so the frame's
strip carries the thread's name and this heading says it again — which is worth
one line, because the heading is what a reader lands on and the strip entry is
what they navigate by.

### Behavior

**The agent and the mode are the thread's, not the turn's.** The selector sets
the persona for everything the thread will do next; there is no per-turn switch,
and the mode is not a control at all — what a thread is for is chosen when it
starts.

**New thread** opens a thread from the library that has no tab yet. Nothing
creates a thread, so minting an id would put a tab in the strip that no door can
answer for.

## Ask

The prompt, as a card, with what it was allowed to look at.

**Example** — "You asked · 10:21" over "Was the coordination study ever redone
after the 2024 reconductoring?", then `Field reports 2024–25` and `Web`

### Structure

- a bordered card: the time, the prompt, and the scope chips
- `ScreenNote` `tone="gap"` — that the chips are the thread's scope now, not the
  scope this turn ran under

### Behavior

Per-request scope is not stored, so reopening an earlier turn cannot show what it
could actually see. The note says so rather than letting current chips be read as
a record of the past.

## Answer

The reply, its citations, then the trace — in that order, so the claim comes
before the machinery.

**Example** — a paragraph of prose; two `PanelQuote`s each naming a source and
quoting the passage; then trace chips reading `lattice.retrieve · 4 regions ·
1.2 s` and `web.search · nothing found · 2.8 s`

### Structure

- the answer, at a reading measure
- `ScreenGroup` *Stands on*, counted
  - `PanelQuote` ×n — the excerpt, with `source` the title and locator
- `ScreenGroup` *How it was produced*, counted
  - `PanelChip` ×n in buttons — one per tool call

### Props

A call that found nothing takes `tone="attention"`; the rest are neutral. It is
an outcome rather than an error, and it is the most informative chip on the
screen when an answer came back thin — which is why it is the only one toned.

### Behavior

Selecting a quote opens [the source](../../inspector/research/source.md); a chip
opens [the call](../../inspector/research/tool-call.md).

## Findings

What the answer produced, decided one at a time, over what the thread has already
accepted.

**Example** — *Coordination study was not redone* — `Inference` — with **Accept**
**Edit** **Dismiss**; below it, *Feeder 12 tripped twice on the same fault* —
`In the lattice` · Ana Reyes · 2 days ago

### Structure

- `ScreenGroup` *Proposed here*, counted
  - `ScreenDecision` ×n — title, derivation, verdict, and an `actions` snippet
    - `PanelChip` ×n — what it stands on, and what it bears on
  - `ScreenEmpty` — where the turn proposed nothing, which is a result rather
    than a failure
- `ScreenGroup` *Accepted in this thread*, counted
  - `ScreenCard` ×n — with a `success` chip reading *In the lattice*

### Props

`verdict` is one of *Proposed*, *Accepted* or *Dismissed*. A bearing chip is
`success` for Supports, `danger` for Contradicts and `neutral` otherwise.

### Behavior

**A decided proposal stays where it was.** A card that vanished on Accept would
leave the reader unable to check what they had just done, so the decision is
carried on the card as a verdict and the controls change rather than going away —
a dismissed finding can be accepted after all, which is the reason the card is
still there.

**A finding is a conclusion, not a quotation.** One of them reads *Inference*
rather than pretending a source says it outright, and the derivation is on the
card because that is the difference between accepting a conclusion and copying a
passage.

**Accepted is retrievable project-wide and proposed is not.** That is the whole
difference between the two bands, and the `In the lattice` chip is what says it.

Accept and Dismiss are held on the screen. Proposed, accepted and dismissed live
only in the mock door, so the verdict is a statement about this session rather
than a claim to have written anything.

## Composer

The next question, framed by what the thread already is.

**Example** — `Question mode`, "anchored to Q-14 · the coordination study"; a
field reading "Ask the next question…"; **Context** and **Web** toggles; **Ask**

### Structure

- the mode chip and the anchor, across the top
- `Textarea` — two rows
- `Button` ×2 — **Context** and **Web**, filled when on
- `Button` — **Ask**, disabled on an empty field

### Behavior

**Context and Web are the next request's scope, not the thread's.** Both start on
— a thread that could search the web once can search it again — and the pair is
here rather than on the header because it is the one scope decision that is
genuinely per-turn. Nothing reads them yet: no capability takes a request, so the
two toggles carry the choice and no more.

**Ask** is disabled on an empty field and clears it. There is nothing to dispatch
to — `currentTurn` answers with the turn the thread is anchored to, and no door
appends one — so asking cannot yet produce a turn, and the field emptying is the
whole of what happens.

**The Copilot's composer is disabled on this screen.** This is already a
conversation with an agent, and the composer at the foot is the one place to say
the next thing. Nothing enforces it yet; see
[the status bar](../_shared/status-bar.md).
