# Top Bar

Lives at `src/lib/surfaces/top-bar/top-bar.md`. Trees live in the concern documents
linked below.

## Purpose

The band across the head of the application: the wordmark at one end, the theme
toggle at the other. It is the first rung of the disclosure ladder — always
visible, never route-dependent — so what sits here is what is true of the whole
application rather than of whatever is open.

## Why light and dark are chromatic themes

Celestial declares `color-scheme: light`; cyberpunk declares `color-scheme:
dark`. Every slot in `chromatic-themes/slots.css` is a `light-dark()`, so those
two declarations are the only place the polarity of the system is stated, and
one attribute on `<html>` re-aims all seven slots of all eleven ramps at once.

The light/dark axis is therefore carried by which chromatic theme is active.
This toggle names its ends `celestial` and `cyberpunk` and does nothing else.
A dark celestial would mean a second palette authored for a dark ground — the
cyberpunk file says plainly why a lightness-flipped light theme cannot give one
— and that is a design decision, not a switch.

## Why the choice lives in the component

A theme is about the page, not about the work. It survives no tab, coordinates
no sibling, and means nothing to the model that holds what is open, so keeping
it in the frame's own head is what stops appearance from becoming workbench
state. Persistence is the effect's, and the reader's browser is where it lands.

## Boundary

This view owns:

- the row's two ends and what occupies them;
- which theme is active, and the button that changes it;
- `data-theme` on the document root, and the `icarus.appearance` key beneath it.

It does not own:

- what any theme looks like. A theme declares ramps and a `color-scheme`;
  nothing here selects an intensity or names a colour.
- its position. It fills the wrapper the frame places, so it stays renderable
  outside the grid.
- the first paint. `app.html` carries the default attribute, so the document is
  themed before this view exists.
- anything a reader is working on. Nothing on this row is about the active tab.

## Public Contract

- **Entry:** [`top-bar.svelte`](top-bar.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. It is placed by the frame and reads its one piece of state out of browser storage. |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `None` | — |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `None` | — |

### Composed views

Views reached through their root component only.

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | — | — |

### Presentation

| Dependency | Usage |
| --- | --- |
| `@lucide/svelte` | The sun and the moon |
| Token domains: color, spacing, shape, typography | Every value |

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Effects | [effects.md](effects/effects.md) | Keeping `<html data-theme>` and browser storage in step with the choice |

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Light | Celestial is active | A sun, over "Switch to the dark theme" | The press |
| Dark | Cyberpunk is active | A moon, over "Switch to the light theme" | The press |
| Loading | `None` | — | — |
| Empty | `None` | — | — |
| Stale | `None` | — | — |
| Failure | `None` | — | — |
| Denied | `None` | — | — |

There is no unresolved state. A theme name that storage cannot supply — no key,
unreadable storage, a value outside the declared list — resolves to the default,
so the button always has an appearance to show and a destination to name.

## Accessibility

- **Landmark and accessible name:** a `banner` landmark, unnamed. One banner per
  document needs no name to be found.
- **Initial focus:** none taken. The head of the application is not where a
  session should begin.
- **Keyboard model:** tab order. The toggle is an ordinary button, so Enter and
  Space both press it, and the application's focus ring is the one every control
  carries.
- **Announcements:** `None`. The accessible name changes with the press, which
  is what tells a screen-reader user the theme took.
- **Focus restoration:** the button keeps focus through the swap. Nothing here
  mounts or unmounts, so a reader can press it twice without hunting for it
  again.

## Layout and Overflow

- **Parent constraints:** the frame's first grid row, 44px.
- **Responsive behavior:** the wordmark holds its size and the toggle holds the
  far end; the space between them absorbs every change in width.
- **Scroll owner:** nobody. The row holds two items and never fills.
- **Minimum and maximum geometry:** the height is the frame's. The toggle is
  sized by its glyph and its padding, which puts it above the 24px minimum a
  pointer target needs.

## View Invariants

- **The glyph is the state and the name is the action.** A button's accessible
  name has to say what pressing it does, and a glyph that showed the destination
  would put a moon on screen in the dark, beside every other surface already
  saying so.
- **One attribute carries the appearance.** `data-theme` on the document root is
  the whole mechanism; a view that painted its own dark variant would be a
  second answer to a question that has one.
- **The default is present before this view is.** The attribute is in
  `app.html`, so the page is never unthemed and a stored non-default costs one
  frame rather than a flash of unstyled colour.
- **Nothing on this row belongs to a tab.** What is on the work surface has two
  bars of its own beneath this one; a row that mixed the two would make the
  permanent look closeable.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
