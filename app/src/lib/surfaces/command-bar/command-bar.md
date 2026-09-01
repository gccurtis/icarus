# Command Bar

Lives at `src/lib/surfaces/command-bar/command-bar.md`. Trees live in the concern
documents linked below.

## Purpose

Every action this application can perform, by name. It is how a person finds
what they cannot see a button for, and how they learn what exists — which is why
a command that does not apply right now is greyed rather than hidden.

Named the command bar rather than the command palette because `--palette-*`
already means colour in this repository, and one word for two unrelated things
is how a vocabulary stops being worth having.

## Boundary

This view owns:

- what each command is **called** — its label, its description, and the words
  that find it in search;
- how a chord is rendered, including whether `$mod` shows as `⌘` or `Ctrl`;
- what a disabled row looks like, and that it is shown at all.

It does not own:

- whether it is open. `command-bar.open` is itself a command, so a chord has to
  reach the same state this view does — the model holds it.
- which commands exist, or whether one applies. Both are the model's.
- the keystroke that opens it. That is
  [the frame's effect](../app/effects/effects.md); this view never listens.

## Public Contract

- **Entry:** [`command-bar.svelte`](command-bar.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. It reads the model and renders; the frame places it once |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$runtime/client` | `commands.ids`, `enabled`, `bindingsFor`, `open`, `hide`, `run` |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `None` | — |

### Composed views

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | | |

### Presentation

| Dependency | Usage |
| --- | --- |
| `$lib/components/vendor/command` | The dialog, input, list, group, and items |
| `$lib/components/vendor/kbd` | One key per element in a chord |
| Token domains: color, typography, spacing | Label, description, and the chord row |

## Directory Documents

`components/`, `interactions/`, `effects/`, `shared/`, and `procedures/` are all
absent. The view is one component: it reads three values, maps a list, and
reports two intents.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Closed | `commands.open` is false | Nothing rendered | The chord, or the command |
| Open | `commands.open` is true | Every command, greyed where disabled | Escape, a click away, or a selection |
| Empty | A search matching no command | "No commands found." | Clear the input |
| Loading | `None` | — | — |
| Stale | `None` | — | — |
| Failure | `None` | — | — |
| Denied | `None` | — | — |

There is no failure state, because nothing here can fail. Every value it reads
is synchronous and total, and `run` is only ever called for a row this view has
already checked.

## Accessibility

- **Landmark and accessible name:** a dialog, named "Command bar" with a
  description. Both are visually hidden — the input's placeholder says the same
  thing to anyone who can see it.
- **Initial focus:** the input, which the dialog primitive moves focus to.
- **Keyboard model:** the list primitive's — arrows traverse, Enter selects,
  Escape closes. This view adds none of its own.
- **Announcements:** `None`.
- **Focus restoration:** the dialog primitive's. Focus returns to whatever held
  it before the bar opened.

Disabled rows carry `disabled`, so they are announced as unavailable rather than
merely looking grey. Colour is not the only thing saying so.

## Layout and Overflow

- **Parent constraints:** none. The frame renders it outside the grid, because
  it belongs to no zone.
- **Responsive behavior:** the dialog's own — centred, with a maximum width.
- **Scroll owner:** the list, which caps its height and scrolls within itself.
- **Minimum and maximum geometry:** the dialog primitive's.

## View Invariants

- **Every command is rendered.** `Record<CommandId, …>` is total, so a new
  command fails to compile until it has a label and a description. There is no
  fallback: a command nobody named would render as its own id, and an id is not
  English.
- **Disabled means greyed, never hidden.** The list is how a person learns what
  the application can do, and a row that appears only sometimes teaches nothing.
- **Enablement is read, never cached.** Each row reads `enabled(id)` inside a
  `$derived`, so the greying follows the workbench without a subscription.
- **This view never opens itself.** It reports `hide`, and something else
  reports open — otherwise a stray close could race the command that just ran.
- **An unbound command renders no chord**, rather than a placeholder. `tab.close`
  ships that way, so the empty case is the common one.

## Supporting Documents

| Document | Subject |
| --- | --- |
| [`docs/commands.md`](../../../../../docs/commands.md) | The command system's design, including the parts not built yet |
