# Shared — the status bar

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The bar across the foot of every screen | What the work surface is on, the Copilot, and what is waiting on you | Work · Copilot · You |

**Three parts, and the middle one is the Copilot.** Left is about the work, right
is about you. A resource's state and a person's attention are different kinds of
fact, and putting them at opposite ends is what stops the bar becoming a single
run of unrelated chips.

**The Copilot is a row of the frame, not a dock floating over it.** A bar hovering
over the work covers the bottom of every screen and has to be made translucent to
be bearable, which would leave the one always-available input in the application
as the hardest thing on it to read. A row of its own costs 8px more than the
status bar takes and covers nothing.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.resourceId` | Model | the identified thing a tab edits, where there is one |
| `view.active.focus` | Model | what a singleton's centre is on, where no resource id names it |
| `view.frame.inspectorCollapsed` | Model | whether engaging the composer also has to open the inspector |
| `capabilities.project.resources` | Capability | the name and kind behind the subject's id |
| `clientModel().copilot` | Model | mode, persona, draft, focus requests, and whether sending is blocked |
| `capabilities.collaboration.mentionsForViewer` | Capability | what is addressed to you, for the unresolved count |
| `VIEWER` | Model | who you are |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a surface that took it would be offering a second answer
to a question already settled.

## Layout

| var(--app-context) | 1fr | var(--app-inspector) |
| --- | --- | --- |
| work | copilot | you |

**Its columns are the frame's columns.** Left sits under the context panel, the
composer under the work surface, right under the inspector — so the Copilot is
under the thing it is talking about rather than centred over a layout it has
nothing to do with. The widths are read from the frame's own custom properties,
so the three parts track the panels as they are dragged.

Below 60rem the bar becomes one column and the two ends drop out: what is on the
surface and what is waiting for you both already have somewhere to be, and the
composer is the part that cannot.

## Work

What the centre is on. Never a control, except for the subject.

**Example** — "Q3 Resilience Memo · document", and "Nothing open" where the
centre is on nothing at all

### Structure

- the subject, truncated with an ellipsis
- a separator, then its kind, where the project knows one

### Props

The subject is `view.active.resourceId` first and `view.active.focus` second: a
tab that edits an identified thing is named by it, and a singleton keeps its
subject in `focus` because it moves between subjects without ever minting a tab —
the Agents tab on a persona is the case a resource id cannot describe. The id
resolves through the project's resources to a name, and falls back to the id
itself, so the line is never blank.

**Which screen is showing is deliberately absent.** It has a tab with its name on
it two rows up, and repeating it here would spend the one always-visible line in
the application on its least surprising fact.

### Behavior

**A status bar that acted on things would be a toolbar.** The only live thing on
this side is the subject, which opens what it names. Everything else here states.

This is where resource-level facts belong as they arrive — sync state, extraction
progress, a connector that cannot proceed. That is why Project Overview carries no
health band: something that cannot proceed is a standing condition rather than an
item on a to-do list, and a standing condition belongs on the line that is always
there.

## Copilot

The one surface that belongs to no tab: a composer, its mode, and who is
answering.

**Example** — `Ask ▾` · "Describe the next move" · `Generalist ▾` · ↑

### Structure

- `Select` — the mode: Ask · Plan · Act
- a `textarea` — the draft, growing to three lines and then scrolling inside
  itself
- `Select` — the persona
- a send button

### Props

Both menus open upward, into the space above the bar: a menu dropping from this
row would land off the bottom of the viewport. The two selects wear the bar's
scale rather than the registry's, and their chevrons are hidden — a control sized
for a form is half again the height of this row, and the chevron says what the
border already says.

### Behavior

**The composer grows upward out of the row rather than making the row taller.**
The bar is a fixed band in the frame's grid, and a band that resized as someone
typed would reflow the whole work surface mid-sentence.

Focusing the composer opens [the Copilot's lens](../../inspector/copilot/home.md)
and expands the inspector if it is collapsed. Two calls deliberately: `inspect()`
records what is being looked at and `resize()` moves a panel, and folding the
second into the first would make every future caller of `inspect()` a layout
change.

Enter sends; Shift-Enter breaks the line. Nothing is dispatched — there is no
agent capability — so the message goes where it was addressed and the draft
clears.

**Send is blocked for a reason, never just greyed.** Two of them, and only two:
an empty draft, and a new conversation with nobody chosen to answer it. The
reason is the button's title, because "type something" and "choose who answers"
are different instructions and a dead button with no explanation is the version
of this that gets reported as a bug.

**Disabled on Research.** That screen is already a conversation with an agent,
and a second composer under it would be two ways to say the same thing. Research
records the same decision in its own centre; neither the bar nor `blocked` acts
on it yet, so this is the one line here that the built bar does not keep.

## You

What is addressed to you, and who you are.

**Example** — `@ 4` · "Ana Reyes"

### Structure

- a button carrying the unresolved mention count, with an at-sign
- a separator, then the viewer's name

### Props

The count is unresolved mentions, not all of them. A resolved mention is a thing
that happened rather than a thing that needs you.

### Behavior

**The count is a button because an unanswered mention is the one thing here worth
acting on.** It opens
[the mention lens](../../inspector/collaboration/mention.md).

It is the one place in the bar that raises its voice, and only when something is
actually waiting: at zero it is the same muted ink as everything else. A badge
that was always coloured would be a colour that means nothing.

This side is reserved for you — mentions, presence, whatever else is addressed to
a person rather than to the project.
