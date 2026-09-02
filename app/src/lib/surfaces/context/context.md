# Context Panel

Lives at `src/lib/surfaces/context/context.md`. Trees live in the
concern documents linked below.

## Purpose

The map. It answers "where am I, and what else is here?" — a fixed rail of
contexts on the inline edge, and whatever the chosen one shows beside it.

A **context** is a way of looking at what surrounds the active resource: its
outline, what it relates to, who commented on it. Never a mode of working. That
distinction is the whole reason for the name — a rail entry here answers "what
else is here?", where an activity bar's entry would answer "what am I doing?".

## Boundary

This view owns:

- the rail and its content, and the division between them;
- what each context id renders as, and its display copy;
- the rail's width, which is structural and never resizes — exported from
  [`types.ts`](types.ts) because the frame's column math needs it;
- one scroll context, in the content half.

It does not own:

- which contexts exist, which are offered, or which is selected. The model
  decides all three from the active tab's category.
- the panel's total width. That is a column in the frame, sized from the model.
- the bounds of a resize. Values are the model's, bounds belong to the drag that
  does not exist yet.

## Public Contract

- **Entry:** [`context.svelte`](context.svelte)
- **Types:** [`types.ts`](types.ts)

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| Export | `RAIL_WIDTH` | `number` | — | Pixels. The frame adds it to the model's content width to size this whole column, and it is what the flank collapses to. |
| Export | `MIN_WIDTH` | `number` | — | Narrowest visible width a drag may reach |
| Export | `MAX_WIDTH` | `number` | — | Widest |
| Export | `COLLAPSE_BELOW` | `number` | — | Drag inside this and the panel collapses instead of clamping |

It takes no props. Everything above is a **visible** width — rail included —
while the model stores the content portion only, because the rail is structural
and never resizes. The panel converts at that boundary so the arithmetic runs one
way: model plus rail equals visible, always.

The bounds are exported rather than kept private because the frame sizes the
column, and they match the inspector's, so both edges of the work surface behave
alike.

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$model/client/workspace-state` | `active`, `context`, `frame`, `railFor`; calls `selectContext` and `resize` |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `None` | — |

### Composed views

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | — | — |

### Presentation

| Dependency | Usage |
| --- | --- |
| `@lucide/svelte` | One icon per context |
| Token domains: color, spacing, shape, typography | Every value |

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Procedures | [procedures.md](procedures/procedures.md) | What each context view is called and which icon stands for it |

No components directory. The rail and the content half are twenty lines of
markup between them, and a context id names its own file — so there is nothing
here for a component to hold that the panel does not already say in one place.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | Always | The rail, one entry selected, and that entry's content | — |
| Collapsed | A drag inside `COLLAPSE_BELOW` | The rail alone, nothing selected-looking | Click any rail icon |
| Loading | `None` | — | — |
| Empty | `None` | — | — |
| Stale | `None` | — | — |
| Failure | `None` | — | — |
| Denied | `None` | — | — |

No unknown-context state. The model's `context` getter answers with a view the
active category offers, or that category's default when a remembered id has
drifted out of range, so there is no branch here for an id that does not resolve.

**What the rail offers changes with the active tab**, because `railFor` is keyed
by category. Project Overview offers four entries; a research thread offers
eight; Agents offers eleven. It does not change when the centre does — moving
from a library to the thing chosen in it is the same subject at closer range, and
a rail that emptied itself there would be answering a question nobody asked. That
is the most visible proof that this panel is a projection over workspace state
rather than a surface holding its own.

## Accessibility

- **Landmark and accessible name:** a `complementary` landmark named "Context".
- **Initial focus:** none taken.
- **Keyboard model:** tab order only. Each rail entry is an ordinary button.
  Arrow-key traversal along the rail is the obvious next step and is not built.
- **Announcements:** the selected entry carries `aria-current`; each entry is
  labelled with its context name, since the control shows only an icon.
- **Focus restoration:** `None` — selecting a context replaces the content beside
  the rail and leaves focus on the rail.

## Layout and Overflow

- **Parent constraints:** fills the frame's left column, whose width the frame
  sets from the model.
- **Responsive behavior:** the rail holds `RAIL_WIDTH`; the content half absorbs
  every change.
- **Scroll owner:** the content half, vertically. The rail never scrolls, so
  there is exactly one scroll context here — nesting a second inside a panel
  makes a scroll position unrecoverable.
- **Minimum and maximum geometry:** rail entries clear the 24px minimum target.
  Bounds on the panel's width belong to the drag that enforces them.

## View Invariants

- **The rail decides and the content displays.** They are split so the two can
  be reasoned about separately, and the rail reports a choice rather than
  resolving one.
- **Selection never rides on colour alone.** The tint is paired with a marker on
  the inline edge and with `aria-current`.
- **The rail table is total.** `Record<ContextId, RailEntry>` means a new context
  view fails to compile until it has a label and an icon. What it *shows* needs
  no entry at all: an id is a path, so the file is the registry.
- **The rail is one number.** `RAIL_WIDTH` sizes the rail and is what the frame
  adds to the model's content width; nothing restates it.
- **Collapsing never destroys the width.** A gesture that shuts the panel
  reports the width it began with, so reopening returns to the size the user
  chose. Reporting the pointer's position instead would remember the minimum
  every time, because every pixel between the minimum and the threshold clamps
  to the minimum.
- **Selecting a context always opens the panel**, and that is the whole
  uncollapse affordance — no arrow, no chevron. Choosing the context already
  showing is left alone rather than treated as a toggle, because closing a panel
  by clicking into it is a surprise and the edge already closes it.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
