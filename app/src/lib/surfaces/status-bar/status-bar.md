# Status Bar

Lives at `src/lib/surfaces/status-bar/status-bar.md`. Trees live in the concern
documents linked below.

## Purpose

The bar across the foot of the application. Two parts, at opposite ends: what is
on the work surface, and what is waiting for you.

It reads workspace state and reports. It takes no input and performs nothing,
which is what keeps it a line of status rather than a toolbar.

## Why the columns are the frame's columns

Left sits under the context panel and right under the inspector, with the work
surface's width between them. The widths are read from `--app-context` and
`--app-inspector`, which the frame sets from the active tab — so each end tracks
the flank it is under as that flank is dragged.

Halves would be simpler and wrong: the two ends would drift out from under the
panels they belong to the moment either was resized.

## Boundary

This view owns:

- the two-part division and its widths;
- what counts as something waiting for you.

It does not own:

- what is inspected. Nothing here sets an inspection.
- the panels' widths. It reads them and places itself against them.
- the category's name. That is on the tab, two rows up.

## Public Contract

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. It reads workspace state directly and is placed by the frame. |

- **Entry:** [`status-bar.svelte`](status-bar.svelte)
- **Types:** `None`

## Dependencies

### Client models

| Model | Usage |
| --- | --- |
| `$model/client/workspace-state` | `active` — the tab's `resourceId` and `focus` |

### Capabilities

| Capability | Usage |
| --- | --- |
| `$capabilities/store` | `read` — the row behind an id, through `procedures/resource-name.ts` |
| `$capabilities/development` | `username` — who you are, until authentication exists |

### Composed views

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | — | — |

### Presentation

| Dependency | Usage |
| --- | --- |
| Token domains: color, spacing, shape, typography | Every value |

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Procedures | [`resource-name.ts`](procedures/resource-name.ts) | What a row is called, and what word to call its kind |

Its own copy rather than the tab bar's: a surface is entered at its root, so
there is no path from here to `tab-bar/procedures/`.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Nothing open | The active tab has neither `resourceId` nor `focus` | Left reads "Nothing open" | — |
| On a thing | Either is set | Left reads its name and kind, or its id where the project does not know it | — |
| Nothing waiting | No unresolved mention | The count reads 0 in the muted ink | — |
| Waiting | An unresolved mention | The count takes the attention role — the one raised voice in the bar | Opens the mention lens |
| Loading | `None` | — | — |
| Failure | `None` | — | — |

## Accessibility

- **Landmark and accessible name:** a `contentinfo` landmark.
- **Initial focus:** none taken, and nothing here is focusable.
- **Keyboard model:** `None`. The bar holds no control.
- **Announcements:** `None` yet. Something arriving for you needs one, and that
  belongs with the surface that renders it.
- **Focus restoration:** `None`. Nothing here takes focus to restore.

## Layout and Overflow

- **Parent constraints:** the frame's last grid row, 32px — a height sized for
  the composer this bar used to hold, and left alone when it went.
- **Responsive behavior:** none. Both parts are a line of text and both stay.
- **Scroll owner:** neither part. The subject truncates with an ellipsis.
- **Minimum and maximum geometry:** the row is fixed at 32px and nothing in it
  can grow.

## View Invariants

- **It reports and never acts.** Nothing in the bar performs a command, opens a
  panel or records an inspection. A status bar with a control in it is a toolbar
  wearing the wrong name, and the one that used to be here — a composer that
  opened the inspector on focus — is what made the distinction worth writing down.
- **Left is about the work and right is about you.** A resource's state and a
  person's attention are different kinds of fact; a single run of chips across
  the bar would make them look like one kind.
- **One raised voice.** Only the unresolved-mention count takes a role colour.
  A status bar where three things are coloured has no status.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
