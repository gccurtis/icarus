# Status Bar

Lives at `src/lib/views/status-bar/status-bar.md`. Trees live in the concern
documents linked below.

## Purpose

The bar across the foot of the application. Three parts: what is on the work
surface, the Copilot, and what is waiting for you.

It reads the client model, coordinates two panels, and owns the one input that is
available from every screen — which is what makes it a view rather than a strip
of text.

## Why the Copilot is here and not floating

A dock hovering over the foot of the work surface covers the bottom of every
screen. It has to be translucent to be bearable, which makes the one
always-available input in the application also the hardest to read, and the
gutter around it has to be made non-hit-testable so it does not swallow clicks
meant for the work underneath.

A row of its own costs eight pixels more than the status bar already takes, and
covers nothing.

## Why the columns are the frame's columns

Left sits under the context panel, the composer under the work surface, right
under the inspector. The widths are read from `--app-context` and
`--app-inspector`, which the frame sets from the active tab — so the three parts
track the flanks as they are dragged, and the composer stays exactly as wide as
the thing it is talking about.

Thirds would be simpler and wrong: a composer centred over a layout it has
nothing to do with reads as a floating bar that happens to be at the bottom.

## Boundary

This view owns:

- the three-part division and its widths;
- the composer, its growth, and the two menus that open upward out of it;
- the decision to open the inspector when the composer is engaged;
- what counts as something waiting for you.

It does not own:

- what is inspected. It records `copilot.home`; the inspector decides what that
  looks like.
- the inspector's width. It opens a collapsed panel and leaves an open one at
  whatever width its user chose.
- anything the prompt does. No agent capability exists.
- the screen's name. That is on the tab, two rows up.

## Public Contract

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. It reads view state directly and is placed by the frame. |

- **Entry:** [`status-bar.svelte`](status-bar.svelte)
- **Types:** `None`

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$model/client` | `copilot`: mode, persona, draft, `focusRequests`, `blocked`; calls `setMode`, `selectPersona`, `write`, `sent` |
| `$model/client/view-state` | `active`, `frame`; calls `inspect` and `resize` |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `$mock-capabilities/naming` | `subject` — the name and kind behind an id |
| `$mock-capabilities/collaboration` | `mentionsForViewer` — what is addressed to you |
| `$mock-capabilities/cast` | `VIEWER` — who you are |

### Composed views

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | — | — |

### Presentation

| Dependency | Usage |
| --- | --- |
| `$lib/simple-components/select` | Mode and persona |
| `@lucide/svelte` | The submit glyph and the mention mark |
| Token domains: color, spacing, shape, typography | Every value |

## Directory Documents

No concern directories. Three parts, one form, and nothing to coordinate between
them.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Nothing open | The active tab has neither `resourceId` nor `focus` | Left reads "Nothing open" | — |
| On a thing | Either is set | Left reads its name and kind, or its id where the project does not know it | — |
| Nothing waiting | No unresolved mention | The count reads 0 in the muted ink | — |
| Waiting | An unresolved mention | The count takes the attention role — the one raised voice in the bar | Opens the mention lens |
| Grown | Prompt past one line | Up to three lines, then it scrolls inside itself | — |
| Loading | `None` | — | — |
| Failure | `None` | — | — |

Submitting clears the prompt and opens the Copilot's lens. Nothing is dispatched
— there is no agent capability — so a turn produces no reply, and the panel it
opens says so rather than pretending to wait.

## Accessibility

- **Landmark and accessible name:** a `contentinfo` landmark holding a form
  labelled "Copilot".
- **Initial focus:** none taken. A composer that grabbed focus on load would
  steal the first keystroke of every session.
- **Keyboard model:** tab order. Enter submits, Shift+Enter adds a line. Mode and
  persona carry the registry's own keyboard behaviour.
- **Announcements:** `None` yet. A reply arriving in the inspector needs one, and
  that belongs to the surface that renders replies.
- **Focus restoration:** engaging the composer must not destroy the selection
  that preceded it — an inspection is set only by an explicit call, never derived
  from focus, so the prior selection survives in the tab that owns it.

## Layout and Overflow

- **Parent constraints:** the frame's last grid row, 32px.
- **Responsive behavior:** below 60rem the two outer parts are dropped and the
  composer takes the whole row. What is on the surface and what is waiting are
  both reachable from the frame's own bars; the composer is not reachable
  anywhere else.
- **Scroll owner:** the composer, past three lines.
- **Minimum and maximum geometry:** the row is fixed at 32px and the composer
  stops growing at 66px, overflowing upward rather than resizing the row — a band
  that grew as someone typed would reflow the whole work surface mid-sentence.

## View Invariants

- **Opening and inspecting are two calls, not one.** `inspect()` records what the
  user is looking at and nothing else; a model method that also moved panels
  would make every future caller of `inspect()` a layout change.
- **It opens a collapsed panel and never resizes an open one.** A composer that
  resized the inspector each time it took focus would be fighting its user.
- **Left is about the work and right is about you.** A resource's state and a
  person's attention are different kinds of fact; a single run of chips across
  the bar would make them look like one kind.
- **One raised voice.** Only the unresolved-mention count takes a role colour.
  A status bar where three things are coloured has no status.
- **Mode and persona are the copilot model's, not this view's.** Neither survives
  a reload, and neither should until something can act on them.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
